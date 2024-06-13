#!/usr/bin/env node
/* eslint-env node */

import puppeteer from  'puppeteer';
import path from  'path';
import fs from 'fs';
import express from 'express';
import url from 'url';
import { program } from 'commander';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));  // eslint-disable-line

const fixedParseInt = v => parseInt(v);

program
    .usage('[options] [path-to-serve]')
    .option('--skip-count <count>',  'num to skip', fixedParseInt, 0)
    .option('--threejs',             'test three.js examples')
    .option('--use-chrome',          'use chrome');

program.showHelpAfterError('(add --help for additional information)');
program.parse();

function startServer(port, dir) {
  return new Promise(resolve => {
    const app = express();
    app.use(express.static(dir));
    const server = app.listen(port, () => {
      console.log(`Example app listening on port ${port}!`);
      resolve({server, port});
    });
  });
}

const args = program.opts();

const rootDir = args.threejs
  ? '../three.js'
  : path.dirname(__dirname);
const { server, port } = await startServer(3000, rootDir);

const tests = [
  {url: `http://localhost:${port}/test/index.html?reporter=spec`},
];

if (args.threejs) {
  const exampleInjectJS =
    fs.readFileSync('test/js/example-inject.js', {encoding: 'utf-8'}) +
    fs.readFileSync('dist/0.x/webgpu-debug-helper.js', {encoding: 'utf-8'});

  // Some strange bug, even without webgpu-debug-helper these
  // examples fail in puppeteer.
  const skip = [
    'webgpu_instancing_morph.html',
    'webgpu_loader_gltf_compressed.html',
    'webgpu_materials.html',
    'webgpu_morphtargets.html',
    'webgpu_morphtargets_face.html',
    'webgpu_sandbox.html',
    'webgpu_video_panorama.html',
  ];

  tests.length = 0;  // clear tests
  tests.push(...fs.readdirSync(path.join(__dirname, '..', '..', 'three.js', 'examples'))
    .filter(f => f.startsWith('webgpu_') && f.endsWith('.html') && !skip.includes(f))
    .map((f, id) => ({
      url: `http://localhost:${port}/examples/${f}`,
      js: exampleInjectJS,
      id: id + 1,
    })));
  tests.splice(0, args.skipCount);
}

test(tests);

function makePromiseInfo() {
  const info = {};
  const promise = new Promise((resolve, reject) => {
    Object.assign(info, {resolve, reject});
  });
  info.promise = promise;
  return info;
}


async function test(tests) {
  const browser = await puppeteer.launch({
    headless: args.useChrome ? false : "new",
    ...(args.useChrome ?? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }),
    args: [
      '--enable-unsafe-webgpu',
      '--enable-webgpu-developer-features',
      //'--use-angle=swiftshader',
      '--user-agent=puppeteer',
    ],
  });
  const page = await browser.newPage();

  page.on('console', async e => {
    const args = await Promise.all(e.args().map(a => a.jsonValue()));
    console.log(...args);
  });

  let totalFailures = 0;
  let waitingPromiseInfo;

  // Get the "viewport" of the page, as reported by the page.
  page.on('domcontentloaded', async () => {
    const failures = await page.evaluate(() => {
      return window.testsPromiseInfo.promise;
    });

    totalFailures += failures;

    waitingPromiseInfo.resolve();
  });

  for (const {url, js, id} of tests) {
    waitingPromiseInfo = makePromiseInfo();
    console.log(`===== [ ${id ? `#${id}:` : ''} ${url} ] =====`);
    let newScriptEval;
    if (js) {
      newScriptEval = await page.evaluateOnNewDocument(js);
    }
    await page.goto(url);
    await page.waitForNetworkIdle();
    if (js) {
      await page.evaluate(() => {
        setTimeout(() => {
          window.testsPromiseInfo.resolve(0);
        }, 500);
      });
    }
    await waitingPromiseInfo.promise;
    if (js) {
      await page.removeScriptToEvaluateOnNewDocument(newScriptEval.identifier);
    }
  }

  await browser.close();
  server.close();

  process.exit(totalFailures ? 1 : 0);  // eslint-disable-line
}
