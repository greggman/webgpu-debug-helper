import {
  assertNotDestroyed,
  s_bindGroupToInfo,
  s_objToDevice,
} from './shared-state.js';
import { s_textureViewToTexture } from './texture.js';
import {
  assert
} from './validation.js';

type EncoderState = 'open' | 'locked' | 'ended';

export type BindGroupBinding = {
  bindGroup?: GPUBindGroup | null | undefined,
  dynamicOffsets?: Uint32Array,
};

export type EncoderInfo = {
  state: EncoderState;
}

export type PassInfo = EncoderInfo & {
  commandEncoder: GPUCommandEncoder,
  bindGroups: BindGroupBinding[],
}

export function validateEncoderState(encoder: GPUComputePassEncoder | GPURenderPassEncoder | GPUCommandEncoder, state: EncoderState) {
  assert(state === 'open', () => `encoder state(${state}) is not "open"`, [encoder]);
}

const s_commandEncoderToInfoMap = new WeakMap<GPUCommandEncoder, EncoderInfo>();

export function createCommandEncoder(commandEncoder: GPUCommandEncoder) {
  s_commandEncoderToInfoMap.set(commandEncoder, { state: 'open' });
}

export function unlockCommandEncoder(commandEncoder: GPUCommandEncoder) {
  const info = s_commandEncoderToInfoMap.get(commandEncoder)!;
  assert(info.state === 'locked');
  info.state = 'open';
}

export function lockCommandEncoder(commandEncoder: GPUCommandEncoder) {
  getCommandBufferInfoAndValidateState(commandEncoder).state = 'locked';
}

export function finishCommandEncoder(commandEncoder: GPUCommandEncoder) {
  getCommandBufferInfoAndValidateState(commandEncoder).state = 'ended';
}

export function getCommandBufferInfoAndValidateState(commandEncoder: GPUCommandEncoder) {
  const info = s_commandEncoderToInfoMap.get(commandEncoder)!;
  validateEncoderState(commandEncoder, info.state);
  return info;
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

export function setBindGroup(parent: GPUCommandEncoder, bindGroupBindings: BindGroupBinding[], index: number, bindGroup: GPUBindGroup | null | undefined, dynamicOffsets?: Uint32Array) {
  const device = s_objToDevice.get(parent)!;
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
    validateBindGroupResourcesNotDestroyed(info.desc.entries);

    // TODO: Validate Dynamic Offsets
    bindGroupBindings[index] = {
      bindGroup,
      dynamicOffsets,
    };
  } else {
    bindGroupBindings[index] = {
      bindGroup: undefined,
    };
  }
}

//function validateBindGroups(this: PassEncoder, _: void) {
//  const {pipeline, bindGroups} = s_passToState.get(this)!;
//  if (!pipeline) {
//    emitError('no pipeline', [this]);
//    return;
//  }
//  // get bind group indices needed for current pipeline
//  const requiredGroupLayouts = s_pipelineToRequiredGroupLayouts.get(pipeline) || [];
//  for (const {ndx, layout: requiredLayout} of requiredGroupLayouts) {
//    const bindGroup = bindGroups[ndx];
//    if (!bindGroup) {
//      emitError(`no bindGroup at ndx: ${ndx}`);
//      return;
//    }
//
//    {
//      const error = validateBindGroupIsGroupEquivalent(requiredLayout, bindGroup);
//      if (error) {
//        emitError(error);
//        return;
//      }
//    }
//
//    {
//      const error = validateMinBindingSize(requiredLayout, bindGroup));
//      if (eror)
//      emitErr
//    }
//  }
//}

