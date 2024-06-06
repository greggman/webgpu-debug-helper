import {
  EncoderInfo,
  validateEncoderState,
} from './encoder-utils.js';
import {
  BindGroupLayoutDescriptorPlus,
  s_pipelineToReifiedPipelineLayoutDescriptor,
} from './pipeline.js';
import {
  BindGroupInfo,
  assertNotDestroyed,
  getIdForObject,
  s_bindGroupToInfo,
  s_objToDevice,
} from './shared-state.js';
import { s_textureViewToDesc, s_textureViewToTexture } from './texture.js';
import {
  assert,
} from './validation.js';
import {
  wrapFunctionBefore,
} from './wrap-api.js';

export type BindGroupBinding = {
  bindGroup: GPUBindGroup,
  dynamicOffsets?: Uint32Array,
} | undefined;

export type PassInfo = EncoderInfo & {
  bindGroups: BindGroupBinding[],
}

type BindingMixin =
  | GPUComputePassEncoder
  | GPURenderPassEncoder
  | GPURenderBundleEncoder;

type Ctor<T extends BindingMixin> = {
   new (): never;
   prototype: T;
};

function getResourceFromBindingResource(bindingResource: GPUBindingResource) {
  if (bindingResource instanceof GPUTextureView) {
    return s_textureViewToTexture.get(bindingResource)!;
  } else if (bindingResource instanceof GPUSampler ||
        bindingResource instanceof GPUExternalTexture) {
    return bindingResource;
  } else {
    return bindingResource.buffer;
  }
}

const autoIdRE = /^(.*?)autoId\((\d+)\)/;
function generateErrorMessageForMismatchedBindGroupLayouts(group: number, bindGroupInfo: BindGroupInfo, bindGroupLayoutDescriptor: BindGroupLayoutDescriptorPlus) {
  const bgAuto = autoIdRE.exec(bindGroupInfo.layoutPlus.signature);
  const bglAuto = autoIdRE.exec(bindGroupLayoutDescriptor.signature);
  if (bgAuto || bglAuto) {
    // are they both auto?
    if (!bgAuto === !bglAuto) {
      if (bgAuto![2] !== bglAuto![2]) {
      return `bindGroup in group(${group}) is not compatible with pipeline requirements for that group \
because they are from different layout: 'auto' pipelines.`;
      }
    } else {
      return `bindGroup in group(${group}) is not compatible with pipeline requirements for that group \
because bindGroup's layout ${bgAuto ? 'is' : 'is not'} from a layout: 'auto' pipeline \
and the pipeline's bindGroup layout requirements ${bglAuto ? 'is' : 'is not'} from a layout: 'auto' pipeline`;
    }
  }
  return `bindGroup in group(${group}) is not compatible with pipeline requirements for that group

bindGroup.layout = ${JSON.stringify(bindGroupInfo.layoutPlus.bindGroupLayoutDescriptor, null, 2)}

pipeline.group[${group}] requirements = ${JSON.stringify(bindGroupLayoutDescriptor.bindGroupLayoutDescriptor, null, 2)}`;
}

//function validateEncoderBindGroupsDoNotAliasAWritableResource() {
//  //
//}

export function validateEncoderBindGroups(bindGroups: BindGroupBinding[], pipeline?: GPURenderPipeline | GPUComputePipeline) {
  assert(!!pipeline, 'no pipeline set');
  const device = s_objToDevice.get(pipeline);

  const reifiedPipelineDescriptor = s_pipelineToReifiedPipelineLayoutDescriptor.get(pipeline)!;
  reifiedPipelineDescriptor.bindGroupLayoutDescriptors.forEach((bindGroupLayoutDescriptor, group) => {
    const binding = bindGroups[group];
    assert(!!binding, () => `required bindGroup missing from group(${group})`);
    const bindGroupInfo = s_bindGroupToInfo.get(binding.bindGroup)!;
    assert(
      bindGroupInfo.layoutPlus.signature === bindGroupLayoutDescriptor.signature,
      () => generateErrorMessageForMismatchedBindGroupLayouts(group, bindGroupInfo, bindGroupLayoutDescriptor),
    );
    for (const {binding, resource: bindingResource} of bindGroupInfo.entries) {
      const resource = getResourceFromBindingResource(bindingResource);
      if (resource instanceof GPUTexture || resource instanceof GPUBuffer) {
        assertNotDestroyed(resource);
      }
      assert(s_objToDevice.get(resource) === device, () => `texture at binding(${binding}) group(${group}) is not from same device`, [resource]);
    }
  });

  const bindGroupSpaceUsed = 0;
  return bindGroupSpaceUsed;
}

export function validateBindGroupResourcesNotDestroyed(entries: GPUBindGroupEntry[]) {
 for (const {resource} of entries) {
    if (resource instanceof GPUTextureView) {
      const texture = s_textureViewToTexture.get(resource)!;
      assertNotDestroyed(texture);
    } else {
      const asBufferBinding = resource as GPUBufferBinding;
      const buffer = asBufferBinding.buffer;
      if (buffer instanceof GPUBuffer) {
        assertNotDestroyed(buffer);
      }
    }
  }
}



