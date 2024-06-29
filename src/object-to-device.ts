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
  | GPUQueue
  | GPURenderBundle
  | GPURenderBundleEncoder
  | GPURenderPassEncoder
  | GPURenderPipeline
  | GPUSampler
  | GPUShaderModule
  | GPUTexture

export const s_objToDevice = new WeakMap<DeviceResource, GPUDevice>();
