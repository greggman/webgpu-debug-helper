import {
  makeBindGroupLayoutDescriptors,
  makeShaderDataDefinitions,
  PipelineDescriptor,
  ShaderDataDefinitions,
} from 'webgpu-utils';

const deviceToErrorScopeStack: WeakMap<GPUDevice, {filter: GPUErrorFilter, errors: GPUError[]}[]> = new WeakMap();
const origPushErrorScope = GPUDevice.prototype.pushErrorScope;
const origPopErrorScope = GPUDevice.prototype.popErrorScope;

function assert(condition: boolean, msg?: string | (() => string), resources?: any[]): asserts condition {
  if (!condition) {
    const lines = (resources || []).map(r => `    ${r.constructor.name}${r.label ? `(${r.label})` :''}`).join('\n')
    const m = msg ? (typeof msg === 'string' ? msg : msg()) : '';
    emitError(`${m}${lines ? `\n${lines}`: ''}`);
  }
}

function bitmaskToString(bitNames: Record<string, number>, mask: number) {
  const names = [];
  for (const [k, v] of Object.entries(bitNames)) {
    if (mask & v) {
      names.push(k);
    }
  }
  return names.join('|');
}

function bufferUsageToString(mask: number) {
  return bitmaskToString(GPUBufferUsage as unknown as Record<string, number>, mask);
}

function getFilterForGPUError(error: GPUError): GPUErrorFilter {
  if (error instanceof GPUValidationError) {
    return 'validation';
  }
  if (error instanceof GPUOutOfMemoryError) {
    return 'out-of-memory';
  }
  if (error instanceof GPUInternalError) {
    return 'internal';
  }
  throw new Error('unknown GPUError type');
}

function emitGPUError(device: GPUDevice, error: GPUError) {
  const filter = getFilterForGPUError(error);
  const errorScopeStack = deviceToErrorScopeStack.get(device)!;
  const currentErrorScope = errorScopeStack.findLast(scope => scope.filter === filter);
  if (currentErrorScope) {
    currentErrorScope.errors.push(error);
  } else {
    device.dispatchEvent(new GPUUncapturedErrorEvent('uncapturedError', { error }));
  }
}

interface ThingWithPrototype<T> extends Object {
  prototype: Record<string, any>;
};

function addErrorWrapper<T>(api: ThingWithPrototype<T>, fnName: string) {
  const origFn = api.prototype[fnName];
  api.prototype[fnName] = function(this: T, ...args: any[]) {
    const stack = new Error();
    origPushErrorScope.call(this, 'validation');
    const result = origFn.call(this, ...args);
    origPopErrorScope.call(this)
      .then(error => {
        if (error) {
          console.error(fnName, args);
          console.error(error.message);
          console.error(stack.stack);
          emitGPUError(this as GPUDevice, error);
        }
       });
    return result;
  }
}

function getAPIFunctionNames<T>(api: ThingWithPrototype<T>) {
  return Object.entries(Object.getOwnPropertyDescriptors(api.prototype))
     .filter(([, info]) => info.enumerable && typeof info.value === 'function')
     .map(([name]) => name)
}

const skip = new Set([
  'pushErrorScope',
  'popErrorScope',
  'destroy',
]);
getAPIFunctionNames(GPUDevice)
  .filter(n => !skip.has(n))
  .forEach(n => addErrorWrapper(GPUDevice, n));

GPUDevice.prototype.pushErrorScope = (function(origFn) {
  return function(this: GPUDevice, filter: GPUErrorFilter) {
    origFn.call(this, filter);
    const errorScopeStack = deviceToErrorScopeStack.get(this);
    errorScopeStack!.push({filter, errors: []});
  };
})(GPUDevice.prototype.pushErrorScope)

