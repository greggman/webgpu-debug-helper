import {describe} from '../mocha-support.js';
import { itWithDevice } from '../js/utils.js';
import { assertEqual, assertFalsy, assertInstanceOf, assertTruthy } from '../assert.js';

function causeError(device, filter) {
  switch (filter) {
    case 'validation':
      device.createBuffer({
        size: 1024,
        usage: 0xffff, // Invalid GPUBufferUsage
      });
      break;
    case 'out-of-memory':
      device.createTexture({
        // One of the largest formats. With the base limits, the texture will be 256 GiB.
        format: 'rgba32float',
        usage: GPUTextureUsage.COPY_DST,
        size: [
          device.limits.maxTextureDimension2D,
          device.limits.maxTextureDimension2D,
          device.limits.maxTextureArrayLayers,
        ],
      });
      break;
    default:
      throw Error('unreachable');
  }
}

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

  itWithDevice('test we get errors with success after error', async (device) => {
    device.pushErrorScope('validation');
    device.createSampler({maxAnisotropy: 0});
    device.queue.submit([]);
    const err = await device.popErrorScope();
    assertInstanceOf(err, GPUValidationError);
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

  describe('test scope filters work', () => {

    itWithDevice('out-of-memory', async (device) => {
      let uncapturedError;
      device.addEventListener('uncapturederror', e => {
        uncapturedError = e.error;
      });
      device.pushErrorScope('out-of-memory');
        device.pushErrorScope('validation');
          causeError(device, 'out-of-memory');
        const validationError = await device.popErrorScope();
      const outOfMemoryError = await device.popErrorScope();
      assertFalsy(validationError, 'no validation error');
      assertInstanceOf(outOfMemoryError, GPUOutOfMemoryError);
      assertFalsy(uncapturedError, 'no uncaptured error');
    });

    itWithDevice('validation', async (device) => {
      let uncapturedError;
      device.addEventListener('uncapturederror', e => {
        uncapturedError = e.error;
      });
      device.pushErrorScope('validation');
        device.pushErrorScope('out-of-memory');
          causeError(device, 'validation');
        const outOfMemoryError = await device.popErrorScope();
      const validationError = await device.popErrorScope();
      assertFalsy(outOfMemoryError, 'no out of memory error');
      assertInstanceOf(validationError, GPUValidationError);
      assertFalsy(uncapturedError, 'no uncaptured error');
    });

    itWithDevice('both', async (device) => {
      let uncapturedError;
      device.addEventListener('uncapturederror', e => {
        uncapturedError = e.error;
      });
      device.pushErrorScope('validation');
        device.pushErrorScope('out-of-memory');
          causeError(device, 'validation');
          causeError(device, 'out-of-memory');
        const outOfMemoryError = await device.popErrorScope();
      const validationError = await device.popErrorScope();
      assertInstanceOf(outOfMemoryError, GPUOutOfMemoryError);
      assertInstanceOf(validationError, GPUValidationError);
      assertFalsy(uncapturedError, 'no uncaptured error');
    });

  });

  itWithDevice('test we get rejection for empty stack, not an exception', async (device) => {
    let rejectedError;
    try {
      await device.popErrorScope()
        .then(() => assertFalsy(true, 'should not succeed'))
        .catch((error) => {
          rejectedError = error;
        });
    } catch {
      assertFalsy(true, 'should not throw');
    }
    assertInstanceOf(rejectedError, DOMException);
    assertEqual(rejectedError.name, 'OperationError');
   });

});
