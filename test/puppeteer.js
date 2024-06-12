#!/usr/bin/env node
/* eslint-env node */

import puppeteer from  'puppeteer';
import path from  'path';
import fs from 'fs';
import express from 'express';
import url from 'url';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));  // eslint-disable-line

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

const { server, port } = await startServer(3000, path.dirname(__dirname));
const servers = [server];

const tests = [
  {url: `http://localhost:${port}/test/index.html?reporter=spec`},
];

if (process.argv.includes('--threejs')) {
  const { server, port } = await startServer(3001, '../three.js');
  servers.push(server);

  const exampleInjectJS =
    fs.readFileSync('test/js/example-inject.js', {encoding: 'utf-8'}) +
    fs.readFileSync('dist/0.x/webgpu-debug-helper.js', {encoding: 'utf-8'});

  tests.length = 0;
  tests.push(...fs.readdirSync(path.join(__dirname, '..', '..', 'three.js', 'examples'))
    .filter(f => f.startsWith('webgpu_') && f.endsWith('.html'))
    .map(f => ({
      url: `http://localhost:${port}/examples/${f}`,
      js: exampleInjectJS,
    })));
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
  const browser = await puppeteer.launch();
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

  for (const {url, js} of tests) {
    waitingPromiseInfo = makePromiseInfo();
    console.log(`===== [ ${url} ] =====`);
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
  servers.forEach(s => s.close());

  process.exit(totalFailures ? 1 : 0);  // eslint-disable-line
}
