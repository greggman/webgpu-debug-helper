import {describe} from '../mocha-support.js';
import { itWithDevice } from '../js/utils.js';
import { assertTruthy } from '../assert.js';

describe('test encoder debug push group', () => {

  itWithDevice('test encoder error has stack', async (device) => {
    const p = new Promise(resolve => {
      device.addEventListener('uncapturederror', e => {
        resolve(e.error);
      });
    });
    const src = device.createBuffer({size: 16, usage: GPUBufferUsage.COPY_SRC});
    const dst = device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM}); // not COPY_DST so error at copyB2B
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(src, 0, dst, 0, dst.size);
    encoder.finish();
    device.queue.submit([]);
    const error = await p;
    assertTruthy(error.message.includes('debug-group-stack-tests.js'), error.message);
  });

});
