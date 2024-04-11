import {
  bufferUsageToString,
  textureUsageToString,
} from './utils.js';
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

function getProperties(o: any) {
  const keyValues = [];
  for (const k in o) {
    const v = o[k];
    if (typeof v !== 'function') {
      if (o instanceof GPUBuffer && k === 'usage') {
        keyValues.push(`${k}: ${v} (${bufferUsageToString(v)})`);
      } else if (o instanceof GPUTexture && k === 'usage') {
        keyValues.push(`${k}: ${v} (${textureUsageToString(v)})`);
      } else {
        keyValues.push(`${k}: ${JSON.stringify(v)}`);
      }
    }
  }
  return keyValues.join(', ');
}

export function objToString(o: LabeledObject) {
  return `${o.constructor.name}(${o.label}){${getProperties(o)}}`;
}

export function emitError(msg: string, objs: LabeledObject[] = []) {
  throw new Error(`${msg}\n${(objs).map(o => objToString(o)).join('\n')}`);
}

export function assert(condition: boolean, msg?: string | (() => string), resources?: any[]): asserts condition {
  if (!condition) {
    const lines = (resources || []).map(r => `    ${objToString(r)}`).join('\n');
    const m = msg ? (typeof msg === 'string' ? msg : msg()) : '';
    emitError(`${m}${lines ? `\n${lines}` : ''}`);
  }
}
