import {describe, it} from '../mocha-support.js';
import {expectValidationError} from '../js/utils.js';

async function createBindGroup(device, buffer) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {},
      },
    ],
  });
  buffer = buffer || device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM});
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer } },
    ],
  });
  return bindGroup;
}

async function createBindGroupWithDynamicOffsets(device) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  // entries are intentional not in binding order.
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { hasDynamicOffset: true, minBindingSize: 512 },
      },
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {},
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'storage', hasDynamicOffset: true, minBindingSize: 1024 },
      },
    ],
  });
  const buffer2 = device.createBuffer({size: 1024, usage: GPUBufferUsage.UNIFORM});
  const buffer0 = device.createBuffer({size: 128, usage: GPUBufferUsage.UNIFORM});
  const buffer1 = device.createBuffer({size: 2048, usage: GPUBufferUsage.STORAGE});
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 2, resource: { buffer: buffer2 } },
      { binding: 1, resource: { buffer: buffer1 } },
      { binding: 0, resource: { buffer: buffer0 } },
    ],
  });
  return bindGroup;
}

export function addBindingMixinTests({
  makePass,
  endPass,
}) {

  describe('check errors on setBindGroup', () => {

    it('works', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const pass = await makePass(device);
      const bindGroup = await createBindGroup(device);
      await expectValidationError(false, () => {
        pass.setBindGroup(0, bindGroup);
      });
    });

    it('fails if ended', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const pass = await makePass(device);
      const bindGroup = await createBindGroup(device);
      endPass(pass);
      await expectValidationError(true, () => {
        pass.setBindGroup(0, bindGroup);
      });
    });

    it('bindGroup from different device', async () => {
      const pass = await makePass();
      const bindGroup = await createBindGroup();
      await expectValidationError(true, () => {
        pass.setBindGroup(0, bindGroup);
      });
    });

    it('index < 0', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const pass = await makePass(device);
      const bindGroup = await createBindGroup(device);
      await expectValidationError(true, () => {
        pass.setBindGroup(-1, bindGroup);
      });
    });

    it('index > max', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const pass = await makePass(device);
      const bindGroup = await createBindGroup(device);
      await expectValidationError(true, () => {
        pass.setBindGroup(device.limits.maxBindGroups, bindGroup);
      });
    });

    it('fails if buffer destroyed', async () => {
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const pass = await makePass(device);
      const buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM});
      const bindGroup = await createBindGroup(device, buffer);
      buffer.destroy();
      await expectValidationError(true, () => {
        pass.setBindGroup(0, bindGroup);
      });
    });

    const addDynamicOffsetTests = (fn) => {
      it('works', async () => {
        const device = await (await navigator.gpu.requestAdapter()).requestDevice();
        const pass = await makePass(device);
        const bindGroup = await createBindGroupWithDynamicOffsets(device);
        await expectValidationError(false, () => {
          pass.setBindGroup(0, bindGroup, ...fn([2048 - 1024, 1024 - 512]));
        });
      });

      it('fails if wrong number of dynamic offsets', async () => {
        const device = await (await navigator.gpu.requestAdapter()).requestDevice();
        const pass = await makePass(device);
        const bindGroup = await createBindGroupWithDynamicOffsets(device);
        await expectValidationError('same number of dynamicOffsets', () => {
          pass.setBindGroup(0, bindGroup, ...fn([0, 0, 0]));
        });
      });

      it('fails if dynamic offset out of range', async () => {
        const device = await (await navigator.gpu.requestAdapter()).requestDevice();
        const pass = await makePass(device);
        const bindGroup = await createBindGroupWithDynamicOffsets(device);
        await expectValidationError('dynamic offset is out of range', () => {
          pass.setBindGroup(0, bindGroup, ...fn([2048, 0]));
        });
      });

      it('fails if dynamic offset is not storage aligned', async () => {
        const device = await (await navigator.gpu.requestAdapter()).requestDevice();
        const pass = await makePass(device);
        const bindGroup = await createBindGroupWithDynamicOffsets(device);
        await expectValidationError('device.limits.minStorageBufferOffsetAlignment', () => {
          pass.setBindGroup(0, bindGroup, ...fn([128, 0]));
        });
      });

      it('fails if dynamic offset is not uniform aligned', async () => {
        const device = await (await navigator.gpu.requestAdapter()).requestDevice();
        const pass = await makePass(device);
        const bindGroup = await createBindGroupWithDynamicOffsets(device);
        await expectValidationError('device.limits.minUniformBufferOffsetAlignment', () => {
          pass.setBindGroup(0, bindGroup, ...fn([0, 128]));
        });
      });
    };

    describe('dynamic offsets (array)', () => {

      addDynamicOffsetTests(v => [v]);

    });

    describe('dynamic offsets (Uint32Array)', () => {

      addDynamicOffsetTests(v => {
        const a = new Uint32Array(v);
        return [a, 0, a.length];
      });

    });

  });

}

