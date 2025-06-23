// A normal GPUPipelineDescriptor just has references to GPUBindGroupLayout objects
// but we need the GPUBindGroupLayoutDescriptor for each. They don't exist for

import { RenderPassLayoutInfo } from './render-commands-mixin.js';
import { arraysEqual, trimNulls } from './utils.js';
import { wrapFunctionAfter } from "./wrap-api.js";

type BindGroupLayoutDescriptor = {
  /** this is sparse! */
  entries: GPUBindGroupLayoutEntry[];
};

export type BindGroupLayoutDescriptorPlus = {
  bindGroupLayoutDescriptor: BindGroupLayoutDescriptor,
  entriesById: Record<number, GPUBindGroupLayoutEntry>;
  dynamicOffsetCount: number,
  signature: string,
}

export type ReifiedPipelineLayoutDescriptor = {
  bindGroupLayoutDescriptors: (BindGroupLayoutDescriptorPlus | undefined)[];
}

export const s_bindGroupLayoutToBindGroupLayoutDescriptorPlus = new WeakMap<GPUBindGroupLayout, BindGroupLayoutDescriptorPlus>();
export const s_pipelineLayoutToBindGroupLayoutDescriptorsPlus = new WeakMap<GPUPipelineLayout,(BindGroupLayoutDescriptorPlus | undefined)[]>();

// getBindGroupLayout always returns a different object which means we can't
// use it as a key in a map to look up it's layout descriptor ┌∩┐(◣_◢)┌∩┐
function trackNewBindGroupLayout(this: GPUComputePipeline | GPURenderPipeline, layout: GPUBindGroupLayout, [group]: [number]) {
  // We need to associate this with it's BindGroupLayoutDescriptorPlus
  const pipelineLayout = s_pipelineToReifiedPipelineLayoutDescriptor.get(this)!;
  const descPlus = pipelineLayout.bindGroupLayoutDescriptors[group];
  if (descPlus) {
    s_bindGroupLayoutToBindGroupLayoutDescriptorPlus.set(layout, descPlus);
  }
}

wrapFunctionAfter(GPUComputePipeline, 'getBindGroupLayout', trackNewBindGroupLayout);
wrapFunctionAfter(GPURenderPipeline, 'getBindGroupLayout', trackNewBindGroupLayout);

// We're using JSON.stringify to make a hash/id
// so we need the properties to be in the same order
export function createRenderPassLayout(
  colorFormats: (GPUTextureFormat | null | undefined)[],
  sampleCount: number,
  depthStencilFormat?: GPUTextureFormat,
): RenderPassLayout {
  return {
    colorFormats,
    sampleCount,
    ...(depthStencilFormat && {depthStencilFormat}),
  };
}

export type RenderPassLayout = {
  colorFormats: (GPUTextureFormat | null | undefined)[];
  depthStencilFormat?: GPUTextureFormat;
  sampleCount: number;
};

type RenderPipelineDescriptor = {
    vertex: GPUVertexState,
    primitive?: GPUPrimitiveState,
    depthStencil?: GPUDepthStencilState,
    multisample?: GPUMultisampleState,
    fragment?: GPUFragmentState,
    passLayoutInfo: RenderPassLayoutInfo,
};

export function renderPassLayoutsEqual(a: RenderPassLayout, b: RenderPassLayout) {
  return a.sampleCount === b.sampleCount &&
         a.depthStencilFormat === b.depthStencilFormat &&
         arraysEqual(a.colorFormats, b.colorFormats);
}


export const s_renderPipelineToRenderPipelineDescriptor = new WeakMap<GPURenderPipeline, RenderPipelineDescriptor>();
export const s_pipelineToReifiedPipelineLayoutDescriptor = new WeakMap<GPUPipelineBase, ReifiedPipelineLayoutDescriptor>();

function reifyConstants(c: Record<string, number>) {
  return { ...c };
}

function reifyProgramableStage(ps: GPUProgrammableStage) {
  const { /*module,*/ entryPoint, constants } = ps;
  return {
    ...(entryPoint && { entryPoint }),
    ...(constants && { constants: reifyConstants(constants) }),
  } as GPUProgrammableStage;
}

function reifyVertexAttribute(attr: GPUVertexAttribute): GPUVertexAttribute {
  const { format, offset, shaderLocation } = attr;
  return { format, offset, shaderLocation };
}