GPUDevice.prototype.popErrorScope = (function(origFn) {
  return async function(this: GPUDevice) {
    const errorScopeStack = deviceToErrorScopeStack.get(this);
    const errorScope = errorScopeStack!.pop();
    if (errorScope === undefined) {
      throw new DOMException('popErrorScope called on empty error scope stack', 'OperationError');
    }
    const err = await origFn.call(this);
    return errorScope.errors.length > 0 ? errorScope.errors.pop()! : err;
  };
})(GPUDevice.prototype.popErrorScope)

GPUAdapter.prototype.requestDevice = (function(origFn) {
  return async function(this: GPUAdapter, ...args) {
    const device = await origFn.call(this, ...args);
    if (device) {
      device.addEventListener('uncapturederror', function(e) {
        console.error((e as GPUUncapturedErrorEvent).error.message);
      });
      deviceToErrorScopeStack.set(device, []);
    }
    return device;
  }
})(GPUAdapter.prototype.requestDevice);

function wrapFunctionBefore<K extends PropertyKey, T extends Record<K, (...args: any[]) => any>>(
    API: { prototype: T },
    fnName: K, fn: (args: Parameters<T[K]>) => void) {
  const origFn = API.prototype[fnName];
  API.prototype[fnName] = function (this: T, ...args: any[]) {
    fn.call(this, args);
    return origFn.call(this, ...args);
  } as any;
}

function wrapFunctionAfter<K extends PropertyKey, T extends Record<K, (...args: any[]) => any>>(
    API: { prototype: T },
    fnName: K, fn: (obj: ReturnType<T[K]>, args: Parameters<T[K]>) => void) {
  const origFn = API.prototype[fnName];
  API.prototype[fnName] = function (this: T, ...args: any[]) {
    const result = origFn.call(this, ...args);
    fn.call(this, result, args);
    return result;
  } as any;
}

function wrapAsyncFunctionAfter<K extends PropertyKey, T extends Record<K, (...args: any[]) => any>>(
    API: { prototype: T },
    fnName: K, fn: (obj: Awaited<ReturnType<T[K]>>, args: Parameters<T[K]>) => void) {
  const origFn = API.prototype[fnName];
  API.prototype[fnName] = async function (this: T, ...args: any[]) {
    const result = await origFn.call(this, ...args);
    fn.call(this, result, args);
    return result;
  } as any;
}

type LabeledObject = GPUTexture | GPUTextureView | GPURenderPassEncoder | GPUCommandEncoder;

function emitError(msg: string, objs: LabeledObject[] = []) {
  throw new Error(`${msg}\n${(objs).map(o => `[${o.constructor.name}]${o.label}`).join('\n')}`);
}

type BufferWithOffsetAndSize = {
  buffer: GPUBuffer,
  offset: number,
  size: number,
};

type BindGroupBinding = {
  bindGroup?: GPUBindGroup | null | undefined,
  dynamicOffsets?: Uint32Array,
};

type PassInfo = {
  commandEncoder: GPUCommandEncoder,
  bindGroups: BindGroupBinding[],
}

type ComputePassInfo = PassInfo & {
  pipeline?: GPUComputePipeline,
};

type RenderPassInfo = PassInfo & {
  targetWidth: number,
  targetHeight: number,
  pipeline?: GPURenderPipeline,
  indexBuffer?: BufferWithOffsetAndSize,
  indexFormat?: GPUIndexFormat,
  vertexBuffers: (BufferWithOffsetAndSize | undefined)[],
};

const s_textureViewToTexture = new WeakMap<GPUTextureView, GPUTexture>();
const s_computePassToPassInfoMap = new WeakMap<GPUComputePassEncoder, ComputePassInfo>();
const s_renderPassToPassInfoMap = new WeakMap<GPURenderPassEncoder, RenderPassInfo>();

type DeviceResource =
  | GPUTexture
  | GPUBindGroup
  | GPUBindGroupLayout
  | GPUBuffer
  | GPUCommandEncoder
  | GPUComputePipeline
  | GPUPipelineLayout
  | GPURenderPipeline

