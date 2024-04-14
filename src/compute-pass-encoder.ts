import {
  PassInfo,
  wrapBindingCommandsMixin,
} from './binding-mixin.js';
import {
  unlockCommandEncoder,
  validateEncoderState,
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
  commandEncoder: GPUCommandEncoder,
  pipeline?: GPUComputePipeline,
};

const s_computePassToPassInfoMap = new WeakMap<GPUComputePassEncoder, ComputePassInfo>();

export function beginComputePass(commandEncoder: GPUCommandEncoder, passEncoder: GPUComputePassEncoder) {
  s_computePassToPassInfoMap.set(passEncoder, {
    state: 'open',
    commandEncoder,
    bindGroups: [],
  });
}

wrapBindingCommandsMixin(GPUComputePassEncoder, s_computePassToPassInfoMap);

wrapFunctionBefore(GPUComputePassEncoder, 'setPipeline', function (this: GPUComputePassEncoder, [pipeline]) {
  const info = s_computePassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  assert(s_objToDevice.get(info.commandEncoder) === s_objToDevice.get(pipeline), 'pipeline must be from same device as computePassEncoder', [this, info.commandEncoder]);
  info.pipeline = pipeline;
});

wrapFunctionBefore(GPUComputePassEncoder, 'end', function (this: GPUComputePassEncoder) {
  const info = s_computePassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  info.state = 'ended';
  unlockCommandEncoder(info.commandEncoder);
});

//wrapFunctionAfter(GPUComputePassEncoder, 'dispatchWorkgroups', validateBindGroups);
//wrapFunctionAfter(GPUComputePassEncoder, 'dispatchWorkgroupsIndirect', validateBindGroups);