type BoundBufferRange = {
  bindGroupLayoutEntry: GPUBindGroupLayoutEntry,
  resource: GPUBufferBinding,
};

function makeIdForBoundBufferRange(boundBufferRange: BoundBufferRange) {
  const { binding, visibility, buffer: b } = boundBufferRange.bindGroupLayoutEntry;
  const { type = 'uniform', hasDynamicOffset = false, minBindingSize = 0 } = b!;
  const { buffer, offset = 0, size } = boundBufferRange.resource;
  return `
${binding}]
${visibility}
${type}
${hasDynamicOffset}
${minBindingSize}
${getIdForObject(buffer)}
${offset}
${size}
`;
}

function boundBufferRanges(info: BindGroupInfo, dynamicOffsets: Uint32Array) {
  const result = new Map<string, BoundBufferRange>();
  let dynamicOffsetIndex = 0;
  for (const bindGroupEntry of info.entries) {
    const bindGroupLayoutEntry = info.layoutPlus.bindGroupLayoutDescriptor.entries[bindGroupEntry.binding];
    if (!bindGroupLayoutEntry.buffer) {
      continue;
    }
    const bound = {
      offset: 0,
      ...bindGroupEntry.resource,
    } as GPUBufferBinding;
    if (bindGroupLayoutEntry.buffer.hasDynamicOffset) {
      bound.offset! += dynamicOffsets[dynamicOffsetIndex++];
    }
    const boundBufferRange = {
      bindGroupLayoutEntry,
      resource: bound,
    };
    result.set(makeIdForBoundBufferRange(boundBufferRange), boundBufferRange);
  }
  return result;
}

function intersect(aStart: number, aLen: number, bStart: number, bLen: number) {
  const aEnd = aStart + aLen;
  const bEnd = bStart + bLen;
  return (aEnd > bStart) && (aStart < bEnd);
}

function isBufferBindingAliasing(a: GPUBufferBinding, b: GPUBufferBinding) {
  if (a.buffer !== b.buffer) {
    return false;
  }
  const aSize = a.size ?? a.buffer.size;
  const bSize = b.size ?? b.buffer.size;
  const aStart = a.offset ?? 0;
  const bStart = b.offset ?? 0;
  return intersect(aStart, aSize, bStart, bSize);
}

function aspectToBits(aspect: GPUTextureAspect): number {
  switch (aspect) {
    case 'stencil-only': return 1;
    case 'depth-only': return 2;
    case 'all': return 3;
  }
  throw new Error('unreachable');
}

function isTextureViewAliasing(a: GPUTextureView, b: GPUTextureView) {
  const aTex = s_textureViewToTexture.get(a);
  const bTex = s_textureViewToTexture.get(b);
  if (aTex !== bTex) {
    return false;
  }
  const aInfo = s_textureViewToDesc.get(a)!;
  const bInfo = s_textureViewToDesc.get(b)!;

  const aAspect = aspectToBits(aInfo.aspect);
  const bAspect = aspectToBits(bInfo.aspect);

  if ((aAspect & bAspect) === 0) {
    return false;
  }

  const layersIntersect = intersect(aInfo.baseArrayLayer, aInfo.arrayLayerCount, bInfo.baseArrayLayer, bInfo.arrayLayerCount);
  if (!layersIntersect) {
    return false;
  }
  return intersect(aInfo.baseMipLevel, aInfo.mipLevelCount, bInfo.baseMipLevel, bInfo.mipLevelCount);
}

const kStages = [
  GPUShaderStage.VERTEX,
  GPUShaderStage.FRAGMENT,
  GPUShaderStage.COMPUTE,
];

export function encoderBindGroupsAliasAWritableResource(
    bindGroups: BindGroupBinding[],
    dynamicOffsets: Uint32Array[],
    bindGroupLayoutDescriptorPlus: BindGroupLayoutDescriptorPlus[]) {
  for (const stage of kStages) {
    const bufferBindings = new Map<GPUBufferBinding, boolean>();
    const textureViews = new Map<GPUTextureView, boolean>();
    for (let bindGroupIndex = 0; bindGroupIndex < bindGroups.length; ++bindGroupIndex) {
      const bindGroupBinding = bindGroups[bindGroupIndex];
      if (!bindGroupBinding) {
        continue;
      }
      const bindGroupInfo = s_bindGroupToInfo.get(bindGroupBinding.bindGroup)!;

      // check buffers
      const bufferRanges = boundBufferRanges(bindGroupInfo, dynamicOffsets[bindGroupIndex]);
      for (const {bindGroupLayoutEntry, resource} of bufferRanges.values()) {
        if ((bindGroupLayoutEntry.visibility & stage) === 0) {
          continue;
        }
        const resourceWritable = bindGroupLayoutEntry.buffer!.type === 'storage';
        for (const [pastResource, pastResourceWritable] of bufferBindings.entries()) {
          if ((resourceWritable || pastResourceWritable) && isBufferBindingAliasing(pastResource, resource)) {
            return true;
          }
        }
        bufferBindings.set(resource, resourceWritable);
      }

      // check textures
      const textureEntries = bindGroupLayoutDescriptorPlus[bindGroupIndex].bindGroupLayoutDescriptor.entries.filter(e => (e.visibility & stage) !== 0 && (e.texture || e.storageTexture));
      for (const entry of textureEntries) {
        const resource = bindGroupInfo.entries[entry.binding].resource as GPUTextureView;
        const access = entry.storageTexture?.access;
        const resourceWritable = access === 'read-write' || access === 'write-only';
        if (!entry.storageTexture) {
          continue;
        }
        for (const [pastResource, pastResourceWritable] of textureViews.entries()) {
          if ((resourceWritable || pastResourceWritable) && isTextureViewAliasing(pastResource, resource)) {
            return true;
          }
        }
        textureViews.set(resource, resourceWritable);
      }
    }
  }
  return false;
}

