import {describe, it} from '../mocha-support.js';
import {expectValidationError} from '../js/utils.js';

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
      @vertex fn vsMain(
        @location(0) a0 : vec4f,
        @location(1) a1 : vec4f,
        @location(1) a2 : vec4f,
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
    fragment: { module, targets: [ { format: 'rgba8unorm' } ]},
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

async function createRenderPipelineAndRenderPass(device) {
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

export function addRenderMixinTests({
  makePass,
  endPass,
}) {

  describe('check errors on draw', () => {

    it('works', async () => {
      const { pipeline, device, vertexBuffer0, vertexBuffer1 } = await createRenderPipelineAndRenderPass();
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      await expectValidationError(false, () => {
        pass.draw(kNumVertices, kNumInstances);
      });
      endPass(pass);
    });

    it('fails if pass ended', async () => {
      const { pipeline, device, vertexBuffer0, vertexBuffer1 } = await createRenderPipelineAndRenderPass();
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      endPass(pass);
      await expectValidationError(true, () => {
        pass.draw(kNumVertices);
      });
    });

    it('fails if no pipeline', async () => {
      const { device, vertexBuffer0, vertexBuffer1 } = await createRenderPipelineAndRenderPass();
      const pass = await makePass(device);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      await expectValidationError(true, () => {
        pass.draw(kNumVertices);
      });
      endPass(pass);
    });

    it('fails if no missing vertexBuffer', async () => {
      const { pipeline, device, vertexBuffer0 } = await createRenderPipelineAndRenderPass();
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      await expectValidationError(true, () => {
        pass.draw(kNumVertices);
      });
      endPass(pass);
    });

    it('fails if vertexBuffer destroyed', async () => {
      const { pipeline, device, vertexBuffer0, vertexBuffer1 } = await createRenderPipelineAndRenderPass();
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

    it('fails if vertexCount exceeds data', async () => {
      const { pipeline, device, vertexBuffer0, vertexBuffer1 } = await createRenderPipelineAndRenderPass();
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

    it('fails if count exceeds data via binding size', async () => {
      const { pipeline, device, vertexBuffer0, vertexBuffer1 } = await createRenderPipelineAndRenderPass();
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0, 0, 20);
      pass.setVertexBuffer(1, vertexBuffer1);
      await expectValidationError(true, () => {
        pass.draw(kNumVertices);
      });
      endPass(pass);
    });

    it('fails if count exceeds data via binding offset', async () => {
      const { pipeline, device, vertexBuffer0, vertexBuffer1 } = await createRenderPipelineAndRenderPass();
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

    it('fails if instanceCount exceeds data', async () => {
      const { pipeline, device, vertexBuffer0, vertexBuffer1 } = await createRenderPipelineAndRenderPass();
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

  });

  describe('check errors on drawIndexed', () => {

    it('works', async () => {
      const { pipeline, device, vertexBuffer0, vertexBuffer1, indexBuffer } = await createRenderPipelineAndRenderPass();
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

    it('fails if pass ended', async () => {
      const { pipeline, device, vertexBuffer0, vertexBuffer1, indexBuffer } = await createRenderPipelineAndRenderPass();
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

    it('fails if no pipeline', async () => {
      const { device, vertexBuffer0, vertexBuffer1, indexBuffer } = await createRenderPipelineAndRenderPass();
      const pass = await makePass(device);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      pass.setIndexBuffer(indexBuffer, kIndexFormat);
      await expectValidationError(true, () => {
        pass.drawIndexed(kNumIndices);
      });
      endPass(pass);
    });

    it('fails if no missing vertexBuffer', async () => {
      const { pipeline, device, vertexBuffer0, indexBuffer } = await createRenderPipelineAndRenderPass();
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setIndexBuffer(indexBuffer, kIndexFormat);
      await expectValidationError(true, () => {
        pass.drawIndexed(kNumIndices);
      });
      endPass(pass);
    });

    it('fails if vertexBuffer destroyed', async () => {
      const { pipeline, device, vertexBuffer0, vertexBuffer1, indexBuffer } = await createRenderPipelineAndRenderPass();
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

    it('fails if no missing indexBuffer', async () => {
      const { pipeline, device, vertexBuffer0, vertexBuffer1 } = await createRenderPipelineAndRenderPass();
      const pass = await makePass(device);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer0);
      pass.setVertexBuffer(1, vertexBuffer1);
      await expectValidationError(true, () => {
        pass.drawIndexed(kNumIndices);
      });
      endPass(pass);
    });

    it('fails if indexBuffer destroyed', async () => {
      const { pipeline, device, vertexBuffer0, vertexBuffer1, indexBuffer } = await createRenderPipelineAndRenderPass();
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

    it('fails if indexedCount > data', async () => {
      const { pipeline, device, vertexBuffer0, vertexBuffer1, indexBuffer } = await createRenderPipelineAndRenderPass();
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

    it('fails if indexedCount > data via size', async () => {
      const { pipeline, device, vertexBuffer0, vertexBuffer1, indexBuffer } = await createRenderPipelineAndRenderPass();
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

    it('fails if indexedCount > data via offset', async () => {
      const { pipeline, device, vertexBuffer0, vertexBuffer1, indexBuffer } = await createRenderPipelineAndRenderPass();
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

    it('fails if instanceCount > data', async () => {
      const { pipeline, device, vertexBuffer0, vertexBuffer1, indexBuffer } = await createRenderPipelineAndRenderPass();
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

  });
}