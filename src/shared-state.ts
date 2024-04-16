import { BindGroupLayoutDescriptorPlus } from './pipeline.js';
import {
  assert,
  objToString,
} from './validation.js';
import {
  wrapFunctionBefore,
} from './wrap-api.js';

export type DeviceResource =
  | GPUBindGroup
  | GPUBindGroupLayout
  | GPUBuffer
  | GPUCanvasContext
  | GPUCommandEncoder
  | GPUComputePassEncoder
  | GPUComputePipeline
  | GPUExternalTexture
  | GPUPipelineLayout
  | GPUQuerySet
  | GPURenderBundle
  | GPURenderBundleEncoder
  | GPURenderPassEncoder
  | GPURenderPipeline
  | GPUSampler
  | GPUShaderModule
  | GPUTexture

export const s_objToDevice = new WeakMap<DeviceResource, GPUDevice>();

export type Destroyable = GPUTexture | GPUBuffer | GPUQuerySet | GPUDevice;

const s_destroyedResource = new WeakSet<Destroyable>();

export function assertNotDestroyed(obj: Destroyable) {
  assert(!s_destroyedResource.has(obj), () => `${objToString(obj)} is destroyed`);
}

wrapFunctionBefore(GPUBuffer, 'destroy', function (this: GPUBuffer) {
  s_destroyedResource.add(this);
});

wrapFunctionBefore(GPUTexture, 'destroy', function (this: GPUTexture) {
  s_destroyedResource.add(this);
});

wrapFunctionBefore(GPUQuerySet, 'destroy', function (this: GPUQuerySet) {
  s_destroyedResource.add(this);
});

wrapFunctionBefore(GPUDevice, 'destroy', function (this: GPUDevice) {
  s_destroyedResource.add(this);
});

export type BindGroupInfo = {
  layoutPlus: BindGroupLayoutDescriptorPlus,
  entries: GPUBindGroupEntry[],
};

export const s_bindGroupToInfo = new WeakMap<GPUBindGroup, BindGroupInfo>();
