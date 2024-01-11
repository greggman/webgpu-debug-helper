import '../../dist/0.x/webgpu-debug-helper.js';

import {
  assertEqual,
  assertFalsy,
  assertIsArray,
  assertInstanceOf,
  assertStrictEqual,
  assertStrictNotEqual,
  assertTruthy,
} from '../assert.js';
import {describe, it, beforeEach, afterEach} from '../mocha-support.js';

async function createRenderPass() {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const texture = device.createTexture({
    size: [2, 3],
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
    format: 'rgba8unorm',
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: texture.createView(),
      clearColor: [0, 0, 0, 0],
      loadOp: 'clear',
      storeOp: 'store',
    }],
  });
  return pass;
}

function expectValidationError(expectError, fn) {
  let error = false;
  try {
    fn();
  } catch (e) {
    error = e;
  }
  if (expectError) {
    if (!error) {
      throw new Error('expected error, no error thrown');
    }
  } else {
    if (error) {
      throw error;
    }
  }
}

describe('test webgpu-debug-helper', () => {

  describe('test render pass encoder', () => {

    describe('should generate error on setViewport', () => {

      const tests = [
        { success: true, args: [0, 0, 2, 3, 0, 1], desc: 'valid' },
        { success: false, args: [-1, 0, 1, 1, 0, 1], desc: 'x < 0' },
        { success: false, args: [ 0, -1, 1, 1, 0, 1], desc: 'y < 0' },
        { success: false, args: [ 0, 0, 3, 1, 0, 1], desc: 'x + width > targetWidth' },
        { success: false, args: [ 1, 0, 2, 1, 0, 1], desc: 'x + width > targetWidth' },
        { success: false, args: [ 0, 0, 1, 4, 0, 1], desc: 'y + height > targetHeight' },
        { success: false, args: [ 0, 1, 1, 3, 0, 1], desc: 'y + height > targetHeight' },
      ];

      for (let {success, args, desc} of tests) {
        it(desc, async () => {
          const pass = await createRenderPass();
            expectValidationError(!success, () => {
              pass.setViewport(...args);
            });
        });

      }
  
    });

  });

});
