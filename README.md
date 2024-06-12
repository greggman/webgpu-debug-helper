# webgpu-debug-helper

![](https://img.shields.io/npm/v/webgpu-debug-helper)

## A WebGPU debugging helper script

This script makes it easier to debug WebGPU apps.

note: this script is a work in progress. 

You can use it in your own projects via a script OR, you can
[use it as an extension](https://github.com/greggman/webgpu-dev-extension).

At the moment, if you want to use it to help debug workers, you'll need
to use this script version.

## What does it do?

* It makes as many errors as possible to return the line they happened on

  This is in contrast to normal WebGPU where errors are returned asynchronously
  and so the command that caused the error is long forgotten.

* It adds errors to command encoders and pass encoders (these throw)

  In normal WebGPU, command encoders and pass encoders often do not report errors.
  Rather, they record the error, mark the encoder as *invalid*, and then only report
  the error when the encoder is ended/finished. This can make it hard to find errors
  as they might have happened hundreds or thousands of calls ago.

  With this script, many of these types of errors will be generated immediately.

## Usage:

First off, I recommend [the extension](https://github.com/greggman/webgpu-dev-extension)
as it's just easier to use. Generally you don't want to run with this script enabled.
Rather, run your code as normal. When you see an error, if it's not obvious, turn
on this script via the extension and check the JavaScript console. You should see
messages with stacks. Click the links in the stacks to go to the code that generated
the error.

Otherwise, to use the script directly:

```js
import './webgpu-debug-helper.js';
```

or

```js
import 'https://greggman.github.io/webgpu-debug-helper/dist/0.x/webgpu-debug-helper.js';
```

or

```html
<script type="module" src="https://greggman.github.io/webgpu-debug-helper/dist/0.x/webgpu-debug-helper.js" crossorigin>
```

There is nothing else to do. The webgpu-debug-helper will wrap the WebGPU API and
start generating error messages. 

If you wanted to import programmatically you could do something like this

```js
if (debug) {
  await import('./webgpu-debug-helper.js');
}
```

## Development

Clone the repo and install it locally.

```bash
npm ci
npm run start
```

Now open the browser to `http://localhost:8080/test/timeout=0&src=true`

### Testing with three.js

If you have the [three.js repo](https://github.com/mrdoob/three.js)
install along side in a folder named `three.js` as in

```
+-somefolder
  +-webgpu-dev-extension
  +-three.js
```

Then `npm run test-threejs` will attempt to each of the three.js webgpu
examples and inject the helper. Ideally there should be no errors.

You can skip the first N tests with `-- --skip-count=<number>` (the first `--` is required).

## License

[MIT](LICENSE.md)

