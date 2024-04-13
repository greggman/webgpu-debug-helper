import {
  RenderDrawInfo,
  wrapRenderCommandsMixin,
} from './render-commands-mixin.js';

type BundleEncoderInfo = RenderDrawInfo & {
  desc: GPURenderBundleDescriptor,
};

const s_bundleEncoderToPassInfoMap = new WeakMap<GPURenderBundleEncoder, BundleEncoderInfo>();

wrapRenderCommandsMixin(GPURenderBundleEncoder, s_bundleEncoderToPassInfoMap);

export function createRenderBundleEncoder(encoder: GPURenderBundleEncoder, desc: GPURenderBundleDescriptor) {
  s_bundleEncoderToPassInfoMap.set(encoder, {
    state: 'open',  // this is not needed. should we move it?
    desc: {...desc},
    vertexBuffers: [],
    bindGroups: [],
  });
}
