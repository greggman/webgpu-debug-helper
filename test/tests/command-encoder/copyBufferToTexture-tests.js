import {describe} from '../../mocha-support.js';
import {addCopyTests} from './copy-utils.js';

export default function () {
  describe('test copyBufferToTexture', () => {

    addCopyTests({
      doTest: (encoder, buffer, texture, copySize) => {
        encoder.copyBufferToTexture(buffer, texture, copySize);
      },
      bufferUsage: GPUBufferUsage.COPY_SRC,
      textureUsage: GPUTextureUsage.COPY_DST,
    });

  });

}