function reifyVertexBufferLayout(buffer: GPUVertexBufferLayout): GPUVertexBufferLayout {
  const { arrayStride, stepMode = 'vertex', attributes } = buffer;
  return {
    arrayStride,
    stepMode,
    attributes: [...attributes].map(reifyVertexAttribute),
  };
}

function reifyVertexState(vertex: GPUVertexState): GPUVertexState {
  const { buffers } = vertex;
  return {
    ...reifyProgramableStage(vertex),
    ...(buffers && { buffers: [...buffers].map(b => b ? reifyVertexBufferLayout(b) : null) }),
  };
}

function reifyBlendComponent(bc: GPUBlendComponent): GPUBlendComponent {
  const { operation = 'add', srcFactor = 'one', dstFactor = 'zero' } = bc;
  return {
    operation,
    srcFactor,
    dstFactor,
  };
}

function reifyBlendState(blend: GPUBlendState): GPUBlendState {
  return {
    color: reifyBlendComponent(blend.color),
    alpha: reifyBlendComponent(blend.alpha),
  };
}

function reifyColorTargetState(cts: GPUColorTargetState): GPUColorTargetState {
  const { format, blend, writeMask } = cts;
  return {
    format,
    ...(blend && {blend: reifyBlendState(blend)}),
    writeMask: writeMask ?? 0xF,
  };
}
function reifyFragmentState(fragment: GPUFragmentState): GPUFragmentState {
  return {
    ...reifyProgramableStage(fragment),
    targets: [...fragment.targets].map(t => t ? reifyColorTargetState(t) : null),
  };
}

function reifyPrimitiveState(p: GPUPrimitiveState): GPUPrimitiveState {
  const {
    topology = 'triangle-list',
    stripIndexFormat,
    frontFace = 'ccw',
    cullMode = 'none',
    // unclippedDepth,
  } = p;
  return {
    topology,
    ...(stripIndexFormat && { stripIndexFormat }),
    frontFace,
    cullMode,
  };
}

function reifyStencilFaceState(sf: GPUStencilFaceState): GPUStencilFaceState {
  const {
    compare = "always",
    failOp = "keep",
    depthFailOp = "keep",
    passOp = "keep",
  } = sf;
  return {
    compare, failOp, depthFailOp, passOp,
  };
}

function reifyDepthStencilState(ds: GPUDepthStencilState): GPUDepthStencilState {
  const {
    format,
    depthWriteEnabled,
    depthCompare,
    stencilFront,
    stencilBack,
    stencilReadMask = 0xFFFFFFFF,
    stencilWriteMask = 0xFFFFFFFF,
    depthBias = 0,
    depthBiasSlopeScale = 0,
    depthBiasClamp = 0,
  } = ds;
  return {
    format,
    ...(depthCompare && { depthCompare }),
    ...(depthWriteEnabled !== undefined && { depthWriteEnabled }),
    ...(stencilFront && { stencilFront: reifyStencilFaceState(stencilFront) }),
    ...(stencilBack && { stencilBack: reifyStencilFaceState(stencilBack) }),
    stencilReadMask,
    stencilWriteMask,
    depthBias,
    depthBiasSlopeScale,
    depthBiasClamp,
  };
}

function reifyMultisampleState(ms: GPUMultisampleState): GPUMultisampleState {
  const {
    count = 1,
    mask = 0xFFFFFFFF,
    alphaToCoverageEnabled = false,
  } = ms;
  return { count, mask, alphaToCoverageEnabled };
}

function reifyRenderPipelineDescriptor(desc: GPURenderPipelineDescriptor): RenderPipelineDescriptor {
  const {
    vertex,
    fragment,
    primitive,
    depthStencil,
    multisample,
  } = desc;
  const renderPassLayout = createRenderPassLayout(
    fragment ? trimNulls([...fragment.targets].map(t => t ? t.format : null)) : [],
    multisample?.count || 1,
    depthStencil?.format);
  return {
    vertex: reifyVertexState(vertex),
    ...(fragment && reifyFragmentState(fragment)),
    ...(primitive && reifyPrimitiveState(primitive)),
    ...(depthStencil && reifyDepthStencilState(depthStencil)),
    ...(multisample && reifyMultisampleState(multisample)),
    passLayoutInfo: {
      renderPassLayout,
      passLayoutSignature: JSON.stringify(renderPassLayout),
    },
  };
}

export function trackRenderPipelineDescriptor(pipeline: GPURenderPipeline, desc: GPURenderPipelineDescriptor) {
  s_renderPipelineToRenderPipelineDescriptor.set(pipeline, reifyRenderPipelineDescriptor(desc));
}
