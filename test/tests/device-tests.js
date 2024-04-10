
import {
  assertEqual,
  assertFalsy,
  assertIsArray,
  assertInstanceOf,
  assertStrictEqual,
  assertStrictNotEqual,
  assertTruthy,
} from '../assert.js';
import {describe, it, beforeEach, afterEach} from '../mocha-support.js';
import {expectValidationError} from '../js/utils.js';

async function createBindGroupLayout(device) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  return device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {},
      },
    ],
  });
}

async function createBindGroup(device, buffer) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  buffer = buffer || await device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM});
  const bindGroupLayout = createBindGroupLayout(device);
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer } },
    ]
  });
  return bindGroup;
}

describe('test device', () => {

  describe('test createBindGroup', () =>  {

    it('fails if resource buffer is destroyed', async () => {

      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM});
      buffer.destroy();
      await expectValidationError(true, async () => {
        const bindGroup = await createBindGroup(device, buffer);
      });

    });

    it('fails if size > buffer.size', async () => {

      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM});
      const bindGroupLayout = await createBindGroupLayout(device);

      await expectValidationError(true, async () => {
        const bindGroup = device.createBindGroup({
          layout: bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer, size: 32 } },
          ],
        });
      });

    });

    it('fails if offset + size > buffer.size', async () => {

      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM});
      const bindGroupLayout = await createBindGroupLayout(device);

      await expectValidationError(true, async () => {
        const bindGroup = device.createBindGroup({
          layout: bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer, offset: 16, size: 16 } },
          ],
        });
      });

    });

  });

});