async function createResourcesForAutoLayoutBindGroupTests(makePassAndPipeline, device) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();
  const { pass, pipeline } = await makePassAndPipeline(device, {
    resourceWGSL: `
      @group(0) @binding(0) var<uniform> u00: f32;
      @group(0) @binding(1) var<uniform> u01: f32;
      @group(1) @binding(0) var<uniform> u10: vec4f;
      @group(2) @binding(0) var<uniform> u20: vec4f;
    `,
    usageWGSL: `
      _ = u00;
      _ = u01;
      _ = u10;
      _ = u20;
    `,
  });
  const u00Buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM});
  const u01Buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM});
  const u10Buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM});
  const u20Buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM});
  const bindGroup0 = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: u00Buffer }},
      { binding: 1, resource: { buffer: u01Buffer }},
    ],
  });
  const bindGroup1 = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(1),
    entries: [
      { binding: 0, resource: { buffer: u10Buffer }},
    ],
  });
  const bindGroup2 = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(2),
    entries: [
      { binding: 0, resource: { buffer: u20Buffer }},
    ],
  });
  return {
    device,
    pass,
    pipeline,
    u00Buffer,
    u01Buffer,
    u10Buffer,
    u20Buffer,
    bindGroup0,
    bindGroup1,
    bindGroup2,
  };
}

async function createResourcesForExplicitLayoutBindGroupTests({
  makePassAndPipeline,
  device,
  visibility,
}) {
  device = device || await (await navigator.gpu.requestAdapter()).requestDevice();

  const bindGroupLayouts = [
    {
      entries: [
        { binding: 0, visibility, buffer: {} },
        { binding: 1, visibility, buffer: {} },
      ],
    },
    {
      entries: [
        { binding: 0, visibility, buffer: {} },
      ],
    },
    {
      entries: [
        { binding: 0, visibility, buffer: {} },
      ],
    },
  ].map(bglDesc => device.createBindGroupLayout(bglDesc));

  const layout = device.createPipelineLayout({
    bindGroupLayouts,
  });
  const { pass, pipeline } = await makePassAndPipeline(device, {
    layout,
    resourceWGSL: `
      @group(0) @binding(0) var<uniform> u00: f32;
      @group(0) @binding(1) var<uniform> u01: f32;
      @group(1) @binding(0) var<uniform> u10: vec4f;
      @group(2) @binding(0) var<uniform> u20: vec4f;
    `,
    usageWGSL: `
      _ = u00;
      _ = u01;
      _ = u10;
      _ = u20;
    `,
  });
  const u00Buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM});
  const u01Buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM});
  const u10Buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM});
  const u20Buffer = device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM});

  const bindGroup0 = device.createBindGroup({
    layout: bindGroupLayouts[0],
    entries: [
      { binding: 0, resource: { buffer: u00Buffer }},
      { binding: 1, resource: { buffer: u01Buffer }},
    ],
  });
  const bindGroup1 = device.createBindGroup({
    layout: bindGroupLayouts[1],
    entries: [
      { binding: 0, resource: { buffer: u10Buffer }},
    ],
  });
  const bindGroup2 = device.createBindGroup({
    layout: bindGroupLayouts[2],
    entries: [
      { binding: 0, resource: { buffer: u20Buffer }},
    ],
  });
  return {
    device,
    pass,
    pipeline,
    u00Buffer,
    u01Buffer,
    u10Buffer,
    u20Buffer,
    bindGroup0,
    bindGroup1,
    bindGroup2,
  };
}

