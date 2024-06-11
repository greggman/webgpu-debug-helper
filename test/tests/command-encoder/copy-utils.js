import {it} from '../../mocha-support.js';
import {
  assertTruthy,
} from '../../assert.js';
import {expectValidationError, bufferUsageToString, itWithDevice, textureUsageToString } from '../../js/utils.js';

export async function createCommandEncoder(device) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  return device.createCommandEncoder();
}

export async function createDeviceWith4x4Format16BytesPerPixel() {
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

export function itWithDevice4x4Format16BytesPerPixel(desc, fn) {
  it.call(this, desc, async () => {
    const { device, format } = await createDeviceWith4x4Format16BytesPerPixel();
    await fn.call(this, device, format);
    device.destroy();
  });
}

export function addCopyTests({
  doTest,
  bufferUsage,
  textureUsage,
}) {

  itWithDevice('works', async (device) => {
    const encoder = await createCommandEncoder(device);
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format: 'rgba8unorm',
      size: [4, 4],
      usage: textureUsage,
    });
    await expectValidationError(false, async () => {
      doTest(
        encoder,
        { buffer, bytesPerRow: 256 },
        { texture },
        [4, 4],
      );
    });
  });

  itWithDevice('fails if encoder is locked', async (device) => {
    const encoder = await createCommandEncoder(device);
    encoder.beginComputePass();
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format: 'rgba8unorm',
      size: [4, 4],
      usage: textureUsage,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, bytesPerRow: 256 },
        { texture },
        [4, 4],
      );
    });
  });

  itWithDevice('fails if encoder is finished', async (device) => {
    const encoder = await createCommandEncoder(device);
    encoder.finish();
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format: 'rgba8unorm',
      size: [4, 4],
      usage: textureUsage,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, bytesPerRow: 256 },
        { texture },
        [4, 4],
      );
    });
  });

  itWithDevice('fails if buffer is destroyed', async (device) => {
    const encoder = await createCommandEncoder(device);
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format: 'rgba8unorm',
      size: [4, 4],
      usage: textureUsage,
    });
    buffer.destroy();
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, bytesPerRow: 256 },
        { texture },
        [4, 4],
      );
    });
  });

  itWithDevice('fails if buffer is from a different device', async (device) => {
    const encoder = await createCommandEncoder(device);
    const device2 = await (await navigator.gpu.requestAdapter()).requestDevice();
    const buffer = device2.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format: 'rgba8unorm',
      size: [4, 4],
      usage: textureUsage,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, bytesPerRow: 256 },
        { texture },
        [4, 4],
      );
    });
  });

  itWithDevice('fails if texture is from a different device', async (device) => {
    const encoder = await createCommandEncoder(device);
    const device2 = await (await navigator.gpu.requestAdapter()).requestDevice();
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device2.createTexture({
      format: 'rgba8unorm',
      size: [4, 4],
      usage: textureUsage,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, bytesPerRow: 256 },
        { texture },
        [4, 4],
      );
    });
  });

  itWithDevice('fails if bytesPerRow is not multiple of 256', async (device) => {
    const encoder = await createCommandEncoder(device);
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format: 'rgba8unorm',
      size: [4, 4],
      usage: textureUsage,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, bytesPerRow: 257 },
        { texture },
        [4, 4],
      );
    });
  });

  itWithDevice(`fails if texture.usage does not include ${textureUsageToString(textureUsage)}`, async (device) => {
    const encoder = await createCommandEncoder(device);
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format: 'rgba8unorm',
      size: [4, 4],
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, bytesPerRow: 256 },
        { texture },
        [4, 4],
      );
    });
  });

  itWithDevice(`fails if buffer.usage does not include ${bufferUsageToString(bufferUsage)}`, async (device) => {
    const encoder = await createCommandEncoder(device);
    const buffer = device.createBuffer({size: 2048, usage: GPUBufferUsage.UNIFORM});
    const texture = device.createTexture({
      format: 'rgba8unorm',
      size: [4, 4],
      usage: textureUsage,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, bytesPerRow: 256 },
        { texture },
        [4, 4],
      );
    });
  });

  itWithDevice('fails if sampleCount not 1', async (device) => {
    const encoder = await createCommandEncoder(device);
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format: 'rgba8unorm',
      size: [4, 4],
      usage: textureUsage | GPUTextureUsage.RENDER_ATTACHMENT,
      sampleCount: 4,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, bytesPerRow: 256 },
        { texture },
        [4, 4],
      );
    });
  });

  itWithDevice('fails if depth and incorrect aspect', async (device) => {
    const encoder = await createCommandEncoder(device);
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format: 'depth24plus-stencil8',
      size: [4, 4],
      usage: textureUsage,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, bytesPerRow: 256 },
        { texture },
        [4, 4],
      );
    });
  });

  itWithDevice('fails if stencil and incorrect aspect', async (device) => {
    const encoder = await createCommandEncoder(device);
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format: 'depth24plus-stencil8',
      size: [4, 4],
      usage: textureUsage,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, bytesPerRow: 256 },
        { texture },
        [4, 4],
      );
    });
  });

  itWithDevice('fails if not write copyable', async (device) => {
    const encoder = await createCommandEncoder(device);
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format: 'depth24plus',
      size: [4, 4],
      usage: textureUsage,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, bytesPerRow: 256 },
        { texture, aspect: 'depth-only' },
        [4, 4],
      );
    });
  });

  itWithDevice('fails if origin.x + copySize.width > width', async (device) => {
    const encoder = await createCommandEncoder(device);
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format: 'rgba8unorm',
      size: [4, 4],
      usage: textureUsage,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, bytesPerRow: 256 },
        { texture, origin: [3] },
        [2, 2],
      );
    });
  });

  itWithDevice('fails if origin.y + copySize.height > height', async (device) => {
    const encoder = await createCommandEncoder(device);
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format: 'rgba8unorm',
      size: [4, 4],
      usage: textureUsage,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, bytesPerRow: 256 },
        { texture, origin: [0, 3] },
        [2, 2],
      );
    });
  });

  itWithDevice('fails if origin.z + copySize.depthOrArrayLayers > depthOrArrayLayers', async (device) => {
    const encoder = await createCommandEncoder(device);
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format: 'rgba8unorm',
      size: [4, 4, 4],
      usage: textureUsage,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, bytesPerRow: 256, rowsPerImage: 2 },
        { texture, origin: [0, 0, 3] },
        [2, 2, 2],
      );
    });
  });

  itWithDevice4x4Format16BytesPerPixel('fails copySize.width not multiple of blockWidth', async (device, format) => {
    const encoder = await createCommandEncoder(device);
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format,
      size: [8, 8],
      usage: textureUsage,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, bytesPerRow: 256 },
        { texture },
        [5, 4],
      );
    });
  });

  itWithDevice4x4Format16BytesPerPixel('fails copySize.height not multiple of blockHeight', async (device, format) => {
    const encoder = await createCommandEncoder(device);
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format,
      size: [8, 8],
      usage: textureUsage,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, bytesPerRow: 256 },
        { texture },
        [4, 3],
      );
    });
  });

  itWithDevice4x4Format16BytesPerPixel('fails src offset is not multiple of blockSize in bytes', async (device, format) => {
    const encoder = await createCommandEncoder(device);
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format,
      size: [8, 8],
      usage: textureUsage,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, bytesPerRow: 256, offset: 12 },
        { texture },
        [4, 4],
      );
    });
  });

  itWithDevice('fails copy.height > 1 and bytesPerRow not set', async (device) => {
    const encoder = await createCommandEncoder(device);
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format: 'rgba8unorm',
      size: [4, 4],
      usage: textureUsage,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer },
        { texture },
        [4, 4],
      );
    });
  });

  itWithDevice('fails copy.height = 1 and copySize.depthOrArrayLayers > 1 and bytesPerRow not set', async (device) => {
    const encoder = await createCommandEncoder(device);
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format: 'rgba8unorm',
      size: [4, 4, 4],
      usage: textureUsage,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, rowsPerImage: 2 },
        { texture },
        [4, 1, 2],
      );
    });
  });

  itWithDevice('fails copy.height = 1 and copySize.depthOrArrayLayers > 1 and rowsPerImage not set', async (device) => {
    const encoder = await createCommandEncoder(device);
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format: 'rgba8unorm',
      size: [4, 4, 4],
      usage: textureUsage,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, bytesPerImage: 256 },
        { texture },
        [4, 1, 2],
      );
    });
  });

  itWithDevice('fails if buffer range out of bounds', async (device) => {
    const encoder = await createCommandEncoder(device);
    const buffer = device.createBuffer({size: 2048, usage: bufferUsage});
    const texture = device.createTexture({
      format: 'rgba8unorm',
      size: [4, 4],
      usage: textureUsage,
    });
    await expectValidationError(true, async () => {
      doTest(
        encoder,
        { buffer, bytesPerRow: 256, offset: 1536 },
        { texture },
        [4, 4],
      );
    });
  });
}
