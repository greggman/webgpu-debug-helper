import {describe} from '../mocha-support.js';
import {expectValidationError, itWithDevice} from '../js/utils.js';
import {addValidateBindGroupTests} from './binding-mixin-tests.js';
import {addTimestampWriteTests} from './timestamp-tests.js';

async function createCommandEncoder(device) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  return device.createCommandEncoder();
}

async function createComputePass(device, encoder, { timestampWrites } = {}) {
  encoder = encoder || await createCommandEncoder(device);
  const pass = encoder.beginComputePass({
    ...(timestampWrites && { timestampWrites }),
  });
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

async function createComputeBindGroupPipeline(device, {
  resourceWGSL,
  usageWGSL,
  layout = 'auto',
}) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  const module = device.createShaderModule({
    code: `
      ${resourceWGSL}
      @compute @workgroup_size(1) fn csMain() {
        ${usageWGSL};
      }
    `,
  });
  const pipeline = device.createComputePipeline({
    layout,
    compute: { module },
  });
  const indirectBuffer = device.createBuffer({size: 12, usage: GPUBufferUsage.INDIRECT });
  return { pipeline, indirectBuffer };
}

describe('test compute pass encoder', () => {

 describe('check errors on beginComputePass', () => {

    itWithDevice('errors if 2 passes are started', async (device) => {
      const encoder = await createCommandEncoder(device);
      await createComputePass(device, encoder);
      await expectValidationError(true, async () => {
        await createComputePass(device, encoder);
      });
    });

    itWithDevice('can not end twice', async (device) => {
      const pass = await createComputePass(device);
      pass.end();
      await expectValidationError(true, async () => {
        pass.end();
      });
    });

    addTimestampWriteTests({
      makePass(device, {timestampWrites}) {
        return createComputePass(device, undefined, { timestampWrites });
      },
    });

  });

  describe('check errors on setPipeline', () => {

    itWithDevice('pipeline from different device', async (device) => {
      const pipeline = await createComputePipeline(device);
      const pass = await createComputePass();
      await expectValidationError(true, () => {
        pass.setPipeline(pipeline);
      });
    });

    itWithDevice('fails if ended', async (device) => {
      const pipeline = await createComputePipeline(device);
      const pass = await createComputePass(device);
      pass.end();
      await expectValidationError(true, () => {
        pass.setPipeline(pipeline);
      });
    });

  });

  describe('dispatchWorkgroups', () => {

    const tests = [
      { expectError: false, args: [1], desc: 'works' },
      { expectError: true, args: [100000000] , desc: 'x too big' },
      { expectError: true, args: [1, 100000000] , desc: 'y too big' },
      { expectError: true, args: [1, 1, 100000000] , desc: 'z too big' },
    ];
    for (const {expectError, args, desc} of tests) {
      itWithDevice(desc, async (device) => {
        const pipeline = await createComputePipeline(device);
        const pass = await createComputePass(device);
        pass.setPipeline(pipeline);
        await expectValidationError(expectError, () => {
          pass.dispatchWorkgroups(...args);
        });
      });
    }

    addValidateBindGroupTests({
      makePassAndPipeline: async (device, options) => {
        const { pipeline } = await createComputeBindGroupPipeline(device, options);
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        return {pass, pipeline};
      },
      execute(pass) {
        pass.dispatchWorkgroups(1);
      },
      visibility: GPUShaderStage.COMPUTE,
    });

  });

  describe('dispatchWorkgroupsIndirect', () => {

    itWithDevice('works', async (device) => {
      const pipeline = await createComputePipeline(device);
      const indirectBuffer = device.createBuffer({size: 12, usage: GPUBufferUsage.INDIRECT});
      const pass = await createComputePass(device);
      pass.setPipeline(pipeline);
      await expectValidationError(false, () => {
        pass.dispatchWorkgroupsIndirect(indirectBuffer, 0);
      });
    });

    itWithDevice('fails if indirectBuffer destroyed', async (device) => {
      const pipeline = await createComputePipeline(device);
      const indirectBuffer = device.createBuffer({size: 12, usage: GPUBufferUsage.INDIRECT});
      const pass = await createComputePass(device);
      pass.setPipeline(pipeline);
      indirectBuffer.destroy();
      await expectValidationError(true, () => {
        pass.dispatchWorkgroupsIndirect(indirectBuffer, 0);
      });
    });

    itWithDevice('fails if indirect offset outside data', async (device) => {
      const pipeline = await createComputePipeline(device);
      const indirectBuffer = device.createBuffer({size: 12, usage: GPUBufferUsage.INDIRECT});
      const pass = await createComputePass(device);
      pass.setPipeline(pipeline);
      await expectValidationError(true, () => {
        pass.dispatchWorkgroupsIndirect(indirectBuffer, 4);
      });
    });

    itWithDevice('fails if indirect size too small', async (device) => {
      const pipeline = await createComputePipeline(device);
      const indirectBuffer = device.createBuffer({size: 8, usage: GPUBufferUsage.INDIRECT});
      const pass = await createComputePass(device);
      pass.setPipeline(pipeline);
      await expectValidationError(true, () => {
        pass.dispatchWorkgroupsIndirect(indirectBuffer, 0);
      });
    });

    addValidateBindGroupTests((() => {
      let ib;
      return {
        makePassAndPipeline: async (device, options) => {
          const { pipeline, indirectBuffer } = await createComputeBindGroupPipeline(device, options);
          ib = indirectBuffer;
          const encoder = device.createCommandEncoder();
          const pass = encoder.beginComputePass();
          pass.setPipeline(pipeline);
          return {pass, pipeline};
        },
        execute(pass) {
          pass.dispatchWorkgroupsIndirect(ib, 0);
        },
        visibility: GPUShaderStage.COMPUTE,
      };
    })());

  });

});
