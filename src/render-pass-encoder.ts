import {
  wrapBindingCommandsMixin,
} from './binding-mixin.js';
import {
  unlockCommandEncoder,
  validateEncoderState,
} from './encoder-utils.js';
import { kAllTextureFormatInfo } from './format-info.js';
import {
  createRenderPassLayout,
} from './pipeline.js';
import {
  validateTimestampWrites,
} from './query-support.js';
import {
  getRenderPassLayoutForRenderBundle
} from './render-bundle-encoder.js';
import {
  RenderDrawInfo,
  RenderPassLayoutInfo,
  wrapRenderCommandsMixin,
} from './render-commands-mixin.js';
import {
  assertNotDestroyed,
  s_objToDevice,
} from './shared-state.js';
import {
  s_textureViewToDesc,
  s_textureViewToTexture,
} from './texture.js';
import {
  roundUp,
  trimNulls,
} from './utils.js';
import {
  assert,
  emitError,
} from './validation.js';
import {
  wrapFunctionBefore,
} from './wrap-api.js';

type InUseMipLevels = Set<number>;
type InUseDepthOrArrayLayers = Map<number, InUseMipLevels>;
type InUseTextures = Map<GPUTexture, InUseDepthOrArrayLayers>;

type RenderPassInfo = RenderDrawInfo & {
  commandEncoder: GPUCommandEncoder,
  targetWidth: number,
  targetHeight: number,
  passLayoutInfo: RenderPassLayoutInfo,
  occlusionQuerySet?: GPUQuerySet,
  occlusionIndices: Map<number, Error>,
  occlusionQueryActive?: Error,
  occlusionQueryActiveIndex: number,
  inuseTextures: InUseTextures,
};

const s_renderPassToPassInfoMap = new WeakMap<GPURenderPassEncoder, RenderPassInfo>();

function getRenderPassLayout(passEncoder: GPURenderPassEncoder): RenderPassLayoutInfo {
  return s_renderPassToPassInfoMap.get(passEncoder)!.passLayoutInfo;
}

/*
function checkTextureNotInUse(inuseTextures: InUseTextures, texture: GPUTexture, fullView: TextureViewDescriptor) {
  const views = inuseTextures.get(texture);
  if (!views) {
    return;
  }
}
*/

function markTextureInUse(inuseTextures: InUseTextures, texture: GPUTexture, view: GPUTextureView) {
  const fullView = s_textureViewToDesc.get(view)!;
  const inUseDepthOrArrayLayers = inuseTextures.get(texture) || new Map<number, InUseMipLevels>();
  inuseTextures.set(texture, inUseDepthOrArrayLayers);
  for (let l = 0; l < fullView.arrayLayerCount; ++l) {
    const layer = l + fullView.baseArrayLayer;
    const inUseMipLevels = inUseDepthOrArrayLayers.get(layer) || new Set<number>();
    inUseDepthOrArrayLayers.set(layer, inUseMipLevels);
    for (let m = 0; m < fullView.mipLevelCount; ++m) {
      const mipLevel = m + fullView.baseMipLevel;
      assert(!inUseMipLevels.has(mipLevel), () => `mipLevel(${mipLevel}) of layer(${layer}) is already in use`, [texture]);
      inUseMipLevels.add(mipLevel);
    }
  }
}

wrapRenderCommandsMixin(GPURenderPassEncoder, s_renderPassToPassInfoMap, getRenderPassLayout);