const s_objToDevice = new WeakMap<DeviceResource, GPUDevice>();
const s_pipelineToRequiredGroupIndices = new WeakMap<GPUPipelineBase, number[]>();
const s_layoutToAutoLayoutPipeline = new WeakMap<GPUBindGroupLayout, GPUPipelineBase>();
const s_bindGroupToLayout = new WeakMap<GPUBindGroup, GPUBindGroupLayout>();
const s_shaderModuleToDefs = new WeakMap<GPUShaderModule, ShaderDataDefinitions>();

const s_bindGroupLayoutToBindGroupLayoutDescriptor = new WeakMap<GPUBindGroupLayout, GPUBindGroupLayoutDescriptor>();
const s_pipelineLayoutToPipelineLayoutDescriptor = new WeakMap<GPUPipelineLayout, GPUPipelineLayoutDescriptor>();

function addDefs(defs: ShaderDataDefinitions[], stage: GPUProgrammableStage | undefined) {
  if (stage) {
    defs.push(s_shaderModuleToDefs.get(stage.module));
  }
}

function trackPipelineLayouts(device: GPUDevice, pipeline: GPUPipelineBase, desc: GPUComputePipelineDescriptor | GPURenderPipelineDescriptor) {
    if (desc.layout === 'auto') {
      const defs: ShaderDataDefinitions[] = [];
      addDefs(defs, (desc as GPURenderPipelineDescriptor).vertex);
      addDefs(defs, (desc as GPURenderPipelineDescriptor).fragment);
      addDefs(defs, (desc as GPUComputePipelineDescriptor).compute);
      const layoutsDescriptors = makeBindGroupLayoutDescriptors(defs, desc);
      const requiredGroupIndices = layoutsDescriptors.map((layout, ndx) => [...layout.entries].length > 0 ? ndx : -1).filter(v => v >= 0)
      s_pipelineToRequiredGroupIndices.set(pipeline, requiredGroupIndices);
    } else {
      
    }
}

function trackAutoLayoutPipelineBindGroupLayouts(pipeline, layout) {
  if (s_pipelineToRequiredGroupIndices.has(pipeline)) {
    s_layoutToAutoLayoutPipeline.set(layout, pipeline);
  }
}

function trackPipelineLayout(this: GPUDevice, pipelineLayout: GPUPipelineLayout, [desc]: [GPUPipelineLayoutDescriptor]) {
  s_pipelineLayoutToPipelineLayoutDescriptor.set(pipelineLayout, desc);
}

function trackBindGroupLayout(this: GPUDevice, bindGroupLayout: GPUBindGroupLayout, [desc]: [GPUBindGroupLayoutDescriptor]) {
  s_bindGroupLayoutToBindGroupLayoutDescriptor.set(bindGroupLayout, desc);
}

function setBindGroup(parent: GPUCommandEncoder, bindGroupBindings: BindGroupBinding[], index: number, bindGroup: GPUBindGroup | null | undefined, dynamicOffsets?: Uint32Array) {
  const device = s_objToDevice.get(parent);
  const maxIndex = device.limits.maxBindGroups;
  assert(index >= 0, () => `index(${index}) must be >= 0`);
  assert(index < maxIndex, () => `index(${index}) must be < device.limits.maxBindGroups(${maxIndex})`);
  // TODO: Get dynamic offsets from layout
  const dynamicOffsetCount = 0 ; //bindGroup ? layout.dynamicOffsetCount : 0;
  dynamicOffsets = dynamicOffsets || new Uint32Array(0);
  assert(dynamicOffsets.length === dynamicOffsetCount, `there must be the same number of dynamicOffsets(${dynamicOffsets.length}) as the layout requires (${dynamicOffsetCount})`)
  if (bindGroup) {
    assert(device === s_objToDevice.get(bindGroup), () => `bindGroup must be from same device as ${parent.constructor.name}`, [bindGroup, parent]);
    // TODO: Validate Dynamic Offsets
    bindGroupBindings[index] = {
      bindGroup,
      dynamicOffsets,
    };
  } else {
    bindGroupBindings[index] = undefined;
  }
}

