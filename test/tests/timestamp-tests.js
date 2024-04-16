
import {describe, it} from '../mocha-support.js';
import {expectValidationError} from '../js/utils.js';

async function getDeviceWithTimestamp(test) {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter.features.has('timestamp-query')) {
    test.skip('timestamp-writes feature not available');
    return null;
  }
  return await adapter.requestDevice({
    requiredFeatures: ['timestamp-query'],
  });
}

export function addTimestampWriteTests({
  makePass,
}) {
  describe('timestampWrites', () => {

    it('works', async function () {
      const device = await getDeviceWithTimestamp(this);
      const querySet = device.createQuerySet({count: 2, type: 'timestamp'});

      await expectValidationError(false, async () => {
        await makePass(device, {
          timestampWrites: { querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 },
        });
      });
    });

    it('fails if query destroyed', async function () {
      const device = await getDeviceWithTimestamp(this);
      const querySet = device.createQuerySet({count: 2, type: 'timestamp'});
      querySet.destroy();

      await expectValidationError(true, async () => {
        await makePass(device, {
          timestampWrites: { querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 },
        });
      });
    });

    it('fails if query from different device', async function () {
      const device = await getDeviceWithTimestamp(this);
      const querySet = device.createQuerySet({count: 2, type: 'timestamp'});

      const device2 = await getDeviceWithTimestamp(this);

      await expectValidationError(true, async () => {
        await makePass(device2, {
          timestampWrites: { querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 },
        });
      });
    });

    it('fails if query wrong type', async function () {
      const device = await getDeviceWithTimestamp(this);
      const querySet = device.createQuerySet({count: 2, type: 'occlusion'});

      await expectValidationError(true, async () => {
        await makePass(device, {
          timestampWrites: { querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 },
        });
      });
    });

    it('fails if both begin and end not set', async function () {
      const device = await getDeviceWithTimestamp(this);
      const querySet = device.createQuerySet({count: 2, type: 'timestamp'});

      await expectValidationError(true, async () => {
        await makePass(device, {
          timestampWrites: { querySet },
        });
      });
    });

    it('fails if begin === end', async function () {
      const device = await getDeviceWithTimestamp(this);
      const querySet = device.createQuerySet({count: 2, type: 'timestamp'});

      await expectValidationError(true, async () => {
        await makePass(device, {
          timestampWrites: { querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 0 },
        });
      });
    });

    it('fails if begin out of range', async function () {
      const device = await getDeviceWithTimestamp(this);
      const querySet = device.createQuerySet({count: 2, type: 'timestamp'});

      await expectValidationError(true, async () => {
        await makePass(device, {
          timestampWrites: { querySet, beginningOfPassWriteIndex: 2, endOfPassWriteIndex: 1 },
        });
      });
    });

    it('fails if end out of range', async function () {
      const device = await getDeviceWithTimestamp(this);
      const querySet = device.createQuerySet({count: 2, type: 'timestamp'});

      await expectValidationError(true, async () => {
        await makePass(device, {
          timestampWrites: { querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 2 },
        });
      });
    });


  });
}