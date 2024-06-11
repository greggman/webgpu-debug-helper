import {describe} from '../mocha-support.js';
import {expectValidationError, itWithDevice} from '../js/utils.js';

async function createCommandEncoder(device) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  return device.createCommandEncoder();
}

async function createRenderPass(device, encoder, texture) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  encoder = encoder || await createCommandEncoder(device);
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

describe('test canvas context', () => {

  describe('test getCurrentTexture', () => {

    itWithDevice('works', async (device) => {
      const context = new OffscreenCanvas(1, 1).getContext('webgpu');
      context.configure({
        device,
        format: 'rgba8unorm',
      });
      const texture = context.getCurrentTexture();
      await expectValidationError(false, async () => {
        await createRenderPass(device, undefined, texture);
      });
    });

  });

});