//function validateBindGroups(this: PassEncoder, _: void) {
//  const {pipeline, bindGroups} = s_passToState.get(this)!;
//  if (!pipeline) {
//    emitError('no pipeline', [this]);
//    return;
//  }
//  // get bind group indices needed for current pipeline
//  const requiredGroupLayouts = s_pipelineToRequiredGroupLayouts.get(pipeline) || [];
//  for (const {ndx, layout: requiredLayout} of requiredGroupLayouts) {
//    const bindGroup = bindGroups[ndx];
//    if (!bindGroup) {
//      emitError(`no bindGroup at ndx: ${ndx}`);
//      return;
//    }
//
//    {
//      const error = validateBindGroupIsGroupEquivalent(requiredLayout, bindGroup);
//      if (error) {
//        emitError(error);
//        return;
//      }
//    }
//
//    {
//      const error = validateMinBindingSize(requiredLayout, bindGroup));
//      if (eror)
//      emitErr
//    }
//  }
//}

wrapFunctionAfter(GPUDevice, 'createShaderModule', function(this: GPUDevice, module: GPUShaderModule, [desc]: [GPUShaderModuleDescriptor]) {
  s_shaderModuleToDefs.set(module, makeShaderDataDefinitions(desc.code));
});

wrapFunctionAfter(GPUDevice, 'createBindGroup', function(this: GPUDevice, bindGroup: GPUBindGroup, [desc]: [GPUBindGroupDescriptor]) {
  s_objToDevice.set(bindGroup, this);
  const { layout } = desc;
  const pipeline = s_layoutToAutoLayoutPipeline.get(layout);
  if (pipeline) {
    if (s_pipelineToRequiredGroupIndices.has(pipeline)) {
//      s_bindGroupToLayout.get(bindGroup).set(bindGroup, pipeline);
    }
  }
});

wrapFunctionAfter(GPUDevice, 'createBuffer', function(this: GPUDevice, buffer: GPUBuffer, [desc]) {
  s_objToDevice.set(buffer, this);
});

wrapFunctionAfter(GPUDevice, 'createTexture', function(this: GPUDevice, texture: GPUTexture, [desc]) {
  s_objToDevice.set(texture, this);
});

wrapFunctionAfter(GPUDevice, 'createCommandEncoder', function(this: GPUDevice, commandEncoder: GPUCommandEncoder, [desc]) {
  s_objToDevice.set(commandEncoder, this);
});

wrapFunctionAfter(GPUDevice, 'createRenderPipeline', function(this: GPUDevice, pipeline: GPURenderPipeline, [desc]) {
  s_objToDevice.set(pipeline, this);
  trackPipelineLayouts(this, pipeline, desc);
});

wrapFunctionAfter(GPUDevice, 'createComputePipeline', function(this: GPUDevice, pipeline: GPUComputePipeline, [desc]) {
  s_objToDevice.set(pipeline, this);
  trackPipelineLayouts(this, pipeline, desc);
});

wrapAsyncFunctionAfter(GPUDevice, 'createRenderPipelineAsync', function(this: GPUDevice, pipeline: GPURenderPipeline, [desc]) {
  s_objToDevice.set(pipeline, this);
  trackPipelineLayouts(this, pipeline, desc);
});

wrapAsyncFunctionAfter(GPUDevice, 'createComputePipelineAsync', function(this: GPUDevice, pipeline: GPUComputePipeline, [desc]) {
  s_objToDevice.set(pipeline, this);
  trackPipelineLayouts(this, pipeline, desc);
});

wrapFunctionAfter(GPUDevice, 'createBindGroupLayout', trackBindGroupLayout);
wrapFunctionAfter(GPUDevice, 'createPipelineLayout', trackPipelineLayout);

