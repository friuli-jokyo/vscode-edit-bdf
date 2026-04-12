/// <reference types="node" />

import { context } from "esbuild";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * This plugin hooks into the build process to print errors in a format that the problem matcher in
 * Visual Studio Code can understand.
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',

  setup(build: any) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd((result: any) => {
      result.errors.forEach(({ text, location }: { text: any; location: any }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location == null) return;
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log('[watch] build finished');
    });
  }
};

const nodeCtx = await context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    minify: production,
    sourcemap: !production,
    platform: "node",
    target: "es2020",
    outfile: "dist/extension.js",
    external: ["vscode"],
    plugins: [esbuildProblemMatcherPlugin],
});

const webCtx = await context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    platform: "browser",
    target: "es2020",
    outfile: "dist/web/extension.js",
    external: ["vscode"],
    plugins: [
        NodeGlobalsPolyfillPlugin({
            buffer: true,
            process: true,
        }),
        esbuildProblemMatcherPlugin,
    ],
});

const webViewEntryPoints = [
    "src/webview/glyph-list-view.ts",
];

const webViewBuilds = await Promise.all(webViewEntryPoints.map((entry) => {
    return context({
        entryPoints: [entry],
        bundle: true,
        format: 'iife',
        minify: production,
        sourcemap: !production,
        platform: "browser",
        target: "es2020",
        outfile: `dist/webview/${entry.split('/').slice(-1)[0].replace('.ts', '.js')}`,
        external: ["vscode"],
        plugins: [esbuildProblemMatcherPlugin],
        loader: {
            ".woff": "file",
            ".woff2": "file",
        }
    });
}));


if (watch) {
    Promise.all([nodeCtx.watch(), webCtx.watch(), ...webViewBuilds.map((ctx) => ctx.watch())]);
} else {
    await nodeCtx.rebuild();
    await nodeCtx.dispose();

    await webCtx.rebuild();
    await webCtx.dispose();

    for (const ctx of webViewBuilds) {
        await ctx.rebuild();
        await ctx.dispose();
    }
}
