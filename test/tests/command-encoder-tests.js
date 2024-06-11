import {describe} from '../mocha-support.js';
import {expectValidationError, itWithDevice} from '../js/utils.js';
import copyBufferToBufferTests from './command-encoder/copyBufferToBuffer-tests.js';
import copyBufferToTextureTests from './command-encoder/copyBufferToTexture-tests.js';
import copyTextureToBufferTests from './command-encoder/copyTextureToBuffer-tests.js';
import copyTextureToTextureTests from './command-encoder/copyTextureToTexture-tests.js';

async function createCommandEncoder(device) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  return device.createCommandEncoder();
}

describe('test command encoder', () => {

  describe('test finish', () => {

     itWithDevice('can not finish twice', async (device) => {
      const encoder = await createCommandEncoder(device);
      encoder.finish();
      await expectValidationError(true, async () => {
        encoder.finish();
      });
    });

     itWithDevice('can not finish if locked', async (device) => {
      const encoder = await createCommandEncoder(device);
      encoder.beginComputePass();
      await expectValidationError(true, async () => {
        encoder.finish();
      });
    });

  });

  describe('test clearBuffer', () => {

     itWithDevice('works', async (device) => {
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_DST});
      await expectValidationError(false, async () => {
        encoder.clearBuffer(buffer);
      });
    });

     itWithDevice('fails if encoder is locked', async (device) => {
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_DST});
      encoder.beginComputePass();
      await expectValidationError(true, async () => {
        encoder.clearBuffer(buffer);
      });
    });

     itWithDevice('fails if encoder is finished', async (device) => {
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_DST});
      encoder.finish();
      await expectValidationError(true, async () => {
        encoder.clearBuffer(buffer);
      });
    });

     itWithDevice('fails if buffer is destroyed', async (device) => {
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_DST});
      buffer.destroy();
      await expectValidationError(true, async () => {
        encoder.clearBuffer(buffer);
      });
    });

     itWithDevice('fails if buffer is from a different device', async (device) => {
      const encoder = await createCommandEncoder(device);
      const device2 = await (await navigator.gpu.requestAdapter()).requestDevice();
      const buffer = device2.createBuffer({size: 16, usage: GPUBufferUsage.COPY_DST});
      await expectValidationError(true, async () => {
        encoder.clearBuffer(buffer);
      });
    });

     itWithDevice('fails if buffer.usage missing COPY_DST', async (device) => {
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_SRC});
      await expectValidationError(true, async () => {
        encoder.clearBuffer(buffer);
      });
    });

     itWithDevice('fails if size is not multiple of 4', async (device) => {
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_DST});
      await expectValidationError(true, async () => {
        encoder.clearBuffer(buffer, 0, 3);
      });
    });

     itWithDevice('fails if offset is not multiple of 4', async (device) => {
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_DST});
      await expectValidationError(true, async () => {
        encoder.clearBuffer(buffer, 1, 4);
      });
    });

     itWithDevice('fails if offset + size > buffer.size', async (device) => {
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_DST});
      await expectValidationError(true, async () => {
        encoder.clearBuffer(buffer, 12, 8);
      });
    });

  });

  copyBufferToBufferTests();
  copyBufferToTextureTests();
  copyTextureToBufferTests();
  copyTextureToTextureTests();

});
