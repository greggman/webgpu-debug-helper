import {describe, it} from '../mocha-support.js';
import {expectValidationError} from '../js/utils.js';
import copyBufferToBufferTests from './command-encoder/copyBufferToBuffer-tests.js';
import copyBufferToTextureTests from './command-encoder/copyBufferToTexture-tests.js';
import copyTextureToBufferTests from './command-encoder/copyTextureToBuffer-tests.js';
import copyTextureToTextureTests from './command-encoder/copyTextureToTexture-tests.js';

async function createCommandEncoder(device) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  return device.createCommandEncoder();
}

describe('test command encoder', () => {

  describe('test finish', () => {

    it('can not finish twice', async () => {
      const encoder = await createCommandEncoder();
      encoder.finish();
      await expectValidationError(true, async () => {
        encoder.finish();
      });
    });

    it('can not finish if locked', async () => {
      const encoder = await createCommandEncoder();
      encoder.beginComputePass();
      await expectValidationError(true, async () => {
        encoder.finish();
      });
    });

  });

  copyBufferToBufferTests();
  copyBufferToTextureTests();
  copyTextureToBufferTests();
  copyTextureToTextureTests();

});
