#!/usr/bin/env node

/**
 * JARVIS Framework CLI
 */

import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  createApp,
  createNewApp,
  generateComponent,
  generatePage,
  generateService,
  generateDirective,
  generatePipe,
  generateGuard,
  generateResolver,
  generateRoutes,
  generateModel,
  generateRepository,
  type GeneratorOptions,
} from './generator.ts';
import { serveApp, buildApp } from './builder.ts';
import { lintProject } from './linter.ts';

export * from './generator.ts';
export * from './builder.ts';
export * from './linter.ts';
export * from './config.ts';

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'help' || command === '--help' || command === '-h') {
  console.log(`
⚡ JARVIS Framework CLI v0.1.0

Usage:
  jarvis new <name>                                Create a new Angular-like Jarvis application
  jarvis serve [--port 4200] [--open]              Start fast compiler-mode dev server with HMR
  jarvis build [--configuration production] [--watch] AOT compile application for production/dev
  jarvis test [--watch]                            Run application tests with Vitest/Node test runner
  jarvis lint                                      Enforce naming rules, standalone components, no cycles
  jarvis generate <schematic> <name>               Generate component, service, guard, resolver, routes, etc.

Schematics for generate (or alias 'g'):
  component (c)       routes
  service (s)         pipe
  guard               directive (d)
  resolver            model (m)
`);
  if (!process.env.JARVIS_TEST_RUN) {
    process.exit(0);
  }
}

function parseOptions(rawArgs: string[]): GeneratorOptions {
  const options: GeneratorOptions = {
    skipTests: rawArgs.includes('--skip-tests'),
    force: rawArgs.includes('--force'),
  };

  const prefixIdx = rawArgs.indexOf('--prefix');
  if (prefixIdx !== -1 && rawArgs[prefixIdx + 1]) {
    options.prefix = rawArgs[prefixIdx + 1];
  }

  const styleIdx = rawArgs.indexOf('--style');
  if (styleIdx !== -1 && rawArgs[styleIdx + 1]) {
    options.styleExt = rawArgs[styleIdx + 1];
  }

  return options;
}

