/**
 * Adds a wrapper function to a class method that gets called before the actual function
 */
export function wrapFunctionBefore<K extends PropertyKey, T extends Record<K, (...args: Parameters<T[K]>) => any>>(
    API: { prototype: T },
    fnName: K, fn: (args: Parameters<T[K]>) => void) {
  const origFn = API.prototype[fnName];
  API.prototype[fnName] = function (this: T, ...args: Parameters<T[K]>) {
    fn.call(this, args);
    return origFn.call(this, ...args);
  } as any;
}

/**
 * Adds a wrapper function to a class method that gets called after the actual function
 */
export function wrapFunctionAfter<K extends PropertyKey, T extends Record<K, (...args: Parameters<T[K]>) => any>>(
    API: { prototype: T },
    fnName: K, fn: (obj: ReturnType<T[K]>, args: Parameters<T[K]>) => void) {
  const origFn = API.prototype[fnName];
  API.prototype[fnName] = function (this: T, ...args: Parameters<T[K]>) {
    const result = origFn.call(this, ...args);
    fn.call(this, result, args);
    return result;
  } as any;
}

/**
 * Adds a wrapper function to an async class method that gets called after the actual function
 */
export function wrapAsyncFunctionAfter<K extends PropertyKey, T extends Record<K, (...args: Parameters<T[K]>) => any>>(
    API: { prototype: T },
    fnName: K, fn: (obj: Awaited<ReturnType<T[K]>>, args: Parameters<T[K]>) => void) {
  const origFn = API.prototype[fnName];
  API.prototype[fnName] = async function (this: T, ...args: Parameters<T[K]>) {
    const result = await origFn.call(this, ...args);
    fn.call(this, result, args);
    return result;
  } as any;
}