
import {
  s_objToDevice,
} from './shared-state.js';
import {
  wrapFunctionAfter,
  wrapFunctionBefore,
} from './wrap-api.js';


wrapFunctionBefore(GPUCanvasContext, 'configure', function (this: GPUCanvasContext, [desc]) {
  s_objToDevice.set(this, desc.device);
});

wrapFunctionBefore(GPUCanvasContext, 'unconfigure', function (this: GPUCanvasContext) {
  s_objToDevice.delete(this);
});

wrapFunctionAfter(GPUCanvasContext, 'getCurrentTexture', function (this: GPUCanvasContext, texture: GPUTexture) {
  const device = s_objToDevice.get(this)!;
  s_objToDevice.set(texture, device);
});
