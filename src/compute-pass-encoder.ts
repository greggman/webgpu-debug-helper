import {
  PassInfo,
  validateEncoderBindGroups,
  wrapBindingCommandsMixin,
} from './binding-mixin.js';
import {
  unlockCommandEncoder,
  validateEncoderState,
} from './encoder-utils.js';
import {
  assertNotDestroyed,
  s_objToDevice,
} from './shared-state.js';
import {
  bufferUsageToString,
} from './utils.js';
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

wrapFunctionBefore(GPUComputePassEncoder, 'dispatchWorkgroups', function (this: GPUComputePassEncoder, [workgroupCountX, workgroupCountY = 1, workgroupCountZ = 1]) {
  const info = s_computePassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  validateEncoderBindGroups(info.bindGroups, info.pipeline);

  const device = s_objToDevice.get(this)!;
  assert(workgroupCountX < device.limits.maxComputeWorkgroupsPerDimension, () => `workGroupCountX(${workgroupCountX} > device.limits.maxComputeWorkgroupsPerDimension(${device.limits.maxComputeWorkgroupsPerDimension})`);
  assert(workgroupCountY < device.limits.maxComputeWorkgroupsPerDimension, () => `workGroupCountY(${workgroupCountY} > device.limits.maxComputeWorkgroupsPerDimension(${device.limits.maxComputeWorkgroupsPerDimension})`);
  assert(workgroupCountZ < device.limits.maxComputeWorkgroupsPerDimension, () => `workGroupCountZ(${workgroupCountZ} > device.limits.maxComputeWorkgroupsPerDimension(${device.limits.maxComputeWorkgroupsPerDimension})`);
});

const kIndirectDispatchWorkgroupsParametersSize = 12;
wrapFunctionBefore(GPUComputePassEncoder, 'dispatchWorkgroupsIndirect', function (this: GPUComputePassEncoder, [indirectBuffer, indirectOffset]) {
  const info = s_computePassToPassInfoMap.get(this)!;
  validateEncoderState(this, info.state);
  validateEncoderBindGroups(info.bindGroups, info.pipeline);
  assertNotDestroyed(indirectBuffer);
  const device = s_objToDevice.get(this)!;
  assert(device === s_objToDevice.get(indirectBuffer), 'indirectBuffer is not from same device', [indirectBuffer]);
  assert(!!(indirectBuffer.usage & GPUBufferUsage.INDIRECT), () => `buffer(${bufferUsageToString(indirectBuffer.usage)}) must have usage INDIRECT`, [indirectBuffer, this]);
  assert(indirectOffset + kIndirectDispatchWorkgroupsParametersSize <= indirectBuffer.size, `indirectOffset(${indirectOffset}) + sizeOfIndirectParameters(${kIndirectDispatchWorkgroupsParametersSize}) > indirectBuffer.size(${indirectBuffer.size})`, [indirectBuffer]);
  assert(indirectOffset % 4 === 0, () => `indirectOffset(${indirectOffset}) is not multiple of 4`);
});
