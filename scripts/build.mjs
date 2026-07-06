import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const header = readFileSync(join(root, 'src/userscript.header.js'), 'utf8').trim();
const outDir = join(root, 'dist');
const outFile = join(outDir, 'AI-Token-Tracker.user.js');

async function build() {
    mkdirSync(outDir, { recursive: true });

    const result = await esbuild.build({
        entryPoints: [join(root, 'src/index.js')],
        bundle: true,
        format: 'iife',
        platform: 'browser',
        target: ['es2018'],
        write: false,
        legalComments: 'none'
    });

    const body = result.outputFiles[0].text;
    writeFileSync(outFile, header + '\n\n' + body + '\n', 'utf8');
    console.log('Built', outFile);
}

const watch = process.argv.includes('--watch');
if (watch) {
    const ctx = await esbuild.context({
        entryPoints: [join(root, 'src/index.js')],
        bundle: true,
        format: 'iife',
        platform: 'browser',
        target: ['es2018'],
        write: false,
        legalComments: 'none',
        plugins: [{
            name: 'userscript-banner',
            setup(build) {
                build.onEnd(async () => {
                    await build();
                });
            }
        }]
    });
    await ctx.watch();
    await build();
    console.log('Watching...');
} else {
    await build();
}
