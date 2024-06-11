import {describe} from '../mocha-support.js';
import {expectValidationError, itWithDevice} from '../js/utils.js';
import {addBindingMixinTests} from './binding-mixin-tests.js';
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

async function createRenderBundleEncoder(device) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  return device.createRenderBundleEncoder({
    colorFormats: ['rgba8unorm'],
  });
}

describe('test render bundle encoder', () => {

  addRenderMixinTests({
    makePass: async (device) => {
      return await createRenderBundleEncoder(device);
    },
    endPass(pass) {
      pass.finish();
    },
  });

  describe('check errors on setPipeline', () => {

     itWithDevice('pipeline from different device', async (device) => {
      const pipeline = await createRenderPipeline(device);
      const pass = await createRenderPass();
      await expectValidationError(true, () => {
        pass.setPipeline(pipeline);
      });
    });

     itWithDevice('fails if ended', async (device) => {
      const pipeline = await createRenderPipeline(device);
      const pass = await createRenderPass(device);
      pass.end();
      await expectValidationError(true, () => {
        pass.setPipeline(pipeline);
      });
    });

  });

  addBindingMixinTests({
    makePass: async (device) => {
      return await createRenderBundleEncoder(device);
    },
    endPass(pass) {
      pass.finish();
    },
  });

});
