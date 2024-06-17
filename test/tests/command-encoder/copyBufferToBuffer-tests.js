import {describe} from '../../mocha-support.js';
import {expectValidationError, itWithDevice} from '../../js/utils.js';

async function createCommandEncoder(device) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  return device.createCommandEncoder();
}

export default function () {
  describe('test copyBufferToBuffer', () => {

    itWithDevice('works', async (device) => {
      const encoder = await createCommandEncoder(device);
      const src = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_SRC});
      const dst = device.createBuffer({size: 32, usage: GPUBufferUsage.COPY_DST});
      await expectValidationError(false, async () => {
        encoder.copyBufferToBuffer(src, 0, dst, 0, 16);
      });
    });

    itWithDevice('fails if src not same device', async (device) => {
      const encoder = await createCommandEncoder(device);
      const device2 = await (await navigator.gpu.requestAdapter()).requestDevice();
      const src = device2.createBuffer({size: 16, usage: GPUBufferUsage.COPY_SRC});
      const dst = device.createBuffer({size: 32, usage: GPUBufferUsage.COPY_DST});
      await expectValidationError(true, async () => {
        encoder.copyBufferToBuffer(src, 0, dst, 0, 16);
      });
    });

    itWithDevice('fails if dst not same device', async (device) => {
      const encoder = await createCommandEncoder(device);
      const device2 = await (await navigator.gpu.requestAdapter()).requestDevice();
      const src = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_SRC});
      const dst = device2.createBuffer({size: 32, usage: GPUBufferUsage.COPY_DST});
      await expectValidationError(true, async () => {
        encoder.copyBufferToBuffer(src, 0, dst, 0, 16);
      });
    });

    itWithDevice('fails if src = dst', async (device) => {
      const encoder = await createCommandEncoder(device);
      const src = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST});
      await expectValidationError(true, async () => {
        encoder.copyBufferToBuffer(src, 0, src, 0, 16);
      });
    });

    itWithDevice('fails if src destroyed', async (device) => {
      const encoder = await createCommandEncoder(device);
      const src = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_SRC});
      const dst = device.createBuffer({size: 32, usage: GPUBufferUsage.COPY_DST});
      src.destroy();
      await expectValidationError(true, async () => {
        encoder.copyBufferToBuffer(src, 0, dst, 0, 16);
      });
    });

    itWithDevice('fails if dst destroyed', async (device) => {
      const encoder = await createCommandEncoder(device);
      const src = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_SRC});
      const dst = device.createBuffer({size: 32, usage: GPUBufferUsage.COPY_DST});
      dst.destroy();
      await expectValidationError(true, async () => {
        encoder.copyBufferToBuffer(src, 0, dst, 0, 16);
      });
    });

    itWithDevice('fails if src.usage missing COPY_SRC', async (device) => {
      const encoder = await createCommandEncoder(device);
      const src = device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM});
      const dst = device.createBuffer({size: 32, usage: GPUBufferUsage.COPY_DST});
      await expectValidationError(true, async () => {
        encoder.copyBufferToBuffer(src, 0, dst, 0, 16);
      });
    });

    itWithDevice('fails if dst.usage missing COPY_DST', async (device) => {
      const encoder = await createCommandEncoder(device);
      const src = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_SRC});
      const dst = device.createBuffer({size: 32, usage: GPUBufferUsage.UNIFORM});
      await expectValidationError(true, async () => {
        encoder.copyBufferToBuffer(src, 0, dst, 0, 16);
      });
    });

    const tests = [
      { srcOffset: 24, desc: 'srcOffset + size > src.size' },
      { dstOffset: 24, desc: 'dstOffset + size > dst.size' },
      { size: 15, desc: 'size not multiple of 4' },
      { size: 8, srcOffset: 1, desc: 'srcOffset not multiple of 4' },
      { size: 8, dstOffset: 1, desc: 'dstOffset not multiple of 4' },
    ];
    for (const {srcOffset = 0, dstOffset = 0, size = 16, desc} of tests) {
      itWithDevice(desc, async (device) => {
        const encoder = await createCommandEncoder(device);
        const src = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_SRC});
        const dst = device.createBuffer({size: 32, usage: GPUBufferUsage.COPY_DST});
        await expectValidationError(true, async () => {
          encoder.copyBufferToBuffer(src, srcOffset, dst, dstOffset, size);
        });
      });
    }

  });
}