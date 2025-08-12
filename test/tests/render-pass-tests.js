import {describe, it} from '../mocha-support.js';
import {expectValidationError, itWithDevice} from '../js/utils.js';
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

    itWithDevice('errors if 2 passes are started', async (device) => {
      const encoder = await createCommandEncoder(device);
      await createRenderPass(device, encoder);
      await expectValidationError(true, async () => {
        await createRenderPass(device, encoder);
      });
    });

    itWithDevice('can not end twice', async (device) => {
      const pass = await createRenderPass(device);
      pass.end();
      await expectValidationError(true, async () => {
        pass.end();
      });
    });

    itWithDevice('errors when colorAttachments are not the same size', async (device) => {
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

    itWithDevice('errors when colorAttachments are not the same sampleCount', async (device) => {
      const textures = [1, 4].map(sampleCount => device.createTexture({
        size: [3, 3],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        format: 'rgba8unorm',
        sampleCount,
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

    itWithDevice('works with resolveTarget', async (device) => {
      const textures = [4, 1].map(sampleCount => device.createTexture({
        size: [3, 3],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        format: 'rgba8unorm',
        sampleCount,
      }));
      const encoder = device.createCommandEncoder();
      await expectValidationError(false, () => {
        encoder.beginRenderPass({
          colorAttachments: [
            {
              view: textures[0].createView(),
              resolveTarget: textures[1].createView(),
              clearColor: [0, 0, 0, 0],
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });
      });
    });

    itWithDevice('errors when resolveTarget is not sampleCount 1', async (device) => {
      const textures = [4, 4].map(sampleCount => device.createTexture({
        size: [3, 3],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        format: 'rgba8unorm',
        sampleCount,
      }));
      const encoder = device.createCommandEncoder();
      await expectValidationError(true, () => {
        encoder.beginRenderPass({
          colorAttachments: [
            {
              view: textures[0].createView(),
              resolveTarget: textures[1].createView(),
              clearColor: [0, 0, 0, 0],
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });
      });
    });

    itWithDevice('errors when resolveTarget is not same size', async (device) => {
      const textures = [4, 1].map((sampleCount, i) => device.createTexture({
        size: [3, 3 + i],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        format: 'rgba8unorm',
        sampleCount,
      }));
      const encoder = device.createCommandEncoder();
      await expectValidationError(true, () => {
        encoder.beginRenderPass({
          colorAttachments: [
            {
              view: textures[0].createView(),
              resolveTarget: textures[1].createView(),
              clearColor: [0, 0, 0, 0],
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });
      });
    });

    itWithDevice('errors when resolveTarget is not same format', async (device) => {
      const textures = [4, 1].map((sampleCount, i) => device.createTexture({
        size: [3, 3],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        format: ['rgba8unorm', 'r8unorm'][i],
        sampleCount,
      }));
      const encoder = device.createCommandEncoder();
      await expectValidationError(true, () => {
        encoder.beginRenderPass({
          colorAttachments: [
            {
              view: textures[0].createView(),
              resolveTarget: textures[1].createView(),
              clearColor: [0, 0, 0, 0],
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });
      });
    });

    itWithDevice('errors when no attachments', async (device) => {
      const encoder = device.createCommandEncoder();
      await expectValidationError(true, () => {
        encoder.beginRenderPass({
          colorAttachments: [],
        });
      });
    });

    itWithDevice('no error when max bytes per sample', async (device) => {
      const textures = [1, 1, 1, 1].map(() => device.createTexture({
        size: [3, 3],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        format: 'rgba16float',
      }));
      const encoder = device.createCommandEncoder();
      await expectValidationError(false, () => {
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

    itWithDevice('error when > max bytes per sample', async (device) => {
      const textures = new Array(Math.ceil(device.limits.maxColorAttachmentBytesPerSample / 16) + 1).fill(1).map(() => device.createTexture({
        size: [3, 3],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        format: 'rgba32float',
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

    itWithDevice('error when > max attachments', async (device) => {
      const textures = new Array(device.limits.maxColorAttachments + 1).fill(1).map(() => device.createTexture({
        size: [3, 3],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        format: 'r8unorm',
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

    itWithDevice('errors when depthStencilAttachment is a different size than the colorAttachments', async (device) => {
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

    itWithDevice('fails when the sample layer/level is used more than once', async (device) => {
      const colorTexture = device.createTexture({
        size: [2, 2],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        format: 'rgba8unorm',
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
            {
              view: colorTexture.createView(),
              clearColor: [0, 0, 0, 0],
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });
      });
    });

    itWithDevice('passes when the sample different layers on the same texture', async (device) => {
      const colorTexture = device.createTexture({
        size: [2, 2, 2],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        format: 'rgba8unorm',
      });
      const encoder = device.createCommandEncoder();
      await expectValidationError(false, () => {
        encoder.beginRenderPass({
          colorAttachments: [
            {
              view: colorTexture.createView({dimension: '2d', baseArrayLayer: 0, arrayLayerCount: 1}),
              clearColor: [0, 0, 0, 0],
              loadOp: 'clear',
              storeOp: 'store',
            },
            {
              view: colorTexture.createView({dimension: '2d', baseArrayLayer: 1, arrayLayerCount: 1}),
              clearColor: [0, 0, 0, 0],
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });
      });
    });

    itWithDevice('errors when colorAttachments are destroyed', async (device) => {
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

    itWithDevice('errors when depthStencilAttachment is destroyed', async (device) => {
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
      device.destroy();
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

    itWithDevice('works', async (device) => {
      const pass = await createRenderPass(device);
      const bundleEncoder = device.createRenderBundleEncoder({
        colorFormats: ['rgba8unorm'],
      });
      const bundle = bundleEncoder.finish();

      await expectValidationError(false, () => {
        pass.executeBundles([bundle]);
      });

    });

    itWithDevice('fails if bundle is from different device', async (device) => {
      const pass = await createRenderPass();
      const bundleEncoder = device.createRenderBundleEncoder({
        colorFormats: ['rgba8unorm'],
      });
      const bundle = bundleEncoder.finish();

      await expectValidationError(true, () => {
        pass.executeBundles([bundle]);
      });

    });

    itWithDevice('fails if bundle incompatible', async (device) => {
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

    itWithDevice('works', async (device) => {
      const occlusionQuerySet = device.createQuerySet({ type: 'occlusion', count: 2 });
      const pass = await createRenderPass(device, undefined, {
        occlusionQuerySet,
      });

      await expectValidationError(false, () => {
        pass.beginOcclusionQuery(0);
      });
    });

    itWithDevice('fails if no occlusionQuerySet on pass', async (device) => {
      const pass = await createRenderPass(device);
      await expectValidationError(true, () => {
        pass.beginOcclusionQuery(0);
      });
    });

    itWithDevice('fails if querySet destroyed', async (device) => {
      const occlusionQuerySet = device.createQuerySet({ type: 'occlusion', count: 2 });
      const pass = await createRenderPass(device, undefined, {
        occlusionQuerySet,
      });
      occlusionQuerySet.destroy();

      await expectValidationError(true, () => {
        pass.beginOcclusionQuery(0);
      });
    });

    itWithDevice('fails if queryIndex out of range', async (device) => {
      const occlusionQuerySet = device.createQuerySet({ type: 'occlusion', count: 2 });
      const pass = await createRenderPass(device, undefined, {
        occlusionQuerySet,
      });

      await expectValidationError(true, () => {
        pass.beginOcclusionQuery(2);
      });
    });

    itWithDevice('fails if query in progress', async (device) => {
      const occlusionQuerySet = device.createQuerySet({ type: 'occlusion', count: 2 });
      const pass = await createRenderPass(device, undefined, {
        occlusionQuerySet,
      });

      pass.beginOcclusionQuery(1);
      await expectValidationError(true, () => {
        pass.beginOcclusionQuery(0);
      });
    });

    itWithDevice('fails if queryIndex already used', async (device) => {
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

    itWithDevice('works', async (device) => {
      const occlusionQuerySet = device.createQuerySet({ type: 'occlusion', count: 2 });
      const pass = await createRenderPass(device, undefined, {
        occlusionQuerySet,
      });
      pass.beginOcclusionQuery(0);

      await expectValidationError(false, () => {
        pass.endOcclusionQuery();
      });
    });

    itWithDevice('fails if querySet destroyed', async (device) => {
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


    itWithDevice('fails if no query in progress', async (device) => {
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
      itWithDevice(desc, async (device) => {
        const pass = await createRenderPass(device);
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
      itWithDevice(desc, async (device) => {
        const pass = await createRenderPass(device);
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
