import {
  openCommandEncoder,
  PassInfo,
  setBindGroup,
  validateEncoderState
} from './encoder-utils.js';
import {
  s_objToDevice,
} from './shared-state.js';
import {
  assert,
} from './validation.js';
import {
  wrapFunctionBefore,
} from './wrap-api.js';

type ComputePassInfo = PassInfo & {
  pipeline?: GPUComputePipeline,
};

const s_computePassToPassInfoMap = new WeakMap<GPUComputePassEncoder, ComputePassInfo>();

export function beginComputePass(commandEncoder: GPUCommandEncoder, passEncoder: GPUComputePassEncoder, desc?: GPUComputePassDescriptor) {
  s_computePassToPassInfoMap.set(passEncoder, {
    state: 'open',
    commandEncoder,
    bindGroups: [],
  });
}

wrapFunctionBefore(GPUComputePassEncoder, 'setBindGroup', function(this: GPUComputePassEncoder, [index, bindGroup, dynamicOffsets]) {
  const info = s_computePassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  setBindGroup(info.commandEncoder, info.bindGroups, index, bindGroup, dynamicOffsets);
});

wrapFunctionBefore(GPUComputePassEncoder, 'setPipeline', function(this: GPUComputePassEncoder, [pipeline]) {
  const info = s_computePassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  assert(s_objToDevice.get(info.commandEncoder) === s_objToDevice.get(pipeline), 'pipeline must be from same device as computePassEncoder', [this, info.commandEncoder]);
  info.pipeline = pipeline;
});

wrapFunctionBefore(GPUComputePassEncoder, 'end', function(this: GPUComputePassEncoder) {
  const info = s_computePassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  info.state = 'ended';
  openCommandEncoder(info.commandEncoder);
});

//wrapFunctionAfter(GPUComputePassEncoder, 'dispatchWorkgroups', validateBindGroups);
//wrapFunctionAfter(GPUComputePassEncoder, 'dispatchWorkgroupsIndirect', validateBindGroups);
