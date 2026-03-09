import { defineConfig } from 'tsup';

export default defineConfig([
  // stdio entry point — CLI binary for npx / Claude Desktop
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    noExternal: ['@y0exchange/shared'],
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  // remote HTTP entry point — deployable web server for Claude connectors
  {
    entry: { remote: 'src/remote.ts' },
    format: ['esm'],
    dts: false,
    clean: false,
    sourcemap: true,
    noExternal: ['@y0exchange/shared'],
  },
]);
