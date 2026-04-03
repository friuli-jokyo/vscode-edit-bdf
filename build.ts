/// <reference types="node" />

import { build } from "esbuild";

const production = process.argv.includes('--production');

build({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    minify: production,
    sourcemap: !production,
    platform: "node",
    target: "es2020",
    outfile: "dist/extension.js",
    external: ["vscode"],
})

build({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    minify: production,
    sourcemap: !production,
    platform: "browser",
    target: "es2020",
    outfile: "dist/web/extension.js",
    external: ["vscode"],
})