//wrapFunctionAfter(GPUCommandEncoder, 'beginRenderPass', addPassState);
//wrapFunctionAfter(GPUCommandEncoder, 'beginComputePass', addPassState);
//wrapFunctionAfter(GPUDevice, 'createRenderBundleEncoder', addPassState);

//wrapFunctionAfter(GPURenderPassEncoder, 'setPipeline', setPipeline);
//wrapFunctionAfter(GPURenderPassEncoder, 'setBindGroup', setBindGroup);
//wrapFunctionAfter(GPURenderPassEncoder, 'draw',  validateBindGroups);
//wrapFunctionAfter(GPURenderPassEncoder, 'drawIndexed',  validateBindGroups);
//wrapFunctionAfter(GPURenderPassEncoder, 'drawIndirect',  validateBindGroups);
//wrapFunctionAfter(GPURenderPassEncoder, 'drawIndexedIndirect',  validateBindGroups);
//wrapFunctionAfter(GPURenderPassEncoder, 'executeBundles', function(this: GPURenderPassEncoder, _: void, [bundles]: [Iterable<GPURenderBundle>]) {
//  const state = s_passToState.get(this)!;
//  state.pipeline = undefined;
//  state.bindGroups.length = 0;
//});

//wrapFunctionAfter(GPURenderBundleEncoder, 'setBindGroup', setBindGroup);
//wrapFunctionAfter(GPURenderBundleEncoder, 'draw',  validateBindGroups);
//wrapFunctionAfter(GPURenderBundleEncoder, 'drawIndexed',  validateBindGroups);
//wrapFunctionAfter(GPURenderBundleEncoder, 'drawIndirect',  validateBindGroups);
//wrapFunctionAfter(GPURenderBundleEncoder, 'drawIndexedIndirect',  validateBindGroups);

//wrapFunctionAfter(GPUComputePassEncoder, 'setPipeline', setPipeline);
//wrapFunctionAfter(GPUComputePassEncoder, 'setBindGroup', setBindGroup);
//wrapFunctionAfter(GPUComputePassEncoder, 'dispatchWorkgroups', validateBindGroups);
//wrapFunctionAfter(GPUComputePassEncoder, 'dispatchWorkgroupsIndirect', validateBindGroups);

wrapFunctionAfter(GPUTexture, 'createView', function(this: GPUTexture, view: GPUTextureView) {
  s_textureViewToTexture.set(view, this);
});

wrapFunctionAfter(GPUCommandEncoder, 'beginComputePass', function(this: GPUCommandEncoder, passEncoder: GPUComputePassEncoder, [desc]) {
  s_computePassToPassInfoMap.set(passEncoder, {
    commandEncoder: this,
    bindGroups: [],
  });
});

wrapFunctionBefore(GPUComputePassEncoder, 'setBindGroup', function(this: GPUComputePassEncoder, [index, bindGroup, dynamicOffsets]) {
  const info = s_computePassToPassInfoMap.get(this)!;
  setBindGroup(info.commandEncoder, info.bindGroups, index, bindGroup, dynamicOffsets);
});

wrapFunctionBefore(GPUComputePassEncoder, 'setPipeline', function(this: GPUComputePassEncoder, [pipeline]) {
  const info = s_computePassToPassInfoMap.get(this)!;
  assert(s_objToDevice.get(info.commandEncoder) === s_objToDevice.get(pipeline), 'pipeline must be from same device as computePassEncoder', [this, info.commandEncoder]);
  info.pipeline = pipeline;
});

wrapFunctionBefore(GPURenderPassEncoder, 'setBindGroup', function(this: GPURenderPassEncoder, [index, bindGroup, dynamicOffsets]) {
  const info = s_renderPassToPassInfoMap.get(this)!;
  setBindGroup(info.commandEncoder, info.bindGroups, index, bindGroup, dynamicOffsets);
});

