import {describe, it} from '../mocha-support.js';
import { assertFalsy, assertInstanceOf } from '../assert.js';

describe('test push/pop error scope', () => {

  it('test we get error (because they are being captured)', async () => {
    const device = await (await navigator.gpu.requestAdapter()).requestDevice();

    device.pushErrorScope('validation');
      device.createSampler({maxAnisotropy: 0});
    const err = await device.popErrorScope();
    assertInstanceOf(err, GPUValidationError);
  });

  it('test we get errors nested', async () => {
    const device = await (await navigator.gpu.requestAdapter()).requestDevice();

    device.pushErrorScope('validation');
      device.pushErrorScope('validation');
        device.createSampler({maxAnisotropy: 0});
        device.pushErrorScope('validation');
          device.createSampler({maxAnisotropy: 0});
          device.pushErrorScope('validation');
          const innerErr = await device.popErrorScope();
        const middleErr = await device.popErrorScope();
      const outerErr = await device.popErrorScope();
    const rootErr = await device.popErrorScope();
    assertFalsy(innerErr, GPUValidationError);
    assertInstanceOf(middleErr, GPUValidationError);
    assertInstanceOf(outerErr, GPUValidationError);
    assertFalsy(rootErr);
  });

  it('test we get errors nested - more', async () => {
    const device = await (await navigator.gpu.requestAdapter()).requestDevice();

    device.pushErrorScope('validation');
      device.pushErrorScope('validation');
        device.pushErrorScope('validation');
          device.pushErrorScope('validation');
            device.createSampler({maxAnisotropy: 0});
            device.createSampler({maxAnisotropy: 0});
            device.createSampler({maxAnisotropy: 0});
          const innerErr = await device.popErrorScope();
        const middleErr = await device.popErrorScope();
      const outerErr = await device.popErrorScope();
      device.createSampler({maxAnisotropy: 0});
    const rootErr = await device.popErrorScope();
    assertInstanceOf(innerErr, GPUValidationError);
    assertFalsy(middleErr);
    assertFalsy(outerErr);
    assertInstanceOf(rootErr, GPUValidationError);
  });

  it('test we get uncaught errors', async () => {
    const device = await (await navigator.gpu.requestAdapter()).requestDevice();

    const promise = new Promise(resolve => {
      device.addEventListener('uncapturederror', (e) => {
        resolve(e.error);
      });
    });

    //device.pushErrorScope('validation');
    //  device.pushErrorScope('validation');
    //    device.pushErrorScope('validation');
    //      device.pushErrorScope('validation');
    //        device.createSampler({maxAnisotropy: 0});
    //        device.createSampler({maxAnisotropy: 0});
    //        device.createSampler({maxAnisotropy: 0});
    //      const innerErr = await device.popErrorScope();
    //    const middleErr = await device.popErrorScope();
    //  const outerErr = await device.popErrorScope();
    //  device.createSampler({maxAnisotropy: 0});
    //const rootErr = await device.popErrorScope();
    device.createSampler({maxAnisotropy: 0});

    // we need to do something to flush the commands.
    device.queue.submit([]);

    const uncapturedError = await promise;

    //assertInstanceOf(innerErr, GPUValidationError);
    //assertFalsy(middleErr);
    //assertFalsy(outerErr);
    //assertInstanceOf(rootErr, GPUValidationError);
    assertInstanceOf(uncapturedError, GPUValidationError);
  });

});
