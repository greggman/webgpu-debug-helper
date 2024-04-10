
function bitmaskToString(bitNames: Record<string, number>, mask: number) {
  const names = [];
  for (const [k, v] of Object.entries(bitNames)) {
    if (mask & v) {
      names.push(k);
    }
  }
  return names.join('|');
}

export function bufferUsageToString(mask: number) {
  return bitmaskToString(GPUBufferUsage as unknown as Record<string, number>, mask);
}

export function textureUsageToString(mask: number) {
  return bitmaskToString(GPUTextureUsage as unknown as Record<string, number>, mask);
}
