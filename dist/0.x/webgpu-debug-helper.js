/* webgpu-debug-helper@0.0.2, license MIT */
if (typeof GPUDevice !== 'undefined') {
    const deviceToErrorScopeStack = new WeakMap();
    const origPushErrorScope = GPUDevice.prototype.pushErrorScope;
    const origPopErrorScope = GPUDevice.prototype.popErrorScope;
    function assert(condition, msg) {
        if (!condition) {
            emitError(msg ? (typeof msg === 'string' ? msg : msg()) : '');
        }
    }
    function getFilterForGPUError(error) {
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
    function emitGPUError(device, error) {
        const filter = getFilterForGPUError(error);
        const errorScopeStack = deviceToErrorScopeStack.get(device);
        const currentErrorScope = errorScopeStack.findLast(scope => scope.filter === filter);
        if (currentErrorScope) {
            currentErrorScope.errors.push(error);
        }
        else {
            device.dispatchEvent(new GPUUncapturedErrorEvent('uncapturedError', { error }));
        }
    }
    function addErrorWrapper(api, fnName) {
        const origFn = api.prototype[fnName];
        api.prototype[fnName] = function (...args) {
            const stack = new Error();
            origPushErrorScope.call(this, 'validation');
            const result = origFn.call(this, ...args);
            origPopErrorScope.call(this)
                .then(error => {
                if (error) {
                    console.error(fnName, args);
                    console.error(error.message);
                    console.error(stack.stack);
                    emitGPUError(this, error);
                }
            });
            return result;
        };
    }
    function getAPIFunctionNames(api) {
        return Object.entries(Object.getOwnPropertyDescriptors(api.prototype))
            .filter(([, info]) => info.enumerable && typeof info.value === 'function')
            .map(([name]) => name);
    }
    const skip = new Set([
        'pushErrorScope',
        'popErrorScope',
        'destroy',
    ]);
    getAPIFunctionNames(GPUDevice)
        .filter(n => !skip.has(n))
        .forEach(n => addErrorWrapper(GPUDevice, n));
    GPUDevice.prototype.pushErrorScope = (function (origFn) {
        return function (filter) {
            origFn.call(this, filter);
            const errorScopeStack = deviceToErrorScopeStack.get(this);
            errorScopeStack.push({ filter, errors: [] });
        };
    })(GPUDevice.prototype.pushErrorScope);
    GPUDevice.prototype.popErrorScope = (function (origFn) {
        return async function () {
            const errorScopeStack = deviceToErrorScopeStack.get(this);
            const errorScope = errorScopeStack.pop();
            if (errorScope === undefined) {
                throw new DOMException('popErrorScope called on empty error scope stack', 'OperationError');
            }
            const err = await origFn.call(this);
            return errorScope.errors.length > 0 ? errorScope.errors.pop() : err;
        };
    })(GPUDevice.prototype.popErrorScope);
    GPUAdapter.prototype.requestDevice = (function (origFn) {
        return async function (...args) {
            const device = await origFn.call(this, ...args);
            if (device) {
                device.addEventListener('uncapturederror', function (e) {
                    console.error(e.error.message);
                });
                deviceToErrorScopeStack.set(device, []);
            }
            return device;
        };
    })(GPUAdapter.prototype.requestDevice);
    function wrapFunctionBefore(API, fnName, fn) {
        const origFn = API.prototype[fnName];
        API.prototype[fnName] = function (...args) {
            fn.call(this, ...args);
            return origFn.call(this, ...args);
        };
    }
    function wrapFunctionAfter(API, fnName, fn) {
        const origFn = API.prototype[fnName];
        API.prototype[fnName] = function (...args) {
            const result = origFn.call(this, ...args);
            fn.call(this, result, ...args);
            return result;
        };
    }
    function emitError(msg, objs = []) {
        throw new Error(`${msg}\n${(objs).map(o => `[${o.constructor.name}]${o.label}`).join('\n')}`);
    }
    const textureViewToTexture = new WeakMap();
    const renderPassToPassInfoMap = new WeakMap();
    wrapFunctionAfter(GPUTexture, 'createView', function (view, desc) {
        textureViewToTexture.set(view, this);
    });
    wrapFunctionAfter(GPUCommandEncoder, 'beginRenderPass', function (passEncoder, desc) {
        let targetWidth;
        let targetHeight;
        const addView = (attachment) => {
            if (!attachment) {
                return;
            }
            const { view } = attachment;
            const texture = textureViewToTexture.get(view);
            const { width, height } = texture;
            if (targetWidth === undefined) {
                targetWidth = width;
                targetHeight = height;
            }
            else if (targetWidth !== width || targetHeight !== height) {
                emitError('attachments are not all the same width and height', [view, texture, passEncoder, this]);
            }
        };
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
    wrapFunctionBefore(GPURenderPassEncoder, 'setViewport', function (x, y, width, height, minDepth, maxDepth) {
        const { targetWidth, targetHeight, } = renderPassToPassInfoMap.get(this);
        assert(x >= 0, 'x < 0');
        assert(y >= 0, 'y < 0');
        assert(x + width <= targetWidth, 'x + width > texture.width');
        assert(y + height <= targetHeight, 'y + height > texture.height');
    });
}
//# sourceMappingURL=webgpu-debug-helper.js.map
