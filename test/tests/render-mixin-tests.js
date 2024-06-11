import {describe} from '../mocha-support.js';
import {expectValidationError, itWithDevice} from '../js/utils.js';
import {addValidateBindGroupTests} from './binding-mixin-tests.js';

async function createRenderPipeline(device, {
  format = 'rgba8unorm',
  sampleCount,
  depthStencilFormat,
} = {}) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  const module = device.createShaderModule({
    code: `
      @vertex fn vsMain(
        @location(0) a0 : vec4f,
        @location(1) a1 : vec4f,
        @location(2) a2 : vec4f,
      ) -> @builtin(position) vec4f {
        return a0 + a1 + a2;
      }
      @fragment fn fsMain() -> @location(0) vec4f { return vec4f(0); }
    `,
  });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
          arrayStride: 6 * 4, // 6 floats, 4 bytes each
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x3'},
            {shaderLocation: 1, offset: 12, format: 'float32x3'},
          ],
        },
        {
          stepMode: 'instance',
          arrayStride: 3 * 4, // 3 floats, 4 bytes each
          attributes: [
            {shaderLocation: 2, offset: 0, format: 'float32x3'},
          ],
        },
      ],
    },
    fragment: { module, targets: [ { format } ]},
    ...(depthStencilFormat && {
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: depthStencilFormat,
      },
    }),
    ...(sampleCount && {
      multisample: {
        count: sampleCount,
      },
    }),
  });
  return pipeline;
}

const kVertexSize = 24;
const kNumVertices = 4;
const kNumInstances = 4;
const kInstanceSize = 12;
const kNumIndices = 20;
const kIndexSize = 2;
const kIndexFormat = 'uint16';

async function createRenderPipelineAndAttribResources(device) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  const pipeline = await createRenderPipeline(device);
  const vertexBuffer0 = device.createBuffer({size: kVertexSize * kNumVertices, usage: GPUBufferUsage.VERTEX});
  const vertexBuffer1 = device.createBuffer({size: kInstanceSize * kNumInstances, usage: GPUBufferUsage.VERTEX});
  const indexBuffer = device.createBuffer({size: kNumIndices * kIndexSize, usage: GPUBufferUsage.INDEX});
  const indirectBuffer = device.createBuffer({size: 40, usage: GPUBufferUsage.INDIRECT});

  return {
    pipeline,
    device,
    vertexBuffer0,
    vertexBuffer1,
    indexBuffer,
    indirectBuffer,
  };
}

async function createRenderBindGroupPipeline(device, {
  resourceWGSL,
  usageWGSL,
  layout = 'auto',
}) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  const module = device.createShaderModule({
    code: `
      ${resourceWGSL}
      @vertex fn vsMain() -> @builtin(position) vec4f {
        ${usageWGSL};
        return vec4f(0);
      }
      @fragment fn fsMain() -> @location(0) vec4f { return vec4f(0); }
    `,
  });
  const pipeline = device.createRenderPipeline({
    layout,
    vertex: { module },
    fragment: { module, targets: [ { format: 'rgba8unorm' } ]},
  });
  const indexBuffer = device.createBuffer({size: kNumIndices * kIndexSize, usage: GPUBufferUsage.INDEX});
  const indirectBuffer = device.createBuffer({size: 40, usage: GPUBufferUsage.INDIRECT});
  return { pipeline, indexBuffer, indirectBuffer };
}

