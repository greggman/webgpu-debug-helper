import {describe} from '../../mocha-support.js';
import {addCopyTests} from './copy-utils.js';

export default function () {
  describe('test copyTextureToBuffer', () => {

    addCopyTests({
      doTest: (encoder, buffer, texture, copySize) => {
        encoder.copyTextureToBuffer(texture, buffer, copySize);
      },
      bufferUsage: GPUBufferUsage.COPY_DST,
      textureUsage: GPUTextureUsage.COPY_SRC,
    });

  });

}
