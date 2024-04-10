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
import {expectValidationError} from '../js/utils.js';

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
      const pass = encoder.beginComputePass();
      await expectValidationError(true, async () => {
        encoder.finish();
      });
    });

  });

});