export function addRenderMixinTests({
  makePass,
  endPass,
}) {

  describe('check errors on setPipeline', () => {

    itWithDevice('pipeline from different device', async (device) => {
      const pipeline = await createRenderPipeline(device);
      const pass = await makePass();
      await expectValidationError(true, () => {
        pass.setPipeline(pipeline);
      });
    });

    itWithDevice('fails if ended', async (device) => {
      const pipeline = await createRenderPipeline(device);
      const pass = await makePass(device);
      endPass(pass);
      await expectValidationError(true, () => {
        pass.setPipeline(pipeline);
      });
    });

    itWithDevice('fails if pipeline colorFormats do not match', async (device) => {
      const pipeline = await createRenderPipeline(device, {format: 'r8unorm'});
      const pass = await makePass(device);
      await expectValidationError(true, () => {
        pass.setPipeline(pipeline);
      });
    });

    itWithDevice('fails if pipeline sampleCount does not match', async (device) => {
      const pipeline = await createRenderPipeline(device, {sampleCount: 4});
      const pass = await makePass(device);
      await expectValidationError(true, () => {
        pass.setPipeline(pipeline);
      });
    });

    itWithDevice('fails if pipeline depthStencilFormat does not match', async (device) => {
      const pipeline = await createRenderPipeline(device, {depthStencilFormat: 'depth24plus'});
      const pass = await makePass(device);
      await expectValidationError(true, () => {
        pass.setPipeline(pipeline);
      });
    });

  });


  describe('check errors on setVertexBuffer', () => {

    itWithDevice('works with null', async (device) => {
      const pass = await makePass(device);
      await expectValidationError(false, () => {
        pass.setVertexBuffer(0, null);
      });
    });

    itWithDevice('fails with null if ended', async (device) => {
      const pass = await makePass(device);
      endPass(pass);
      await expectValidationError(true, () => {
        pass.setVertexBuffer(0, null);
      });
    });

    itWithDevice('works with buffer', async (device) => {
      const pass = await makePass(device);
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.VERTEX});
      await expectValidationError(false, () => {
        pass.setVertexBuffer(0, buffer);
      });
    });

    itWithDevice('errors if buffer is destroyed', async (device) => {
      const pass = await makePass(device);
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.VERTEX});
      buffer.destroy();
      await expectValidationError(true, () => {
        pass.setVertexBuffer(0, buffer);
      });
    });

    itWithDevice('slot < 0', async (device) => {
      const pass = await makePass(device);
      await expectValidationError(true, () => {
        pass.setVertexBuffer(-1, null);
      });
    });

    itWithDevice('slot > max', async (device) => {
      const pass = await makePass(device);
      await expectValidationError(true, () => {
        pass.setVertexBuffer(device.limits.maxVertexBuffers, null);
      });
    });

    itWithDevice('offset is not multiple of 4', async (device) => {
      const pass = await makePass(device);
      await expectValidationError(true, () => {
        pass.setVertexBuffer(0, null, 3);
      });
    });

    itWithDevice('offset + size > bufferSize (no buffer)', async (device) => {
      const pass = await makePass(device);
      await expectValidationError(true, () => {
        pass.setVertexBuffer(0, null, 4);
      });
    });

    itWithDevice('offset + size > bufferSize (w/buffer via size)', async (device) => {
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.VERTEX});
      const pass = await makePass(device);
      await expectValidationError(true, () => {
        pass.setVertexBuffer(0, buffer, 0, 5);
      });
    });

    itWithDevice('offset + size > bufferSize (w/buffer via offset + size)', async (device) => {
      const buffer = device.createBuffer({size: 8, usage: GPUBufferUsage.VERTEX});
      const pass = await makePass(device);
      await expectValidationError(true, () => {
        pass.setVertexBuffer(0, buffer, 4, 5);
      });
    });

    itWithDevice('buffer from different device', async (device) => {
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.VERTEX});
      const pass = await makePass();
      await expectValidationError(true, () => {
        pass.setVertexBuffer(0, buffer);
      });
    });

    itWithDevice('buffer not VERTEX', async (device) => {
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.INDEX});
      const pass = await makePass(device);
      await expectValidationError(true, () => {
        pass.setVertexBuffer(0, buffer);
      });
    });

  });

  describe('check errors on setIndexBuffer', () => {

    itWithDevice('works', async (device) => {
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.INDEX});
      const pass = await makePass(device);
      await expectValidationError(false, () => {
        pass.setIndexBuffer(buffer, 'uint16');
      });
    });

    itWithDevice('errors if buffer is destroyed', async (device) => {
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.INDEX});
      buffer.destroy();
      const pass = await makePass(device);
      await expectValidationError(true, () => {
        pass.setIndexBuffer(buffer, 'uint16');
      });
    });

    itWithDevice('fails if ended', async (device) => {
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.INDEX});
      const pass = await makePass(device);
      endPass(pass);
      await expectValidationError(true, () => {
        pass.setIndexBuffer(buffer, 'uint16');
      });
    });

    itWithDevice('offset is not multiple of 2 when format is uint16', async (device) => {
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.INDEX});
      const pass = await makePass(device);
      await expectValidationError(true, () => {
        pass.setIndexBuffer(buffer, 'uint16', 1);
      });
    });

    itWithDevice('offset is not multiple of 4 when format is uint32', async (device) => {
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.INDEX});
      const pass = await makePass(device);
      await expectValidationError(true, () => {
        pass.setIndexBuffer(buffer, 'uint32', 2);
      });
    });

    itWithDevice('offset + size > buffer.size', async (device) => {
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.INDEX});
      const pass = await makePass(device);
      await expectValidationError(true, () => {
        pass.setIndexBuffer(buffer, 'uint16', 0, 5);
      });
    });

    itWithDevice('offset + size > buffer.size (offset + size)', async (device) => {
      const buffer = device.createBuffer({size: 8, usage: GPUBufferUsage.INDEX});
      const pass = await makePass(device);
      await expectValidationError(true, () => {
        pass.setIndexBuffer(buffer, 'uint16', 4, 5);
      });
    });

    itWithDevice('buffer from different device', async (device) => {
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.INDEX});
      const pass = await makePass();
      await expectValidationError(true, () => {
        pass.setIndexBuffer(buffer, 'uint16');
      });
    });

    itWithDevice('buffer not INDEX', async (device) => {
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.VERTEX});
      const pass = await makePass(device);
      await expectValidationError(true, () => {
        pass.setIndexBuffer(buffer, 'uint16');
      });
    });

  });

  describe('check errors on draw', () => {

    itWithDevice('works', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1 } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      await expectValidationError(false, () => {
        pass.draw(kNumVertices, kNumInstances);
      });
      endPass(pass);
    });

    itWithDevice('fails if pass ended', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1 } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      endPass(pass);
      await expectValidationError(true, () => {
        pass.draw(kNumVertices);
      });
    });

    itWithDevice('fails if no pipeline', async (device) => {
      const { vertexBuffer0, vertexBuffer1 } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      await expectValidationError(true, () => {
        pass.draw(kNumVertices);
      });
      endPass(pass);
    });

    itWithDevice('fails if missing vertexBuffer', async (device) => {
      const { pipeline, vertexBuffer0 } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      await expectValidationError(true, () => {
        pass.draw(kNumVertices);
      });
      endPass(pass);
    });

    itWithDevice('fails if vertexBuffer destroyed', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1 } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      vertexBuffer0.destroy();
      await expectValidationError(true, () => {
        pass.draw(kNumVertices);
      });
      endPass(pass);
    });

    itWithDevice('fails if vertexCount exceeds data', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1 } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      vertexBuffer0.destroy();
      await expectValidationError(true, () => {
        pass.draw(kNumVertices + 1);
      });
      endPass(pass);
    });

    itWithDevice('fails if count exceeds data via binding size', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1 } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0, 0, 20);
      pass.setVertexBuffer(1, vertexBuffer1);
      await expectValidationError(true, () => {
        pass.draw(kNumVertices);
      });
      endPass(pass);
    });

    itWithDevice('fails if count exceeds data via binding offset', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1 } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0, 4);
      pass.setVertexBuffer(1, vertexBuffer1);
      vertexBuffer0.destroy();
      await expectValidationError(true, () => {
        pass.draw(kNumVertices);
      });
      endPass(pass);
    });

    itWithDevice('fails if instanceCount exceeds data', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1 } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      vertexBuffer0.destroy();
      await expectValidationError(true, () => {
        pass.draw(kNumVertices, kNumInstances + 1);
      });
      endPass(pass);
    });

    addValidateBindGroupTests({
      makePassAndPipeline: async (device, options) => {
        const { pipeline } = await createRenderBindGroupPipeline(device, options);
        const pass = await makePass(device);
        pass.setPipeline(pipeline);
        return {pass, pipeline};
      },
      execute(pass) {
        pass.draw(3);
      },
      visibility: GPUShaderStage.VERTEX,
    });

  });

  describe('check errors on drawIndexed', () => {

    itWithDevice('works', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1, indexBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      pass.setIndexBuffer(indexBuffer, kIndexFormat);
      await expectValidationError(false, () => {
        pass.drawIndexed(kNumVertices, kNumInstances);
      });
      endPass(pass);
    });

    itWithDevice('fails if pass ended', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1, indexBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      pass.setIndexBuffer(indexBuffer, kIndexFormat);
      endPass(pass);
      await expectValidationError(true, () => {
        pass.drawIndexed(kNumIndices);
      });
    });

    itWithDevice('fails if no pipeline', async (device) => {
      const { vertexBuffer0, vertexBuffer1, indexBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      pass.setIndexBuffer(indexBuffer, kIndexFormat);
      await expectValidationError(true, () => {
        pass.drawIndexed(kNumIndices);
      });
      endPass(pass);
    });

    itWithDevice('fails if missing vertexBuffer', async (device) => {
      const { pipeline, vertexBuffer0, indexBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setIndexBuffer(indexBuffer, kIndexFormat);
      await expectValidationError(true, () => {
        pass.drawIndexed(kNumIndices);
      });
      endPass(pass);
    });

    itWithDevice('fails if vertexBuffer destroyed', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1, indexBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      pass.setIndexBuffer(indexBuffer, kIndexFormat);
      vertexBuffer0.destroy();
      await expectValidationError(true, () => {
        pass.drawIndexed(kNumIndices);
      });
      endPass(pass);
    });

    itWithDevice('fails if missing indexBuffer', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1 } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      await expectValidationError(true, () => {
        pass.drawIndexed(kNumIndices);
      });
      endPass(pass);
    });

    itWithDevice('fails if indexBuffer destroyed', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1, indexBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      pass.setIndexBuffer(indexBuffer, kIndexFormat);
      indexBuffer.destroy();
      await expectValidationError(true, () => {
        pass.drawIndexed(kNumIndices);
      });
      endPass(pass);
    });

    itWithDevice('fails if indexedCount > data', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1, indexBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      pass.setIndexBuffer(indexBuffer, kIndexFormat);
      await expectValidationError(true, () => {
        pass.drawIndexed(kNumIndices + 1, kNumInstances);
      });
      endPass(pass);
    });

    itWithDevice('fails if indexedCount > data via size', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1, indexBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      pass.setIndexBuffer(indexBuffer, kIndexFormat, 0, indexBuffer.size - 4);
      await expectValidationError(true, () => {
        pass.drawIndexed(kNumIndices, kNumInstances);
      });
      endPass(pass);
    });

    itWithDevice('fails if indexedCount > data via offset', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1, indexBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      pass.setIndexBuffer(indexBuffer, kIndexFormat, 4);
      await expectValidationError(true, () => {
        pass.drawIndexed(kNumIndices, kNumInstances);
      });
      endPass(pass);
    });

    itWithDevice('fails if instanceCount > data', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1, indexBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      pass.setIndexBuffer(indexBuffer, kIndexFormat);
      await expectValidationError(true, () => {
        pass.drawIndexed(kNumIndices, kNumInstances + 1);
      });
      endPass(pass);
    });

    addValidateBindGroupTests({
      makePassAndPipeline: async (device, options) => {
        const { pipeline, indexBuffer } = await createRenderBindGroupPipeline(device, options);
        const pass = await makePass(device);
        pass.setPipeline(pipeline);
        pass.setIndexBuffer(indexBuffer, kIndexFormat);
        return {pass, pipeline};
      },
      execute(pass) {
        pass.drawIndexed(3);
      },
      visibility: GPUShaderStage.VERTEX,
    });

  });

  describe('check errors on drawIndirect', () => {

    itWithDevice('works', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1, indirectBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      await expectValidationError(false, () => {
        pass.drawIndirect(indirectBuffer, 0);
      });
      endPass(pass);
    });

    itWithDevice('fails if pass ended', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1, indirectBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      endPass(pass);
      await expectValidationError(true, () => {
        pass.drawIndirect(indirectBuffer, 0);
      });
    });

    itWithDevice('fails if no pipeline', async (device) => {
      const { vertexBuffer0, vertexBuffer1, indirectBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      await expectValidationError(true, () => {
        pass.drawIndirect(indirectBuffer, 0);
      });
      endPass(pass);
    });

    itWithDevice('fails if missing vertexBuffer', async (device) => {
      const { pipeline, vertexBuffer0, indirectBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      await expectValidationError(true, () => {
        pass.drawIndirect(indirectBuffer, 0);
      });
      endPass(pass);
    });

    itWithDevice('fails if vertexBuffer destroyed', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1, indirectBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      vertexBuffer0.destroy();
      await expectValidationError(true, () => {
        pass.drawIndirect(indirectBuffer, 0);
      });
      endPass(pass);
    });

    itWithDevice('fails if indirectBuffer destroyed', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1, indirectBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      indirectBuffer.destroy();
      await expectValidationError(true, () => {
        pass.drawIndirect(indirectBuffer, 0);
      });
      endPass(pass);
    });

    itWithDevice('fails if indirect offset outside data', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1, indirectBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      await expectValidationError(true, () => {
        pass.drawIndirect(indirectBuffer, indirectBuffer.size - 12);
      });
      endPass(pass);
    });

    addValidateBindGroupTests((() => {
      let ib;  // kind of hacky but at least we don't have to pass indirect buffer through?
      return {
        makePassAndPipeline: async (device, options) => {
          const { pipeline, indirectBuffer } = await createRenderBindGroupPipeline(device, options);
          ib = indirectBuffer;
          const pass = await makePass(device);
          pass.setPipeline(pipeline);
          return {pass, pipeline};
        },
        execute(pass) {
          pass.drawIndirect(ib, 0);
        },
        visibility: GPUShaderStage.VERTEX,
      };
    })());

  });

  describe('check errors on drawIndexedIndirect', () => {

    itWithDevice('works', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1, indexBuffer, indirectBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      pass.setIndexBuffer(indexBuffer, kIndexFormat);
      await expectValidationError(false, () => {
        pass.drawIndexedIndirect(indirectBuffer, 0);
      });
      endPass(pass);
    });

    itWithDevice('fails if pass ended', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1, indexBuffer, indirectBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      pass.setIndexBuffer(indexBuffer, kIndexFormat);
      endPass(pass);
      await expectValidationError(true, () => {
        pass.drawIndexedIndirect(indirectBuffer, 0);
      });
    });

    itWithDevice('fails if no pipeline', async (device) => {
      const { vertexBuffer0, vertexBuffer1, indexBuffer, indirectBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      pass.setIndexBuffer(indexBuffer, kIndexFormat);
      await expectValidationError(true, () => {
        pass.drawIndexedIndirect(indirectBuffer, 0);
      });
      endPass(pass);
    });

    itWithDevice('fails if missing vertexBuffer', async (device) => {
      const { pipeline, vertexBuffer0, indexBuffer, indirectBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setIndexBuffer(indexBuffer, kIndexFormat);
      await expectValidationError(true, () => {
        pass.drawIndexedIndirect(indirectBuffer, 0);
      });
      endPass(pass);
    });

    itWithDevice('fails if vertexBuffer destroyed', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1, indexBuffer, indirectBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      pass.setIndexBuffer(indexBuffer, kIndexFormat);
      vertexBuffer0.destroy();
      await expectValidationError(true, () => {
        pass.drawIndexedIndirect(indirectBuffer, 0);
      });
      endPass(pass);
    });

    itWithDevice('fails if missing indexBuffer', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1, indirectBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      await expectValidationError(true, () => {
        pass.drawIndexedIndirect(indirectBuffer, 0);
      });
      endPass(pass);
    });

    itWithDevice('fails if indexBuffer destroyed', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1, indexBuffer, indirectBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      pass.setIndexBuffer(indexBuffer, kIndexFormat);
      indexBuffer.destroy();
      await expectValidationError(true, () => {
        pass.drawIndexedIndirect(indirectBuffer, 0);
      });
      endPass(pass);
    });

    itWithDevice('fails if indirectBuffer destroyed', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1, indexBuffer, indirectBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      pass.setIndexBuffer(indexBuffer, kIndexFormat);
      indirectBuffer.destroy();
      await expectValidationError(true, () => {
        pass.drawIndexedIndirect(indirectBuffer, 0);
      });
      endPass(pass);
    });

    itWithDevice('fails if indirect offset outside data', async (device) => {
      const { pipeline, vertexBuffer0, vertexBuffer1, indexBuffer, indirectBuffer } = await createRenderPipelineAndAttribResources(device);
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      pass.setIndexBuffer(indexBuffer, kIndexFormat);
      await expectValidationError(true, () => {
        pass.drawIndexedIndirect(indirectBuffer, indirectBuffer.size - 16);
      });
      endPass(pass);
    });

    addValidateBindGroupTests((() => {
      let ib;  // kind of hacky but at least we don't have to pass indirect buffer through?
      return {
        makePassAndPipeline: async (device, options) => {
          const { pipeline, indexBuffer, indirectBuffer } = await createRenderBindGroupPipeline(device, options);
          ib = indirectBuffer;
          const pass = await makePass(device);
          pass.setPipeline(pipeline);
          pass.setIndexBuffer(indexBuffer, kIndexFormat);
          return {pass, pipeline};
        },
        execute(pass) {
          pass.drawIndexedIndirect(ib, 0);
        },
        visibility: GPUShaderStage.VERTEX,
      };
    })());

  });
}