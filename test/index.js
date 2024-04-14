/* global mocha */
import './tests/canvas-context-tests.js';
import './tests/command-encoder-tests.js';
import './tests/compute-pass-tests.js';
import './tests/device-tests.js';
import './tests/render-bundle-tests.js';
import './tests/render-pass-tests.js';
import './tests/webgpu-debug-helper-tests.js';

const settings = Object.fromEntries(new URLSearchParams(window.location.search).entries());
if (settings.reporter) {
  mocha.reporter(settings.reporter);
}
if (settings.grep) {
  mocha.grep(new RegExp(settings.grep, 'i'), false);
}

mocha.run((failures) => {
  window.testsPromiseInfo.resolve(failures);
});
