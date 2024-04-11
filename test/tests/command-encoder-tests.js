import assert, {
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

async function createCommandEncoder(device) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  return device.createCommandEncoder();
}

async function createDeviceWith4x4Format16BytesPerPixel() {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice({requiredFeatures: adapter.features});

  // Pick a format with 4x4 blockSize and 16 bytes per pixel
  const format = [
    { feature: 'texture-compression-bc', format: 'bc2-rgba-unorm' },
    { feature: 'texture-compression-etc2', format: 'etc2-rgba8unorm"' },
    { feature: 'texture-compression-astc', format: 'astc-4x4-unorm' },
  ].find(({feature}) => device.features.has(feature)).format;

  assertTruthy(format);

  return { device, format };
}

describe('test command encoder', () => {

  describe('test finish', () => {

    it('can not finish twice', async () => {
      const encoder = await createCommandEncoder();
      encoder.finish();
      await expectValidationError(true, async () => {
        encoder.finish();
      });
    });

    it('can not finish if locked', async () => {
      const encoder = await createCommandEncoder();
      const pass = encoder.beginComputePass();
      await expectValidationError(true, async () => {
        encoder.finish();
      });
    });

  });

  describe('test copyBufferToBuffer', () => {

    it('works', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const src = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_SRC});
      const dst = device.createBuffer({size: 32, usage: GPUBufferUsage.COPY_DST});
      await expectValidationError(false, async () => {
        encoder.copyBufferToBuffer(src, 0, dst, 0, 16);
      });
    });

    it('fails if src not same device', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const device2 = await (await navigator.gpu.requestAdapter()).requestDevice();
      const src = device2.createBuffer({size: 16, usage: GPUBufferUsage.COPY_SRC});
      const dst = device.createBuffer({size: 32, usage: GPUBufferUsage.COPY_DST});
      await expectValidationError(true, async () => {
        encoder.copyBufferToBuffer(src, 0, dst, 0, 16);
      });
    });

    it('fails if dst not same device', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const device2 = await (await navigator.gpu.requestAdapter()).requestDevice();
      const src = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_SRC});
      const dst = device2.createBuffer({size: 32, usage: GPUBufferUsage.COPY_DST});
      await expectValidationError(true, async () => {
        encoder.copyBufferToBuffer(src, 0, dst, 0, 16);
      });
    });

    it('fails if src = dst', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const src = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST});
      await expectValidationError(true, async () => {
        encoder.copyBufferToBuffer(src, 0, src, 0, 16);
      });
    });

    it('fails if src destroyed', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const src = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_SRC});
      const dst = device.createBuffer({size: 32, usage: GPUBufferUsage.COPY_DST});
      src.destroy();
      await expectValidationError(true, async () => {
        encoder.copyBufferToBuffer(src, 0, dst, 0, 16);
      });      
    });

    it('fails if dst destroyed', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const src = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_SRC});
      const dst = device.createBuffer({size: 32, usage: GPUBufferUsage.COPY_DST});
      dst.destroy();
      await expectValidationError(true, async () => {
        encoder.copyBufferToBuffer(src, 0, dst, 0, 16);
      });      
    });

    it('fails if src.usage missing COPY_SRC', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const src = device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM});
      const dst = device.createBuffer({size: 32, usage: GPUBufferUsage.COPY_DST});
      await expectValidationError(true, async () => {
        encoder.copyBufferToBuffer(src, 0, dst, 0, 16);
      });
    });

    it('fails if dst.usage missing COPY_DST', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const src = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_SRC});
      const dst = device.createBuffer({size: 32, usage: GPUBufferUsage.UNIFORM});
      await expectValidationError(true, async () => {
        encoder.copyBufferToBuffer(src, 0, dst, 0, 16);
      });
    });

    const tests = [
      { srcOffset: 24, desc: 'srcOffset + size > src.size' },
      { dstOffset: 24, desc: 'dstOffset + size > dst.size' },
      { size: 15, desc: 'size not multiple of 4' },
      { size: 8, srcOffset: 1, desc: 'srcOffset not multiple of 4' },
      { size: 8, dstOffset: 1, desc: 'dstOffset not multiple of 4' },
    ];
    for (const {srcOffset = 0, dstOffset = 0, size = 16, desc} of tests) {
      it(desc, async () => {
        const device = await (await navigator.gpu.requestAdapter()).requestDevice();
        const encoder = await createCommandEncoder(device);
        const src = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_SRC});
        const dst = device.createBuffer({size: 32, usage: GPUBufferUsage.COPY_DST});
        await expectValidationError(true, async () => {
          encoder.copyBufferToBuffer(src, srcOffset, dst, dstOffset, size);
        });
      });
    }

  });

  describe('test copyBufferToTexture', () => {

    it('works', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.COPY_SRC});
      const texture = device.createTexture({
        format: 'rgba8unorm',
        size: [4, 4],
        usage: GPUTextureUsage.COPY_DST,
      });
      await expectValidationError(false, async () => {
        encoder.copyBufferToTexture(
          { buffer, bytesPerRow: 256 },
          { texture },
          [4, 4],
        );
      });
    });

    it('fails if encoder is locked', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const pass = encoder.beginComputePass();
      const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.COPY_SRC});
      const texture = device.createTexture({
        format: 'rgba8unorm',
        size: [4, 4],
        usage: GPUTextureUsage.COPY_DST,
      });
      await expectValidationError(true, async () => {
        encoder.copyBufferToTexture(
          { buffer, bytesPerRow: 256 },
          { texture },
          [4, 4],
        );
      });
    });

    it('fails if encoder is finished', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      encoder.finish();
      const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.COPY_SRC});
      const texture = device.createTexture({
        format: 'rgba8unorm',
        size: [4, 4],
        usage: GPUTextureUsage.COPY_DST,
      });
      await expectValidationError(true, async () => {
        encoder.copyBufferToTexture(
          { buffer, bytesPerRow: 256 },
          { texture },
          [4, 4],
        );
      });
    });

    it('fails if buffer is destroyed', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.COPY_SRC});
      const texture = device.createTexture({
        format: 'rgba8unorm',
        size: [4, 4],
        usage: GPUTextureUsage.COPY_DST,
      });
      buffer.destroy();
      await expectValidationError(true, async () => {
        encoder.copyBufferToTexture(
          { buffer, bytesPerRow: 256 },
          { texture },
          [4, 4],
        );
      });
    });

    it('fails if bytesPerRow is not multiple of 256', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.COPY_SRC});
      const texture = device.createTexture({
        format: 'rgba8unorm',
        size: [4, 4],
        usage: GPUTextureUsage.COPY_DST,
      });
      await expectValidationError(true, async () => {
        encoder.copyBufferToTexture(
          { buffer, bytesPerRow: 257 },
          { texture },
          [4, 4],
        );
      });
    });

    it('fails if texture.usage does not include COPY_DST', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.COPY_SRC});
      const texture = device.createTexture({
        format: 'rgba8unorm',
        size: [4, 4],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      await expectValidationError(true, async () => {
        encoder.copyBufferToTexture(
          { buffer, bytesPerRow: 256 },
          { texture },
          [4, 4],
        );
      });
    });

    it('fails if sampleCount not 1', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.COPY_SRC});
      const texture = device.createTexture({
        format: 'rgba8unorm',
        size: [4, 4],
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        sampleCount: 4,
      });
      await expectValidationError(true, async () => {
        encoder.copyBufferToTexture(
          { buffer, bytesPerRow: 256 },
          { texture },
          [4, 4],
        );
      });
    });

    it('fails if depth and incorrect aspect', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.COPY_SRC});
      const texture = device.createTexture({
        format: 'depth24plus-stencil8',
        size: [4, 4],
        usage: GPUTextureUsage.COPY_DST,
      });
      await expectValidationError(true, async () => {
        encoder.copyBufferToTexture(
          { buffer, bytesPerRow: 256 },
          { texture },
          [4, 4],
        );
      });
    });

    it('fails if stencil and incorrect aspect', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.COPY_SRC});
      const texture = device.createTexture({
        format: 'depth24plus-stencil8',
        size: [4, 4],
        usage: GPUTextureUsage.COPY_DST,
      });
      await expectValidationError(true, async () => {
        encoder.copyBufferToTexture(
          { buffer, bytesPerRow: 256 },
          { texture },
          [4, 4],
        );
      });
    });

    it('fails if not write copyable', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.COPY_SRC});
      const texture = device.createTexture({
        format: 'depth24plus',
        size: [4, 4],
        usage: GPUTextureUsage.COPY_DST,
      });
      await expectValidationError(true, async () => {
        encoder.copyBufferToTexture(
          { buffer, bytesPerRow: 256 },
          { texture, aspect: 'depth-only' },
          [4, 4],
        );
      });
    });

    it('fails if origin.x + copySize.width > width', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.COPY_SRC});
      const texture = device.createTexture({
        format: 'rgba8unorm',
        size: [4, 4],
        usage: GPUTextureUsage.COPY_DST,
      });
      await expectValidationError(true, async () => {
        encoder.copyBufferToTexture(
          { buffer, bytesPerRow: 256 },
          { texture, origin: [3] },
          [2, 2],
        );
      });
    });

    it('fails if origin.y + copySize.height > height', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.COPY_SRC});
      const texture = device.createTexture({
        format: 'rgba8unorm',
        size: [4, 4],
        usage: GPUTextureUsage.COPY_DST,
      });
      await expectValidationError(true, async () => {
        encoder.copyBufferToTexture(
          { buffer, bytesPerRow: 256 },
          { texture, origin: [0, 3] },
          [2, 2],
        );
      });
    });

    it('fails if origin.z + copySize.depthOrArrayLayers > depthOrArrayLayers', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.COPY_SRC});
      const texture = device.createTexture({
        format: 'rgba8unorm',
        size: [4, 4, 4],
        usage: GPUTextureUsage.COPY_DST,
      });
      await expectValidationError(true, async () => {
        encoder.copyBufferToTexture(
          { buffer, bytesPerRow: 256, rowsPerImage: 2 },
          { texture, origin: [0, 0, 3] },
          [2, 2, 2],
        );
      });
    });

    it('fails copySize.width not multiple of blockWidth', async () => {
      const { device, format } = await createDeviceWith4x4Format16BytesPerPixel();
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.COPY_SRC});
      const texture = device.createTexture({
        format,
        size: [8, 8],
        usage: GPUTextureUsage.COPY_DST,
      });
      await expectValidationError(true, async () => {
        encoder.copyBufferToTexture(
          { buffer, bytesPerRow: 256 },
          { texture },
          [5, 4],
        );
      });
    });

    it('fails copySize.height not multiple of blockHeight', async () => {
      const { device, format } = await createDeviceWith4x4Format16BytesPerPixel();
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.COPY_SRC});
      const texture = device.createTexture({
        format,
        size: [8, 8],
        usage: GPUTextureUsage.COPY_DST,
      });
      await expectValidationError(true, async () => {
        encoder.copyBufferToTexture(
          { buffer, bytesPerRow: 256 },
          { texture },
          [4, 3],
        );
      });
    });

    it('fails src offset is not multiple of blockSize in bytes', async () => {
      const { device, format } = await createDeviceWith4x4Format16BytesPerPixel();
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.COPY_SRC});
      const texture = device.createTexture({
        format,
        size: [8, 8],
        usage: GPUTextureUsage.COPY_DST,
      });
      await expectValidationError(true, async () => {
        encoder.copyBufferToTexture(
          { buffer, bytesPerRow: 256, offset: 12 },
          { texture },
          [4, 4],
        );
      });
    });

    it('fails copy.height > 1 and bytesPerRow not set', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.COPY_SRC});
      const texture = device.createTexture({
        format: 'rgba8unorm',
        size: [4, 4],
        usage: GPUTextureUsage.COPY_DST,
      });
      await expectValidationError(true, async () => {
        encoder.copyBufferToTexture(
          { buffer },
          { texture },
          [4, 4],
        );
      });
    });

    it('fails copy.height = 1 and copySize.depthOrArrayLayers > 1 and bytesPerRow not set', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.COPY_SRC});
      const texture = device.createTexture({
        format: 'rgba8unorm',
        size: [4, 4, 4],
        usage: GPUTextureUsage.COPY_DST,
      });
      await expectValidationError(true, async () => {
        encoder.copyBufferToTexture(
          { buffer, rowsPerImage: 2 },
          { texture },
          [4, 1, 2],
        );
      });
    });

    it('fails copy.height = 1 and copySize.depthOrArrayLayers > 1 and rowsPerImage not set', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.COPY_SRC});
      const texture = device.createTexture({
        format: 'rgba8unorm',
        size: [4, 4, 4],
        usage: GPUTextureUsage.COPY_DST,
      });
      await expectValidationError(true, async () => {
        encoder.copyBufferToTexture(
          { buffer, bytesPerImage: 256 },
          { texture },
          [4, 1, 2],
        );
      });
    });

    it('fails if buffer range out of bounds', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const encoder = await createCommandEncoder(device);
      const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.COPY_SRC});
      const texture = device.createTexture({
        format: 'rgba8unorm',
        size: [4, 4],
        usage: GPUTextureUsage.COPY_DST,
      });
      await expectValidationError(true, async () => {
        encoder.copyBufferToTexture(
          { buffer, bytesPerRow: 256, offset: 1536 },
          { texture },
          [4, 4],
        );
      });
    });

  });

});
