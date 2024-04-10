// exported from the WebGPU CTS by adding the following line to src/webgpu/format_info.ts
//
//    console.log(JSON.stringify(kAllTextureFormatInfo, null, 2));

export type DataInfo = {
  copySrc: boolean,
  copyDst: boolean,
  storage: boolean,
  readWriteStorage: boolean,
};

export type ColorInfo = DataInfo & {
  type: 'float' | 'uint' | 'sint' | 'unfilterable-float',
  bytes: number,
};

export type ColorRenderInfo = {
  blend: boolean,
  resolve: boolean,
  byteCost: number,
  alignment: number,
};

export type StencilInfo = DataInfo & {
  type: 'uint',
  bytes: number,
}

export type DepthInfo = DataInfo & {
  type: 'depth',
  bytes?: number,
}

export type FormatInfo = {
  blockWidth: number,
  blockHeight: number,
  multisample?: boolean,
  bytesPerBlock?: number,
  color?: ColorInfo,
  colorRender?: ColorRenderInfo,
  stencil?: StencilInfo,
  depth?: DepthInfo,
  baseFormat?: string,
  feature?: string,
};

export const kAllTextureFormatInfo: {[key: string]: FormatInfo} =  {
  "r8unorm": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 1
    },
    "colorRender": {
      "blend": true,
      "resolve": true,
      "byteCost": 1,
      "alignment": 1
    },
    "multisample": true,
    "bytesPerBlock": 1
  },
  "r8snorm": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 1
    },
    "multisample": false,
    "bytesPerBlock": 1
  },
  "r8uint": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "uint",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 1
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 1,
      "alignment": 1
    },
    "multisample": true,
    "bytesPerBlock": 1
  },
  "r8sint": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "sint",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 1
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 1,
      "alignment": 1
    },
    "multisample": true,
    "bytesPerBlock": 1
  },
  "rg8unorm": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 2
    },
    "colorRender": {
      "blend": true,
      "resolve": true,
      "byteCost": 2,
      "alignment": 1
    },
    "multisample": true,
    "bytesPerBlock": 2
  },
  "rg8snorm": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 2
    },
    "multisample": false,
    "bytesPerBlock": 2
  },
  "rg8uint": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "uint",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 2
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 2,
      "alignment": 1
    },
    "multisample": true,
    "bytesPerBlock": 2
  },
  "rg8sint": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "sint",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 2
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 2,
      "alignment": 1
    },
    "multisample": true,
    "bytesPerBlock": 2
  },
  "rgba8unorm": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": true,
      "readWriteStorage": false,
      "bytes": 4
    },
    "colorRender": {
      "blend": true,
      "resolve": true,
      "byteCost": 8,
      "alignment": 1
    },
    "multisample": true,
    "baseFormat": "rgba8unorm",
    "bytesPerBlock": 4
  },
  "rgba8unorm-srgb": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 4
    },
    "colorRender": {
      "blend": true,
      "resolve": true,
      "byteCost": 8,
      "alignment": 1
    },
    "multisample": true,
    "baseFormat": "rgba8unorm",
    "bytesPerBlock": 4
  },
  "rgba8snorm": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": true,
      "readWriteStorage": false,
      "bytes": 4
    },
    "multisample": false,
    "bytesPerBlock": 4
  },
  "rgba8uint": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "uint",
      "copySrc": true,
      "copyDst": true,
      "storage": true,
      "readWriteStorage": false,
      "bytes": 4
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 4,
      "alignment": 1
    },
    "multisample": true,
    "bytesPerBlock": 4
  },
  "rgba8sint": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "sint",
      "copySrc": true,
      "copyDst": true,
      "storage": true,
      "readWriteStorage": false,
      "bytes": 4
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 4,
      "alignment": 1
    },
    "multisample": true,
    "bytesPerBlock": 4
  },
  "bgra8unorm": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 4
    },
    "colorRender": {
      "blend": true,
      "resolve": true,
      "byteCost": 8,
      "alignment": 1
    },
    "multisample": true,
    "baseFormat": "bgra8unorm",
    "bytesPerBlock": 4
  },
  "bgra8unorm-srgb": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 4
    },
    "colorRender": {
      "blend": true,
      "resolve": true,
      "byteCost": 8,
      "alignment": 1
    },
    "multisample": true,
    "baseFormat": "bgra8unorm",
    "bytesPerBlock": 4
  },
  "r16uint": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "uint",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 2
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 2,
      "alignment": 2
    },
    "multisample": true,
    "bytesPerBlock": 2
  },
  "r16sint": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "sint",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 2
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 2,
      "alignment": 2
    },
    "multisample": true,
    "bytesPerBlock": 2
  },
  "r16float": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 2
    },
    "colorRender": {
      "blend": true,
      "resolve": true,
      "byteCost": 2,
      "alignment": 2
    },
    "multisample": true,
    "bytesPerBlock": 2
  },
  "rg16uint": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "uint",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 4
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 4,
      "alignment": 2
    },
    "multisample": true,
    "bytesPerBlock": 4
  },
  "rg16sint": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "sint",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 4
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 4,
      "alignment": 2
    },
    "multisample": true,
    "bytesPerBlock": 4
  },
  "rg16float": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 4
    },
    "colorRender": {
      "blend": true,
      "resolve": true,
      "byteCost": 4,
      "alignment": 2
    },
    "multisample": true,
    "bytesPerBlock": 4
  },
  "rgba16uint": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "uint",
      "copySrc": true,
      "copyDst": true,
      "storage": true,
      "readWriteStorage": false,
      "bytes": 8
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 8,
      "alignment": 2
    },
    "multisample": true,
    "bytesPerBlock": 8
  },
  "rgba16sint": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "sint",
      "copySrc": true,
      "copyDst": true,
      "storage": true,
      "readWriteStorage": false,
      "bytes": 8
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 8,
      "alignment": 2
    },
    "multisample": true,
    "bytesPerBlock": 8
  },
  "rgba16float": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": true,
      "readWriteStorage": false,
      "bytes": 8
    },
    "colorRender": {
      "blend": true,
      "resolve": true,
      "byteCost": 8,
      "alignment": 2
    },
    "multisample": true,
    "bytesPerBlock": 8
  },
  "r32uint": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "uint",
      "copySrc": true,
      "copyDst": true,
      "storage": true,
      "readWriteStorage": true,
      "bytes": 4
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 4,
      "alignment": 4
    },
    "multisample": false,
    "bytesPerBlock": 4
  },
  "r32sint": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "sint",
      "copySrc": true,
      "copyDst": true,
      "storage": true,
      "readWriteStorage": true,
      "bytes": 4
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 4,
      "alignment": 4
    },
    "multisample": false,
    "bytesPerBlock": 4
  },
  "r32float": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "unfilterable-float",
      "copySrc": true,
      "copyDst": true,
      "storage": true,
      "readWriteStorage": true,
      "bytes": 4
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 4,
      "alignment": 4
    },
    "multisample": true,
    "bytesPerBlock": 4
  },
  "rg32uint": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "uint",
      "copySrc": true,
      "copyDst": true,
      "storage": true,
      "readWriteStorage": false,
      "bytes": 8
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 8,
      "alignment": 4
    },
    "multisample": false,
    "bytesPerBlock": 8
  },
  "rg32sint": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "sint",
      "copySrc": true,
      "copyDst": true,
      "storage": true,
      "readWriteStorage": false,
      "bytes": 8
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 8,
      "alignment": 4
    },
    "multisample": false,
    "bytesPerBlock": 8
  },
  "rg32float": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "unfilterable-float",
      "copySrc": true,
      "copyDst": true,
      "storage": true,
      "readWriteStorage": false,
      "bytes": 8
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 8,
      "alignment": 4
    },
    "multisample": false,
    "bytesPerBlock": 8
  },
  "rgba32uint": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "uint",
      "copySrc": true,
      "copyDst": true,
      "storage": true,
      "readWriteStorage": false,
      "bytes": 16
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 16,
      "alignment": 4
    },
    "multisample": false,
    "bytesPerBlock": 16
  },
  "rgba32sint": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "sint",
      "copySrc": true,
      "copyDst": true,
      "storage": true,
      "readWriteStorage": false,
      "bytes": 16
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 16,
      "alignment": 4
    },
    "multisample": false,
    "bytesPerBlock": 16
  },
  "rgba32float": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "unfilterable-float",
      "copySrc": true,
      "copyDst": true,
      "storage": true,
      "readWriteStorage": false,
      "bytes": 16
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 16,
      "alignment": 4
    },
    "multisample": false,
    "bytesPerBlock": 16
  },
  "rgb10a2uint": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "uint",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 4
    },
    "colorRender": {
      "blend": false,
      "resolve": false,
      "byteCost": 8,
      "alignment": 4
    },
    "multisample": true,
    "bytesPerBlock": 4
  },
  "rgb10a2unorm": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 4
    },
    "colorRender": {
      "blend": true,
      "resolve": true,
      "byteCost": 8,
      "alignment": 4
    },
    "multisample": true,
    "bytesPerBlock": 4
  },
  "rg11b10ufloat": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 4
    },
    "multisample": false,
    "bytesPerBlock": 4
  },
  "rgb9e5ufloat": {
    "blockWidth": 1,
    "blockHeight": 1,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 4
    },
    "multisample": false,
    "bytesPerBlock": 4
  },
  "stencil8": {
    "blockWidth": 1,
    "blockHeight": 1,
    "stencil": {
      "type": "uint",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 1
    },
    "multisample": true,
    "bytesPerBlock": 1
  },
  "depth16unorm": {
    "blockWidth": 1,
    "blockHeight": 1,
    "depth": {
      "type": "depth",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 2
    },
    "multisample": true,
    "bytesPerBlock": 2
  },
  "depth32float": {
    "blockWidth": 1,
    "blockHeight": 1,
    "depth": {
      "type": "depth",
      "copySrc": true,
      "copyDst": false,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 4
    },
    "multisample": true,
    "bytesPerBlock": 4
  },
  "depth24plus": {
    "blockWidth": 1,
    "blockHeight": 1,
    "depth": {
      "type": "depth",
      "copySrc": false,
      "copyDst": false,
      "storage": false,
      "readWriteStorage": false
    },
    "multisample": true
  },
  "depth24plus-stencil8": {
    "blockWidth": 1,
    "blockHeight": 1,
    "depth": {
      "type": "depth",
      "copySrc": false,
      "copyDst": false,
      "storage": false,
      "readWriteStorage": false
    },
    "stencil": {
      "type": "uint",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 1
    },
    "multisample": true
  },
  "depth32float-stencil8": {
    "blockWidth": 1,
    "blockHeight": 1,
    "depth": {
      "type": "depth",
      "copySrc": true,
      "copyDst": false,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 4
    },
    "stencil": {
      "type": "uint",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 1
    },
    "multisample": true,
    "feature": "depth32float-stencil8"
  },
  "bc1-rgba-unorm": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 8
    },
    "multisample": false,
    "feature": "texture-compression-bc",
    "baseFormat": "bc1-rgba-unorm",
    "bytesPerBlock": 8
  },
  "bc1-rgba-unorm-srgb": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 8
    },
    "multisample": false,
    "feature": "texture-compression-bc",
    "baseFormat": "bc1-rgba-unorm",
    "bytesPerBlock": 8
  },
  "bc2-rgba-unorm": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-bc",
    "baseFormat": "bc2-rgba-unorm",
    "bytesPerBlock": 16
  },
  "bc2-rgba-unorm-srgb": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-bc",
    "baseFormat": "bc2-rgba-unorm",
    "bytesPerBlock": 16
  },
  "bc3-rgba-unorm": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-bc",
    "baseFormat": "bc3-rgba-unorm",
    "bytesPerBlock": 16
  },
  "bc3-rgba-unorm-srgb": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-bc",
    "baseFormat": "bc3-rgba-unorm",
    "bytesPerBlock": 16
  },
  "bc4-r-unorm": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 8
    },
    "multisample": false,
    "feature": "texture-compression-bc",
    "bytesPerBlock": 8
  },
  "bc4-r-snorm": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 8
    },
    "multisample": false,
    "feature": "texture-compression-bc",
    "bytesPerBlock": 8
  },
  "bc5-rg-unorm": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-bc",
    "bytesPerBlock": 16
  },
  "bc5-rg-snorm": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-bc",
    "bytesPerBlock": 16
  },
  "bc6h-rgb-ufloat": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-bc",
    "bytesPerBlock": 16
  },
  "bc6h-rgb-float": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-bc",
    "bytesPerBlock": 16
  },
  "bc7-rgba-unorm": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-bc",
    "baseFormat": "bc7-rgba-unorm",
    "bytesPerBlock": 16
  },
  "bc7-rgba-unorm-srgb": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-bc",
    "baseFormat": "bc7-rgba-unorm",
    "bytesPerBlock": 16
  },
  "etc2-rgb8unorm": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 8
    },
    "multisample": false,
    "feature": "texture-compression-etc2",
    "baseFormat": "etc2-rgb8unorm",
    "bytesPerBlock": 8
  },
  "etc2-rgb8unorm-srgb": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 8
    },
    "multisample": false,
    "feature": "texture-compression-etc2",
    "baseFormat": "etc2-rgb8unorm",
    "bytesPerBlock": 8
  },
  "etc2-rgb8a1unorm": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 8
    },
    "multisample": false,
    "feature": "texture-compression-etc2",
    "baseFormat": "etc2-rgb8a1unorm",
    "bytesPerBlock": 8
  },
  "etc2-rgb8a1unorm-srgb": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 8
    },
    "multisample": false,
    "feature": "texture-compression-etc2",
    "baseFormat": "etc2-rgb8a1unorm",
    "bytesPerBlock": 8
  },
  "etc2-rgba8unorm": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-etc2",
    "baseFormat": "etc2-rgba8unorm",
    "bytesPerBlock": 16
  },
  "etc2-rgba8unorm-srgb": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-etc2",
    "baseFormat": "etc2-rgba8unorm",
    "bytesPerBlock": 16
  },
  "eac-r11unorm": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 8
    },
    "multisample": false,
    "feature": "texture-compression-etc2",
    "bytesPerBlock": 8
  },
  "eac-r11snorm": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 8
    },
    "multisample": false,
    "feature": "texture-compression-etc2",
    "bytesPerBlock": 8
  },
  "eac-rg11unorm": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-etc2",
    "bytesPerBlock": 16
  },
  "eac-rg11snorm": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-etc2",
    "bytesPerBlock": 16
  },
  "astc-4x4-unorm": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-4x4-unorm",
    "bytesPerBlock": 16
  },
  "astc-4x4-unorm-srgb": {
    "blockWidth": 4,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-4x4-unorm",
    "bytesPerBlock": 16
  },
  "astc-5x4-unorm": {
    "blockWidth": 5,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-5x4-unorm",
    "bytesPerBlock": 16
  },
  "astc-5x4-unorm-srgb": {
    "blockWidth": 5,
    "blockHeight": 4,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-5x4-unorm",
    "bytesPerBlock": 16
  },
  "astc-5x5-unorm": {
    "blockWidth": 5,
    "blockHeight": 5,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-5x5-unorm",
    "bytesPerBlock": 16
  },
  "astc-5x5-unorm-srgb": {
    "blockWidth": 5,
    "blockHeight": 5,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-5x5-unorm",
    "bytesPerBlock": 16
  },
  "astc-6x5-unorm": {
    "blockWidth": 6,
    "blockHeight": 5,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-6x5-unorm",
    "bytesPerBlock": 16
  },
  "astc-6x5-unorm-srgb": {
    "blockWidth": 6,
    "blockHeight": 5,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-6x5-unorm",
    "bytesPerBlock": 16
  },
  "astc-6x6-unorm": {
    "blockWidth": 6,
    "blockHeight": 6,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-6x6-unorm",
    "bytesPerBlock": 16
  },
  "astc-6x6-unorm-srgb": {
    "blockWidth": 6,
    "blockHeight": 6,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-6x6-unorm",
    "bytesPerBlock": 16
  },
  "astc-8x5-unorm": {
    "blockWidth": 8,
    "blockHeight": 5,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-8x5-unorm",
    "bytesPerBlock": 16
  },
  "astc-8x5-unorm-srgb": {
    "blockWidth": 8,
    "blockHeight": 5,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-8x5-unorm",
    "bytesPerBlock": 16
  },
  "astc-8x6-unorm": {
    "blockWidth": 8,
    "blockHeight": 6,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-8x6-unorm",
    "bytesPerBlock": 16
  },
  "astc-8x6-unorm-srgb": {
    "blockWidth": 8,
    "blockHeight": 6,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-8x6-unorm",
    "bytesPerBlock": 16
  },
  "astc-8x8-unorm": {
    "blockWidth": 8,
    "blockHeight": 8,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-8x8-unorm",
    "bytesPerBlock": 16
  },
  "astc-8x8-unorm-srgb": {
    "blockWidth": 8,
    "blockHeight": 8,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-8x8-unorm",
    "bytesPerBlock": 16
  },
  "astc-10x5-unorm": {
    "blockWidth": 10,
    "blockHeight": 5,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-10x5-unorm",
    "bytesPerBlock": 16
  },
  "astc-10x5-unorm-srgb": {
    "blockWidth": 10,
    "blockHeight": 5,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-10x5-unorm",
    "bytesPerBlock": 16
  },
  "astc-10x6-unorm": {
    "blockWidth": 10,
    "blockHeight": 6,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-10x6-unorm",
    "bytesPerBlock": 16
  },
  "astc-10x6-unorm-srgb": {
    "blockWidth": 10,
    "blockHeight": 6,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-10x6-unorm",
    "bytesPerBlock": 16
  },
  "astc-10x8-unorm": {
    "blockWidth": 10,
    "blockHeight": 8,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-10x8-unorm",
    "bytesPerBlock": 16
  },
  "astc-10x8-unorm-srgb": {
    "blockWidth": 10,
    "blockHeight": 8,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-10x8-unorm",
    "bytesPerBlock": 16
  },
  "astc-10x10-unorm": {
    "blockWidth": 10,
    "blockHeight": 10,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-10x10-unorm",
    "bytesPerBlock": 16
  },
  "astc-10x10-unorm-srgb": {
    "blockWidth": 10,
    "blockHeight": 10,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-10x10-unorm",
    "bytesPerBlock": 16
  },
  "astc-12x10-unorm": {
    "blockWidth": 12,
    "blockHeight": 10,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-12x10-unorm",
    "bytesPerBlock": 16
  },
  "astc-12x10-unorm-srgb": {
    "blockWidth": 12,
    "blockHeight": 10,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-12x10-unorm",
    "bytesPerBlock": 16
  },
  "astc-12x12-unorm": {
    "blockWidth": 12,
    "blockHeight": 12,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-12x12-unorm",
    "bytesPerBlock": 16
  },
  "astc-12x12-unorm-srgb": {
    "blockWidth": 12,
    "blockHeight": 12,
    "color": {
      "type": "float",
      "copySrc": true,
      "copyDst": true,
      "storage": false,
      "readWriteStorage": false,
      "bytes": 16
    },
    "multisample": false,
    "feature": "texture-compression-astc",
    "baseFormat": "astc-12x12-unorm",
    "bytesPerBlock": 16
  }
};
