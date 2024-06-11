import {
  assertNotDestroyed,
  s_objToDevice,
} from './shared-state.js';
import {
  assert,
} from './validation.js';

export function validateTimestampWrites(device: GPUDevice, timestampWrites: GPUComputePassTimestampWrites | GPURenderPassTimestampWrites) {
  const { querySet, beginningOfPassWriteIndex, endOfPassWriteIndex } = timestampWrites;
  assertNotDestroyed(querySet);
  assert(s_objToDevice.get(querySet) === device, 'querySet not from same device', [querySet]);
  assert(querySet.type === 'timestamp', () => `querySet.type(${querySet.type}) !== 'timestamp'`);
  assert(beginningOfPassWriteIndex === undefined || beginningOfPassWriteIndex < querySet.count, () => `timestampWrites.beginningOfPassWriteIndex(${beginningOfPassWriteIndex}) is >= querySet.count(${querySet.count})`);
  assert(endOfPassWriteIndex === undefined || endOfPassWriteIndex < querySet.count, () => `timestampWrites.endOfPassWriteIndex(${endOfPassWriteIndex}) is >= querySet.count(${querySet.count})`);
  assert(
    beginningOfPassWriteIndex !== undefined || endOfPassWriteIndex !== undefined,
    () => `at least one of beginningOfPassWriteIndex(${beginningOfPassWriteIndex}) or endOfPassWriteIndex(${endOfPassWriteIndex})`);
  assert(beginningOfPassWriteIndex !== endOfPassWriteIndex,
     () => `beginningOfPassWriteIndex(${beginningOfPassWriteIndex}) and endOfPassWriteIndex(${endOfPassWriteIndex}) may not be the same`);
}

