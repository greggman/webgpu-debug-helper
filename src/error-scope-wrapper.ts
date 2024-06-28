/* eslint-disable no-inner-declarations */
import {
  s_objToDevice
} from './object-to-device.js';

if (typeof GPUDevice !== 'undefined') {

  const deviceToErrorScopeStack: WeakMap<GPUDevice, {filter: GPUErrorFilter, errors: Promise<GPUError | null>[]}[]> = new WeakMap();
  const origPushErrorScope = GPUDevice.prototype.pushErrorScope;
  const origPopErrorScope = GPUDevice.prototype.popErrorScope;

  type AnyFunction = (...args: any[]) => any;

  function errorWrapper<T extends AnyFunction>(this: any, device: GPUDevice, fnName: string, origFn: T, ...args: Parameters<T>): ReturnType<T> {
    const stack = new Error();
    origPushErrorScope.call(device, 'validation');
    const result = origFn.call(this, ...args);

    const errorScopeStack = deviceToErrorScopeStack.get(device)!;
    const currentErrorScope = errorScopeStack.findLast(scope => scope.filter === 'validation');

    const promise = origPopErrorScope.call(device)
      .then(error => {
        // If there was a currentErrorScope when we added pushed then remove our promise
        if (currentErrorScope) {
          const ndx = currentErrorScope.errors.indexOf(promise);
          if (ndx) {
            currentErrorScope.errors.splice(ndx, 1);
          }
        } else {
          // there was no currentErrorScope so emit the error
          if (error) {
            device.dispatchEvent(new GPUUncapturedErrorEvent('uncapturederror', { error }));
          }
        }

        // show it
        if (error) {
          console.error('WebGPU ERROR in:', fnName, args);
          console.error(error.message);
          console.error(stack.stack);
        }

        // return it (as a promise)
        return error;
       });

    if (currentErrorScope) {
      currentErrorScope.errors.push(promise);
    }
    return result;
  }

  function addErrorWrapper<T extends { prototype: any }>(api: T, fnName: keyof T['prototype'] & PropertyKey): void {
    const origFn = api.prototype[fnName] as AnyFunction;
    api.prototype[fnName] = function (this: any, ...args: any[]) {
      return errorWrapper.call(this, this, fnName.toString(), origFn, ...args);
    };
  }

  function addErrorWrapperWithDevice<T extends { prototype: any }>(api: T, fnName: keyof T['prototype'] & PropertyKey): void {
    const origFn = api.prototype[fnName] as AnyFunction;
    api.prototype[fnName] = function (this: any, ...args: any[]) {
      const device = s_objToDevice.get(this as GPUQueue)!;
      return errorWrapper.call(this, device, fnName.toString(), origFn, ...args);
    };
  }

  /**
   * given a class returns all the method names.
   */
  function getAPIFunctionNames<T extends { prototype: any }>(api: T) {
    return Object.entries(Object.getOwnPropertyDescriptors(api.prototype))
       .filter(([, info]) => info.enumerable && typeof info.value === 'function')
       .map(([name]) => name as keyof T['prototype'] & PropertyKey);
  }

  const skip = new Set([
    'pushErrorScope',
    'popErrorScope',
    'destroy',
  ]);
  getAPIFunctionNames(GPUDevice)
    .filter(n => !skip.has(n))
    .forEach(n => addErrorWrapper(GPUDevice, n));
  getAPIFunctionNames(GPUQueue)
    .forEach(n => addErrorWrapperWithDevice(GPUQueue, n));

  GPUDevice.prototype.pushErrorScope = (function (origFn) {
    return function (this: GPUDevice, filter: GPUErrorFilter) {
      origFn.call(this, filter);
      const errorScopeStack = deviceToErrorScopeStack.get(this);
      errorScopeStack!.push({filter, errors: []});
    };
  })(GPUDevice.prototype.pushErrorScope);

  GPUDevice.prototype.popErrorScope = (function (origFn) {
    return async function (this: GPUDevice) {
      const errorScopeStack = deviceToErrorScopeStack.get(this);
      const errorScope = errorScopeStack!.pop();
      if (errorScope === undefined) {
        throw new DOMException('popErrorScope called on empty error scope stack', 'OperationError');
      }
      const errPromise = origFn.call(this);
      return errorScope.errors.pop() ?? errPromise;
    };
  })(GPUDevice.prototype.popErrorScope);

  GPUAdapter.prototype.requestDevice = (function (origFn) {
    return async function (this: GPUAdapter, ...args) {
      const device = await origFn.call(this, ...args);
      if (device) {
        device.addEventListener('uncapturederror', function (e) {
          console.error((e as GPUUncapturedErrorEvent).error.message);
        });
        deviceToErrorScopeStack.set(device, []);
        s_objToDevice.set(device.queue, device);
      }
      return device;
    };
  })(GPUAdapter.prototype.requestDevice);

}