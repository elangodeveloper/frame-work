import * as fs from 'node:fs';
import * as path from 'node:path';

export interface JarvisBudget {
  type: 'initial' | 'anyComponentStyle' | 'any' | 'bundle';
  maximumWarning?: string | number;
  maximumError?: string | number;
  baseline?: string | number;
}

export interface JarvisBuildConfig {
  entry?: string;
  index?: string;
  outputPath?: string;
  styles?: string[];
  assets?: string[];
  sourcemaps?: boolean;
  minify?: boolean;
  contentHash?: boolean;
  budgets?: JarvisBudget[];
  [key: string]: any;
}

export interface JarvisProjectConfig {
  name: string;
  root: string;
  sourceRoot: string;
  entry: string;
  index: string;
  assets: string[];
  styles: string[];
  outputPath: string;
  configurations?: {
    development?: Partial<JarvisBuildConfig>;
    production?: Partial<JarvisBuildConfig>;
    [key: string]: Partial<JarvisBuildConfig> | undefined;
  };
}

export interface JarvisWorkspaceConfig {
  $schema?: string;
  version?: number;
  projects?: Record<string, JarvisProjectConfig>;
  defaultProject?: string;
  name?: string;
  root?: string;
  sourceRoot?: string;
  entry?: string;
  index?: string;
  assets?: string[];
  styles?: string[];
  outputPath?: string;
  configurations?: {
    development?: Partial<JarvisBuildConfig>;
    production?: Partial<JarvisBuildConfig>;
    [key: string]: Partial<JarvisBuildConfig> | undefined;
  };
}

export function loadJarvisConfig(cwd: string = process.cwd()): JarvisProjectConfig {
  const configPath = path.join(cwd, 'jarvis.json');
  if (fs.existsSync(configPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (raw.projects && raw.defaultProject && raw.projects[raw.defaultProject]) {
        return raw.projects[raw.defaultProject];
      }
      return {
        name: raw.name || 'jarvis-app',
        root: raw.root || '',
        sourceRoot: raw.sourceRoot || 'src',
        entry: raw.entry || 'src/main.ts',
        index: raw.index || 'src/index.html',
        assets: raw.assets || ['public'],
        styles: raw.styles || ['src/styles.css'],
        outputPath: raw.outputPath || 'dist',
        configurations: raw.configurations || {},
      };
    } catch (e) {
      console.warn(`[JARVIS CLI] Warning: Failed to parse jarvis.json: ${e}`);
    }
  }

  return {
    name: 'jarvis-app',
    root: '',
    sourceRoot: 'src',
    entry: 'src/main.ts',
    index: 'src/index.html',
    assets: ['public'],
    styles: ['src/styles.css'],
    outputPath: 'dist',
    configurations: {
      development: { sourcemaps: true, minify: false },
      production: { sourcemaps: false, minify: true, contentHash: true },
    },
  };
}

// Deprecated aliases for backwards compatibility
export type AstraBudget = JarvisBudget;
export type AstraBuildOptions = JarvisBuildConfig;
export type AstraConfig = JarvisWorkspaceConfig;
export function defineConfig(config: JarvisWorkspaceConfig): JarvisWorkspaceConfig {
  return config;
}
