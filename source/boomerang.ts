export const BOOMERANG_RETURN = Symbol();

/**
 * Iterate over an array and return when a certain point is met
 *  - Asynchronously iterate over an array of items until the
 *  return symbol is returned, which causes the boomerang to
 *  walk backwards over the list again
 */
export async function boomerang<B>(
    arr: Array<B>,
    cb: (item: B, index: number, backwards?: boolean) => Promise<void | Symbol>
): Promise<void> {
    let shouldReturn = false,
        returnIndex: number;
    for (let ind = 0; ind < arr.length; ind += 1) {
        let ret = await cb(arr[ind], ind, false);
        if (ret === BOOMERANG_RETURN) {
            shouldReturn = true;
            returnIndex = ind - 1;
            break;
        }
    }
    if (shouldReturn && returnIndex >= 0) {
        for (let ind = returnIndex; ind >= 0; ind -= 1) {
            await cb(arr[ind], ind, true);
        }
    }
}
