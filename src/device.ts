import {
  makeBindGroupLayoutDescriptors,
  makeShaderDataDefinitions,
  ShaderDataDefinitions,
} from 'webgpu-utils';

import {
  createCommandEncoder,
  validateBindGroupResourcesNotDestroyed,
} from './encoder-utils.js';
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
const s_pipelineToRequiredGroupIndices = new WeakMap<GPUPipelineBase, number[]>();
const s_layoutToAutoLayoutPipeline = new WeakMap<GPUBindGroupLayout, GPUPipelineBase>();

const s_bindGroupLayoutToBindGroupLayoutDescriptor = new WeakMap<GPUBindGroupLayout, GPUBindGroupLayoutDescriptor>();
const s_pipelineLayoutToPipelineLayoutDescriptor = new WeakMap<GPUPipelineLayout, GPUPipelineLayoutDescriptor>();
const s_renderPipelineToRenderPipelineDescriptor = new WeakMap<GPURenderPipeline, GPURenderPipelineDescriptor>();

function addDefs(defs: ShaderDataDefinitions[], stage: GPUProgrammableStage | undefined) {
  if (stage) {
    defs.push(s_shaderModuleToDefs.get(stage.module)!);
  }
}

// function trackAutoLayoutPipelineBindGroupLayouts(pipeline, layout) {
//   if (s_pipelineToRequiredGroupIndices.has(pipeline)) {
//     s_layoutToAutoLayoutPipeline.set(layout, pipeline);
//   }
// }

function trackPipelineLayout(this: GPUDevice, pipelineLayout: GPUPipelineLayout, [desc]: [GPUPipelineLayoutDescriptor]) {
  s_pipelineLayoutToPipelineLayoutDescriptor.set(pipelineLayout, desc);
}

function trackBindGroupLayout(this: GPUDevice, bindGroupLayout: GPUBindGroupLayout, [desc]: [GPUBindGroupLayoutDescriptor]) {
  s_bindGroupLayoutToBindGroupLayoutDescriptor.set(bindGroupLayout, desc);
}

function trackPipelineLayouts(device: GPUDevice, pipeline: GPUPipelineBase, desc: GPUComputePipelineDescriptor | GPURenderPipelineDescriptor) {
    if (desc.layout === 'auto') {
      const defs: ShaderDataDefinitions[] = [];
      addDefs(defs, (desc as GPURenderPipelineDescriptor).vertex);
      addDefs(defs, (desc as GPURenderPipelineDescriptor).fragment);
      addDefs(defs, (desc as GPUComputePipelineDescriptor).compute);
      const layoutsDescriptors = makeBindGroupLayoutDescriptors(defs, desc);
      const requiredGroupIndices = layoutsDescriptors.map((layout, ndx) => [...layout.entries].length > 0 ? ndx : -1).filter(v => v >= 0);
      s_pipelineToRequiredGroupIndices.set(pipeline, requiredGroupIndices);
    } else {
      /* */
    }
}

wrapFunctionAfter(GPUDevice, 'createShaderModule', function (this: GPUDevice, module: GPUShaderModule, [desc]: [GPUShaderModuleDescriptor]) {
  assertNotDestroyed(this);
  s_shaderModuleToDefs.set(module, makeShaderDataDefinitions(desc.code));
});

wrapFunctionAfter(GPUDevice, 'createBindGroup', function (this: GPUDevice, bindGroup: GPUBindGroup, [desc]: [GPUBindGroupDescriptor]) {
  s_objToDevice.set(bindGroup, this);
  const { layout } = desc;
  // copy the entries since the user might change them
  const entries = [];
  for (const {binding, resource} of [...desc.entries]) {
    const r = resource instanceof GPUSampler ||
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
  validateBindGroupResourcesNotDestroyed(entries);
  s_bindGroupToInfo.set(bindGroup, {
    //layout: null,
    desc: { layout, entries },
  });
  const pipeline = s_layoutToAutoLayoutPipeline.get(layout);
  if (pipeline) {
    if (s_pipelineToRequiredGroupIndices.has(pipeline)) {
//      s_bindGroupToLayout.get(bindGroup).set(bindGroup, pipeline);
    }
  }
});

wrapFunctionAfter(GPUDevice, 'createBuffer', function (this: GPUDevice, buffer: GPUBuffer) {
  assertNotDestroyed(this);
  s_objToDevice.set(buffer, this);
});

wrapFunctionAfter(GPUDevice, 'createTexture', function (this: GPUDevice, texture: GPUTexture) {
  assertNotDestroyed(this);
  s_objToDevice.set(texture, this);
});

wrapFunctionAfter(GPUDevice, 'createCommandEncoder', function (this: GPUDevice, commandEncoder: GPUCommandEncoder) {
  assertNotDestroyed(this);
  s_objToDevice.set(commandEncoder, this);
  createCommandEncoder(commandEncoder);
});

wrapFunctionAfter(GPUDevice, 'createRenderPipeline', function (this: GPUDevice, pipeline: GPURenderPipeline, [desc]) {
  assertNotDestroyed(this);
  s_objToDevice.set(pipeline, this);
  s_renderPipelineToRenderPipelineDescriptor.set(pipeline, desc);
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
  s_renderPipelineToRenderPipelineDescriptor.set(pipeline, desc);
  trackPipelineLayouts(this, pipeline, desc);
});

wrapAsyncFunctionAfter(GPUDevice, 'createComputePipelineAsync', function (this: GPUDevice, pipeline: GPUComputePipeline, [desc]) {
  assertNotDestroyed(this);
  s_objToDevice.set(pipeline, this);
  trackPipelineLayouts(this, pipeline, desc);
});

wrapFunctionAfter(GPUDevice, 'createBindGroupLayout', trackBindGroupLayout);
wrapFunctionAfter(GPUDevice, 'createPipelineLayout', trackPipelineLayout);
//wrapFunctionAfter(GPUDevice, 'createRenderBundleEncoder', addPassState);

