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
  } else {
    if (error) {
      throw error;
    }
  }
}