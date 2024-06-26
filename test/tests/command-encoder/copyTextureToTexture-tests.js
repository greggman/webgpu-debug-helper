import {describe} from '../../mocha-support.js';
import {expectValidationError, itWithDevice} from '../../js/utils.js';
import {createCommandEncoder, createDeviceWith4x4Format16BytesPerPixel, itWithDevice4x4Format16BytesPerPixel} from './copy-utils.js';

export default function () {
  describe('test copyTextureToTexture', () => {

     itWithDevice('works', async (device) => {
      const encoder = await createCommandEncoder(device);
      const src = device.createTexture({ format: 'rgba8unorm', size: [4, 4], usage: GPUTextureUsage.COPY_SRC });
      const dst = device.createTexture({ format: 'rgba8unorm', size: [4, 4], usage: GPUTextureUsage.COPY_DST });
      await expectValidationError(false, async () => {
        encoder.copyTextureToTexture(
          { texture: src },
          { texture: dst },
          [4, 4],
        );
      });
    });

     itWithDevice('fails if encoder is locked', async (device) => {
      const encoder = await createCommandEncoder(device);
      encoder.beginComputePass();
      const src = device.createTexture({ format: 'rgba8unorm', size: [4, 4], usage: GPUTextureUsage.COPY_SRC });
      const dst = device.createTexture({ format: 'rgba8unorm', size: [4, 4], usage: GPUTextureUsage.COPY_DST });
      await expectValidationError(true, async () => {
        encoder.copyTextureToTexture(
          { texture: src },
          { texture: dst },
          [4, 4],
        );
      });
    });

     itWithDevice('fails if encoder is finished', async (device) => {
      const encoder = await createCommandEncoder(device);
      encoder.finish();
      const src = device.createTexture({ format: 'rgba8unorm', size: [4, 4], usage: GPUTextureUsage.COPY_SRC });
      const dst = device.createTexture({ format: 'rgba8unorm', size: [4, 4], usage: GPUTextureUsage.COPY_DST });
      await expectValidationError(true, async () => {
        encoder.copyTextureToTexture(
          { texture: src },
          { texture: dst },
          [4, 4],
        );
      });
    });

     itWithDevice('fails if src sampleCount != dst sampleCount', async (device) => {
      const encoder = await createCommandEncoder(device);
      const src = device.createTexture({ format: 'rgba8unorm', size: [4, 4], usage: GPUTextureUsage.COPY_SRC });
      const dst = device.createTexture({ format: 'rgba8unorm', size: [4, 4], usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT, sampleCount: 4 });
      await expectValidationError(true, async () => {
        encoder.copyTextureToTexture(
          { texture: src },
          { texture: dst },
          [4, 4],
        );
      });
    });

    describe('fails if src = dst and box overlaps', () => {
      const overlapTests = [
        { fail: false, origin: [2, 2, 2], desc: 'no overlap'},
        { fail: true, origin: [1, 2, 2], desc: 'overlap x'},
        { fail: true, origin: [2, 1, 2], desc: 'overlap y'},
        { fail: true, origin: [2, 1, 1], desc: 'overlap z'},
      ];

      for (const {fail, origin, desc} of overlapTests) {
        itWithDevice(desc, async (device) => {
          const encoder = await createCommandEncoder(device);
          const texture = device.createTexture({ format: 'rgba8unorm', size: [4, 4, 4], usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST });
          await expectValidationError(fail, async () => {
            encoder.copyTextureToTexture(
              { texture, origin },
              { texture },
              [2, 2, 2],
            );
          });
        });
      }
    });

    const sdTests = [
      { options: { mipLevel: 1 }, desc: 'fails if $.mipLevel > $.textureMipLevelCount' },
      { options: { origin: [1] }, desc: 'fails if $.originX is not a multiple of blockWidth' },
      { options: { origin: [0, 1] }, desc: 'fails if $.originY is not a multiple of blockWidth' },
      { options: { origin: [8]}, desc: 'fails if $.originX + copySize.width > texture.width' },
      { options: { origin: [0, 8]}, desc: 'fails if $.originY + copySize.height > texture.width' },
      { destroy: true, desc: 'fails if $ destroyed' },
      { usage: true, desc: 'fails if $ usage incorrect' },
      { otherDevice: true, desc: 'fails if $ from different device' },
    ];

    // test depth-stencil must be entire texture if sampleCount > 1
    // test depth-stencil must be aspect "all"

    ['src', 'dst'].forEach((sd, i) => {
      describe(sd, () => {
        for (const {options, destroy, usage, otherDevice, desc} of sdTests) {
          itWithDevice4x4Format16BytesPerPixel(desc.replaceAll('$', sd), async (device, format) => {
            const encoder = await createCommandEncoder(device);
            const usages = [GPUTextureUsage.COPY_SRC, GPUTextureUsage.COPY_DST];
            if (usage) {
              usages[i] = GPUTextureUsage.TEXTURE_BINDING;
            }
            const devices = [device, device];
            if (otherDevice) {
              devices[i] = (await createDeviceWith4x4Format16BytesPerPixel()).device;
            }
            const [src, dst] = usages.map((usage, i) => devices[i].createTexture({ format, size: [8, 8], usage }));
            if (destroy) {
              [src, dst][i].destroy();
            }

            const args = [
              { texture: src },
              { texture: dst },
              [4, 4],
            ];
            Object.assign(args[i], options);

            await expectValidationError(true, async () => {
              encoder.copyTextureToTexture(...args);
            });

          });
        }
      });
    });

  });

}

