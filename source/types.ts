export interface Interchange<T> {
    read: (id?: any) => Promise<T>;
    write: (value?: T) => Promise<T>;
}

interface InterchangeSource {
    read?: (id?: any) => any;
    readError?: (err?: Error) => ReadAction;
    write?: <T>(value: T) => T;
    writeMissingRead?: boolean;
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
    Throw = "throw"
}