export function beginRenderPass(commandEncoder: GPUCommandEncoder, passEncoder: GPURenderPassEncoder, desc: GPURenderPassDescriptor) {
  let targetWidth: number | undefined;
  let targetHeight: number | undefined;
  const device = s_objToDevice.get(commandEncoder)!;

  const inuseTextures = new Map<GPUTexture, InUseDepthOrArrayLayers>();
  const colorFormats: (GPUTextureFormat | null)[] = [];
  let passSampleCount: number | undefined;
  let depthStencilFormat: GPUTextureFormat | undefined;
  let bytesPerSample = 0;
  let numAttachments = 0;

  const addView = (attachment: GPURenderPassColorAttachment | GPURenderPassDepthStencilAttachment | null | undefined, isDepth?: boolean) => {
    if (!attachment) {
      if (!isDepth) {
        colorFormats.push(null);
      }
      return;
    }
    ++numAttachments;
    const {view} = attachment;
    const texture = s_textureViewToTexture.get(view)!;
    assertNotDestroyed(texture);
    assert(s_objToDevice.get(texture) === device, 'texture is not from same device as command encoder', [texture, commandEncoder]);
    const {width, height, sampleCount, format} = texture;
    const formatInfo = kAllTextureFormatInfo[format];
    markTextureInUse(inuseTextures, texture, view);
    const { colorRender, depth, stencil } = formatInfo;
    if (isDepth) {
      assert(!!depth || !!stencil, () => `format(${format}) is not a depth stencil format`);
      depthStencilFormat = format;
    } else {
      colorFormats.push(format);
      assert(!!colorRender, () => `format(${format}) is not color renderable`);
      bytesPerSample += roundUp(colorRender.byteCost, colorRender.alignment);
    }
    if (!passSampleCount) {
      passSampleCount = sampleCount;
    } else {
      assert(sampleCount === passSampleCount, 'all attachments do not have the same sampleCount');
    }
    if (targetWidth === undefined) {
      targetWidth = width;
      targetHeight = height;
    } else if (targetWidth !== width || targetHeight !== height) {
      emitError('attachments are not all the same width and height', [view, texture, passEncoder, commandEncoder]);
    }
  };

  const { timestampWrites, colorAttachments, depthStencilAttachment, occlusionQuerySet } = desc;

  for (const colorAttachment of colorAttachments || []) {
      addView(colorAttachment);
  }

  addView(depthStencilAttachment, true);

  assert(numAttachments > 0, 'there must be at least 1 colorAttachment or depthStencilAttachment');
  assert(numAttachments <= device.limits.maxColorAttachments, () => `numAttachments(${numAttachments}) > device.limits.maxColorAttachments(${device.limits.maxColorAttachments})`);
  assert(bytesPerSample <= device.limits.maxColorAttachmentBytesPerSample,
    () => `color attachments bytesPerSample(${bytesPerSample}) > device.limits.maxColorAttachmentBytesPerSample(${device.limits.maxColorAttachmentBytesPerSample})`);

  if (timestampWrites) {
    validateTimestampWrites(device, timestampWrites);
  }

  if (occlusionQuerySet) {
    assertNotDestroyed(occlusionQuerySet);
    assert(device === s_objToDevice.get(occlusionQuerySet), 'occlusionQuerySet is not from same device', [occlusionQuerySet]);
    assert(occlusionQuerySet.type === 'occlusion', () => `occlusionQuerySet.type(${occlusionQuerySet.type}) is not 'occlusion'`, [occlusionQuerySet]);
  }

  const renderPassLayout = createRenderPassLayout(
    trimNulls(colorFormats),
    passSampleCount!,
    depthStencilFormat);

  s_renderPassToPassInfoMap.set(passEncoder, {
    state: 'open',
    commandEncoder,
    targetWidth: targetWidth || 0,
    targetHeight: targetWidth || 0,
    vertexBuffers: [],
    bindGroups: [],
    occlusionQuerySet,
    occlusionIndices: new Map<number, Error>(),
    occlusionQueryActiveIndex: -1,
    passLayoutInfo: {
      renderPassLayout,
      passLayoutSignature: JSON.stringify(renderPassLayout),
    },
    inuseTextures,
  });
}

wrapFunctionBefore(GPURenderPassEncoder, 'executeBundles', function (this: GPURenderPassEncoder, [bundles]) {
  const info = s_renderPassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  const device = s_objToDevice.get(this)!;

  let bundleCount = 0;
  for (const bundle of bundles) {
    assert(s_objToDevice.get(bundle) === device, () => 'bundle[${count} is not from same device as render pass encoder', [bundle]);
    const count = bundleCount;
    const bundleDesc = getRenderPassLayoutForRenderBundle(bundle)!;
    const passLayoutInfo = getRenderPassLayout(this);
    assert(bundleDesc.passLayoutInfo.passLayoutSignature === passLayoutInfo.passLayoutSignature,
           () => `bundle[${count}] is not compatible with ${this.constructor.name}

${this.constructor.name} expects ${JSON.stringify(passLayoutInfo.renderPassLayout, null, 2)}

bundle is: ${JSON.stringify(bundleDesc.passLayoutInfo.renderPassLayout, null, 2)}
`,
      [bundle, this],
    );
    ++bundleCount;
  }

  info.bindGroups.length = 0;
  info.pipeline = undefined;
  info.indexBuffer = undefined;
  info.indexFormat = undefined;
  info.vertexBuffers.length = 0;
});

