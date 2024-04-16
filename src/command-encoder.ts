import {
  beginComputePass,
} from './compute-pass-encoder.js';
import {
  lockCommandEncoder,
  finishCommandEncoder,
  getCommandBufferInfoAndValidateState,
} from './encoder-utils.js';
import {
  kAllTextureFormatInfo
} from './format-info.js';
import {
  beginRenderPass,
} from './render-pass-encoder.js';
import { assertNotDestroyed, s_objToDevice } from './shared-state.js';
import { bufferUsageToString, physicalMipLevelSpecificTextureExtent, reifyGPUExtent3D, reifyGPUOrigin3D, textureUsageToString } from './utils.js';
import { assert } from './validation.js';
import {
  wrapFunctionAfter,
  wrapFunctionBefore,
} from './wrap-api.js';

wrapFunctionAfter(GPUCommandEncoder, 'beginComputePass', function (this: GPUCommandEncoder, passEncoder: GPUComputePassEncoder, [desc]) {
  s_objToDevice.set(passEncoder, s_objToDevice.get(this)!);
  lockCommandEncoder(this);
  beginComputePass(this, passEncoder, desc);
});

wrapFunctionAfter(GPUCommandEncoder, 'beginRenderPass', function (this: GPUCommandEncoder, passEncoder: GPURenderPassEncoder, [desc]) {
  s_objToDevice.set(passEncoder, s_objToDevice.get(this)!);
  lockCommandEncoder(this);
  beginRenderPass(this, passEncoder, desc);
});

wrapFunctionBefore(GPUCommandEncoder, 'finish', function (this: GPUCommandEncoder) {
  finishCommandEncoder(this);
});

wrapFunctionBefore(GPUCommandEncoder, 'copyBufferToBuffer', function (this: GPUCommandEncoder, [src, srcOffset, dst, dstOffset, size]) {
  getCommandBufferInfoAndValidateState(this);
  assertNotDestroyed(src);
  assertNotDestroyed(dst);
  const device = s_objToDevice.get(this);
  assert(device === s_objToDevice.get(src), 'src is not from same device as commandEncoder', [src, this]);
  assert(device === s_objToDevice.get(dst), 'dst is not from same device as commandEncoder', [dst, this]);
  assert(src !== dst, 'src must not be same buffer as dst', [src, dst]);
  assert(!!(src.usage & GPUBufferUsage.COPY_SRC), () => `src.usage(${bufferUsageToString(src.usage)} missing COPY_SRC)`, [src]);
  assert(!!(dst.usage & GPUBufferUsage.COPY_DST), () => `dst.usage(${bufferUsageToString(dst.usage)} missing COPY_DST)`, [dst]);
  assert(srcOffset + size <= src.size, () => `srcOffset(${srcOffset}) + size(${size}) > srcBuffer.size(${src.size})`, [src]);
  assert(dstOffset + size <= dst.size, () => `dstOffset(${dstOffset}) + size(${size}) > dstBuffer.size(${dst.size})`, [dst]);
  assert(size % 4 === 0, () => `size(${size}) is not multiple of 4`);
  assert(srcOffset % 4 === 0, () => `srcOffset(${srcOffset}) is not multiple of 4`);
  assert(dstOffset % 4 === 0, () => `dstOffset(${dstOffset}) is not multiple of 4`);
});

function validateImageCopyBuffer(icb: GPUImageCopyBuffer) {
  assertNotDestroyed(icb.buffer);
  const bytesPerRow = icb.bytesPerRow || 0;
  assert(bytesPerRow % 256 === 0, () => `src.bytesPerRow(${bytesPerRow}) not multiple of 256`, [icb.buffer]);
}

function validateImageCopyTexture(ict: GPUImageCopyTexture, copySize: GPUExtent3D) {
  assertNotDestroyed(ict.texture);

  const formatInfo = kAllTextureFormatInfo[ict.texture.format];
  const {
    blockWidth,
    blockHeight,
  } = formatInfo;

  const mipLevel = ict.mipLevel || 0;
  const [origX, origY] = reifyGPUOrigin3D(ict.origin);
  assert(mipLevel < ict.texture.mipLevelCount, () => `mipLevel(${mipLevel}) must be less than texture.mipLevelCount(${ict.texture.mipLevelCount})`, [ict.texture]);
  assert(origX % blockWidth === 0, () => `origin.x(${origX}) not multiple of blockWidth(${blockWidth})`, [ict.texture]);
  assert(origY % blockHeight === 0, () => `origin.y(${origY}) not multiple of blockHeight(${blockHeight})`, [ict.texture]);

  const [copyWidth, copyHeight, copyDepthOrArrayLayers] = reifyGPUExtent3D(copySize);

  if (formatInfo.depth && formatInfo.stencil && ict.texture.sampleCount > 1) {
    const [w, h, d] = physicalMipLevelSpecificTextureExtent(ict.texture, mipLevel);
    assert(copyWidth === w &&
           copyHeight === h &&
           copyDepthOrArrayLayers === d, 'copySize must match textureSize for depth-stencil textures', [ict.texture]);
  }
}

