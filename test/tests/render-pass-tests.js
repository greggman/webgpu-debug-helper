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

async function createRenderPass(device) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  const texture = device.createTexture({
    size: [2, 3],
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
    format: 'rgba8unorm',
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: texture.createView(),
      clearColor: [0, 0, 0, 0],
      loadOp: 'clear',
      storeOp: 'store',
    }],
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
  })
  return pipeline;
}

describe('test render pass encoder', () => {

  describe('check errors on beginRenderPass', () => {

    it('errors when colorAttachments are not the same size', async () => {
      const adapter = await navigator.gpu.requestAdapter();
      const device = await adapter.requestDevice();
      const textures = [2, 3].map(width => device.createTexture({
        size: [width, 3],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        format: 'rgba8unorm',
      }));
      const encoder = device.createCommandEncoder();
      expectValidationError(true, () => {
        encoder.beginRenderPass({
          colorAttachments: textures.map(texture => ({
            view: texture.createView(),
            clearColor: [0, 0, 0, 0],
            loadOp: 'clear',
            storeOp: 'store',
          })),
        });
      });
    });

    it('errors when depthStencilAttachment is a different size than the colorAttachments', async () => {
      const adapter = await navigator.gpu.requestAdapter();
      const device = await adapter.requestDevice();
      const colorTexture = device.createTexture({
        size: [2, 2],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        format: 'rgba8unorm',
      });
      const depthTexture = device.createTexture({
        size: [2, 3],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        format: 'depth24plus',
      });
      const encoder = device.createCommandEncoder();
      expectValidationError(true, () => {
        encoder.beginRenderPass({
          colorAttachments: [{
            view: colorTexture.createView(),
            clearColor: [0, 0, 0, 0],
            loadOp: 'clear',
            storeOp: 'store',
          }],
          depthStencilAttachment: {
            view: depthTexture.createView(),
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
          },
        });
      });
    });

  });

  describe('check errors on setViewport', () => {

    const tests = [
      { success: true, args: [0, 0, 2, 3, 0, 1], desc: 'valid' },
      { success: false, args: [-1, 0, 1, 1, 0, 1], desc: 'x < 0' },
      { success: false, args: [ 0, -1, 1, 1, 0, 1], desc: 'y < 0' },
      { success: false, args: [ 0, 0, 3, 1, 0, 1], desc: 'x + width > targetWidth' },
      { success: false, args: [ 1, 0, 2, 1, 0, 1], desc: 'x + width > targetWidth' },
      { success: false, args: [ 0, 0, 1, 4, 0, 1], desc: 'y + height > targetHeight' },
      { success: false, args: [ 0, 1, 1, 3, 0, 1], desc: 'y + height > targetHeight' },
    ];

    for (let {success, args, desc} of tests) {
      it(desc, async () => {
        const pass = await createRenderPass();
          expectValidationError(!success, () => {
            pass.setViewport(...args);
          });
      });

    }

  });

  describe('check errors on setScissorRect', () => {

    const tests = [
      { success: true, args: [0, 0, 2, 3, 0, 1], desc: 'valid' },
      { success: false, args: [-1, 0, 1, 1, 0, 1], desc: 'x < 0' },
      { success: false, args: [ 0, -1, 1, 1, 0, 1], desc: 'y < 0' },
      { success: false, args: [ 0, 0, 3, 1, 0, 1], desc: 'x + width > targetWidth' },
      { success: false, args: [ 1, 0, 2, 1, 0, 1], desc: 'x + width > targetWidth' },
      { success: false, args: [ 0, 0, 1, 4, 0, 1], desc: 'y + height > targetHeight' },
      { success: false, args: [ 0, 1, 1, 3, 0, 1], desc: 'y + height > targetHeight' },
    ];

    for (let {success, args, desc} of tests) {
      it(desc, async () => {
        const pass = await createRenderPass();
          expectValidationError(!success, () => {
            pass.setViewport(...args);
          });
      });

    }

  });

  describe('check errors on setPipeline', () => {

    it('pipeline from different device', async () => {
      const pipeline = await createRenderPipeline();
      const pass = await createRenderPass();
      expectValidationError(true, () => {
        pass.setPipeline(pipeline);
      });
    });

  });

  describe('check errors on setVertexBuffer', () => {

    it('works with null', async () => {
      const pass = await createRenderPass();
      expectValidationError(false, () => {
        pass.setVertexBuffer(0, null);
      });
    });

    it('works with buffer', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const pass = await createRenderPass(device);
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.VERTEX});
      expectValidationError(false, () => {
        pass.setVertexBuffer(0, buffer);
      });
    });

    it('slot < 0', async () => {
      const pass = await createRenderPass();
      expectValidationError(true, () => {
        pass.setVertexBuffer(-1, null);
      });
    });

    it('slot > max', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const pass = await createRenderPass(device);
      expectValidationError(true, () => {
        pass.setVertexBuffer(device.limits.maxVertexBuffers, null);
      });
    });

    it('offset is not multiple of 4', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const pass = await createRenderPass(device);
      expectValidationError(true, () => {
        pass.setVertexBuffer(0, null, 3);
      });
    });

    it('offset + size > bufferSize (no buffer)', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const pass = await createRenderPass(device);
      expectValidationError(true, () => {
        pass.setVertexBuffer(0, null, 4);
      });
    });

    it('offset + size > bufferSize (w/buffer via size)', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.VERTEX});
      const pass = await createRenderPass(device);
      expectValidationError(true, () => {
        pass.setVertexBuffer(0, buffer, 0, 5);
      });
    });

    it('offset + size > bufferSize (w/buffer via offset + size)', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const buffer = device.createBuffer({size: 8, usage: GPUBufferUsage.VERTEX});
      const pass = await createRenderPass(device);
      expectValidationError(true, () => {
        pass.setVertexBuffer(0, buffer, 4, 5);
      });
    });

    it('buffer from different device', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.VERTEX});
      const pass = await createRenderPass();
      expectValidationError(true, () => {
        pass.setVertexBuffer(0, buffer);
      });
    });

    it('buffer not VERTEX', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.INDEX});
      const pass = await createRenderPass(device);
      expectValidationError(true, () => {
        pass.setVertexBuffer(0, buffer);
      });
    });

  });

  describe('check errors on setIndexBuffer', () => {

    it('works', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.INDEX});
      const pass = await createRenderPass(device);
      expectValidationError(false, () => {
        pass.setIndexBuffer(buffer, 'uint16');
      });
    });

    it('offset is not multiple of 2 when format is uint16', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.INDEX});
      const pass = await createRenderPass(device);
      expectValidationError(true, () => {
        pass.setIndexBuffer(buffer, 'uint16', 1);
      });
    });

    it('offset is not multiple of 4 when format is uint32', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.INDEX});
      const pass = await createRenderPass(device);
      expectValidationError(true, () => {
        pass.setIndexBuffer(buffer, 'uint32', 2);
      });
    });

    it('offset + size > buffer.size', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.INDEX});
      const pass = await createRenderPass(device);
      expectValidationError(true, () => {
        pass.setIndexBuffer(buffer, 'uint16', 0, 5);
      });
    });

    it('offset + size > buffer.size (offset + size)', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const buffer = device.createBuffer({size: 8, usage: GPUBufferUsage.INDEX});
      const pass = await createRenderPass(device);
      expectValidationError(true, () => {
        pass.setIndexBuffer(buffer, 'uint16', 4, 5);
      });
    });

    it('buffer from different device', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.INDEX});
      const pass = await createRenderPass();
      expectValidationError(true, () => {
        pass.setIndexBuffer(buffer, 'uint16');
      });
    });

    it('buffer not INDEX', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const buffer = device.createBuffer({size: 4, usage: GPUBufferUsage.VERTEX});
      const pass = await createRenderPass(device);
      expectValidationError(true, () => {
        pass.setIndexBuffer(buffer, 'uint16');
      });
    });

  });

});
