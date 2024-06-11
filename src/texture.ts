import {
  wrapFunctionBefore,
  wrapFunctionAfter,
} from './wrap-api.js';

export type TextureViewDescriptor = {
  format: GPUTextureFormat;
  dimension: GPUTextureViewDimension;
  aspect: GPUTextureAspect;
  baseMipLevel: GPUIntegerCoordinate;
  mipLevelCount: GPUIntegerCoordinate;
  baseArrayLayer: GPUIntegerCoordinate;
  arrayLayerCount: GPUIntegerCoordinate;
};
export const s_textureViewToTexture = new WeakMap<GPUTextureView, GPUTexture>();
export const s_textureViewToDesc = new WeakMap<GPUTextureView, TextureViewDescriptor>();

function reifyTextureViewDescriptor(texture: GPUTexture, desc: GPUTextureViewDescriptor | undefined): TextureViewDescriptor {
  const {
    format = texture.format,
    dimension = texture.dimension === '2d'
      ? (texture.depthOrArrayLayers === 1 ? '2d' : '2d-array')
      : texture.dimension,
    aspect = 'all',
    baseMipLevel = 0,
    mipLevelCount = texture.mipLevelCount,
    baseArrayLayer = 0,
    arrayLayerCount = texture.depthOrArrayLayers,
  } = desc || {};
  return {
    format, dimension, aspect, baseMipLevel, mipLevelCount, baseArrayLayer, arrayLayerCount,
  };
}

let lastDesc: GPUTextureViewDescriptor | undefined;
wrapFunctionBefore(GPUTexture, 'createView', function (this: GPUTexture, [desc]) {
  lastDesc = desc;
});

wrapFunctionAfter(GPUTexture, 'createView', function (this: GPUTexture, view: GPUTextureView) {
  s_textureViewToTexture.set(view, this);
  s_textureViewToDesc.set(view, reifyTextureViewDescriptor(this, lastDesc));
});
