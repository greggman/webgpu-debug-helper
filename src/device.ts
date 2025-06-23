import {
  makeBindGroupLayoutDescriptors,
  makeShaderDataDefinitions,
  ShaderDataDefinitions,
} from 'webgpu-utils';

import {
  validateBindGroupResourcesNotDestroyed,
} from './binding-mixin.js';
import {
  createCommandEncoder,
} from './encoder-utils.js';
import {
  BindGroupLayoutDescriptorPlus,
  s_bindGroupLayoutToBindGroupLayoutDescriptorPlus,
  s_pipelineToReifiedPipelineLayoutDescriptor,
  s_pipelineLayoutToBindGroupLayoutDescriptorsPlus,
  trackRenderPipelineDescriptor,
} from './pipeline.js';
import {
  createRenderBundleEncoder,
} from './render-bundle-encoder.js';
import {
  assertNotDestroyed,
  s_bindGroupToInfo,
  s_objToDevice,
} from './shared-state.js';
import {
  assert
} from './validation.js';
import {
  wrapFunctionAfter,
  wrapAsyncFunctionAfter,
} from './wrap-api.js';

const s_shaderModuleToDefs = new WeakMap<GPUShaderModule, ShaderDataDefinitions>();

function addDefs(defs: ShaderDataDefinitions[], stage: GPUProgrammableStage | undefined) {
  if (stage) {
    defs.push(s_shaderModuleToDefs.get(stage.module)!);
  }
}

function reifyBufferLayout(buffer: GPUBufferBindingLayout) {
  return {
    type: buffer.type ?? 'uniform',
    hasDynamicOffset: !!buffer.hasDynamicOffset,
    minBindingSize: buffer.minBindingSize ?? 0,
  };
}

function reifySamplerLayout(sampler: GPUSamplerBindingLayout) {
  return {
    type: sampler.type ?? 'filtering',
  };
}

function reifyTextureLayout(texture: GPUTextureBindingLayout) {
  return {
    sampleType: texture.sampleType ?? 'float',
    viewDimension: texture.viewDimension ?? '2d',
    multisampled: !!texture.multisampled,
  };
}