async function main() {
  try {
    switch (command) {
      case 'new': {
        const appName = args[1];
        if (!appName) {
          console.error('Error: Please provide an application name. Usage: jarvis new <name>');
          process.exit(1);
        }
        const options = parseOptions(args);
        console.log(`[JARVIS CLI] Creating application '${appName}' from template...`);
        const files = createNewApp(appName, undefined, options);
        console.log(`[JARVIS CLI] Successfully created application '${appName}' (${files.length} files)!`);
        console.log(`\nNext steps:`);
        console.log(`  cd ${appName}`);
        console.log(`  jarvis serve\n`);
        break;
      }

      case 'create': {
        const type = args[1];
        const appName = args[2] || 'jarvis-app';
        if (type === 'app') {
          const options = parseOptions(args);
          console.log(`[JARVIS CLI] Scaffolding new application: ${appName}`);
          const files = createApp(appName, undefined, options);
          console.log(`[JARVIS CLI] Successfully created ${files.length} files for '${appName}'!`);
        } else {
          console.error(`Unknown create target: ${type}. Usage: jarvis create app <name>`);
        }
        break;
      }

      case 'generate':
      case 'g': {
        const schematic = args[1];
        const targetName = args[2];
        const options = parseOptions(args);

        if (!schematic || !targetName) {
          console.error('Usage: jarvis generate <component|service|guard|resolver|pipe|directive|routes> <name>');
          process.exit(1);
        }

        let generated: string[] = [];

        switch (schematic) {
          case 'component':
          case 'c':
            generated = generateComponent(targetName, options);
            break;

          case 'page':
          case 'p':
            generated = generatePage(targetName, options);
            break;

          case 'service':
          case 's':
            generated = generateService(targetName, options);
            break;

          case 'guard':
            generated = generateGuard(targetName, options);
            break;

          case 'resolver':
            generated = generateResolver(targetName, options);
            break;

          case 'routes':
            generated = generateRoutes(targetName, options);
            break;

          case 'directive':
          case 'd':
            generated = generateDirective(targetName, options);
            break;

          case 'pipe':
            generated = generatePipe(targetName, options);
            break;

          case 'model':
          case 'm':
            generated = generateModel(targetName, options);
            break;

          case 'repository':
          case 'repo':
            generated = generateRepository(targetName, options);
            break;

          default:
            console.error(`[JARVIS CLI] Unknown schematic: ${schematic}`);
            process.exit(1);
        }

        console.log(`[JARVIS CLI] Generated ${schematic} '${targetName}':`);
        for (const file of generated) {
          console.log(`  + ${file}`);
        }
        break;
      }

      case 'serve':
      case 'dev': {
        let port = 4200;
        const portIdx = args.indexOf('--port');
        if (portIdx !== -1 && args[portIdx + 1]) {
          port = parseInt(args[portIdx + 1], 10) || 4200;
        }
        const open = args.includes('--open');
        await serveApp({ port, open });
        break;
      }

      case 'build': {
        let configuration = 'production';
        const configIdx = args.indexOf('--configuration');
        if (configIdx !== -1 && args[configIdx + 1]) {
          configuration = args[configIdx + 1];
        }
        const watch = args.includes('--watch');
        const res = await buildApp({ configuration, watch });
        if (res.success) {
          console.log(`\x1b[32m✔\x1b[0m [JARVIS Build] Application build completed successfully!`);
          for (const c of res.chunks) {
            console.log(`  - ${c.name} (${c.size} bytes)`);
          }
        } else {
          console.error(`\x1b[31m✖\x1b[0m [JARVIS Build] Build failed:`, res.errors);
          process.exit(1);
        }
        break;
      }

      case 'lint': {
        console.log(`[JARVIS Linter] Checking code conventions, standalone rules, and circular dependencies...`);
        const result = lintProject(process.cwd());
        if (result.valid) {
          console.log(`\x1b[32m✔\x1b[0m All ${result.filesChecked} files passed Jarvis linting without issues!`);
        } else {
          console.error(`\x1b[31m✖\x1b[0m Found ${result.diagnostics.length} lint issue(s):`);
          for (const d of result.diagnostics) {
            console.error(`  - \x1b[33m${d.file}\x1b[0m [${d.rule}]: ${d.message}`);
          }
          process.exit(1);
        }
        break;
      }

      case 'test': {
        const watch = args.includes('--watch');
        const vitestConfig = path.resolve(process.cwd(), 'vitest.config.ts');
        const pkgJson = path.resolve(process.cwd(), 'package.json');
        let useVitest = false;

        if (fs.existsSync(pkgJson)) {
          const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
          if (pkg.devDependencies?.vitest || pkg.dependencies?.vitest) {
            useVitest = true;
          }
        }

        if (useVitest) {
          console.log(`[JARVIS Test] Running tests via Vitest...`);
          const vitestArgs = ['vitest'];
          if (!watch) vitestArgs.push('run');
          const child = spawn('npx', vitestArgs, { stdio: 'inherit', shell: true });
          child.on('exit', (code) => process.exit(code || 0));
        } else {
          console.log(`[JARVIS Test] Running tests via Node test runner...`);
          const child = spawn('node', ['--test', 'src/**/*.spec.ts', 'tests/**/*.test.ts'], { stdio: 'inherit', shell: true });
          child.on('exit', (code) => process.exit(code || 0));
        }
        break;
      }

      default:
        if (command) {
          console.log(`[JARVIS CLI] Unknown command: ${command}`);
        }
    }
  } catch (err: any) {
    console.error(`[JARVIS CLI Error] ${err.message || String(err)}`);
    process.exit(1);
  }
}

if (!process.env.JARVIS_TEST_RUN) {
  main();
}
