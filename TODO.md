# To Do

* enforce renderPass validation
  * https://www.w3.org/TR/webgpu/#abstract-opdef-gpurenderpassdescriptor-valid-usage
  * enforce feedback of textures
  * enforce render targets vs storage textures
* enforce storage textures bound write and read
* enforce storage buffers bound write and read
* change all tests to use regex/includes
* change assert to have call stack? eg: error in draw->beginRenderPass->commandEncoder ...