function validateTextureCopyRange(ict: GPUImageCopyTexture, copySize: GPUExtent3D) {
  const formatInfo = kAllTextureFormatInfo[ict.texture.format];
  const {
    blockWidth,
    blockHeight,
  } = formatInfo;
  const mipLevel = ict.mipLevel || 0;
  const [origX, origY, origZ] = reifyGPUOrigin3D(ict.origin);
  const [copyWidth, copyHeight, copyDepthOrArrayLayers] = reifyGPUExtent3D(copySize);
  const [w, h, d] = physicalMipLevelSpecificTextureExtent(ict.texture, mipLevel);

  const res = [ict.texture];
  assert(origX + copyWidth <= w, () => `origin.x(${origX}) + copySize.width(${copyWidth}) is > physical width(${w}) of mipLevel(${mipLevel})`, res);
  assert(origY + copyHeight <= h, () => `origin.y(${origY}) + copySize.height(${copyHeight}) is > physical height(${h}) of mipLevel(${mipLevel})`, res);
  assert(origZ + copyDepthOrArrayLayers <= d, () => `origin.z(${origZ}) + copySize.depthOrArrayBuffers(${copyDepthOrArrayLayers}) is > texture.depthOrArrayLayers(${d}) of mipLevel(${mipLevel})`, res);
  assert(copyWidth % blockWidth === 0, () => `copySize.width(${copyWidth}) is not multiple of blockWidth(${blockWidth})`, res);
  assert(copyHeight % blockHeight === 0, () => `copySize.height(${copyHeight}) is not multiple of blockHeight(${blockHeight})`, res);
}

function validateLinearTextureData(idl: GPUImageDataLayout, byteSize: number, format: GPUTextureFormat, copyExtent: GPUExtent3D) {
  const formatInfo = kAllTextureFormatInfo[format];
  const [copyWidth, copyHeight, copyDepthOrArrayLayers] = reifyGPUExtent3D(copyExtent);
  const { blockWidth, blockHeight } = formatInfo;
  const widthInBlocks = copyWidth / blockWidth;
  const heightInBlocks = copyHeight / blockHeight;
  const bytesInLastRow = widthInBlocks * formatInfo.bytesPerBlock!;

  assert(widthInBlocks % 1 === 0, () => `width(${copyWidth}) must be multiple of blockWidth${blockWidth}`);
  assert(heightInBlocks % 1 === 0, () => `height(${copyHeight}) must be multiple of blockHeight${blockHeight}`);
  if (heightInBlocks > 1) {
    assert(idl.bytesPerRow !== undefined, () => `bytesPerRow must be set if heightInBlocks(${heightInBlocks}) > 1`);
  }

  if (copyDepthOrArrayLayers > 1) {
    assert(idl.bytesPerRow !== undefined, () => `bytesPerRow must be set if copySize.depthOrArrayLayers(${copyDepthOrArrayLayers}) > 1`);
  }
  if (copyDepthOrArrayLayers > 1) {
    assert(idl.rowsPerImage !== undefined, () => `rowsPerImage must be set if copySize.depthOrArrayLayers(${copyDepthOrArrayLayers}) > 1`);
  }
  if (idl.bytesPerRow !== undefined) {
    assert(idl.bytesPerRow >= bytesInLastRow, () => `bytesPerRow(${idl.bytesPerRow}) must be >= bytes in the last row(${bytesInLastRow})`);
  }
  if (idl.rowsPerImage !== undefined) {
    assert(idl.rowsPerImage >= heightInBlocks, () => `rowsPerImage(${idl.rowsPerImage}) must be >= heightInBlocks(${heightInBlocks})`);
  }

  const bytesPerRow = idl.bytesPerRow ?? 0;
  const rowsPerImage = idl.rowsPerImage ?? 0;
  let requiredBytesInCopy = 0;
  if (copyDepthOrArrayLayers > 0) {
    // all layers except the last one
    requiredBytesInCopy += bytesPerRow * rowsPerImage * (copyDepthOrArrayLayers - 1);
    if (heightInBlocks > 0) {
      // last layer = all rows padded + last row
      requiredBytesInCopy += bytesPerRow * (heightInBlocks - 1) + bytesInLastRow;
    }
  }
  const offset = idl.offset ?? 0;
  assert(offset + requiredBytesInCopy <= byteSize, () => `offset(${offset}) + requiredBytesInCopy(${requiredBytesInCopy}) must be <= buffer.size(${byteSize})`);
}

