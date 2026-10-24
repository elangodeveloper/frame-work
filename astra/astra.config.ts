import { defineConfig } from './cli/src/config.ts';

export default defineConfig({
  projectRoot: '.',
  build: {
    entry: 'examples/03-router-primeng-tailwind/app.ts',
    outDir: 'dist',
    baseHref: '/',
    minify: true,
    sourceMap: true,
    contentHash: true,
    statsJson: true,
    budgets: [
      { type: 'initial', maximumWarning: '500kb', maximumError: '1mb' },
      { type: 'any', maximumWarning: '250kb', maximumError: '500kb' },
    ],
  },
  serve: {
    port: 4200,
    hmr: true,
    errorOverlay: true,
  },
  environments: {
    production: {
      minify: true,
      sourceMap: false,
      fileReplacements: [
        { replace: 'environments/environment.ts', with: 'environments/environment.prod.ts' },
      ],
    },
  },
});
