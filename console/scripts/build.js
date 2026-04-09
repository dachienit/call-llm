import esbuild from 'esbuild';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function build() {
    console.log('Bundling with esbuild...');

    // Bundle server.js
    await esbuild.build({
        entryPoints: ['bin/server.js'],
        bundle: true,
        platform: 'node',
        target: 'node18',
        outfile: 'dist/server.cjs',
        format: 'cjs', // pkg works best with CJS
        external: ['pkg', 'fsevents'], // Exclude pkg itself
        loader: { '.node': 'file' },
    });

    console.log('Bundling complete. Creating executable with pkg...');

    // Run pkg
    exec('pkg dist/server.cjs --target node18-win-x64 --output octo-console.exe', (error, stdout, stderr) => {
        if (error) {
            console.error(`pkg error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`pkg stderr: ${stderr}`);
        }
        console.log(`pkg stdout: ${stdout}`);
        console.log('Build complete! Executable created: octo-console.exe');
    });
}

build().catch(err => {
    console.error(err);
    process.exit(1);
});