function* forEachDynamicBinding(info: BindGroupInfo) {
  let dynamicOffsetIndex = 0;
  const layout = info.layoutPlus.bindGroupLayoutDescriptor;
  for (const entry of info.entries) {
    const bindingDescriptor = layout.entries[entry.binding];
    if (bindingDescriptor.buffer?.hasDynamicOffset) {
      const bufferBinding = entry.resource as GPUBufferBinding;
      const bufferLayout = bindingDescriptor.buffer;
      yield {bufferBinding, bufferLayout, dynamicOffsetIndex};
      ++dynamicOffsetIndex;
    }
  }
}

export function wrapBindingCommandsMixin<T extends BindingMixin>(
  API: Ctor<T>,
  s_passToPassInfoMap: WeakMap<T, PassInfo>) {

  wrapFunctionBefore(API, 'setBindGroup', function (this: T, [index, bindGroup, dynamicOffsetsArg, dynamicOffsetDataStart, dynamicOffsetDataLength]) {
    const info = s_passToPassInfoMap.get(this)!;
    validateEncoderState(this, info.state);
    const bindGroupBindings = info.bindGroups;

    const dynamicOffsetCount = bindGroup
      ? s_bindGroupToInfo.get(bindGroup)!.layoutPlus.dynamicOffsetCount
      : 0;
    dynamicOffsetsArg = new Uint32Array(dynamicOffsetsArg || 0);
    dynamicOffsetDataStart = dynamicOffsetDataStart ?? 0;
    dynamicOffsetDataLength = dynamicOffsetDataLength ?? dynamicOffsetsArg.length;
    const dynamicOffsets = dynamicOffsetsArg.slice(dynamicOffsetDataStart, dynamicOffsetDataLength);

    assert(dynamicOffsets.length === dynamicOffsetCount, `there must be the same number of dynamicOffsets(${dynamicOffsets.length}) as the layout requires (${dynamicOffsetCount})`);

    const device = s_objToDevice.get(this)!;
    const maxIndex = device.limits.maxBindGroups;
    assert(index >= 0, () => `index(${index}) must be >= 0`);
    assert(index < maxIndex, () => `index(${index}) must be < device.limits.maxBindGroups(${maxIndex})`);
    if (bindGroup) {
      assert(device === s_objToDevice.get(bindGroup), () => `bindGroup must be from same device as ${parent.constructor.name}`, [bindGroup, parent]);

      // Validate resources are not destroyed
      const info = s_bindGroupToInfo.get(bindGroup)!;
      validateBindGroupResourcesNotDestroyed(info.entries);

      // Validate Dynamic Offsets
      for (const {bufferBinding, bufferLayout, dynamicOffsetIndex} of forEachDynamicBinding(info)) {
        const dynamicOffset = dynamicOffsets[dynamicOffsetIndex];
        assert((bufferBinding.offset || 0) + dynamicOffset + (bufferLayout.minBindingSize || 0) <= bufferBinding.buffer.size, 'dynamic offset is out of range');
        switch (bufferLayout.type) {
          case 'uniform':
            assert(dynamicOffset % device.limits.minUniformBufferOffsetAlignment === 0, () => `dynamicOffset[${dynamicOffsetIndex}](${dynamicOffset}) used for a uniform buffer is not a multiple of device.limits.minUniformBufferOffsetAlignment(${device.limits.minUniformBufferOffsetAlignment})`);
            break;
          case 'storage':
          case 'read-only-storage':
            assert(dynamicOffset % device.limits.minStorageBufferOffsetAlignment === 0, () => `dynamicOffset[${dynamicOffsetIndex}](${dynamicOffset}) used for a uniform buffer is not a multiple of device.limits.minStorageBufferOffsetAlignment(${device.limits.minStorageBufferOffsetAlignment})`);
            break;
        }
      }

      bindGroupBindings[index] = {
        bindGroup,
        dynamicOffsets,
      };
    } else {
      bindGroupBindings[index] = undefined;
    }
  });

}

