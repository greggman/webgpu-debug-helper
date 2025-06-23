import {
  PassInfo,
  validateEncoderBindGroups,
} from './binding-mixin.js';
import {
  validateEncoderState,
} from './encoder-utils.js';
import {
  assertNotDestroyed,
  s_objToDevice,
} from './shared-state.js';
import {
  assert,
} from './validation.js';
import {
  RenderPassLayout,
  s_renderPipelineToRenderPipelineDescriptor,
} from './pipeline.js';
import {
  bufferUsageToString,
} from './utils.js';
import {
  wrapFunctionBefore,
} from './wrap-api.js';

type RenderMixin = GPURenderPassEncoder | GPURenderBundleEncoder;

type BufferWithOffsetAndSize = {
  buffer: GPUBuffer,
  offset: number,
  size: number,
};

export type RenderDrawInfo = PassInfo & {
  pipeline?: GPURenderPipeline,
  indexBuffer?: BufferWithOffsetAndSize,
  indexFormat?: GPUIndexFormat,
  vertexBuffers: (BufferWithOffsetAndSize | undefined)[],
};

function toArray<T>(v: Iterable<T>): T[] {
  return Array.isArray(v) ? v : [...v];
}

type VertexBufferValidationFn = (slot: number, layout: GPUVertexBufferLayout, vertexBufferBinding: BufferWithOffsetAndSize) => void;

function validateValidToDraw(mixin: RenderMixin, info: RenderDrawInfo, fn: VertexBufferValidationFn) {
  const bindGroupSpaceUsed = validateEncoderBindGroups(info.bindGroups, info.pipeline);
  const pipelineDescriptor = s_renderPipelineToRenderPipelineDescriptor.get(info.pipeline!)!;
  const device = s_objToDevice.get(mixin)!;
  let vertexBufferSpaceUsed = 0;
  if (pipelineDescriptor.vertex.buffers) {
    // buffers is sequence so no forEach, convert to array
    const buffers = toArray(pipelineDescriptor.vertex.buffers);
    buffers.forEach((buffer, slot) => {
      if (buffer) {
        const vertexBufferBinding = info.vertexBuffers[slot];
        assert(!!vertexBufferBinding, () => `no vertexBuffer in slot(${slot})`);
        assertNotDestroyed(vertexBufferBinding.buffer);
        fn(slot, buffer, vertexBufferBinding);
        // don't need to check that vertex buffer is same device as was checked at setVertexBuffer
        vertexBufferSpaceUsed = slot;
      }
    });
  }

  // TODO: test!
  assert(
    bindGroupSpaceUsed + vertexBufferSpaceUsed <= device.limits.maxBindGroupsPlusVertexBuffers,
    () => `bindGroupSpaceUsed(${bindGroupSpaceUsed}) + vertexBufferSpaceUsed(${vertexBufferSpaceUsed}) <= device.limits.maxBindGroupsPlusVertexBuffers(${device.limits.maxBindGroupsPlusVertexBuffers})`);
}

function validateValidToDrawIndexed(mixin: RenderMixin, info: RenderDrawInfo, fn: VertexBufferValidationFn) {
  assert(!!info.indexBuffer, 'indexBuffer is not set');
  const device = s_objToDevice.get(mixin)!;
  assertNotDestroyed(info.indexBuffer.buffer);
  assert(device === s_objToDevice.get(info.indexBuffer.buffer), 'indexBuffer is not from same device');
  validateValidToDraw(mixin, info, fn);

  const pipelineDescriptor = s_renderPipelineToRenderPipelineDescriptor.get(info.pipeline!)!;
  switch (pipelineDescriptor.primitive?.topology) {
    case 'line-strip':
    case 'triangle-strip':
      assert(
        info.indexFormat === pipelineDescriptor.primitive?.stripIndexFormat,
        () => `indexFormat(${info.indexFormat}) !== pipeline.primitive.stripIndexFormat(${pipelineDescriptor.primitive?.stripIndexFormat})`,
      );
  }
}

function bufferSizeFromBufferBinding({buffer, offset, size}: BufferWithOffsetAndSize) {
  offset = offset ?? 0;
  return size ?? buffer.size - offset;
}

