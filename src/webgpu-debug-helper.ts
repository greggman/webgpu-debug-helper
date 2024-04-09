import {
  makeBindGroupLayoutDescriptors,
  makeShaderDataDefinitions,
  PipelineDescriptor,
  ShaderDataDefinitions,
} from 'webgpu-utils';

const deviceToErrorScopeStack: WeakMap<GPUDevice, {filter: GPUErrorFilter, errors: GPUError[]}[]> = new WeakMap();
const origPushErrorScope = GPUDevice.prototype.pushErrorScope;
const origPopErrorScope = GPUDevice.prototype.popErrorScope;

function assert(condition: boolean, msg?: string | (() => string)): asserts condition {
  if (!condition) {
    emitError(msg ? (typeof msg === 'string' ? msg : msg()) : '');
  }
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

function wrapFunctionBefore<K extends PropertyKey, T extends Record<K, (...args: any) => any>>(
    API: { prototype: T },
    fnName: K, fn: (args: Parameters<T[K]>) => void) {
  const origFn = API.prototype[fnName];
  API.prototype[fnName] = function (this: T, ...args: any) {
    fn.call(this, args);
    return origFn.call(this, ...args);
  } as any;
}

function wrapFunctionAfter<K extends PropertyKey, T extends Record<K, (...args: any) => any>>(
    API: { prototype: T },
    fnName: K, fn: (obj: ReturnType<T[K]>, args: Parameters<T[K]>) => void) {
  const origFn = API.prototype[fnName];
  API.prototype[fnName] = function (this: T, args: any) {
    const result = origFn.call(this, ...args);
    fn.call(this, result, args);
    return result;
  } as any;
}

function wrapAsyncFunctionAfter<K extends PropertyKey, T extends Record<K, (...args: any) => any>>(
    API: { prototype: T },
    fnName: K, fn: (obj: Awaited<ReturnType<T[K]>>, args: Parameters<T[K]>) => void) {
  const origFn = API.prototype[fnName];
  API.prototype[fnName] = async function (this: T, ...args: any) {
    const result = await origFn.call(this, ...args);
    fn.call(this, result, args);
    return result;
  } as any;
}

type LabeledObject = GPUTexture | GPUTextureView | GPURenderPassEncoder | GPUCommandEncoder;

function emitError(msg: string, objs: LabeledObject[] = []) {
  throw new Error(`${msg}\n${(objs).map(o => `[${o.constructor.name}]${o.label}`).join('\n')}`);
}

type RenderPassInfo = {
  targetWidth: number,
  targetHeight: number,
};

type PassState = {
  bindGroups: (GPUBindGroup | null | undefined)[],
  pipeline: GPUPipelineBase | null | undefined,
};

type PassEncoder = GPURenderPassEncoder | GPUComputePassEncoder | GPURenderBundleEncoder;

const textureViewToTexture = new WeakMap<GPUTextureView, GPUTexture>();
const renderPassToPassInfoMap = new WeakMap<GPURenderPassEncoder, RenderPassInfo>();

const s_pipelineToRequiredGroupIndices = new WeakMap<GPUPipelineBase, number[]>();
const s_layoutToAutoLayoutPipeline = new WeakMap<GPUBindGroupLayout, GPUPipelineBase>();
const s_bindGroupToLayout.get(bindGroup) = new WeakMap<GPUBindGroup, boolean>();
const s_passToState = new WeakMap<PassEncoder, PassState>();
const s_shaderModuleToDefs = new WeakMap<GPUShaderModule, ShaderDataDefinitions>();

const s_bindGroupLayoutToBindGroupLayoutDescriptor = new WeakMap<GPUBindGroupLayout, GPUBindGroupLayoutDescriptor>();
const s_pipelineLayoutToPipelineLayoutDescriptor = new WeakMap<GPUPipelineLayout, GPUPipelineLayoutDescriptor>();

function addDefs(defs: ShaderDataDefinitions[], stage: GPUProgrammableStage | undefined) {
  if (stage) {
    defs.push(s_shaderModuleToDefs.get(stage.module));
  }
}

function trackPipelineLayouts(this: GPUDevice, pipeline: GPUPipelineBase, [desc]: [GPUPipelineDescriptorBase]) {
    if (desc.layout === 'auto') {
      const defs: ShaderDataDefinitions[] = [];
      addDefs(defs, (desc as GPURenderPipelineDescriptor).vertex);
      addDefs(defs, (desc as GPURenderPipelineDescriptor).fragment);
      addDefs(defs, (desc as GPUComputePipelineDescriptor).compute);
      const layoutsDescriptors = makeBindGroupLayoutDescriptors(defs, desc);
      const requiredGroupIndices = layoutsDescriptors.map((layout, ndx) => layout.entries.length > 0 ? ndx : -1).filter(v => v >= 0)
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

function addPassState(this: GPUCommandEncoder | GPUDevice, pass: PassEncoder) {
  s_passToState.set(pass, {
    bindGroups: [],
    pipeline: undefined,
  });
}

function setPipeline(this: PassEncoder, _: void, [pipeline]: [GPUPipelineBase]) {
  s_passToState.get(this)!.pipeline = pipeline;
}

function setBindGroup(this: PassEncoder, _: void, [ndx, bindGroup]: [number, GPUBindGroup | null, ...any]) {
  s_passToState.get(this)!.bindGroups[ndx] = bindGroup;
}

function wobjToString(o: GPUObjectBase) {
  return `[${o.constructor.name}]${o.label}`;
}

function validateBindGroups(this: PassEncoder, _: void) {
  const {pipeline, bindGroups} = s_passToState.get(this)!;
  if (!pipeline) {
    emitError('no pipeline', [this]);
    return;
  }
  // get bind group indices needed for current pipeline
  const requiredGroupLayouts = s_pipelineToRequiredGroupLayouts.get(pipeline) || [];
  for (const {ndx, layout: requiredLayout} of requiredGroupLayouts) {
    const bindGroup = bindGroups[ndx];
    if (!bindGroup) {
      emitError(`no bindGroup at ndx: ${ndx}`);
      return;
    }

    {
      const error = validateBindGroupIsGroupEquivalent(requiredLayout, bindGroup);
      if (error) {
        emitError(error);
        return;
      }
    }

    {
      const error = validateMinBindingSize(requiredLayout, bindGroup));
      if (eror)
      emitErr
    }
  }
}

wrapFunctionAfter(GPUDevice, 'createShaderModule', function(this: GPUDevice, module: GPUShaderModule, [desc]: [GPUShaderModuleDescriptor]) {
  s_shaderModuleToDefs.set(module, makeShaderDataDefinitions(desc.code));
});

wrapFunctionAfter(GPUDevice, 'createBindGroup', function(this: GPUDevice, bindGroup: GPUBindGroup, [desc]: [GPUBindGroupDescriptor]) {
  const { layout } = desc;
  const pipeline = s_layoutToAutoLayoutPipeline.get(layout);
  if (pipeline) {
    if (s_pipelineToRequiredGroupIndices.has(pipeline)) {
      s_bindGroupToLayout.get(bindGroup).set(bindGroup, pipeline);
    }
  }
});

wrapFunctionAfter(GPUDevice, 'createRenderPipeline', trackPipelineLayouts);
wrapFunctionAfter(GPUDevice, 'createComputePipeline', trackPipelineLayouts);
wrapAsyncFunctionAfter(GPUDevice, 'createRenderPipelineAsync', trackPipelineLayouts);
wrapAsyncFunctionAfter(GPUDevice, 'createComputePipelineAsync', trackPipelineLayouts);

wrapFunctionAfter(GPUDevice, 'createComputePipeline', trackPipelineLayouts);
wrapFunctionAfter(GPUDevice, 'createBindGroupLayout', trackBindGroupLayout);
wrapFunctionAfter(GPUDevice, 'createPipelineLayout', trackPipelineLayout);

wrapFunctionAfter(GPUCommandEncoder, 'beginRenderPass', addPassState);
wrapFunctionAfter(GPUCommandEncoder, 'beginComputePass', addPassState);
wrapFunctionAfter(GPUDevice, 'createRenderBundleEncoder', addPassState);

wrapFunctionAfter(GPURenderPassEncoder, 'setPipeline', setPipeline);
wrapFunctionAfter(GPURenderPassEncoder, 'setBindGroup', setBindGroup);
wrapFunctionAfter(GPURenderPassEncoder, 'draw',  validateBindGroups);
wrapFunctionAfter(GPURenderPassEncoder, 'drawIndexed',  validateBindGroups);
wrapFunctionAfter(GPURenderPassEncoder, 'drawIndirect',  validateBindGroups);
wrapFunctionAfter(GPURenderPassEncoder, 'drawIndexedIndirect',  validateBindGroups);
wrapFunctionAfter(GPURenderPassEncoder, 'executeBundles', function(this: GPURenderPassEncoder, _: void, [bundles]: [Iterable<GPURenderBundle>]) {
  const state = s_passToState.get(this)!;
  state.pipeline = undefined;
  state.bindGroups.length = 0;
});

wrapFunctionAfter(GPURenderBundleEncoder, 'setPipeline', setPipeline);
wrapFunctionAfter(GPURenderBundleEncoder, 'setBindGroup', setBindGroup);
wrapFunctionAfter(GPURenderBundleEncoder, 'draw',  validateBindGroups);
wrapFunctionAfter(GPURenderBundleEncoder, 'drawIndexed',  validateBindGroups);
wrapFunctionAfter(GPURenderBundleEncoder, 'drawIndirect',  validateBindGroups);
wrapFunctionAfter(GPURenderBundleEncoder, 'drawIndexedIndirect',  validateBindGroups);

wrapFunctionAfter(GPUComputePassEncoder, 'setPipeline', setPipeline);
wrapFunctionAfter(GPUComputePassEncoder, 'setBindGroup', setBindGroup);
wrapFunctionAfter(GPUComputePassEncoder, 'dispatchWorkgroups', validateBindGroups);
wrapFunctionAfter(GPUComputePassEncoder, 'dispatchWorkgroupsIndirect', validateBindGroups);

wrapFunctionAfter(GPUTexture, 'createView', function(this: GPUTexture, view: GPUTextureView) {
  textureViewToTexture.set(view, this);
});

wrapFunctionAfter(GPUCommandEncoder, 'beginRenderPass', function(this: GPUCommandEncoder, passEncoder: GPURenderPassEncoder, [desc]: [GPURenderPassDescriptor]) {
  let targetWidth: number | undefined;
  let targetHeight: number | undefined;

  const addView = (attachment: GPURenderPassColorAttachment | GPURenderPassDepthStencilAttachment | null | undefined) => {
    if (!attachment) {
      return;
    }
    const {view} = attachment;
    const texture = textureViewToTexture.get(view)!;
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

  assert(targetWidth !== undefined);
  assert(targetHeight !== undefined);

  renderPassToPassInfoMap.set(passEncoder, {
    targetWidth,
    targetHeight,
  });
});

wrapFunctionBefore(GPURenderPassEncoder, 'setViewport', function(this: GPURenderPassEncoder, [x, y, width, height, minDepth, maxDepth]: [number, number, number, number, number, number]) {
  const {
    targetWidth,
    targetHeight,
  } = renderPassToPassInfoMap.get(this)!;
  assert(x >= 0, 'x < 0');
  assert(y >= 0, 'y < 0');
  assert(x + width <= targetWidth, 'x + width > texture.width');
  assert(y + height <= targetHeight, 'y + height > texture.height');
});

wrapFunctionBefore(GPURenderPassEncoder, 'setScissorRect', function(this: GPURenderPassEncoder, [x, y, width, height]: [number, number, number, number]) {
  const {
    targetWidth,
    targetHeight,
  } = renderPassToPassInfoMap.get(this)!;
  assert(x >= 0, 'x < 0');
  assert(y >= 0, 'y < 0');
  assert(x + width <= targetWidth, 'x + width > texture.width');
  assert(y + height <= targetHeight, 'y + height > texture.height');
});
