import {
  wrapBindingCommandsMixin
} from './binding-mixin.js';
import {
  validateEncoderState,
} from './encoder-utils.js';
import {
  RenderDrawInfo,
  wrapRenderCommandsMixin,
} from './render-commands-mixin.js';
import {
  wrapFunctionBefore,
} from './wrap-api.js';

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

wrapBindingCommandsMixin(GPURenderBundleEncoder, s_bundleEncoderToPassInfoMap);

wrapFunctionBefore(GPURenderBundleEncoder, 'finish', function (this: GPURenderBundleEncoder) {
  const info = s_bundleEncoderToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  info.state = 'ended';
});