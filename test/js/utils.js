import {it} from '../mocha-support.js';

function saveFunctionsOfClass(obj) {
  const desc = Object.getOwnPropertyDescriptors(obj);
  return Object.entries(desc)
      .filter(([, {writable, enumerable, configurable}]) =>
        writable && enumerable && configurable && typeof value === 'function');
}

function restoreFunctionsOfClass(obj, funcEntries) {
  for (const [name, props] of funcEntries) {
    obj[name] = props.value;
  }
}

export function saveFunctionsOfClasses(classes) {
  return classes.map(c => {
    return [c, saveFunctionsOfClass(c.prototype)];
  });
}

export function restoreFunctionsOfClasses(savedClasses) {
  for (const [c, savedFuncs] of savedClasses) {
    restoreFunctionsOfClass(c.prototype, savedFuncs);
  }
}

function bitmaskToString(bitNames/*: Record<string, number>*/, mask/*: number*/) {
  const names = [];
  for (const [k, v] of Object.entries(bitNames)) {
    if (mask & v) {
      names.push(k);
    }
  }
  return names.join('|');
}

export function bufferUsageToString(mask/*: number*/) {
  return bitmaskToString(GPUBufferUsage/* as unknown as Record<string, number>*/, mask);
}

export function textureUsageToString(mask/*: number*/) {
  return bitmaskToString(GPUTextureUsage/* as unknown as Record<string, number>*/, mask);
}

export async function expectValidationError(expectError, fn) {
  let error = false;
  try {
    await fn();
  } catch (e) {
    error = e;
  }
  if (expectError) {
    if (!error) {
      throw new Error('expected error, no error thrown');
    }
    if (expectError instanceof RegExp) {
      if (!expectError.test(error)) {
        throw new Error(`expected error to match /${expectError}/ but was ${error}`);
      }
    } else if (typeof expectError === 'string') {
      if (!error.toString().includes(expectError)) {
        throw new Error(`expected error to contain '${expectError}' but was ${error}`);
      }
    }
  } else {
    if (error) {
      throw error;
    }
  }
}

export function itWithDevice(desc, fn) {
  it.call(this, desc, async () => {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    await fn.call(this, device);
    device.destroy();
  });
}

export function makeExposedPromise() {
  const p = {};
  p.promise = new Promise((resolve, reject) => {
    p.resolve = resolve;
    p.reject = reject;
  });
  return p;
}