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

wrapFunctionAfter(GPUCommandEncoder, 'beginComputePass', function(this: GPUCommandEncoder, passEncoder: GPUComputePassEncoder, [desc]) {
  lockCommandEncoder(this);
  beginComputePass(this, passEncoder, desc);
});

wrapFunctionAfter(GPUCommandEncoder, 'beginRenderPass', function(this: GPUCommandEncoder, passEncoder: GPURenderPassEncoder, [desc]) {
  lockCommandEncoder(this);
  beginRenderPass(this, passEncoder, desc);
});

wrapFunctionBefore(GPUCommandEncoder, 'finish', function(this: GPUCommandEncoder) {
  finishCommandEncoder(this);
});

wrapFunctionBefore(GPUCommandEncoder, 'copyBufferToBuffer', function(this: GPUCommandEncoder, [src, srcOffset, dst, dstOffset, size]) {
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
  assert(icb.bytesPerRow % 256 === 0, () => `src.bytesPerRow(${bytesPerRow}) not multiple of 256`, [icb.buffer])
}

function validateImageCopyTexture(ict: GPUImageCopyTexture, copySize: GPUExtent3D) {
  assertNotDestroyed(ict.texture);

  const formatInfo = kAllTextureFormatInfo[ict.texture.format];
  const {
    blockWidth,
    blockHeight,
  } = formatInfo;

  const mipLevel = ict.mipLevel || 0;
  const [origX, origY, origZ] = reifyGPUOrigin3D(ict.origin);
  assert(mipLevel < ict.texture.mipLevelCount, () => `mipLevel(${mipLevel}) must be less than texture.mipLevelCount(${ict.texture.mipLevelCount})`, [ict.texture]);
  assert(origX % blockWidth === 0, () => `origin.x(${origX}) not multiple of blockWidth(${blockWidth})`, [ict.texture]);
  assert(origY % blockHeight === 0, () => `origin.y(${origY}) not multiple of blockHeight(${blockHeight})`, [ict.texture]);

  const [copyWidth, copyHeight, copyDepthOrArrayLayers] = reifyGPUExtent3D(copySize)

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

  assert(origX + copyWidth <= w);
  assert(origY + copyHeight <= h);
  assert(origZ + copyDepthOrArrayLayers <= d);
  assert(w % blockWidth === 0);
  assert(h % blockHeight === 0);
}

function validateLinearTextureData(idl: GPUImageDataLayout, byteSize: number, format: GPUTextureFormat, copyExtent: GPUExtent3D) {
  const formatInfo = kAllTextureFormatInfo[format];
  const [copyWidth, copyHeight, copyDepthOrArrayLayers] = reifyGPUExtent3D(copyExtent);
  const widthInBlocks = copyWidth / formatInfo.blockWidth;
  const heightInBlocks = copyHeight / formatInfo.blockHeight;
  const bytesInLastRow = widthInBlocks * formatInfo.bytesPerBlock;

  assert(widthInBlocks % 1 === 0);
  assert(heightInBlocks % 1 === 0);
  if (heightInBlocks > 1 || copyDepthOrArrayLayers > 1) {
    assert(idl.bytesPerRow !== undefined)
  }
  if (copyDepthOrArrayLayers > 1) {
    idl.rowsPerImage !== undefined;
  }
  if (idl.bytesPerRow !== undefined) {
    assert(idl.bytesPerRow >= bytesInLastRow)
  }
  if (idl.rowsPerImage !== undefined) {
    assert(idl.rowsPerImage >= heightInBlocks);
  }

  const bytesPerRow = idl.bytesPerRow ?? 0;
  const rowsPerImage = idl.rowsPerImage ?? 0;
  let requiredBytesInCopy = 0;
  if (copyDepthOrArrayLayers > 0) {
    requiredBytesInCopy += bytesPerRow * rowsPerImage * copyDepthOrArrayLayers - 1;
    if (heightInBlocks > 0) {
      requiredBytesInCopy += bytesPerRow * (heightInBlocks - 1) + bytesInLastRow;
    }
  }
  const offset = idl.offset ?? 0;
  assert(offset + requiredBytesInCopy <= byteSize);
}

wrapFunctionBefore(GPUCommandEncoder, 'copyBufferToTexture', function(this: GPUCommandEncoder, [src, dst, copySize]) {
  getCommandBufferInfoAndValidateState(this);
  validateImageCopyBuffer(src);
  assert(!!(src.buffer.usage & GPUBufferUsage.COPY_SRC), () => `src.usage(${bufferUsageToString(src.buffer.usage)} missing COPY_SRC)`, [src.buffer]);

  validateImageCopyTexture(dst, copySize);

  const formatInfo = kAllTextureFormatInfo[dst.texture.format];

  assert(!!(dst.texture.usage & GPUTextureUsage.COPY_DST), () => `dst.texture.usage(${textureUsageToString(dst.texture.usage)} missing COPY_DST)`, [dst.texture]);
  assert(dst.texture.sampleCount === 1, 'sampleCount must be 1', [dst.texture]);
  let aspectSpecificFormat = dst.texture.format;
  const isDepthOrStencil = formatInfo.depth || formatInfo.stencil;
  if (isDepthOrStencil) {
    if (!formatInfo.stencil) {
      assert(dst.aspect !== 'stencil-only', 'can not use stencil-only aspect on non stencil texture', [dst.texture]);
    }
    if (!formatInfo.depth) {
      assert(dst.aspect !== 'depth-only', 'can not use depth-only aspect on non depth texture', [dst.texture]);
    }    
    assert(dst.aspect === 'depth-only' || dst.aspect === 'stencil-only', 'must use one aspect');
    const aspect = dst.aspect === 'depth-only' ? 'depth' : 'stencil';
    const info = formatInfo[aspect];
    assert(info.copyDst, `can not copy to ${dst.aspect} of texture`, [dst.texture]);

    if (aspectSpecificFormat === 'depth24plus-stencil8') {
      aspectSpecificFormat = dst.aspect === 'depth-only'
        ? 'depth24plus'
        : 'stencil8';
    } else if (aspectSpecificFormat === 'depth32float-stencil8') {
      aspectSpecificFormat = dst.aspect === 'depth-only'
        ? 'depth32float'
        : 'stencil8';
    }
  }

  validateTextureCopyRange(dst, copySize);

  if (!isDepthOrStencil) {
    const texelCopyBlockFootPrint = formatInfo.bytesPerBlock;
    assert(src.offset % texelCopyBlockFootPrint === 0, 'offset must be in blockSize');
  } else {
    assert(src.offset % 4 === 0);
  }

  validateLinearTextureData(src, src.buffer.size, aspectSpecificFormat, copySize);
});

