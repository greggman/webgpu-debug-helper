if (typeof GPUDevice !== 'undefined') {
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
      fnName: K, fn: (...args: Parameters<T[K]>) => void) {
    const origFn = API.prototype[fnName];
    API.prototype[fnName] = function (this: T, ...args: any) {
      fn.call(this, ...args);
      return origFn.call(this, ...args);
    } as any;
  }

  function wrapFunctionAfter<K extends PropertyKey, T extends Record<K, (...args: any) => any>>(
      API: { prototype: T },
      fnName: K, fn: (obj: ReturnType<T[K]>,...args: Parameters<T[K]>) => void) {
    const origFn = API.prototype[fnName];
    API.prototype[fnName] = function (this: T, ...args: any) {
      const result = origFn.call(this, ...args);
      fn.call(this, result, ...args);
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

  const textureViewToTexture = new WeakMap<GPUTextureView, GPUTexture>();
  const renderPassToPassInfoMap = new WeakMap<GPURenderPassEncoder, RenderPassInfo>();

  wrapFunctionAfter(GPUTexture, 'createView', function(this: GPUTexture, view: GPUTextureView, desc?: GPUTextureViewDescriptor) {
    textureViewToTexture.set(view, this);
  });

  wrapFunctionAfter(GPUCommandEncoder, 'beginRenderPass', function(this: GPUCommandEncoder, passEncoder: GPURenderPassEncoder, desc: GPURenderPassDescriptor) {
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

  wrapFunctionBefore(GPURenderPassEncoder, 'setViewport', function(this: GPURenderPassEncoder, x: number, y: number, width: number, height: number, minDepth: number, maxDepth: number) {
    const {
      targetWidth,
      targetHeight,
    } = renderPassToPassInfoMap.get(this)!;
    assert(x >= 0, 'x < 0');
    assert(y >= 0, 'y < 0');
    assert(x + width <= targetWidth, 'x + width > texture.width');
    assert(y + height <= targetHeight, 'y + height > texture.height');
  });

}