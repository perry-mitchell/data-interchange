import { Layerr } from "layerr";
import { isPromise } from "./promise";
import { BOOMERANG_RETURN, boomerang } from "./boomerang";
import { Interchange, InterchangeSourceAuxiliary, InterchangeSourcePrimary, ReadAction } from "./types";

export type Sources<T> = [
    InterchangeSourcePrimary<T>,
    ...InterchangeSourceAuxiliary[]
];

const UNDEFINED = "undefined";
const VALUE_NOOP = <T>(val: T): T => val;

export function createInterchange<T>(
    sources: Sources<T>
): Interchange<T> {
    return {
        read: (id: any): Promise<T> => processRead(sources, id),
        write: () => null
    };
}

async function processRead<T>(sources: Sources<T>, id: any): Promise<T> {
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
        if (typeof (<InterchangeSourceAuxiliary> source).convert === "object") {
            const {
                read: tempRead,
                write: tempWrite
            } = (<InterchangeSourceAuxiliary> source).convert;
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
                let writeResult = write(lastValue);
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
                initialValue = read(id);
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
