import path from 'path';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescriptPlugin from 'rollup-plugin-typescript2';
import versionInjector from 'rollup-plugin-version-injector';
import minimist from 'minimist';

const args = minimist(process.argv.slice(2));
const isProduction = args.configProduction;
import pkg from '../package.json';

const umdOutput = 'dist/rage-rpc.umd.js';

const onwarn = (msg, warn) => {
	if (!/Circular|The 'this' keyword/.test(msg)) {
		warn(msg);
	}
};

const createRollupConfig = () => {
	const output = {
		esm: {
			file: pkg.module,
			format: `es`
		},
		cjs: {
			file: pkg.main,
			format: `cjs`
		},
		umd: {
			file: umdOutput,
			format: 'umd',
			name: 'rpc'
		}
	};

	const packageFormats = Object.keys(output);
	return packageFormats.map((format) => createConfig(output[format]));
};

function createConfig(output) {
	return {
		input: path.resolve('src', 'index.ts'),
		output,
		plugins: [
			nodeResolve(),
			typescriptPlugin({
				tsconfig: path.resolve('src', 'tsconfig.json'),
				cacheRoot: path.resolve('node_modules', '.rts2_cache'),
				tsconfigOverride: {
					compilerOptions: {
						declaration: true,
						declarationMap: false
					}
				}
			}),
			versionInjector({
				injectInTags: {
					fileRegexp: /\.(js|mjs|html|css)$/
				},
				injectInComments: false
			})
		],
		inlineDynamicImports: true,
		onwarn
	};
}

export default createRollupConfig;