wrapFunctionBefore(GPURenderPassEncoder, 'setPipeline', function(this: GPURenderPassEncoder, [pipeline]) {
  const info = s_renderPassToPassInfoMap.get(this)!;
  assert(s_objToDevice.get(info.commandEncoder) === s_objToDevice.get(pipeline), 'pipeline must be from same device as renderPassEncoder', [this, info.commandEncoder]);
  info.pipeline = pipeline;
});

wrapFunctionAfter(GPUCommandEncoder, 'beginRenderPass', function(this: GPUCommandEncoder, passEncoder: GPURenderPassEncoder, [desc]) {
  let targetWidth: number | undefined;
  let targetHeight: number | undefined;

  const addView = (attachment: GPURenderPassColorAttachment | GPURenderPassDepthStencilAttachment | null | undefined) => {
    if (!attachment) {
      return;
    }
    const {view} = attachment;
    const texture = s_textureViewToTexture.get(view)!;
    const {width, height} = texture;
    if (targetWidth === undefined) {
      targetWidth = width;
      targetHeight = height;
    } else if (targetWidth !== width || targetHeight !== height) {
      emitError('attachments are not all the same width and height', [view, texture, passEncoder, this]);
    }
  }

  for (const colorAttachment of desc.colorAttachments || []) {
      addView(colorAttachment);
  }

  addView(desc.depthStencilAttachment);

  assert(targetWidth !== undefined, 'render pass targets width is undefined', [passEncoder]);
  assert(targetHeight !== undefined, 'render pass targets height is undefined', [passEncoder]);

  s_renderPassToPassInfoMap.set(passEncoder, {
    commandEncoder: this,
    targetWidth,
    targetHeight,
    vertexBuffers: [],
    bindGroups: [],
  });
});

wrapFunctionBefore(GPURenderPassEncoder, 'setIndexBuffer', function(this: GPURenderPassEncoder, [buffer, format, offset, size]) {
  const info = s_renderPassToPassInfoMap.get(this)!;
  const device = s_objToDevice.get(info.commandEncoder)!;
  offset = offset ?? 0;
  size = size ?? Math.max(0, buffer.size - offset);

  assert(device === s_objToDevice.get(buffer), 'buffer must be from the same device', [buffer, this]);
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
    assert(!!(buffer.usage & GPUBufferUsage.VERTEX), () => `buffer(${bufferUsageToString(buffer.usage)}) must have usage VERTEX`, [buffer, this]);
    info.vertexBuffers[slot] = {
      buffer,
      offset,
      size,
    };
  }
});

wrapFunctionBefore(GPURenderPassEncoder, 'setViewport', function(this: GPURenderPassEncoder, [x, y, width, height, minDepth, maxDepth]: [number, number, number, number, number, number]) {
  const {
    targetWidth,
    targetHeight,
  } = s_renderPassToPassInfoMap.get(this)!;
  assert(x >= 0, () => `x(${x}) < 0`, [this]);
  assert(y >= 0, () => `y(${y}) < 0`, [this]);
  assert(x + width <= targetWidth, () => `x(${x}) + width(${width}) > texture.width(${targetWidth})`, [this]);
  assert(y + height <= targetHeight, () => `y(${x}) + height(${height}) > texture.height(${targetHeight})`, [this]);
});

wrapFunctionBefore(GPURenderPassEncoder, 'setScissorRect', function(this: GPURenderPassEncoder, [x, y, width, height]: [number, number, number, number]) {
  const {
    targetWidth,
    targetHeight,
  } = s_renderPassToPassInfoMap.get(this)!;
  assert(x >= 0, () => `x(${x}) < 0`, [this]);
  assert(y >= 0, () => `y(${y}) < 0`, [this]);
  assert(x + width <= targetWidth, () => `x(${x}) + width(${width}) > texture.width(${targetWidth})`, [this]);
  assert(y + height <= targetHeight, () => `y(${x}) + height(${height}) > texture.height(${targetHeight})`, [this]);
});