function validateB2TorT2BCopy(encoder: GPUCommandEncoder, buf: GPUImageCopyBuffer, tex: GPUImageCopyTexture, copySize: GPUExtent3D, bufferIsSource: boolean) {
  const device = s_objToDevice.get(encoder);
  assert(device === s_objToDevice.get(buf.buffer), 'buffer is not from same device as commandEncoder', [buf.buffer, encoder]);
  assert(device === s_objToDevice.get(tex.texture), 'texture is not from same device as commandEncoder', [tex.texture, encoder]);

  validateImageCopyBuffer(buf);
  const [bufRequiredUsage, texRequiredUsage]: [keyof GPUBufferUsage, keyof GPUTextureUsage] = bufferIsSource
     ? ['COPY_SRC', 'COPY_DST']
     : ['COPY_DST', 'COPY_SRC'];
  assert(!!(buf.buffer.usage & GPUBufferUsage[bufRequiredUsage]), () => `src.usage(${bufferUsageToString(buf.buffer.usage)} missing ${bufRequiredUsage})`, [buf.buffer]);

  validateImageCopyTexture(tex, copySize);

  const formatInfo = kAllTextureFormatInfo[tex.texture.format];

  assert(!!(tex.texture.usage & GPUTextureUsage[texRequiredUsage]), () => `dst.texture.usage(${textureUsageToString(tex.texture.usage)} missing ${texRequiredUsage})`, [tex.texture]);
  assert(tex.texture.sampleCount === 1, 'sampleCount must be 1', [tex.texture]);

  let aspectSpecificFormat = tex.texture.format;
  const isDepthOrStencil = formatInfo.depth || formatInfo.stencil;
  if (isDepthOrStencil) {
    if (!formatInfo.stencil) {
      assert(tex.aspect !== 'stencil-only', 'can not use stencil-only aspect on non stencil texture', [tex.texture]);
    }
    if (!formatInfo.depth) {
      assert(tex.aspect !== 'depth-only', 'can not use depth-only aspect on non depth texture', [tex.texture]);
    }
    assert(tex.aspect === 'depth-only' || tex.aspect === 'stencil-only', 'must use one aspect');
    const aspect = tex.aspect === 'depth-only' ? 'depth' : 'stencil';
    const info = formatInfo[aspect];
    assert(!!info?.copyDst, `can not copy to ${tex.aspect} of texture of format(${tex.texture.format})`, [tex.texture]);

    if (aspectSpecificFormat === 'depth24plus-stencil8') {
      aspectSpecificFormat = tex.aspect === 'depth-only'
        ? 'depth24plus'
        : 'stencil8';
    } else if (aspectSpecificFormat === 'depth32float-stencil8') {
      aspectSpecificFormat = tex.aspect === 'depth-only'
        ? 'depth32float'
        : 'stencil8';
    }
  }

  validateTextureCopyRange(tex, copySize);

  const srcOffset = buf.offset || 0;
  if (!isDepthOrStencil) {
    const texelCopyBlockFootPrint = formatInfo.bytesPerBlock!;
    assert(srcOffset % texelCopyBlockFootPrint === 0, () => `src.offset(${srcOffset}) must multiple of blockSize(${texelCopyBlockFootPrint})`);
  } else {
    assert(srcOffset % 4 === 0, () => `src.offset(${srcOffset}) must by multiple of 4 for depth and/or stencil textures`);
  }

  validateLinearTextureData(buf, buf.buffer.size, aspectSpecificFormat, copySize);
}

function isCopyCompatible(format1: GPUTextureFormat, format2: GPUTextureFormat) {
  return format1.replace('-srgb', '') === format2.replace('-srgb', '');
}

function isIntersectingAxis(v1: number, v2: number, size: number) {
  const distance = Math.abs(v2 - v1);
  const gap = distance - size;
  return gap < 0;
}

wrapFunctionBefore(GPUCommandEncoder, 'copyBufferToTexture', function (this: GPUCommandEncoder, [src, dst, copySize]) {
  getCommandBufferInfoAndValidateState(this);
  validateB2TorT2BCopy(this, src, dst, copySize, true);
});

wrapFunctionBefore(GPUCommandEncoder, 'copyTextureToBuffer', function (this: GPUCommandEncoder, [src, dst, copySize]) {
  getCommandBufferInfoAndValidateState(this);
  validateB2TorT2BCopy(this, dst, src, copySize, false);
});

