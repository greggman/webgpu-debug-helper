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

async function createComputePass() {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  return pass;
}

async function createComputePipeline() {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const module = device.createShaderModule({
    code: `
      @compute @workgroup_size(1) fn csMain() { }
    `,
  });
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module },
  })
  return pipeline;
}

describe('test compute pass encoder', () => {

  describe('check errors on setPipeline', () => {

    it('pipeline from different device', async () => {
      const pipeline = await createComputePipeline();
      const pass = await createComputePass();
      expectValidationError(true, () => {
        pass.setPipeline(pipeline);
      });
    });

  });

});
