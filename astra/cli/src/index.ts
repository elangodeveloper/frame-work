#!/usr/bin/env node

/**
 * JARVIS Framework CLI
 */

import {
  createApp,
  generateComponent,
  generatePage,
  generateService,
  generateDirective,
  generatePipe,
  generateGuard,
  generateModel,
  generateRepository,
  type GeneratorOptions,
} from './generator.ts';

export * from './generator.ts';

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'help' || command === '--help' || command === '-h') {
  console.log(`
✅ JARVIS Framework CLI v0.1.0

Usage:
  jarvis create app <name> [--force]
  jarvis generate component <name> [--skip-tests] [--prefix <name>] [--style <css|scss>]
  jarvis generate page <name> [--skip-tests]
  jarvis generate service <name> [--skip-tests]
  jarvis generate directive <name> [--skip-tests]
  jarvis generate pipe <name> [--skip-tests]
  jarvis generate guard <name> [--skip-tests]
  jarvis generate model <name>
  jarvis generate repository <name>
  jarvis build
  jarvis dev
  jarvis test
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

try {
  switch (command) {
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
        console.error('Usage: jarvis generate <component|page|service|directive|pipe|guard|model|repository> <name>');
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

        case 'directive':
        case 'd':
          generated = generateDirective(targetName, options);
          break;

        case 'pipe':
          generated = generatePipe(targetName, options);
          break;

        case 'guard':
          generated = generateGuard(targetName, options);
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

    case 'build':
      console.log('[JARVIS CLI] Running AOT build...');
      break;

    case 'dev':
      console.log('[JARVIS CLI] Starting dev server...');
      break;

    case 'test':
      console.log('[JARVIS CLI] Executing tests...');
      break;

    default:
      if (command) {
        console.log(`[JARVIS CLI] Unknown command: ${command}`);
      }
  }
} catch (err: any) {
  console.error(`[JARVIS CLI Error] ${err.message || String(err)}`);
  process.exit(1);
}
