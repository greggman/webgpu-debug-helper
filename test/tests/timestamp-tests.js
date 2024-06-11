
import {describe, it} from '../mocha-support.js';
import {expectValidationError} from '../js/utils.js';

export async function getDeviceWithTimestamp(test) {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter.features.has('timestamp-query')) {
    test.skip('timestamp-writes feature not available');
    return null;
  }
  return await adapter.requestDevice({
    requiredFeatures: ['timestamp-query'],
  });
}

async function itWithDeviceWithTimestamp(desc, fn) {
  it.call(this, desc, async function () {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter.features.has('timestamp-query')) {
      this.skip('timestamp-writes feature not available');
      return null;
    }
    const device = await adapter.requestDevice({
      requiredFeatures: ['timestamp-query'],
    });

    await fn.call(this, device);
    device.destroy();
    return null;
  });
}
export function addTimestampWriteTests({
  makePass,
}) {
  describe('timestampWrites', () => {

    itWithDeviceWithTimestamp('works', async function (device) {
      const querySet = device.createQuerySet({count: 2, type: 'timestamp'});

      await expectValidationError(false, async () => {
        await makePass(device, {
          timestampWrites: { querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 },
        });
      });
    });

    itWithDeviceWithTimestamp('fails if query destroyed', async function (device) {
      const querySet = device.createQuerySet({count: 2, type: 'timestamp'});
      querySet.destroy();

      await expectValidationError(true, async () => {
        await makePass(device, {
          timestampWrites: { querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 },
        });
      });
    });

    itWithDeviceWithTimestamp('fails if query from different device', async function (device) {
      const querySet = device.createQuerySet({count: 2, type: 'timestamp'});

      const device2 = await getDeviceWithTimestamp(this);

      await expectValidationError(true, async () => {
        await makePass(device2, {
          timestampWrites: { querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 },
        });
      });

      device2.destroy();
    });

    itWithDeviceWithTimestamp('fails if query wrong type', async function (device) {
      const querySet = device.createQuerySet({count: 2, type: 'occlusion'});

      await expectValidationError(true, async () => {
        await makePass(device, {
          timestampWrites: { querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 },
        });
      });
    });

    itWithDeviceWithTimestamp('fails if both begin and end not set', async function (device) {
      const querySet = device.createQuerySet({count: 2, type: 'timestamp'});

      await expectValidationError(true, async () => {
        await makePass(device, {
          timestampWrites: { querySet },
        });
      });
    });

    itWithDeviceWithTimestamp('fails if begin === end', async function (device) {
      const querySet = device.createQuerySet({count: 2, type: 'timestamp'});

      await expectValidationError(true, async () => {
        await makePass(device, {
          timestampWrites: { querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 0 },
        });
      });
    });

    itWithDeviceWithTimestamp('fails if begin out of range', async function (device) {
      const querySet = device.createQuerySet({count: 2, type: 'timestamp'});

      await expectValidationError(true, async () => {
        await makePass(device, {
          timestampWrites: { querySet, beginningOfPassWriteIndex: 2, endOfPassWriteIndex: 1 },
        });
      });
    });

    itWithDeviceWithTimestamp('fails if end out of range', async function (device) {
      const querySet = device.createQuerySet({count: 2, type: 'timestamp'});

      await expectValidationError(true, async () => {
        await makePass(device, {
          timestampWrites: { querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 2 },
        });
      });
    });


  });
}