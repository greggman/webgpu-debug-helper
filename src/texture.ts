import {
  getDepthStencilFormatResolvedAspect,
} from './format-info.js';
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

function resolveTextureAspect(format: GPUTextureFormat, aspect: GPUTextureAspect) {
  switch (aspect) {
    case 'all':
      return format;
    case 'depth-only':
    case 'stencil-only':
      return getDepthStencilFormatResolvedAspect(format, aspect);
  }
  return undefined;
}

function reifyTextureViewDescriptor(texture: GPUTexture, desc: GPUTextureViewDescriptor | undefined): TextureViewDescriptor {
  const dimension = desc?.dimension ?? (
      texture.dimension === '2d'
        ? (texture.depthOrArrayLayers === 1 ? '2d' : '2d-array')
        : texture.dimension
      );
  const aspect = desc?.aspect ?? 'all';
  let format = desc?.format;
  if (!format) {
    const f = resolveTextureAspect(texture.format, aspect);
    format = f ?? texture.format;
  }
  return {
    format,
    dimension,
    aspect,
    baseMipLevel: desc?.baseMipLevel ?? 0,
    mipLevelCount: desc?.mipLevelCount ?? (texture.mipLevelCount - (desc?.baseMipLevel ?? 0)),
    baseArrayLayer: desc?.baseArrayLayer ?? 0,
    arrayLayerCount: desc?.arrayLayerCount ?? (
      dimension === 'cube'
        ? 6
        : (dimension === '2d-array' || dimension === 'cube-array'
           ? texture.depthOrArrayLayers - (desc?.baseArrayLayer ?? 0)
           : 1
          )
      ),
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
