import {
  kAllTextureFormatInfo
} from './format-info.js';

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

export function unreachable(msg?: string): never {
  throw Error('unreachable');
}

export function roundUp(v: number, align: number) {
  return Math.ceil(v / align) * align;
}

export function reifyGPUOrigin3D(e: GPUOrigin3D) {
  e = e || [];
  const d = e as GPUOrigin3DDict;
  if (typeof d.x === 'number' || typeof d.y === 'number' || typeof d.z === 'number') {
    return [
      d.x ?? 0,
      d.y ?? 0,
      d.z ?? 0,
    ];
  }

  const a = [...(e as number[])];
  return [
    a[0] ?? 0,
    a[1] ?? 0,
    a[2] ?? 0,
  ];
}

export function reifyGPUExtent3D(e: GPUExtent3D) {
  const d = e as GPUExtent3DDict;
  if (typeof d.width === 'number') {
    return [
      d.width,
      d.height ?? 1,
      d.depthOrArrayLayers ?? 1,
    ];
  }

  const a = [...(e as number[])];
  return [
    a[0],
    a[1] ?? 1,
    a[2] ?? 1,
  ];
}

export function logicalMipLevelSpecificTextureExtent(texture: GPUTexture, mipLevel: number) {
  switch (texture.dimension) {
    case '1d':
      return [
        Math.max(1, texture.width >> mipLevel),
        1,
        1,
      ];
    case '2d':
      return [
        Math.max(1, texture.width >> mipLevel),
        Math.max(1, texture.height >> mipLevel),
        texture.depthOrArrayLayers,
      ];
    case '3d':
      return [
        Math.max(1, texture.width >> mipLevel),
        Math.max(1, texture.height >> mipLevel),
        Math.max(1, texture.depthOrArrayLayers >> mipLevel),
      ];
    default:
      unreachable();
  }
}

export function physicalMipLevelSpecificTextureExtent(texture: GPUTexture, mipLevel: number) {
  const {
    blockWidth,
    blockHeight,
  } = kAllTextureFormatInfo[texture.format];

  const [width, height, depthOrArrayLayers] = logicalMipLevelSpecificTextureExtent(texture, mipLevel);

  switch (texture.dimension) {
    case '1d':
      return [
        roundUp(width, blockWidth),
        1,
        1,
      ];
    case '2d':
    case '3d':
      return [
        roundUp(width, blockWidth),
        roundUp(height, blockHeight),
        depthOrArrayLayers,
      ];
    default:
      unreachable();
  }
}