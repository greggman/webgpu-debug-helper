import {
  openCommandEncoder,
  PassInfo,
  setBindGroup,
  validateEncoderState
} from './encoder-utils.js';
import {
  assertNotDestroyed,
  s_objToDevice,
} from './shared-state.js';
import {
  s_textureViewToTexture,
} from './texture.js';
import {
  bufferUsageToString,
} from './utils.js';
import {
  assert,
  emitError,
} from './validation.js';
import {
  wrapFunctionBefore,
} from './wrap-api.js';

type BufferWithOffsetAndSize = {
  buffer: GPUBuffer,
  offset: number,
  size: number,
};

type RenderPassInfo = PassInfo & {
  targetWidth: number,
  targetHeight: number,
  pipeline?: GPURenderPipeline,
  indexBuffer?: BufferWithOffsetAndSize,
  indexFormat?: GPUIndexFormat,
  vertexBuffers: (BufferWithOffsetAndSize | undefined)[],
};

const s_renderPassToPassInfoMap = new WeakMap<GPURenderPassEncoder, RenderPassInfo>();


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
  }

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

wrapFunctionBefore(GPURenderPassEncoder, 'draw', function(this: GPURenderPassEncoder, [vertexCount, instanceCount, firstVertex, firstInstance]) {
  const info = s_renderPassToPassInfoMap.get(this)!
  validateEncoderState(this, info.state);
  //
  //// validate vertex buffers
  //const desc = s_renderPipelineToRenderPipelineDescriptor.get(info.pipeline)
});

//wrapFunctionAfter(GPURenderPassEncoder, 'drawIndexed',  validateBindGroups);
//wrapFunctionAfter(GPURenderPassEncoder, 'drawIndirect',  validateBindGroups);
//wrapFunctionAfter(GPURenderPassEncoder, 'drawIndexedIndirect',  validateBindGroups);
//wrapFunctionAfter(GPURenderPassEncoder, 'executeBundles', function(this: GPURenderPassEncoder, _: void, [bundles]: [Iterable<GPURenderBundle>]) {
//  const state = s_passToState.get(this)!;
//  state.pipeline = undefined;
//  state.bindGroups.length = 0;
//});

wrapFunctionBefore(GPURenderPassEncoder, 'setBindGroup', function(this: GPURenderPassEncoder, [index, bindGroup, dynamicOffsets]) {
  const info = s_renderPassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  setBindGroup(info.commandEncoder, info.bindGroups, index, bindGroup, dynamicOffsets);
});

wrapFunctionBefore(GPURenderPassEncoder, 'setPipeline', function(this: GPURenderPassEncoder, [pipeline]) {
  const info = s_renderPassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  assert(s_objToDevice.get(info.commandEncoder) === s_objToDevice.get(pipeline), 'pipeline must be from same device as renderPassEncoder', [this, info.commandEncoder]);
  info.pipeline = pipeline;
});

wrapFunctionBefore(GPURenderPassEncoder, 'end', function(this: GPURenderPassEncoder) {
  const info = s_renderPassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  info.state = 'ended';
  openCommandEncoder(info.commandEncoder)!;
});

wrapFunctionBefore(GPURenderPassEncoder, 'setIndexBuffer', function(this: GPURenderPassEncoder, [buffer, format, offset, size]) {
  const info = s_renderPassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  const device = s_objToDevice.get(info.commandEncoder)!;
  offset = offset ?? 0;
  size = size ?? Math.max(0, buffer.size - offset);

  assert(device === s_objToDevice.get(buffer), 'buffer must be from the same device', [buffer, this]);
  assertNotDestroyed(buffer);
  assert(!!(buffer.usage & GPUBufferUsage.INDEX), () => `buffer(${bufferUsageToString(buffer.usage)}) must have usage INDEX`, [buffer, this]);
  const align =  format === 'uint16' ? 2 : 4;
  assert(offset % align === 0, () => `offset(${offset}) must be multiple of index format: ${format}`, [buffer, this]);
  assert(offset + size <= buffer.size, () => `offset(${offset}) + size(${size}) is not <= buffer.size(${buffer.size})`, [buffer, this]);

  info.indexBuffer = {
    buffer,
    offset,
    size,
  };
  info.indexFormat = format;
});

wrapFunctionBefore(GPURenderPassEncoder, 'setVertexBuffer', function(this: GPURenderPassEncoder, [slot, buffer, offset, size]) {
  const info = s_renderPassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  const device = s_objToDevice.get(info.commandEncoder)!;
  const maxSlot = device.limits.maxVertexBuffers;
  const bufferSize = buffer?.size || 0;
  offset = offset ?? 0;
  size = size ?? Math.max(0, bufferSize - offset);
  assert(slot >= 0, () => `slot(${slot}) must be >= 0`, [this]);
  assert(slot < maxSlot, () => `slot(${slot}) must be < device.limits.maxVertexBuffers(${maxSlot})`, [this]);
  assert(offset % 4 === 0, () => `offset(${offset}) must be multiple of 4`, [this]);
  assert(offset + size <= bufferSize, () => `offset(${offset}) + size(${size}) is not <= buffer.size(${bufferSize})`, [this, ...(buffer ? [buffer] : [])]);
  if (!buffer) {
    info.vertexBuffers[slot] = undefined;
  } else {
    assert(device === s_objToDevice.get(buffer), 'buffer must be from the same device', [buffer, this]);
    assertNotDestroyed(buffer);
    assert(!!(buffer.usage & GPUBufferUsage.VERTEX), () => `buffer(${bufferUsageToString(buffer.usage)}) must have usage VERTEX`, [buffer, this]);
    info.vertexBuffers[slot] = {
      buffer,
      offset,
      size,
    };
  }
});

wrapFunctionBefore(GPURenderPassEncoder, 'setViewport', function(this: GPURenderPassEncoder, [x, y, width, height, minDepth, maxDepth]: [number, number, number, number, number, number]) {
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

wrapFunctionBefore(GPURenderPassEncoder, 'setScissorRect', function(this: GPURenderPassEncoder, [x, y, width, height]: [number, number, number, number]) {
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

