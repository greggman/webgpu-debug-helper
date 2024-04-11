import {
  wrapFunctionAfter,
} from './wrap-api.js';

export const s_textureViewToTexture = new WeakMap<GPUTextureView, GPUTexture>();

wrapFunctionAfter(GPUTexture, 'createView', function (this: GPUTexture, view: GPUTextureView) {
  s_textureViewToTexture.set(view, this);
});
