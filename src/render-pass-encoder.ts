import {
  wrapBindingCommandsMixin,
} from './binding-mixin.js';
import {
  unlockCommandEncoder,
  validateEncoderState,
} from './encoder-utils.js';
import {
  RenderDrawInfo,
  wrapRenderCommandsMixin,
} from './render-commands-mixin.js';
import {
  assertNotDestroyed,
} from './shared-state.js';
import {
  s_textureViewToTexture,
} from './texture.js';
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
};

const s_renderPassToPassInfoMap = new WeakMap<GPURenderPassEncoder, RenderPassInfo>();

wrapRenderCommandsMixin(GPURenderPassEncoder, s_renderPassToPassInfoMap);

export function beginRenderPass(commandEncoder: GPUCommandEncoder, passEncoder: GPURenderPassEncoder, desc: GPURenderPassDescriptor) {
  let targetWidth: number | undefined;
  let targetHeight: number | undefined;

  const addView = (attachment: GPURenderPassColorAttachment | GPURenderPassDepthStencilAttachment | null | undefined) => {
    if (!attachment) {
      return;
    }
    const {view} = attachment;
    const texture = s_textureViewToTexture.get(view)!;
    assertNotDestroyed(texture);
    const {width, height} = texture;
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

  addView(desc.depthStencilAttachment);

  assert(targetWidth !== undefined, 'render pass targets width is undefined', [passEncoder]);
  assert(targetHeight !== undefined, 'render pass targets height is undefined', [passEncoder]);

  s_renderPassToPassInfoMap.set(passEncoder, {
    state: 'open',
    commandEncoder,
    targetWidth,
    targetHeight,
    vertexBuffers: [],
    bindGroups: [],
  });
}

wrapFunctionBefore(GPURenderPassEncoder, 'executeBundles', function (this: GPURenderPassEncoder) {
  const info = s_renderPassToPassInfoMap.get(this)!;
  info.bindGroups.length = 0;
  info.pipeline = undefined;
  info.indexBuffer = undefined;
  info.indexFormat = undefined;
  info.vertexBuffers.length = 0;
  // TODO: validate bundle stuff
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

