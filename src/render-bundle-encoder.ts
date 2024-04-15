import {
  wrapBindingCommandsMixin
} from './binding-mixin.js';
import {
  validateEncoderState,
} from './encoder-utils.js';
import { createRenderPassLayout } from './pipeline.js';
import {
  RenderDrawInfo,
  RenderPassLayoutInfo,
  wrapRenderCommandsMixin,
} from './render-commands-mixin.js';
import {
  trimNulls,
} from './utils.js';
import {
  wrapFunctionBefore,
} from './wrap-api.js';

type BundleEncoderInfo = RenderDrawInfo & {
  desc: GPURenderBundleDescriptor,
  passLayoutInfo: RenderPassLayoutInfo,
};

const s_bundleEncoderToPassInfoMap = new WeakMap<GPURenderBundleEncoder, BundleEncoderInfo>();

function getRenderPassLayout(bundleEncoder: GPURenderBundleEncoder): RenderPassLayoutInfo {
  return s_bundleEncoderToPassInfoMap.get(bundleEncoder)!.passLayoutInfo;
}

wrapRenderCommandsMixin(
  GPURenderBundleEncoder,
  s_bundleEncoderToPassInfoMap,
   getRenderPassLayout,
);

export function createRenderBundleEncoder(encoder: GPURenderBundleEncoder, desc: GPURenderBundleEncoderDescriptor) {
  const { sampleCount = 1, depthStencilFormat, colorFormats } = desc;
  const renderPassLayout = createRenderPassLayout(
    trimNulls([...colorFormats]),
    sampleCount,
    depthStencilFormat);
  s_bundleEncoderToPassInfoMap.set(encoder, {
    state: 'open',  // this is not needed. should we move it?
    desc: {...desc},
    vertexBuffers: [],
    bindGroups: [],
    passLayoutInfo: {
      renderPassLayout,
      passLayoutSignature: JSON.stringify(renderPassLayout),
    },
  });
}

wrapBindingCommandsMixin(GPURenderBundleEncoder, s_bundleEncoderToPassInfoMap);

wrapFunctionBefore(GPURenderBundleEncoder, 'finish', function (this: GPURenderBundleEncoder) {
  const info = s_bundleEncoderToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  info.state = 'ended';
});