export function addValidateBindGroupTests({
  makePassAndPipeline,
  execute,
  visibility,
}) {

  describe('validate bindGroups tests', () => {

    describe('auto layout', () => {

      it('works with auto layout', async () => {
        const { pass, bindGroup0, bindGroup1, bindGroup2 } = await createResourcesForAutoLayoutBindGroupTests(makePassAndPipeline);
        pass.setBindGroup(0, bindGroup0);
        pass.setBindGroup(1, bindGroup1);
        pass.setBindGroup(2, bindGroup2);

        await expectValidationError(false, async () => {
          await execute(pass);
        });
      });

      it('fails if missing bindGroup', async () => {
        const { pass, bindGroup1, bindGroup2 } = await createResourcesForAutoLayoutBindGroupTests(makePassAndPipeline);
        pass.setBindGroup(1, bindGroup1);
        pass.setBindGroup(2, bindGroup2);

        await expectValidationError(true, async () => {
          await execute(pass);
        });
      });

      it('fails if resource is destroyed', async () => {
        const { pass, u01Buffer, bindGroup0, bindGroup1, bindGroup2 } = await createResourcesForAutoLayoutBindGroupTests(makePassAndPipeline);
        pass.setBindGroup(0, bindGroup0);
        pass.setBindGroup(1, bindGroup1);
        pass.setBindGroup(2, bindGroup2);
        u01Buffer.destroy();

        await expectValidationError(true, async () => {
          await execute(pass);
        });
      });

      it('fails if layout is incompatible (auto layout)', async () => {
        const { device, pass, bindGroup0, bindGroup2 } = await createResourcesForAutoLayoutBindGroupTests(makePassAndPipeline);
        const { bindGroup1 } = await createResourcesForAutoLayoutBindGroupTests(makePassAndPipeline, device);
        pass.setBindGroup(0, bindGroup0);
        pass.setBindGroup(1, bindGroup1);
        pass.setBindGroup(2, bindGroup2);

        await expectValidationError(true, async () => {
          await execute(pass);
        });
      });

      it('works if layout is compatible (auto layout)', async () => {
        const { pass, bindGroup0, bindGroup1, bindGroup2 } = await createResourcesForAutoLayoutBindGroupTests(makePassAndPipeline);
        pass.setBindGroup(0, bindGroup0);
        pass.setBindGroup(1, bindGroup2);  // 2 and 1 are swapped but
        pass.setBindGroup(2, bindGroup1);  // they should be compatible

        await expectValidationError(false, async () => {
          await execute(pass);
        });
      });

      it('false if layout is incompatible (auto layout + manual bindGroupLayout)', async () => {
        const { device, pass, bindGroup0, bindGroup1, u20Buffer } = await createResourcesForAutoLayoutBindGroupTests(makePassAndPipeline);
        const bindGroupLayout = device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.VERTEX,
              buffer: {},
            },
          ],
        });
        const bindGroup2 = device.createBindGroup({
          layout: bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: u20Buffer }},
          ],
        });
        pass.setBindGroup(0, bindGroup0);
        pass.setBindGroup(1, bindGroup1);
        pass.setBindGroup(2, bindGroup2);

        await expectValidationError(true, async () => {
          await execute(pass);
        });
      });

    });

    describe('explicit layout', () => {

      it('works with explicit layout', async () => {
        const { pass, bindGroup0, bindGroup1, bindGroup2 } = await createResourcesForExplicitLayoutBindGroupTests({ makePassAndPipeline, visibility });
        pass.setBindGroup(0, bindGroup0);
        pass.setBindGroup(1, bindGroup1);
        pass.setBindGroup(2, bindGroup2);

        await expectValidationError(false, async () => {
          await execute(pass);
        });
      });

      it('works with different explicit layout if they are compatible', async () => {
        const { device, pass, bindGroup0, bindGroup1 } = await createResourcesForExplicitLayoutBindGroupTests({ makePassAndPipeline, visibility });
        const { bindGroup2 } = await createResourcesForExplicitLayoutBindGroupTests({ makePassAndPipeline, device, visibility });
        pass.setBindGroup(0, bindGroup0);
        pass.setBindGroup(1, bindGroup1);
        pass.setBindGroup(2, bindGroup2);

        await expectValidationError(false, async () => {
          await execute(pass);
        });
      });

      it('fails with incompatible bindGroup', async () => {
        const { pass, bindGroup1, bindGroup2 } = await createResourcesForExplicitLayoutBindGroupTests({ makePassAndPipeline, visibility });
        pass.setBindGroup(0, bindGroup1); // incompatible
        pass.setBindGroup(1, bindGroup1);
        pass.setBindGroup(2, bindGroup2);

        await expectValidationError(true, async () => {
          await execute(pass);
        });
      });

    });

  });

}