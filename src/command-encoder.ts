import {
  beginComputePass,
} from './compute-pass-encoder.js';
import {
  lockCommandEncoder,
  finishCommandEncoder,
  getCommandBufferInfoAndValidateState,
} from './encoder-utils.js';
import {
  beginRenderPass,
} from './render-pass-encoder.js';
import { assertNotDestroyed, s_objToDevice } from './shared-state.js';
import { bufferUsageToString } from './utils.js';
import { assert } from './validation.js';
import {
  wrapFunctionAfter,
  wrapFunctionBefore,
} from './wrap-api.js';

wrapFunctionAfter(GPUCommandEncoder, 'beginComputePass', function(this: GPUCommandEncoder, passEncoder: GPUComputePassEncoder, [desc]) {
  lockCommandEncoder(this);
  beginComputePass(this, passEncoder, desc);
});

wrapFunctionAfter(GPUCommandEncoder, 'beginRenderPass', function(this: GPUCommandEncoder, passEncoder: GPURenderPassEncoder, [desc]) {
  lockCommandEncoder(this);
  beginRenderPass(this, passEncoder, desc);
});

wrapFunctionBefore(GPUCommandEncoder, 'finish', function(this: GPUCommandEncoder) {
  finishCommandEncoder(this);
});

wrapFunctionBefore(GPUCommandEncoder, 'copyBufferToBuffer', function(this: GPUCommandEncoder, [src, srcOffset, dst, dstOffset, size]) {
  getCommandBufferInfoAndValidateState(this);
  assertNotDestroyed(src);
  assertNotDestroyed(dst);
  const device = s_objToDevice.get(this);
  assert(device === s_objToDevice.get(src), 'src is not from same device as commandEncoder', [src, this]);
  assert(device === s_objToDevice.get(dst), 'dst is not from same device as commandEncoder', [dst, this]);
  assert(src !== dst, 'src must not be same buffer as dst', [src, dst]);
  assert(!!(src.usage & GPUBufferUsage.COPY_SRC), () => `src.usage(${bufferUsageToString(src.usage)} missing COPY_SRC)`, [src]);
  assert(!!(dst.usage & GPUBufferUsage.COPY_DST), () => `dst.usage(${bufferUsageToString(dst.usage)} missing COPY_DST)`, [dst]);
  assert(srcOffset + size <= src.size, () => `srcOffset(${srcOffset}) + size(${size}) > srcBuffer.size(${src.size})`, [src]);
  assert(dstOffset + size <= dst.size, () => `dstOffset(${dstOffset}) + size(${size}) > dstBuffer.size(${dst.size})`, [dst]);
  assert(size % 4 === 0, () => `size(${size}) is not multiple of 4`);
  assert(srcOffset % 4 === 0, () => `srcOffset(${srcOffset}) is not multiple of 4`);
  assert(dstOffset % 4 === 0, () => `dstOffset(${dstOffset}) is not multiple of 4`);
});

