import {
  wrapBindingCommandsMixin,
} from './binding-mixin.js';
import {
  unlockCommandEncoder,
  validateEncoderState,
} from './encoder-utils.js';
import {
  createRenderPassLayout,
} from './pipeline.js';
import {
  getRenderPassLayoutForRenderBundle
} from './render-bundle-encoder.js';
import {
  RenderDrawInfo,
  RenderPassLayoutInfo,
  wrapRenderCommandsMixin,
} from './render-commands-mixin.js';
import {
  assertNotDestroyed,
  s_objToDevice,
} from './shared-state.js';
import {
  s_textureViewToTexture,
} from './texture.js';
import {
  trimNulls,
} from './utils.js';
import {
  assert,
  emitError,
} from './validation.js';
import {
  wrapFunctionBefore,
} from './wrap-api.js';

type RenderPassInfo = RenderDrawInfo & {
  commandEncoder: GPUCommandEncoder,
  targetWidth: number,
  targetHeight: number,
  passLayoutInfo: RenderPassLayoutInfo,
};

const s_renderPassToPassInfoMap = new WeakMap<GPURenderPassEncoder, RenderPassInfo>();

function getRenderPassLayout(passEncoder: GPURenderPassEncoder): RenderPassLayoutInfo {
  return s_renderPassToPassInfoMap.get(passEncoder)!.passLayoutInfo;
}

wrapRenderCommandsMixin(GPURenderPassEncoder, s_renderPassToPassInfoMap, getRenderPassLayout);

export function beginRenderPass(commandEncoder: GPUCommandEncoder, passEncoder: GPURenderPassEncoder, desc: GPURenderPassDescriptor) {
  let targetWidth: number | undefined;
  let targetHeight: number | undefined;
  const device = s_objToDevice.get(commandEncoder);

  const colorFormats: (GPUTextureFormat | null)[] = [];
  let passSampleCount = 1;
  let depthStencilFormat: GPUTextureFormat | undefined;

  const addView = (attachment: GPURenderPassColorAttachment | GPURenderPassDepthStencilAttachment | null | undefined, isDepth?: boolean) => {
    if (!attachment) {
      if (!isDepth) {
        colorFormats.push(null);
      }
      return;
    }
    const {view} = attachment;
    const texture = s_textureViewToTexture.get(view)!;
    assertNotDestroyed(texture);
    assert(s_objToDevice.get(texture) === device, 'texture is not from same device as command encoder', [texture, commandEncoder]);
    const {width, height, sampleCount, format} = texture;
    if (isDepth) {
      depthStencilFormat = format;
    } else {
      colorFormats.push(format);
    }
    passSampleCount = sampleCount;
    if (targetWidth === undefined) {
      targetWidth = width;
      targetHeight = height;
    } else if (targetWidth !== width || targetHeight !== height) {
      emitError('attachments are not all the same width and height', [view, texture, passEncoder, commandEncoder]);
    }
  };

  for (const colorAttachment of desc.colorAttachments || []) {
      addView(colorAttachment);
  }

  addView(desc.depthStencilAttachment, true);

  assert(targetWidth !== undefined, 'render pass targets width is undefined', [passEncoder]);
  assert(targetHeight !== undefined, 'render pass targets height is undefined', [passEncoder]);

  const renderPassLayout = createRenderPassLayout(
    trimNulls(colorFormats),
    passSampleCount,
    depthStencilFormat);

  s_renderPassToPassInfoMap.set(passEncoder, {
    state: 'open',
    commandEncoder,
    targetWidth,
    targetHeight,
    vertexBuffers: [],
    bindGroups: [],
    passLayoutInfo: {
      renderPassLayout,
      passLayoutSignature: JSON.stringify(renderPassLayout),
    },
  });
}

wrapFunctionBefore(GPURenderPassEncoder, 'executeBundles', function (this: GPURenderPassEncoder, [bundles]) {
  const info = s_renderPassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  const device = s_objToDevice.get(this)!;

  let bundleCount = 0;
  for (const bundle of bundles) {
    assert(s_objToDevice.get(bundle) === device, () => 'bundle[${count} is not from same device as render pass encoder', [bundle]);
    const count = bundleCount;
    const bundleDesc = getRenderPassLayoutForRenderBundle(bundle)!;
    const passLayoutInfo = getRenderPassLayout(this);
    assert(bundleDesc.passLayoutInfo.passLayoutSignature === passLayoutInfo.passLayoutSignature,
           () => `bundle[${count}] is not compatible with ${this.constructor.name}

${this.constructor.name} expects ${JSON.stringify(passLayoutInfo.renderPassLayout, null, 2)}

bundle is: ${JSON.stringify(bundleDesc.passLayoutInfo.renderPassLayout, null, 2)}
`,
      [bundle, this],
    );
    ++bundleCount;
  }

  info.bindGroups.length = 0;
  info.pipeline = undefined;
  info.indexBuffer = undefined;
  info.indexFormat = undefined;
  info.vertexBuffers.length = 0;
});

wrapBindingCommandsMixin(GPURenderPassEncoder, s_renderPassToPassInfoMap);

wrapFunctionBefore(GPURenderPassEncoder, 'end', function (this: GPURenderPassEncoder) {
  const info = s_renderPassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  info.state = 'ended';
  unlockCommandEncoder(info.commandEncoder)!;
});

wrapFunctionBefore(GPURenderPassEncoder, 'setViewport', function (this: GPURenderPassEncoder, [x, y, width, height, minDepth, maxDepth]: [number, number, number, number, number, number]) {
  const info = s_renderPassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  const {
    targetWidth,
    targetHeight,
  } = info;

  assert(x >= 0, () => `x(${x}) < 0`, [this]);
  assert(y >= 0, () => `y(${y}) < 0`, [this]);
  assert(x + width <= targetWidth, () => `x(${x}) + width(${width}) > texture.width(${targetWidth})`, [this]);
  assert(y + height <= targetHeight, () => `y(${x}) + height(${height}) > texture.height(${targetHeight})`, [this]);
  assert(minDepth >= 0 && minDepth <= 1.0, () => `minDepth(${minDepth}) must be >= 0 and <= 1`);
  assert(maxDepth >= 0 && maxDepth <= 1.0, () => `maxDepth(${maxDepth}) must be >= 0 and <= 1`);
  assert(minDepth < maxDepth, () => `minDepth(${minDepth}) must be < maxDepth(${maxDepth})`);
});

wrapFunctionBefore(GPURenderPassEncoder, 'setScissorRect', function (this: GPURenderPassEncoder, [x, y, width, height]: [number, number, number, number]) {
  const info = s_renderPassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  const {
    targetWidth,
    targetHeight,
  } = info;
  assert(x >= 0, () => `x(${x}) < 0`, [this]);
  assert(y >= 0, () => `y(${y}) < 0`, [this]);
  assert(x + width <= targetWidth, () => `x(${x}) + width(${width}) > texture.width(${targetWidth})`, [this]);
  assert(y + height <= targetHeight, () => `y(${x}) + height(${height}) > texture.height(${targetHeight})`, [this]);
});