const kVertexFormatInfo = {
  "float16":   { components: 1, bytes:  2, type: "f16" },
  "float16x2": { components: 2, bytes:  4, type: "vec2<f16>" },
  "float16x4": { components: 4, bytes:  8, type: "vec4<f16>" },
  "float32":   { components: 1, bytes:  4, type: "f32" },
  "float32x2": { components: 2, bytes:  8, type: "vec2<f32>" },
  "float32x3": { components: 3, bytes: 12, type: "vec3<f32>" },
  "float32x4": { components: 4, bytes: 16, type: "vec4<f32>" },
  "sint16":    { components: 1, bytes:  2, type: "i32" },
  "sint16x2":  { components: 2, bytes:  4, type: "vec2<i32>" },
  "sint16x4":  { components: 4, bytes:  8, type: "vec4<i32>" },
  "sint32":    { components: 1, bytes:  4, type: "i32" },
  "sint32x2":  { components: 2, bytes:  8, type: "vec2<i32>" },
  "sint32x3":  { components: 3, bytes: 12, type: "vec3<i32>" },
  "sint32x4":  { components: 4, bytes: 16, type: "vec4<i32>" },
  "sint8":     { components: 1, bytes:  1, type: "i32" },
  "sint8x2":   { components: 2, bytes:  2, type: "vec2<i32>" },
  "sint8x4":   { components: 4, bytes:  4, type: "vec4<i32>" },
  "snorm16":   { components: 1, bytes:  2, type: "f32" },
  "snorm16x2": { components: 2, bytes:  4, type: "vec2<f32>" },
  "snorm16x4": { components: 4, bytes:  8, type: "vec4<f32>" },
  "snorm8":    { components: 1, bytes:  1, type: "f32" },
  "snorm8x2":  { components: 2, bytes:  2, type: "vec2<f32>" },
  "snorm8x4":  { components: 4, bytes:  4, type: "vec4<f32>" },
  "uint16":    { components: 1, bytes:  2, type: "u32" },
  "uint16x2":  { components: 2, bytes:  4, type: "vec2<u32>" },
  "uint16x4":  { components: 4, bytes:  8, type: "vec4<u32>" },
  "uint32":    { components: 1, bytes:  4, type: "u32" },
  "uint32x2":  { components: 2, bytes:  8, type: "vec2<u32>" },
  "uint32x3":  { components: 3, bytes: 12, type: "vec3<u32>" },
  "uint32x4":  { components: 4, bytes: 16, type: "vec4<u32>" },
  "uint8":     { components: 1, bytes:  1, type: "u32" },
  "uint8x2":   { components: 2, bytes:  2, type: "vec2<u32>" },
  "uint8x4":   { components: 4, bytes:  4, type: "vec4<u32>" },
  "unorm10-10-10-2": { components: 4, bytes:4, type:"vec4<f32>" },
  "unorm16":   { components: 1, bytes:  2, type: "f32" },
  "unorm16x2": { components: 2, bytes:  4, type: "vec2<f32>" },
  "unorm16x4": { components: 4, bytes:  8, type: "vec4<f32>" },
  "unorm8":    { components: 1, bytes:  1, type: "f32" },
  "unorm8x2":  { components: 2, bytes:  2, type: "vec2<f32>" },
  "unorm8x4-bgra": { components: 4, bytes:4, type:"vec4<u32>" },
  "unorm8x4":  { components: 4, bytes:  4, type: "vec4<f32>" },
};

function getLastStride(layout: GPUVertexBufferLayout) {
  let lastStride = 0;
  for (const {offset, format} of layout.attributes) {
    lastStride = Math.max(lastStride, offset + kVertexFormatInfo[format].bytes);
  }
  return lastStride;
}

type Ctor<T extends RenderMixin> = {
   new (): never;
   prototype: T;
};

export type RenderPassLayoutInfo = {
  renderPassLayout: RenderPassLayout,
  passLayoutSignature: string,
}

