import {describe, it} from '../mocha-support.js';
import {expectValidationError} from '../js/utils.js';

async function createCommandEncoder(device) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  return device.createCommandEncoder();
}

async function createComputePass(device, encoder) {
  encoder = encoder || await createCommandEncoder(device);
  const pass = encoder.beginComputePass();
  return pass;
}

async function createComputePipeline(device) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  const module = device.createShaderModule({
    code: `
      @compute @workgroup_size(1) fn csMain() { }
    `,
  });
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module },
  });
  return pipeline;
}

describe('test compute pass encoder', () => {

 describe('check errors on beginComputePass', () => {

    it('errors if 2 passes are started', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      await createComputePass(device, encoder);
      await expectValidationError(true, async () => {
        await createComputePass(device, encoder);
      });
    });

    it('can not end twice', async () => {
      const pass = await createComputePass();
      pass.end();
      await expectValidationError(true, async () => {
        pass.end();
      });
    });

  });

  describe('check errors on setPipeline', () => {

    it('pipeline from different device', async () => {
      const pipeline = await createComputePipeline();
      const pass = await createComputePass();
      await expectValidationError(true, () => {
        pass.setPipeline(pipeline);
      });
    });

    it('fails if ended', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const pipeline = await createComputePipeline(device);
      const pass = await createComputePass(device);
      pass.end();
      await expectValidationError(true, () => {
        pass.setPipeline(pipeline);
      });
    });

  });

});
