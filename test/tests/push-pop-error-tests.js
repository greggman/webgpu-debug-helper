import {describe} from '../mocha-support.js';
import { itWithDevice } from '../js/utils.js';
import { assertFalsy, assertInstanceOf } from '../assert.js';

describe('test push/pop error scope', () => {

   itWithDevice('test we get error (because they are being captured)', async (device) => {
    device.pushErrorScope('validation');
      device.createSampler({maxAnisotropy: 0});
    const err = await device.popErrorScope();
    assertInstanceOf(err, GPUValidationError);
  });

   itWithDevice('test we get errors nested', async (device) => {
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

   itWithDevice('test we get errors nested - more', async (device) => {
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

   itWithDevice('test we get uncaught errors', async (device) => {
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
