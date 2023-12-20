import {mat3, mat4, quat, utils} from '../../dist/2.x/wgpu-matrix.module.js';

import {
  assertEqual,
  assertFalsy,
  assertIsArray,
  assertInstanceOf,
  assertStrictEqual,
  assertStrictNotEqual,
  assertTruthy,
} from '../assert.js';
import {describe, it, before} from '../mocha-support.js';

function assertMat3Equal(a, b) {
  if (!mat3.equals(a, b)) {
    throw new Error(`${a} !== ${b}`);
  }
}

function assertMat3EqualApproximately(a, b) {
  if (!mat3.equalsApproximately(a, b)) {
    throw new Error(`${a} !== ${b}`);
  }
}

describe('test webgpu-debug-helper', () => {
  let savedFuncEntries;

  beforeEach(() => {
    savedFuncEntries = saveFunctionsOfClasses([
      GPUDevice,
    ]);
  });

  afterEach(() => {
    restoreFunctionsOfClasses(savedFuncEntries);
  });

  it('should catch pass.ooo', () => {

  });

});
