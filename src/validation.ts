export type LabeledObject = 
  | GPUBindGroup
  | GPUBindGroupLayout
  | GPUBuffer
  | GPUCommandEncoder
  | GPUComputePassEncoder
  | GPUComputePipeline
  | GPUDevice
  | GPUQuerySet
  | GPUPipelineLayout
  | GPURenderPassEncoder
  | GPURenderPipeline
  | GPUShaderModule
  | GPUSampler
  | GPUTexture
  | GPUTextureView;

export function objToString(o: LabeledObject) {
  return `${o.constructor.name}(${o.label})`;
}

export function emitError(msg: string, objs: LabeledObject[] = []) {
  throw new Error(`${msg}\n${(objs).map(o => objToString(o)).join('\n')}`);
}

export function assert(condition: boolean, msg?: string | (() => string), resources?: any[]): asserts condition {
  if (!condition) {
    const lines = (resources || []).map(r => `    ${r.constructor.name}${r.label ? `(${r.label})` :''}`).join('\n')
    const m = msg ? (typeof msg === 'string' ? msg : msg()) : '';
    emitError(`${m}${lines ? `\n${lines}`: ''}`);
  }
}
