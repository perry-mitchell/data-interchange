import * as ChannelQueue from "@buttercup/channel-queue";

export interface Interchange<T> {
    read: (id?: any) => Promise<T>;
    write: (value?: T) => Promise<T>;
}

export interface InterchangeOptions {
    queue?: ChannelQueue;
    writeMode?: WriteMode;
}

interface InterchangeSource {
    queueReadKey?: string | ((id?: any) => string);
    queueWriteKey?: string | ((value: any) => string);
    read?: (id?: any) => any;
    readError?: (err?: Error) => ReadAction;
    readResult?: (result?: any) => ReadAction;
    write?: <T>(value: T) => T;
    writeMissingRead?: boolean;
    writeWait?: boolean;
}
export interface InterchangeSourcePrimary<T> extends InterchangeSource {
    read?: (id?: any) => T | Promise<T>;
}
export interface InterchangeSourceAuxiliary extends InterchangeSource {
    convert?: {
        read?: (value: any) => any;
        write?: (value: any) => any;
    };
}

export enum ReadAction {
    Fallback = "fallback",
    Return = "return",
    Throw = "throw"
}

export enum WriteMode {
    Parallel,
    Series
}