function reifyStorageTexture(storageTexture: GPUStorageTextureBindingLayout) {
  return {
    access: storageTexture.access ?? 'write-only',
    format: storageTexture.format,
    viewDimension: storageTexture.viewDimension ?? '2d',
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function reifyExternalTexture(externalTexture: GPUExternalTextureBindingLayout) {
  return {
  };
}

function reifyBindGroupLayoutEntry({
    binding,
    visibility,
    buffer,
    sampler,
    texture,
    storageTexture,
    externalTexture,
  }: GPUBindGroupLayoutEntry): GPUBindGroupLayoutEntry {
  return {
    binding,
    visibility,
    ...(buffer && { buffer: reifyBufferLayout(buffer) }),
    ...(sampler && { sampler: reifySamplerLayout(sampler) }),
    ...(texture && { texture: reifyTextureLayout(texture) }),
    ...(storageTexture && { storageTexture: reifyStorageTexture(storageTexture) }),
    ...(externalTexture && { externalTexture: reifyExternalTexture(externalTexture) }),
  };
}

function  bindGroupLayoutDescriptorToBindGroupLayoutDescriptorPlus(
    src: GPUBindGroupLayoutDescriptor,
    autoId: number): BindGroupLayoutDescriptorPlus {
  const bindGroupLayoutDescriptor = {
    entries: [...src.entries].map(reifyBindGroupLayoutEntry),
  };
  const entriesById = Object.fromEntries(bindGroupLayoutDescriptor.entries.map(e => [e.binding, e]));
  const dynamicOffsetCount = bindGroupLayoutDescriptor.entries.reduce((a, v) => a + (v.buffer?.hasDynamicOffset ? 1 : 0), 0);
  const signature = `${JSON.stringify(bindGroupLayoutDescriptor)}${autoId ? `:autoId(${autoId})` : ''})`;
  return {
    bindGroupLayoutDescriptor,
    entriesById,
    dynamicOffsetCount,
    signature,
  };
}

let s_autoCount = 1;
function getReifiedPipelineLayoutDescriptor(desc: GPUComputePipelineDescriptor | GPURenderPipelineDescriptor) {
  if (desc.layout === 'auto') {
    // It's auto so we need to make a reified pipeline descriptor
    const defs: ShaderDataDefinitions[] = [];
    addDefs(defs, (desc as GPURenderPipelineDescriptor).vertex);
    addDefs(defs, (desc as GPURenderPipelineDescriptor).fragment);
    addDefs(defs, (desc as GPUComputePipelineDescriptor).compute);
    const autoId = s_autoCount++;
    const bindGroupLayoutDescriptors = makeBindGroupLayoutDescriptors(defs, desc).map(b => bindGroupLayoutDescriptorToBindGroupLayoutDescriptorPlus(b, autoId));
    return {
      bindGroupLayoutDescriptors,
    };
  } else {
    const bindGroupLayoutDescriptors = s_pipelineLayoutToBindGroupLayoutDescriptorsPlus.get(desc.layout)!;
    return {
      bindGroupLayoutDescriptors,
    };
  }
}

function trackPipelineLayouts(device: GPUDevice, pipeline: GPUPipelineBase, desc: GPUComputePipelineDescriptor | GPURenderPipelineDescriptor) {
  s_pipelineToReifiedPipelineLayoutDescriptor.set(pipeline, getReifiedPipelineLayoutDescriptor(desc));
}

wrapFunctionAfter(GPUDevice, 'createShaderModule', function (this: GPUDevice, module: GPUShaderModule, [desc]: [GPUShaderModuleDescriptor]) {
  assertNotDestroyed(this);
  s_objToDevice.set(module, this);
  s_shaderModuleToDefs.set(module, makeShaderDataDefinitions(desc.code));
});

wrapFunctionAfter(GPUDevice, 'createBindGroup', function (this: GPUDevice, bindGroup: GPUBindGroup, [desc]: [GPUBindGroupDescriptor]) {
  s_objToDevice.set(bindGroup, this);
  const { layout } = desc;
  // copy the entries since the user might change them
  const entries = [];
  for (const {binding, resource} of [...desc.entries]) {
    const r = resource instanceof GPUBuffer ||
              resource instanceof GPUSampler ||
              resource instanceof GPUTextureView ||
              resource instanceof GPUExternalTexture
        ? resource
        : { ...resource };
    const rb = r as GPUBufferBinding;
    if (rb.buffer instanceof GPUBuffer) {
      const offset = rb.offset || 0;
      const size = rb.size || rb.buffer.size - offset;
      assert(offset + size <= rb.buffer.size, () => `offset(${offset} + size(${size}) > buffer.size(${rb.buffer.size}))`, [rb.buffer]);
    }
    entries.push({
      binding,
      resource: r,
    });
  }
  entries.sort((a, b) => a.binding - b.binding);
  validateBindGroupResourcesNotDestroyed(entries);
  const layoutPlus = s_bindGroupLayoutToBindGroupLayoutDescriptorPlus.get(layout)!;
  s_bindGroupToInfo.set(bindGroup, {
    entries,
    layoutPlus,
  });
});

wrapFunctionAfter(GPUDevice, 'createBuffer', function (this: GPUDevice, buffer: GPUBuffer) {
  assertNotDestroyed(this);
  s_objToDevice.set(buffer, this);
});

wrapFunctionAfter(GPUDevice, 'createQuerySet', function (this: GPUDevice, querySet: GPUQuerySet) {
  assertNotDestroyed(this);
  s_objToDevice.set(querySet, this);
});

wrapFunctionAfter(GPUDevice, 'createSampler', function (this: GPUDevice, sampler: GPUSampler) {
  assertNotDestroyed(this);
  s_objToDevice.set(sampler, this);
});

wrapFunctionAfter(GPUDevice, 'createTexture', function (this: GPUDevice, texture: GPUTexture) {
  assertNotDestroyed(this);
  s_objToDevice.set(texture, this);
});

wrapFunctionAfter(GPUDevice, 'importExternalTexture', function (this: GPUDevice, externalTexture: GPUExternalTexture) {
  s_objToDevice.set(externalTexture, this);
});

wrapFunctionAfter(GPUDevice, 'createCommandEncoder', function (this: GPUDevice, commandEncoder: GPUCommandEncoder) {
  assertNotDestroyed(this);
  s_objToDevice.set(commandEncoder, this);
  createCommandEncoder(commandEncoder);
});

wrapFunctionAfter(GPUDevice, 'createRenderBundleEncoder', function (this: GPUDevice, bundleEncoder: GPURenderBundleEncoder, [desc]) {
  assertNotDestroyed(this);
  s_objToDevice.set(bundleEncoder, this);
  createRenderBundleEncoder(bundleEncoder, desc);
});

wrapFunctionAfter(GPUDevice, 'createRenderPipeline', function (this: GPUDevice, pipeline: GPURenderPipeline, [desc]) {
  assertNotDestroyed(this);
  s_objToDevice.set(pipeline, this);
  trackRenderPipelineDescriptor(pipeline, desc);
  trackPipelineLayouts(this, pipeline, desc);
});

wrapFunctionAfter(GPUDevice, 'createComputePipeline', function (this: GPUDevice, pipeline: GPUComputePipeline, [desc]) {
  assertNotDestroyed(this);
  s_objToDevice.set(pipeline, this);
  trackPipelineLayouts(this, pipeline, desc);
});

wrapAsyncFunctionAfter(GPUDevice, 'createRenderPipelineAsync', function (this: GPUDevice, pipeline: GPURenderPipeline, [desc]) {
  assertNotDestroyed(this);
  s_objToDevice.set(pipeline, this);
  trackRenderPipelineDescriptor(pipeline, desc);
  trackPipelineLayouts(this, pipeline, desc);
});

wrapAsyncFunctionAfter(GPUDevice, 'createComputePipelineAsync', function (this: GPUDevice, pipeline: GPUComputePipeline, [desc]) {
  assertNotDestroyed(this);
  s_objToDevice.set(pipeline, this);
  trackPipelineLayouts(this, pipeline, desc);
});

wrapFunctionAfter(GPUDevice, 'createBindGroupLayout', function (this: GPUDevice, bindGroupLayout: GPUBindGroupLayout, [desc]) {
  s_bindGroupLayoutToBindGroupLayoutDescriptorPlus.set(
    bindGroupLayout,
    bindGroupLayoutDescriptorToBindGroupLayoutDescriptorPlus(desc, 0),
  );
});

wrapFunctionAfter(GPUDevice, 'createPipelineLayout', function (this: GPUDevice, pipelineLayout: GPUPipelineLayout, [desc]) {
  // need to copy the description because the user may change it after
  const bglDescriptorsPlus: (BindGroupLayoutDescriptorPlus | undefined)[] =
    [...desc.bindGroupLayouts].map(bgl => bgl ? s_bindGroupLayoutToBindGroupLayoutDescriptorPlus.get(bgl)! : undefined);
  s_pipelineLayoutToBindGroupLayoutDescriptorsPlus.set(pipelineLayout, bglDescriptorsPlus);
}

);

