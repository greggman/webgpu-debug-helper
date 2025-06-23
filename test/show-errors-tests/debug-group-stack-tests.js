import {describe} from '../mocha-support.js';
import { itWithDevice } from '../js/utils.js';
import { assertTruthy } from '../assert.js';

describe('test encoder debug push group', () => {

  itWithDevice('test encoder error has stack', async (device) => {
    const p = new Promise(resolve => {
      device.addEventListener('uncapturederror', e => {
        e.preventDefault();
        resolve(e.error);
      }, { passive: false });
    });
    const src = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_SRC});
    const dst = device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM}); // not COPY_DST so error at copyB2B
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(src, 0, dst, 0, dst.size);
    encoder.finish();
    device.queue.submit([]);
    const error = await p;
    assertTruthy(error.message.includes('debug-group-stack-tests.js'), error.message);
    // Note: this message is specific to chrome. you'll need add other checks for cross browser testing
    assertTruthy(error.message.includes("doesn't include BufferUsage::CopyDst"), error.message);
  });

  itWithDevice('test pass encoder error has stack', async (device) => {
    const p = new Promise(resolve => {
      device.addEventListener('uncapturederror', e => {
        e.preventDefault();
        resolve(e.error);
      }, { passive: false });
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.dispatchWorkgroups(1);
    pass.end();
    encoder.finish();
    device.queue.submit([]);
    const error = await p;
    assertTruthy(error.message.includes('debug-group-stack-tests.js'), error.message);
    // Note: this message is specific to chrome. you'll need add other checks for cross browser testing
    assertTruthy(error.message.includes('No pipeline set'), error.message);
  });

  itWithDevice('test render bundle encoder error has stack', async (device) => {
    const p = new Promise(resolve => {
      device.addEventListener('uncapturederror', e => {
        e.preventDefault();
        resolve(e.error);
      });
    }, { passive: false });
    const encoder = device.createRenderBundleEncoder({ colorFormats: ['rgba8unorm'] });
    encoder.draw(3);
    encoder.finish();
    device.queue.submit([]);
    const error = await p;
    assertTruthy(error.message.includes('debug-group-stack-tests.js'), error.message);
    // Note: this message is specific to chrome. you'll need add other checks for cross browser testing
    assertTruthy(error.message.includes('No pipeline set'), error.message);
  });


});
