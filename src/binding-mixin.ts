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
  s_bindGroupToInfo,
  s_objToDevice,
} from './shared-state.js';
import { s_textureViewToTexture } from './texture.js';
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

export function wrapBindingCommandsMixin<T extends BindingMixin>(
  API: Ctor<T>,
  s_passToPassInfoMap: WeakMap<T, PassInfo>) {

  wrapFunctionBefore(API, 'setBindGroup', function (this: T, [index, bindGroup, dynamicOffsets]) {
    const info = s_passToPassInfoMap.get(this)!;
    validateEncoderState(this, info.state);
    const bindGroupBindings = info.bindGroups;

    const device = s_objToDevice.get(this)!;
    const maxIndex = device.limits.maxBindGroups;
    assert(index >= 0, () => `index(${index}) must be >= 0`);
    assert(index < maxIndex, () => `index(${index}) must be < device.limits.maxBindGroups(${maxIndex})`);
    // TODO: Get dynamic offsets from layout
    const dynamicOffsetCount = 0; //bindGroup ? layout.dynamicOffsetCount : 0;
    dynamicOffsets = dynamicOffsets || new Uint32Array(0);
    assert(dynamicOffsets.length === dynamicOffsetCount, `there must be the same number of dynamicOffsets(${dynamicOffsets.length}) as the layout requires (${dynamicOffsetCount})`);
    if (bindGroup) {
      assert(device === s_objToDevice.get(bindGroup), () => `bindGroup must be from same device as ${parent.constructor.name}`, [bindGroup, parent]);

      // Validate resources are not destroyed
      const info = s_bindGroupToInfo.get(bindGroup)!;
      validateBindGroupResourcesNotDestroyed(info.entries);

      // TODO: Validate Dynamic Offsets
      bindGroupBindings[index] = {
        bindGroup,
        dynamicOffsets,
      };
    } else {
      bindGroupBindings[index] = undefined;
    }
  });

}

