import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from "@rollup/plugin-node-resolve";
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('package.json', {encoding: 'utf8'}));
const name = pkg.name;
const banner = `/* ${name}@${pkg.version}, license MIT */`;
const major = pkg.version.split('.')[0];
const dist = `dist/${major}.x`;

const plugins = [
    nodeResolve(),
    typescript({ tsconfig: './tsconfig.json' }),
];

export default [
    {
        input: `src/${name}.ts`,
        output: [
            {
                file: `${dist}/${name}.js`,
                format: 'umd',
                sourcemap: true,
                freeze: false,
                banner,
            },
        ],
        plugins,
    },
    {
        input: `src/error-scope-wrapper.ts`,
        output: [
            {
                file: `show-errors/show-errors.js`,
                format: 'umd',
                sourcemap: false,
                freeze: false,
                banner: `/* show-errors@${pkg.version}, license MIT */`,
            },
        ],
        plugins,
    },
];