export function wrapRenderCommandsMixin<T extends RenderMixin>(
  API: Ctor<T>,
  s_renderPassToPassInfoMap: WeakMap<T, RenderDrawInfo>,
  getRenderPassInfo: (pass: T) => RenderPassLayoutInfo) {

  wrapFunctionBefore(API, 'draw', function (this: T, [vertexCount, a_instanceCount, a_firstVertex, a_firstInstance]) {
    const instanceCount = a_instanceCount ?? 1;
    const firstVertex = a_firstVertex ?? 0;
    const firstInstance = a_firstInstance ?? 0;
    const info = s_renderPassToPassInfoMap.get(this)!;
    validateEncoderState(this, info.state);
    validateValidToDraw(this, info, (slot: number, layout: GPUVertexBufferLayout, vertexBufferBinding: BufferWithOffsetAndSize) => {
      const bufferSize = bufferSizeFromBufferBinding(vertexBufferBinding);
      const stride = layout.arrayStride;
      const lastStride = getLastStride(layout);
      const strideCount = layout.stepMode === 'instance'
          ? firstInstance + instanceCount
          : firstVertex + vertexCount;
      if (strideCount !== 0) {
        const bytesNeeded = (strideCount - 1) * stride + lastStride;
        assert(bytesNeeded <= bufferSize, () => `slot(${slot}) vertex buffer binding size ${bufferSize} is not large enough for bytes needed(${bytesNeeded})`);
      }
    });
  });

  wrapFunctionBefore(API, 'drawIndexed', function (this: T, [indexCount, a_instanceCount, a_firstIndex, /*a_baseVertex*/, a_firstInstance]) {
    const instanceCount = a_instanceCount ?? 1;
    const firstIndex = a_firstIndex ?? 0;
    // const baseVertex = a_baseVertex ?? 0;
    const firstInstance = a_firstInstance ?? 0;
    const info = s_renderPassToPassInfoMap.get(this)!;
    validateEncoderState(this, info.state);
    validateValidToDrawIndexed(this, info, (slot: number, layout: GPUVertexBufferLayout, vertexBufferBinding: BufferWithOffsetAndSize) => {
      const bufferSize = bufferSizeFromBufferBinding(vertexBufferBinding);
      const stride = layout.arrayStride;
      const lastStride = getLastStride(layout);
      const strideCount = firstInstance + instanceCount;
      if (layout.stepMode === 'instance') {
        const bytesNeeded = (strideCount - 1) * stride + lastStride;
        assert(bytesNeeded <= bufferSize, () => `slot(${slot}) vertex buffer binding size ${bufferSize} is not large enough for bytes needed(${bytesNeeded})`);
      }
    });
    const bufferSize = bufferSizeFromBufferBinding(info.indexBuffer!);
    const indexByteSize = info.indexFormat === 'uint16' ? 2 : 4;
    const bytesNeeded = firstIndex + indexCount * indexByteSize;
    assert(bytesNeeded <= bufferSize, () => `indexBuffer bound size(${bufferSize}) is not large enough for bytesNeeded(${bytesNeeded})`);
  });

  const kIndirectDrawParametersSize = 16;
  wrapFunctionBefore(API, 'drawIndirect', function (this: T, [indirectBuffer, indirectOffset]) {
    const info = s_renderPassToPassInfoMap.get(this)!;
    validateEncoderState(this, info.state);
    validateValidToDraw(this, info, () => {});
    assertNotDestroyed(indirectBuffer);
    const device = s_objToDevice.get(this)!;
    assert(device === s_objToDevice.get(indirectBuffer), 'indirectBuffer is not from same device', [indirectBuffer]);
    assert(!!(indirectBuffer.usage & GPUBufferUsage.INDIRECT), () => `buffer(${bufferUsageToString(indirectBuffer.usage)}) must have usage INDIRECT`, [indirectBuffer, this]);
    assert(indirectOffset + kIndirectDrawParametersSize <= indirectBuffer.size, `indirectOffset(${indirectOffset}) + sizeOfIndirectParameters(${kIndirectDrawParametersSize}) > indirectBuffer.size(${indirectBuffer.size})`, [indirectBuffer]);
    assert(indirectOffset % 4 === 0, () => `indirectOffset(${indirectOffset}) is not multiple of 4`);
  });

  const kIndirectDrawIndexedParametersSize = 20;
  wrapFunctionBefore(API, 'drawIndexedIndirect', function (this: T, [indirectBuffer, indirectOffset]) {
    const info = s_renderPassToPassInfoMap.get(this)!;
    validateEncoderState(this, info.state);
    validateValidToDrawIndexed(this, info, () => {});
    assertNotDestroyed(indirectBuffer);
    const device = s_objToDevice.get(this)!;
    assert(device === s_objToDevice.get(indirectBuffer), 'indirectBuffer is not from same device', [indirectBuffer]);
    assert(!!(indirectBuffer.usage & GPUBufferUsage.INDIRECT), () => `buffer(${bufferUsageToString(indirectBuffer.usage)}) must have usage INDIRECT`, [indirectBuffer, this]);
    assert(indirectOffset + kIndirectDrawIndexedParametersSize <= indirectBuffer.size, `indirectOffset(${indirectOffset}) + sizeOfIndirectParameters(${kIndirectDrawIndexedParametersSize}) > indirectBuffer.size(${indirectBuffer.size})`, [indirectBuffer]);
    assert(indirectOffset % 4 === 0, () => `indirectOffset(${indirectOffset}) is not multiple of 4`);
  });


  wrapFunctionBefore(API, 'setPipeline', function (this: T, [pipeline]) {
    const info = s_renderPassToPassInfoMap.get(this)!;
    validateEncoderState(this, info.state);
    assert(s_objToDevice.get(this) === s_objToDevice.get(pipeline), 'pipeline must be from same device as renderPassEncoder', [pipeline, this]);
    const pipelineDesc = s_renderPipelineToRenderPipelineDescriptor.get(pipeline)!;
    const passLayoutInfo = getRenderPassInfo(this);
    assert(pipelineDesc.passLayoutInfo.passLayoutSignature === passLayoutInfo.passLayoutSignature,
           () => `pipeline is not compatible with ${this.constructor.name}

${this.constructor.name} expects ${JSON.stringify(passLayoutInfo.renderPassLayout, null, 2)}

pipeline is: ${JSON.stringify(pipelineDesc.passLayoutInfo.renderPassLayout, null, 2)}
`,
      [pipeline, this],
    );
    info.pipeline = pipeline;
  });


  wrapFunctionBefore(API, 'setIndexBuffer', function (this: T, [buffer, format, offset, size]) {
    const info = s_renderPassToPassInfoMap.get(this)!;
    validateEncoderState(this, info.state);
    const device = s_objToDevice.get(this)!;
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

  wrapFunctionBefore(API, 'setVertexBuffer', function (this: T, [slot, buffer, offset, size]) {
    const info = s_renderPassToPassInfoMap.get(this)!;
    validateEncoderState(this, info.state);
    const device = s_objToDevice.get(this)!;
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
  }