import {describe, it} from '../mocha-support.js';
import {expectValidationError} from '../js/utils.js';
import {addRenderMixinTests} from './render-mixin-tests.js';
import {addTimestampWriteTests, getDeviceWithTimestamp} from './timestamp-tests.js';


async function createCommandEncoder(device) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  return device.createCommandEncoder();
}

async function createRenderPass(device, encoder, {
  timestampWrites,
  occlusionQuerySet,
} = {}) {
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
    ...(timestampWrites && { timestampWrites }),
    ...(occlusionQuerySet && { occlusionQuerySet }),
  });
  return pass;
}

describe('test render pass encoder', () => {

  describe('check errors on beginRenderPass', () => {

    it('errors if 2 passes are started', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      await createRenderPass(device, encoder);
      await expectValidationError(true, async () => {
        await createRenderPass(device, encoder);
      });
    });

    it('can not end twice', async () => {
      const pass = await createRenderPass();
      pass.end();
      await expectValidationError(true, async () => {
        pass.end();
      });
    });

    it('errors when colorAttachments are not the same size', async () => {
      const adapter = await navigator.gpu.requestAdapter();
      const device = await adapter.requestDevice();
      const textures = [2, 3].map(width => device.createTexture({
        size: [width, 3],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        format: 'rgba8unorm',
      }));
      const encoder = device.createCommandEncoder();
      await expectValidationError(true, () => {
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
      await expectValidationError(true, () => {
        encoder.beginRenderPass({
          colorAttachments: [
            {
              view: colorTexture.createView(),
              clearColor: [0, 0, 0, 0],
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
          depthStencilAttachment: {
            view: depthTexture.createView(),
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
          },
        });
      });
    });

    it('errors when colorAttachments are destroyed', async () => {
      const adapter = await navigator.gpu.requestAdapter();
      const device = await adapter.requestDevice();
      const textures = [3, 3].map(width => device.createTexture({
        size: [width, 3],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        format: 'rgba8unorm',
      }));
      textures[1].destroy();
      const encoder = device.createCommandEncoder();
      await expectValidationError(true, () => {
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

    it('errors when depthStencilAttachment is destroyed', async () => {
      const adapter = await navigator.gpu.requestAdapter();
      const device = await adapter.requestDevice();
      const colorTexture = device.createTexture({
        size: [2, 2],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        format: 'rgba8unorm',
      });
      const depthTexture = device.createTexture({
        size: [2, 2],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        format: 'depth24plus',
      });
      depthTexture.destroy();
      const encoder = device.createCommandEncoder();
      await expectValidationError(true, () => {
        encoder.beginRenderPass({
          colorAttachments: [
            {
              view: colorTexture.createView(),
              clearColor: [0, 0, 0, 0],
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
          depthStencilAttachment: {
            view: depthTexture.createView(),
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
          },
        });
      });
    });

    it('fails if occlusionQuerySet.type is not occlusion', async function () {
      const device = await getDeviceWithTimestamp(this);
      const colorTexture = device.createTexture({
        size: [2, 2],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        format: 'rgba8unorm',
      });
      const occlusionQuerySet = device.createQuerySet({type: 'timestamp', count: 2});
      const encoder = device.createCommandEncoder();
      await expectValidationError(true, () => {
        encoder.beginRenderPass({
          colorAttachments: [
            {
              view: colorTexture.createView(),
              clearColor: [0, 0, 0, 0],
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
          occlusionQuerySet,
        });
      });
    });

    addTimestampWriteTests({
      makePass(device, {timestampWrites}) {
        return createRenderPass(device, undefined, { timestampWrites });
      },
    });

  });

  addRenderMixinTests({
    makePass: async (device) => {
      return await createRenderPass(device);
    },
    endPass(pass) {
      pass.end();
    },
  });

  describe('check errors on executeBundles', () => {

    it('works', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const pass = await createRenderPass(device);
      const bundleEncoder = device.createRenderBundleEncoder({
        colorFormats: ['rgba8unorm'],
      });
      const bundle = bundleEncoder.finish();

      await expectValidationError(false, () => {
        pass.executeBundles([bundle]);
      });

    });

    it('fails if bundle is from different device', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const pass = await createRenderPass();
      const bundleEncoder = device.createRenderBundleEncoder({
        colorFormats: ['rgba8unorm'],
      });
      const bundle = bundleEncoder.finish();

      await expectValidationError(true, () => {
        pass.executeBundles([bundle]);
      });

    });

    it('fails if bundle incompatible', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const pass = await createRenderPass(device);
      const bundleEncoder = device.createRenderBundleEncoder({
        colorFormats: ['r8unorm'],
      });
      const bundle = bundleEncoder.finish();

      await expectValidationError(true, () => {
        pass.executeBundles([bundle]);
      });

    });

  });

  describe('beginOcclusionQuery', () => {

    it('works', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const occlusionQuerySet = device.createQuerySet({ type: 'occlusion', count: 2 });
      const pass = await createRenderPass(device, undefined, {
        occlusionQuerySet,
      });

      await expectValidationError(false, () => {
        pass.beginOcclusionQuery(0);
      });
    });

    it('fails if no occlusionQuerySet on pass', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const pass = await createRenderPass(device);
      await expectValidationError(true, () => {
        pass.beginOcclusionQuery(0);
      });
    });

    it('fails if querySet destroyed', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const occlusionQuerySet = device.createQuerySet({ type: 'occlusion', count: 2 });
      const pass = await createRenderPass(device, undefined, {
        occlusionQuerySet,
      });
      occlusionQuerySet.destroy();

      await expectValidationError(true, () => {
        pass.beginOcclusionQuery(0);
      });
    });

    it('fails if queryIndex out of range', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const occlusionQuerySet = device.createQuerySet({ type: 'occlusion', count: 2 });
      const pass = await createRenderPass(device, undefined, {
        occlusionQuerySet,
      });

      await expectValidationError(true, () => {
        pass.beginOcclusionQuery(2);
      });
    });

    it('fails if query in progress', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const occlusionQuerySet = device.createQuerySet({ type: 'occlusion', count: 2 });
      const pass = await createRenderPass(device, undefined, {
        occlusionQuerySet,
      });

      pass.beginOcclusionQuery(1);
      await expectValidationError(true, () => {
        pass.beginOcclusionQuery(0);
      });
    });

    it('fails if queryIndex already used', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const occlusionQuerySet = device.createQuerySet({ type: 'occlusion', count: 2 });
      const pass = await createRenderPass(device, undefined, {
        occlusionQuerySet,
      });
      pass.beginOcclusionQuery(0);
      pass.endOcclusionQuery();

      await expectValidationError(true, () => {
        pass.beginOcclusionQuery(0);
      });
    });

  });

  describe('endOcclusionQuery', () => {

    it('works', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const occlusionQuerySet = device.createQuerySet({ type: 'occlusion', count: 2 });
      const pass = await createRenderPass(device, undefined, {
        occlusionQuerySet,
      });
      pass.beginOcclusionQuery(0);

      await expectValidationError(false, () => {
        pass.endOcclusionQuery();
      });
    });

    it('fails if querySet destroyed', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const occlusionQuerySet = device.createQuerySet({ type: 'occlusion', count: 2 });
      const pass = await createRenderPass(device, undefined, {
        occlusionQuerySet,
      });
      pass.beginOcclusionQuery(0);
      occlusionQuerySet.destroy();

      await expectValidationError(true, () => {
        pass.endOcclusionQuery();
      });
    });


    it('fails if no query in progress', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const occlusionQuerySet = device.createQuerySet({ type: 'occlusion', count: 2 });
      const pass = await createRenderPass(device, undefined, {
        occlusionQuerySet,
      });

      await expectValidationError(true, () => {
        pass.endOcclusionQuery();
      });
    });

  });

  describe('check errors on setViewport', () => {

    const tests = [
      { success: true, args: [0, 0, 2, 3, 0, 1], desc: 'valid' },
      { success: false, args: [0, 0, 2, 3, 0, 1], desc: 'pass ended', end: true },
      { success: false, args: [-1, 0, 1, 1, 0, 1], desc: 'x < 0' },
      { success: false, args: [ 0, -1, 1, 1, 0, 1], desc: 'y < 0' },
      { success: false, args: [ 0, 0, 3, 1, 0, 1], desc: 'x + width > targetWidth' },
      { success: false, args: [ 1, 0, 2, 1, 0, 1], desc: 'x + width > targetWidth' },
      { success: false, args: [ 0, 0, 1, 4, 0, 1], desc: 'y + height > targetHeight' },
      { success: false, args: [ 0, 1, 1, 3, 0, 1], desc: 'y + height > targetHeight' },
      { success: false, args: [ 0, 0, 2, 3, -1, 1], desc: 'minDepth < 0' },
      { success: false, args: [ 0, 0, 2, 3, 2, 1], desc: 'minDepth > 1' },
      { success: false, args: [ 0, 0, 2, 3, 0, -1], desc: 'maxDepth < 0' },
      { success: false, args: [ 0, 0, 2, 3, 0, 2], desc: 'maxDepth > 1' },
      { success: false, args: [ 0, 0, 2, 3, 0.5, 0.4], desc: 'minDepth > maxDepth' },
    ];

    for (const {success, args, desc, end} of tests) {
      it(desc, async () => {
        const pass = await createRenderPass();
        if (end) {
          pass.end();
        }
        await expectValidationError(!success, () => {
          pass.setViewport(...args);
        });
      });
    }

  });

  describe('check errors on setScissorRect', () => {

    const tests = [
      { success: true, args: [0, 0, 2, 3, 0, 1], desc: 'valid' },
      { success: false, args: [0, 0, 2, 3, 0, 1], desc: 'valid', end: true },
      { success: false, args: [-1, 0, 1, 1, 0, 1], desc: 'x < 0' },
      { success: false, args: [ 0, -1, 1, 1, 0, 1], desc: 'y < 0' },
      { success: false, args: [ 0, 0, 3, 1, 0, 1], desc: 'x + width > targetWidth' },
      { success: false, args: [ 1, 0, 2, 1, 0, 1], desc: 'x + width > targetWidth' },
      { success: false, args: [ 0, 0, 1, 4, 0, 1], desc: 'y + height > targetHeight' },
      { success: false, args: [ 0, 1, 1, 3, 0, 1], desc: 'y + height > targetHeight' },
    ];

    for (const {success, args, desc, end} of tests) {
      it(desc, async () => {
        const pass = await createRenderPass();
        if (end) {
          pass.end();
        }
        await expectValidationError(!success, () => {
          pass.setViewport(...args);
        });
      });
    }

  });

});