wrapFunctionBefore(GPUCommandEncoder, 'copyTextureToTexture', function (this: GPUCommandEncoder, [src, dst, copySize]) {
  getCommandBufferInfoAndValidateState(this);

  const device = s_objToDevice.get(this);
  assert(device === s_objToDevice.get(src.texture), 'src.texture is not from same device as commandEncoder', [src, this]);
  assert(device === s_objToDevice.get(dst.texture), 'dst.texture is not from same device as commandEncoder', [dst, this]);

  validateImageCopyTexture(src, copySize);
  assert(!!(src.texture.usage & GPUTextureUsage.COPY_SRC), () => `src.texture.usage(${textureUsageToString(src.texture.usage)} missing COPY_SRC`, [src.texture]);

  validateImageCopyTexture(dst, copySize);
  assert(!!(dst.texture.usage & GPUTextureUsage.COPY_DST), () => `src.texture.usage(${textureUsageToString(dst.texture.usage)} missing COPY_DST`, [dst.texture]);

  assert(src.texture.sampleCount === dst.texture.sampleCount, () => `src.texture.sampleCount(${src.texture.sampleCount}) must equal dst.texture.sampleCount(${dst.texture.sampleCount})`, [src.texture, dst.texture]);
  assert(isCopyCompatible(src.texture.format, dst.texture.format), () => `src.texture.format(${src.texture.format}) must be copy compatible with dst.texture.format(${dst.texture.format})`, [src.texture, dst.texture]);

  const formatInfo = kAllTextureFormatInfo[src.texture.format];
  const isDepthStencil = !!formatInfo.depth && !!formatInfo.stencil;
  if (isDepthStencil) {
    assert(src.aspect === 'all', () => `src.aspect must be 'all' when format(${src.texture.format}) is a depth-stencil format`, [src.texture]);
    assert(dst.aspect === 'all', () => `dst.aspect must be 'all' when format(${dst.texture.format}) is a depth-stencil format`, [dst.texture]);
  }

  validateTextureCopyRange(src, copySize);
  validateTextureCopyRange(dst, copySize);

  if (src.texture === dst.texture) {
    const srcOrigin = reifyGPUOrigin3D(src.origin);
    const dstOrigin = reifyGPUOrigin3D(dst.origin);
    const size = reifyGPUExtent3D(copySize);
    assert(
      !isIntersectingAxis(srcOrigin[0], dstOrigin[0], size[0]) &&
      !isIntersectingAxis(srcOrigin[1], dstOrigin[1], size[1]) &&
      !isIntersectingAxis(srcOrigin[2], dstOrigin[2], size[2]),
      () => `when src and dst textures are the same texture, copy boxes must not overlap`, [src.texture, dst.texture]);
  }
});

wrapFunctionBefore(GPUCommandEncoder, 'clearBuffer', function (this: GPUCommandEncoder, [buffer, offset, size]) {
  getCommandBufferInfoAndValidateState(this);
  assertNotDestroyed(buffer);
  offset = offset ?? 0;
  size = size ?? buffer.size - offset;
  assert(s_objToDevice.get(this) === s_objToDevice.get(buffer), 'buffer not from same device as encoder', [buffer, this]);
  assert(!!(buffer.usage & GPUBufferUsage.COPY_DST), () => `buffer.usage(${bufferUsageToString(buffer.usage)}) must have COPY_DST`, [buffer]);
  assert(size % 4 === 0, () => `size(${size}) must be multiple of 4`);
  assert(offset % 4 === 0, () => `offset(${offset}) must be multiple of 4`);
  assert(offset + size <= buffer.size, () => `offset(${offset}) + size(${size}) must be <= buffer.size(${buffer.size})`);
});

wrapFunctionBefore(GPUCommandEncoder, 'resolveQuerySet', function (this: GPUCommandEncoder, [querySet, firstQuery, queryCount, destination, destinationOffset]) {
  getCommandBufferInfoAndValidateState(this);
  assertNotDestroyed(querySet);
  assertNotDestroyed(destination);
  const device = s_objToDevice.get(this);
  assert(s_objToDevice.get(querySet) === device, 'querySet not from same device', [querySet]);
  assert(s_objToDevice.get(destination) === device, 'destination buffer not from same device', [destination]);
  assert((destination.usage & GPUBufferUsage.QUERY_RESOLVE) !== 0, () => `destination.usage(${bufferUsageToString(destination.usage)} does not contain QUERY_RESOLVE)`, [destination]);
  assert(firstQuery < querySet.count, () => `firstQuery(${firstQuery}) out of range for querySet.count(${querySet.count})`);
  assert(firstQuery + queryCount <= querySet.count, () => `firstQuery(${firstQuery}) + queryCount(${queryCount}) > querySet.count(${querySet.count})`);
  assert(destinationOffset % 256 === 0, () => `destinationOffset(${destinationOffset}) is not multiple of 256`);
  assert(destinationOffset + queryCount * 8 < destination.size, () => `destinationOffset(${destinationOffset}) + queryCount(${queryCount}) * 8 > destination.size(${destination.size})`);
});