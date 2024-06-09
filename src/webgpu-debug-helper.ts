import './error-scope-wrapper.js';
import './device.js';
import './canvas-context.js';
import './command-encoder.js';
import './compute-pass-encoder.js';
import './render-pass-encoder.js';
import './render-bundle-encoder.js';
import './texture.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _ = import.meta; // webgpu-debug-helper must be imported as a module with import or `<script type="module" ...>`
console.log('webgpu-debug-helper loaded:', _ !== undefined);