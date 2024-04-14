import {
  EncoderInfo,
  validateEncoderState,
} from './encoder-utils.js';
import {
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
  bindGroup?: GPUBindGroup | null | undefined,
  dynamicOffsets?: Uint32Array,
};

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

export function validateEncoderBindGroups(bindGroups: BindGroupBinding[], pipeline?: GPURenderPipeline | GPUComputePipeline) {
  assert(!!pipeline, 'no pipeline set');

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
  });

}