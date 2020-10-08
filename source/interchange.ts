import { Layerr } from "layerr";
import { isPromise } from "./promise";
import { BOOMERANG_RETURN, boomerang } from "./boomerang";
import { createQueue, enqueue } from "./queue";
import {
    Interchange,
    InterchangeOptions,
    InterchangeSourceAuxiliary,
    InterchangeSourcePrimary,
    ReadAction,
    WriteMode
} from "./types";

export type Sources<T> = [InterchangeSourcePrimary<T>, ...InterchangeSourceAuxiliary[]];

const UNDEFINED = "undefined";
const VALUE_NOOP = <T>(val: T): T => val;

export function createInterchange<T>(
    sources: Sources<T>,
    options: InterchangeOptions = {}
): Interchange<T> {
    options.queue = options.queue || createQueue();
    return {
        read: (id: any): Promise<T> => processRead(sources, id, options),
        write: (value: T): Promise<T> => processWrite(sources, value, options)
    };
}

async function processRead<T>(
    sources: Sources<T>,
    id: any,
    options: InterchangeOptions = {}
): Promise<T> {
    let lastValue: any,
        lastConverters: [(val: any) => any, (val: any) => any] = null;
    await boomerang(sources, async (source, sourceIndex, returning) => {
        const {
            read = null,
            readError = () => ReadAction.Throw,
            write = null,
            writeMissingRead = true
        } = source;
        // Prepare value-conversion functions
        let convertRead = VALUE_NOOP,
            convertWrite = VALUE_NOOP;
        if (typeof (<InterchangeSourceAuxiliary>source).convert === "object") {
            const { read: tempRead, write: tempWrite } = (<InterchangeSourceAuxiliary>(
                source
            )).convert;
            convertRead = tempRead || convertRead;
            convertWrite = tempWrite || convertWrite;
        }
        // Check if rolling back up the chain (boomerang)
        if (returning) {
            const [returnConvertRead] = lastConverters;
            // Convert value to next item format UP the chain
            lastValue = returnConvertRead(lastValue);
            lastConverters = [convertRead, convertWrite];
            // Because all prior indexes (sources) did NOT
            // return a value, they should be written to
            if (writeMissingRead && typeof write === "function") {
                let writeResult = source.queueWriteKey
                    ? enqueue(options.queue, resolveQueueKey(lastValue, source.queueWriteKey), () =>
                          write(lastValue)
                      )
                    : write(lastValue);
                if (isPromise(writeResult)) {
                    writeResult = await writeResult;
                }
                lastValue = typeof writeResult === UNDEFINED ? lastValue : writeResult;
            }
            return;
        }
        // Attempt to read
        if (typeof read === "function") {
            let initialValue: any;
            try {
                initialValue = source.queueReadKey
                    ? enqueue(options.queue, resolveQueueKey(id, source.queueReadKey), () =>
                          read(id)
                      )
                    : read(id);
                if (isPromise(initialValue)) {
                    initialValue = await initialValue;
                }
            } catch (err) {
                const action: ReadAction = readError(err);
                if (action === ReadAction.Throw) {
                    throw new Layerr(err, "Interchange read error");
                } else if (action === ReadAction.Fallback && sourceIndex === sources.length - 1) {
                    throw new Layerr(err, "Interchange fallback requested, but none available");
                }
            }
            lastValue = initialValue;
            lastConverters = [convertRead, convertWrite];
            if (typeof initialValue !== UNDEFINED) {
                return BOOMERANG_RETURN;
            }
        }
    });
    return lastValue;
}

function resolveQueueKey(value: any, resolver: string | ((value: any) => string)): string {
    return typeof resolver === "string" ? resolver : resolver(value);
}

async function processWrite<T>(
    sources: Sources<T>,
    value: T,
    options: InterchangeOptions = {}
): Promise<T> {
    const { writeMode = WriteMode.Series } = options;
    if (writeMode === WriteMode.Parallel) {
        // All sources are written with the same value in parallel
        await Promise.all(
            sources.map(async source => {
                const { writeWait = true } = source;
                if (typeof source.write !== "function") return;
                const result = source.queueWriteKey
                    ? enqueue(options.queue, resolveQueueKey(value, source.queueWriteKey), () =>
                          source.write(value)
                      )
                    : source.write(value);
                if (writeWait && isPromise(result)) {
                    await result;
                }
            })
        );
        return value;
    } else if (writeMode === WriteMode.Series) {
        // Run from first to last, converting, and then backwards
        // writing each value
        let lastValue = value;
        const values = sources.map((source, ind) => {
            if (ind === 0) return value;
            const { convert = {} } = source as InterchangeSourceAuxiliary;
            const { write = VALUE_NOOP } = convert;
            lastValue = write(lastValue);
            return lastValue;
        });
        // Run backwards writing
        lastValue = values[values.length - 1];
        for (let ind = sources.length - 1; ind >= 0; ind -= 1) {
            const { queueWriteKey, write, writeWait = true } = sources[ind];
            if (typeof write !== "function") continue;
            const writeResult = queueWriteKey
                ? enqueue(options.queue, resolveQueueKey(lastValue, queueWriteKey), () =>
                      write(lastValue)
                  )
                : write(lastValue);
            if (writeWait) {
                lastValue = isPromise(writeResult) ? await writeResult : writeResult;
                if (ind > 0) {
                    const { convert = {} } = sources[ind] as InterchangeSourceAuxiliary;
                    const { read = VALUE_NOOP } = convert;
                    // Convert this value
                    lastValue = read(lastValue);
                }
            } else {
                // Not waiting, so set the lastValue to be the
                // correct pre-calculated value
                if (ind > 0) {
                    lastValue = values[ind - 1];
                } else {
                    // First index
                    lastValue = values[0];
                }
            }
        }
        return lastValue;
    } else {
        throw new Layerr(`Invalid write mode: ${writeMode}`);
    }
}
