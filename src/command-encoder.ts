import {
  beginComputePass,
} from './compute-pass-encoder.js';
import {
  lockCommandEncoder,
  finishCommandEncoder,
} from './encoder-utils.js';
import {
  beginRenderPass,
} from './render-pass-encoder.js';
import {
  wrapFunctionAfter,
} from './wrap-api.js';

wrapFunctionAfter(GPUCommandEncoder, 'beginComputePass', function(this: GPUCommandEncoder, passEncoder: GPUComputePassEncoder, [desc]) {
  lockCommandEncoder(this);
  beginComputePass(this, passEncoder, desc);
});

wrapFunctionAfter(GPUCommandEncoder, 'beginRenderPass', function(this: GPUCommandEncoder, passEncoder: GPURenderPassEncoder, [desc]) {
  lockCommandEncoder(this);
  beginRenderPass(this, passEncoder, desc);
});

wrapFunctionAfter(GPUCommandEncoder, 'finish', function(this: GPUCommandEncoder, commandBuffer: GPUCommandBuffer) {
  finishCommandEncoder(this);
});


