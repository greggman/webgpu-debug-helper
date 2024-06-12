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
      device2.destroy();
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

  describe('test resolveQuerySet', () => {

    itWithDevice('works', async (device) => {
      const querySet = device.createQuerySet({count: 2, type: 'occlusion'});
      const encoder = await createCommandEncoder(device);
      const resolveBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.QUERY_RESOLVE,
      });
      encoder.resolveQuerySet(querySet, 0, 2, resolveBuffer, 0);
      encoder.finish();
    });

    itWithDevice('fails if querySet destroyed', async (device) => {
      const querySet = device.createQuerySet({count: 2, type: 'occlusion'});
      const encoder = await createCommandEncoder(device);
      const resolveBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.QUERY_RESOLVE,
      });
      querySet.destroy();
      await expectValidationError(true, async () => {
        encoder.resolveQuerySet(querySet, 0, 2, resolveBuffer, 0);
      });
    });

    itWithDevice('fails if resolve buffer destroyed', async (device) => {
      const querySet = device.createQuerySet({count: 2, type: 'occlusion'});
      const encoder = await createCommandEncoder(device);
      const resolveBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.QUERY_RESOLVE,
      });
      resolveBuffer.destroy();
      await expectValidationError(true, async () => {
        encoder.resolveQuerySet(querySet, 0, 2, resolveBuffer, 0);
      });
    });

    itWithDevice('fails if querySet not from same device', async (device) => {
      const device2 = await (await navigator.gpu.requestAdapter()).requestDevice();
      const querySet = device2.createQuerySet({count: 2, type: 'occlusion'});
      const encoder = await createCommandEncoder(device);
      const resolveBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.QUERY_RESOLVE,
      });
      await expectValidationError(true, async () => {
        encoder.resolveQuerySet(querySet, 0, 2, resolveBuffer, 0);
      });
      device2.destroy();
    });

    itWithDevice('fails if resolveBuffer not from same device', async (device) => {
      const device2 = await (await navigator.gpu.requestAdapter()).requestDevice();
      const querySet = device.createQuerySet({count: 2, type: 'occlusion'});
      const encoder = await createCommandEncoder(device);
      const resolveBuffer = device2.createBuffer({
        size: 16,
        usage: GPUBufferUsage.QUERY_RESOLVE,
      });
      await expectValidationError(true, async () => {
        encoder.resolveQuerySet(querySet, 0, 2, resolveBuffer, 0);
      });
      device2.destroy();
    });

    itWithDevice('fails if resolveBuffer missing usage QUERY_RESOLVE', async (device) => {
      const querySet = device.createQuerySet({count: 2, type: 'occlusion'});
      const encoder = await createCommandEncoder(device);
      const resolveBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM,
      });
      await expectValidationError(true, async () => {
        encoder.resolveQuerySet(querySet, 0, 2, resolveBuffer, 0);
      });
    });

    itWithDevice('fails if start out of range', async (device) => {
      const querySet = device.createQuerySet({count: 2, type: 'occlusion'});
      const encoder = await createCommandEncoder(device);
      const resolveBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM,
      });
      await expectValidationError(true, async () => {
        encoder.resolveQuerySet(querySet, 3, 1, resolveBuffer, 0);
      });
    });

    itWithDevice('fails if end out of range', async (device) => {
      const querySet = device.createQuerySet({count: 2, type: 'occlusion'});
      const encoder = await createCommandEncoder(device);
      const resolveBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM,
      });
      await expectValidationError(true, async () => {
        encoder.resolveQuerySet(querySet, 1, 2, resolveBuffer, 0);
      });
    });

    itWithDevice('fails if resolveBuffer offset not multiple of 256', async (device) => {
      const querySet = device.createQuerySet({count: 2, type: 'occlusion'});
      const encoder = await createCommandEncoder(device);
      const resolveBuffer = device.createBuffer({
        size: 2048,
        usage: GPUBufferUsage.UNIFORM,
      });
      await expectValidationError(true, async () => {
        encoder.resolveQuerySet(querySet, 0, 2, resolveBuffer, 128);
      });
    });

    itWithDevice('fails if resolveBuffer too small', async (device) => {
      const querySet = device.createQuerySet({count: 2, type: 'occlusion'});
      const encoder = await createCommandEncoder(device);
      const resolveBuffer = device.createBuffer({
        size: 8,
        usage: GPUBufferUsage.UNIFORM,
      });
      await expectValidationError(true, async () => {
        encoder.resolveQuerySet(querySet, 0, 2, resolveBuffer, 0);
      });
    });

  });

  copyBufferToBufferTests();
  copyBufferToTextureTests();
  copyTextureToBufferTests();
  copyTextureToTextureTests();

});
