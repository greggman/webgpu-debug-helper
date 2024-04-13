import {describe, it} from '../mocha-support.js';
import {expectValidationError} from '../js/utils.js';
import {addRenderMixinTests} from './render-mixin-tests.js';

async function createCommandEncoder(device) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  return device.createCommandEncoder();
}

async function createRenderPass(device, encoder) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  encoder = encoder || await createCommandEncoder(device);
  const texture = device.createTexture({
    size: [2, 3],
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
    format: 'rgba8unorm',
  });
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: texture.createView(),
        clearColor: [0, 0, 0, 0],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  });
  return pass;
}

async function createRenderPipeline(device) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  const module = device.createShaderModule({
    code: `
      @vertex fn vsMain() -> @builtin(position) vec4f { return vec4f(0); }
      @fragment fn fsMain() -> @location(0) vec4f { return vec4f(0); }
    `,
  });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module },
    fragment: { module, targets: [ { format: 'rgba8unorm' } ]},
  });
  return pipeline;
}

async function createBindGroup(device, buffer) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {},
      },
    ],
  });
  buffer = buffer || device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM});
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer } },
    ],
  });
  return bindGroup;
}

async function createRenderBundleEncoder(device) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  return device.createRenderBundleEncoder({
    colorFormats: ['rgba8unorm'],
  });
}

describe('test render bundle encoder', () => {

  addRenderMixinTests({
    makePass: async (device) => {
      const pass = await createRenderBundleEncoder(device);
      return pass;
    },
    endPass(pass) {
      pass.finish();
    },
  });

  describe('check errors on setPipeline', () => {

    it('pipeline from different device', async () => {
      const pipeline = await createRenderPipeline();
      const pass = await createRenderPass();
      await expectValidationError(true, () => {
        pass.setPipeline(pipeline);
      });
    });

    it('fails if ended', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const pipeline = await createRenderPipeline(device);
      const pass = await createRenderPass(device);
      pass.end();
      await expectValidationError(true, () => {
        pass.setPipeline(pipeline);
      });
    });

  });

  describe('check errors on setBindGroup', () => {

    it('works', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const pass = await createRenderPass(device);
      const bindGroup = await createBindGroup(device);
      await expectValidationError(false, () => {
        pass.setBindGroup(0, bindGroup);
      });
    });

    it('fails if ended', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const pass = await createRenderPass(device);
      const bindGroup = await createBindGroup(device);
      pass.end();
      await expectValidationError(true, () => {
        pass.setBindGroup(0, bindGroup);
      });
    });

    it('bindGroup from different device', async () => {
      const pass = await createRenderPass();
      const bindGroup = await createBindGroup();
      await expectValidationError(true, () => {
        pass.setBindGroup(0, bindGroup);
      });
    });

    it('index < 0', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const pass = await createRenderPass(device);
      const bindGroup = await createBindGroup(device);
      await expectValidationError(true, () => {
        pass.setBindGroup(-1, bindGroup);
      });
    });

    it('index > max', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const pass = await createRenderPass(device);
      const bindGroup = await createBindGroup(device);
      await expectValidationError(true, () => {
        pass.setBindGroup(device.limits.maxBindGroups, bindGroup);
      });
    });

    it('fails if buffer destroyed', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const pass = await createRenderPass(device);
      const buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM});
      const bindGroup = await createBindGroup(device, buffer);
      buffer.destroy();
      await expectValidationError(true, () => {
        pass.setBindGroup(0, bindGroup);
      });
    });

  });

});
