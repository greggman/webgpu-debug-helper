function saveFunctionsOfClass(obj) {
  const desc = Object.getOwnPropertyDescriptors(obj);
  return Object.entries(desc)
      .filter(([name, {writable, enumerable, configurable}]) => writable && enumerable && configurable && typeof value === 'function')
}

function restoreFunctionsOfClass(obj, funcEntries) {
  for (const [name, props] of funcEntries) {
    obj[name] = props.value;
  }
}

function saveFunctionsOfClasses(classes) {
  return classes.map(c => {
    return [c, saveFunctionsOfClass(c.prototype)];
  });
}

function restoreFunctionsOfClasses(savedClasses) {
  for (const [c, savedFuncs] of savedClasses) {
    restoreFunctionsOfClass(c.prototype, savedFuncs);
  }
}
