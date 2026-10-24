/**
 * @astra/cli - astra.config.ts Configuration Schema
 * Matches Angular/Vite/esbuild application builder configuration properties.
 */

export interface AstraBudget {
  type: 'initial' | 'anyComponentStyle' | 'any' | 'bundle';
  maximumWarning?: string | number;
  maximumError?: string | number;
  baseline?: string | number;
}

export interface AstraBuildOptions {
  entry: string;
  outDir?: string;
  baseHref?: string;
  minify?: boolean;
  sourceMap?: boolean;
  contentHash?: boolean;
  statsJson?: boolean;
  fileReplacements?: { replace: string; with: string }[];
  budgets?: AstraBudget[];
  assets?: string[];
  tailwind?: boolean;
  ssr?: boolean;
  serviceWorker?: boolean;
}

export interface AstraServerOptions {
  port?: number;
  host?: string;
  open?: boolean;
  hmr?: boolean;
  errorOverlay?: boolean;
}

export interface AstraConfig {
  projectRoot?: string;
  build?: AstraBuildOptions;
  serve?: AstraServerOptions;
  environments?: Record<string, Partial<AstraBuildOptions>>;
}

export function defineConfig(config: AstraConfig): AstraConfig {
  return config;
}