wrapFunctionBefore(GPURenderPassEncoder, 'beginOcclusionQuery', function (this: GPURenderPassEncoder, [queryIndex]) {
  const info = s_renderPassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  const { occlusionIndices, occlusionQueryActive, occlusionQuerySet } = info;
  assert(!!occlusionQuerySet, 'no occlusionQuerySet in pass');
  assertNotDestroyed(occlusionQuerySet);
  assert(queryIndex < occlusionQuerySet.count, () => `queryIndex(${queryIndex}) >= occlusionQuerySet.count(${occlusionQuerySet.count})`, [occlusionQuerySet]);
  const queryErr = occlusionIndices.get(queryIndex);
  assert(!queryErr, () => `queryIndex(${queryIndex}) was already used in this pass at ${queryErr!.stack}`);
  assert(!occlusionQueryActive, () => `another query is already active from ${occlusionQueryActive!.stack}`);
  info.occlusionQueryActive = new Error();
  info.occlusionQueryActiveIndex = queryIndex;
});

wrapFunctionBefore(GPURenderPassEncoder, 'endOcclusionQuery', function (this: GPURenderPassEncoder) {
  const info = s_renderPassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  const { occlusionIndices, occlusionQueryActive, occlusionQueryActiveIndex, occlusionQuerySet } = info;
  assert(!!info.occlusionQueryActive, 'no occlusion query is active');
  occlusionIndices.set(occlusionQueryActiveIndex, occlusionQueryActive!);
  if (occlusionQuerySet) {
    assertNotDestroyed(occlusionQuerySet);
  }
  info.occlusionQueryActive = undefined;
});

wrapBindingCommandsMixin(GPURenderPassEncoder, s_renderPassToPassInfoMap);

wrapFunctionBefore(GPURenderPassEncoder, 'end', function (this: GPURenderPassEncoder) {
  const info = s_renderPassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  info.state = 'ended';
  unlockCommandEncoder(info.commandEncoder)!;
  assert(!info.occlusionQueryActive, () => `occlusion queryIndex(${info.occlusionQueryActiveIndex}) is still active`);
});

wrapFunctionBefore(GPURenderPassEncoder, 'setViewport', function (this: GPURenderPassEncoder, [x, y, width, height, minDepth, maxDepth]: [number, number, number, number, number, number]) {
  const info = s_renderPassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  const {
    targetWidth,
    targetHeight,
  } = info;

  assert(x >= 0, () => `x(${x}) < 0`, [this]);
  assert(y >= 0, () => `y(${y}) < 0`, [this]);
  assert(x + width <= targetWidth, () => `x(${x}) + width(${width}) > texture.width(${targetWidth})`, [this]);
  assert(y + height <= targetHeight, () => `y(${x}) + height(${height}) > texture.height(${targetHeight})`, [this]);
  assert(minDepth >= 0 && minDepth <= 1.0, () => `minDepth(${minDepth}) must be >= 0 and <= 1`);
  assert(maxDepth >= 0 && maxDepth <= 1.0, () => `maxDepth(${maxDepth}) must be >= 0 and <= 1`);
  assert(minDepth < maxDepth, () => `minDepth(${minDepth}) must be < maxDepth(${maxDepth})`);
});

wrapFunctionBefore(GPURenderPassEncoder, 'setScissorRect', function (this: GPURenderPassEncoder, [x, y, width, height]: [number, number, number, number]) {
  const info = s_renderPassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  const {
    targetWidth,
    targetHeight,
  } = info;
  assert(x >= 0, () => `x(${x}) < 0`, [this]);
  assert(y >= 0, () => `y(${y}) < 0`, [this]);
  assert(x + width <= targetWidth, () => `x(${x}) + width(${width}) > texture.width(${targetWidth})`, [this]);
  assert(y + height <= targetHeight, () => `y(${x}) + height(${height}) > texture.height(${targetHeight})`, [this]);
});

