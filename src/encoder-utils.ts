import {
  assert
} from './validation.js';

type EncoderState = 'open' | 'locked' | 'ended';

export type EncoderInfo = {
  state: EncoderState;
}

export function validateEncoderState(encoder: GPUComputePassEncoder | GPURenderPassEncoder | GPUCommandEncoder | GPURenderBundleEncoder, state: EncoderState) {
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

