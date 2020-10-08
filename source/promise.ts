export function isPromise(val: any): boolean {
    return !!val && typeof val === "object" && typeof val.then === "function";
}
