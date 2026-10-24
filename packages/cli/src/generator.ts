import * as fs from 'node:fs';
import * as path from 'node:path';

export interface GeneratorOptions {
  baseDir?: string;
  skipTests?: boolean;
  prefix?: string;
  styleExt?: string;
  force?: boolean;
}

export function toKebabCase(str: string): string {
  return path.basename(str)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function toPascalCase(str: string): string {
  const kebab = toKebabCase(str);
  return kebab.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeFile(filePath: string, content: string, force = false): void {
  if (fs.existsSync(filePath) && !force) {
    throw new Error(`[JARVIS CLI Error] File already exists: ${filePath}. Use --force to overwrite.`);
  }
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Generates an Object-Oriented Component with separate TS, HTML, CSS, and Spec files.
 */
export function generateComponent(targetPath: string, options: GeneratorOptions = {}): string[] {
  const baseDir = options.baseDir || process.cwd();
  const name = toKebabCase(targetPath);
  const className = toPascalCase(name) + 'Component';
  const selector = `${options.prefix || 'app'}-${name}`;
  const styleExt = options.styleExt || 'css';

  const outDir = path.resolve(baseDir, targetPath);
  ensureDir(outDir);

  const tsFile = path.join(outDir, `${name}.component.ts`);
  const htmlFile = path.join(outDir, `${name}.component.html`);
  const cssFile = path.join(outDir, `${name}.component.${styleExt}`);
  const specFile = path.join(outDir, `${name}.component.spec.ts`);

  const tsContent = [
    "import { Component, input, output, type OnInit, type OnDestroy } from '@jarvis/core';",
    "import { signal } from '@jarvis/reactive';",
    "",
    "@Component({",
    `  selector: '${selector}',`,
    `  templateUrl: './${name}.component.html',`,
    `  styleUrl: './${name}.component.${styleExt}',`,
    "})",
    `export class ${className} implements OnInit, OnDestroy {`,
    `  readonly title = signal('${toPascalCase(name)} Works!');`,
    "  readonly selected = output<string>();",
    "",
    "  onInit(): void {",
    "    // Lifecycle initialization",
    "  }",
    "",
    "  onSelect(): void {",
    "    this.selected.emit(this.title());",
    "  }",
    "",
    "  onDestroy(): void {",
    "    // Cleanup lifecycle",
    "  }",
    "}",
    ""
  ].join('\n');

  const htmlContent = [
    `<div class="${name}-container p-4 rounded-xl border border-slate-200">`,
    "  <h2 class=\"text-xl font-bold\">{{ title() }}</h2>",
    "  <button type=\"button\" (click)=\"onSelect()\" class=\"mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg\">",
    "    Select",
    "  </button>",
    "</div>",
    ""
  ].join('\n');

  const cssContent = [
    `.${name}-container {`,
    "  padding: var(--jarvis-space-4, 1rem);",
    "  border-radius: var(--jarvis-radius-md, 0.5rem);",
    "  background: var(--jarvis-surface, #ffffff);",
    "}",
    ""
  ].join('\n');

  const specContent = [
    "import { describe, it } from 'node:test';",
    "import * as assert from 'node:assert';",
    `import { ${className} } from './${name}.component.ts';`,
    "",
    `describe('${className}', () => {`,
    "  it('should instantiate and expose initial reactive title', () => {",
    `    const comp = new ${className}();`,
    `    assert.strictEqual(comp.title(), '${toPascalCase(name)} Works!');`,
    "  });",
    "",
    "  it('should emit selected event on onSelect()', () => {",
    `    const comp = new ${className}();`,
    "    let received = '';",
    "    comp.selected.subscribe((val) => { received = val; });",
    "    comp.onSelect();",
    `    assert.strictEqual(received, '${toPascalCase(name)} Works!');`,
    "  });",
    "});",
    ""
  ].join('\n');

  const createdFiles: string[] = [];

  writeFile(tsFile, tsContent, options.force);
  createdFiles.push(tsFile);

  writeFile(htmlFile, htmlContent, options.force);
  createdFiles.push(htmlFile);

  writeFile(cssFile, cssContent, options.force);
  createdFiles.push(cssFile);

  if (!options.skipTests) {
    writeFile(specFile, specContent, options.force);
    createdFiles.push(specFile);
  }

  return createdFiles;
}

/**
 * Generates an application Feature Page component with separate TS, HTML, CSS, and Spec files.
 */
export function generatePage(targetPath: string, options: GeneratorOptions = {}): string[] {
  const baseDir = options.baseDir || process.cwd();
  const name = toKebabCase(targetPath);
  const className = toPascalCase(name) + 'Page';
  const selector = `${options.prefix || 'app'}-${name}-page`;
  const styleExt = options.styleExt || 'css';

  const outDir = path.resolve(baseDir, targetPath);
  ensureDir(outDir);

  const tsFile = path.join(outDir, `${name}.page.ts`);
  const htmlFile = path.join(outDir, `${name}.page.html`);
  const cssFile = path.join(outDir, `${name}.page.${styleExt}`);
  const specFile = path.join(outDir, `${name}.page.spec.ts`);

  const tsContent = [
    "import { Component, type OnInit } from '@jarvis/core';",
    "import { signal } from '@jarvis/reactive';",
    "",
    "@Component({",
    `  selector: '${selector}',`,
    `  templateUrl: './${name}.page.html',`,
    `  styleUrl: './${name}.page.${styleExt}',`,
    "})",
    `export class ${className} implements OnInit {`,
    `  readonly pageTitle = signal('${toPascalCase(name)} Page');`,
    "",
    "  onInit(): void {}",
    "}",
    ""
  ].join('\n');

  const htmlContent = [
    `<main class="${name}-page max-w-7xl mx-auto p-6">`,
    "  <header class=\"mb-6\">",
    "    <h1 class=\"text-2xl font-bold text-slate-900\">{{ pageTitle() }}</h1>",
    "  </header>",
    "  <section class=\"content-area\">",
    "    <p class=\"text-slate-600\">Page content ready.</p>",
    "  </section>",
    "</main>",
    ""
  ].join('\n');

  const cssContent = [
    `.${name}-page {`,
    "  min-height: 100vh;",
    "}",
    ""
  ].join('\n');

  const specContent = [
    "import { describe, it } from 'node:test';",
    "import * as assert from 'node:assert';",
    `import { ${className} } from './${name}.page.ts';`,
    "",
    `describe('${className}', () => {`,
    "  it('should initialize page title', () => {",
    `    const page = new ${className}();`,
    `    assert.strictEqual(page.pageTitle(), '${toPascalCase(name)} Page');`,
    "  });",
    "});",
    ""
  ].join('\n');

  const createdFiles: string[] = [];
  writeFile(tsFile, tsContent, options.force);
  createdFiles.push(tsFile);

  writeFile(htmlFile, htmlContent, options.force);
  createdFiles.push(htmlFile);

  writeFile(cssFile, cssContent, options.force);
  createdFiles.push(cssFile);

  if (!options.skipTests) {
    writeFile(specFile, specContent, options.force);
    createdFiles.push(specFile);
  }

  return createdFiles;
}

/**
 * Generates an Injectable Service class and colocated Spec file.
 */
export function generateService(targetPath: string, options: GeneratorOptions = {}): string[] {
  const baseDir = options.baseDir || process.cwd();
  const name = toKebabCase(targetPath);
  const className = toPascalCase(name) + 'Service';
  const outDir = path.resolve(baseDir, path.dirname(targetPath));
  ensureDir(outDir);

  const serviceFile = path.join(outDir, `${name}.service.ts`);
  const specFile = path.join(outDir, `${name}.service.spec.ts`);

  const serviceContent = [
    "import { Injectable, inject } from '@jarvis/core';",
    "import { HttpClient } from '@jarvis/http';",
    "",
    "@Injectable()",
    `export class ${className} {`,
    "  private readonly http = inject(HttpClient);",
    "",
    "  fetchData(): string {",
    `    return '${className} operational';`,
    "  }",
    "}",
    ""
  ].join('\n');

  const specContent = [
    "import { describe, it } from 'node:test';",
    "import * as assert from 'node:assert';",
    `import { ${className} } from './${name}.service.ts';`,
    "",
    `describe('${className}', () => {`,
    "  it('should instantiate and return status message', () => {",
    `    const service = new ${className}();`,
    `    assert.strictEqual(service.fetchData(), '${className} operational');`,
    "  });",
    "});",
    ""
  ].join('\n');

  const createdFiles: string[] = [];
  writeFile(serviceFile, serviceContent, options.force);
  createdFiles.push(serviceFile);

  if (!options.skipTests) {
    writeFile(specFile, specContent, options.force);
    createdFiles.push(specFile);
  }

  return createdFiles;
}

/**
 * Generates a Directive class and Spec file.
 */
export function generateDirective(targetPath: string, options: GeneratorOptions = {}): string[] {
  const baseDir = options.baseDir || process.cwd();
  const name = toKebabCase(targetPath);
  const className = toPascalCase(name) + 'Directive';
  const selector = `[${options.prefix || 'app'}${toPascalCase(name)}]`;
  const outDir = path.resolve(baseDir, path.dirname(targetPath));
  ensureDir(outDir);

  const dirFile = path.join(outDir, `${name}.directive.ts`);
  const specFile = path.join(outDir, `${name}.directive.spec.ts`);

  const dirContent = [
    "import { Directive } from '@jarvis/core';",
    "",
    `@Directive({ selector: '${selector}' })`,
    `export class ${className} {`,
    "  attach(element: any): void {",
    "    // Attach behavior to DOM element",
    "  }",
    "}",
    ""
  ].join('\n');

  const specContent = [
    "import { describe, it } from 'node:test';",
    "import * as assert from 'node:assert';",
    `import { ${className} } from './${name}.directive.ts';`,
    "",
    `describe('${className}', () => {`,
    "  it('should instantiate successfully', () => {",
    `    const directive = new ${className}();`,
    "    assert.ok(directive);",
    "  });",
    "});",
    ""
  ].join('\n');

  const createdFiles: string[] = [];
  writeFile(dirFile, dirContent, options.force);
  createdFiles.push(dirFile);

  if (!options.skipTests) {
    writeFile(specFile, specContent, options.force);
    createdFiles.push(specFile);
  }

  return createdFiles;
}

/**
 * Generates a Pipe class and Spec file.
 */
export function generatePipe(targetPath: string, options: GeneratorOptions = {}): string[] {
  const baseDir = options.baseDir || process.cwd();
  const name = toKebabCase(targetPath);
  const className = toPascalCase(name) + 'Pipe';
  const pipeName = toCamelCase(name);
  const outDir = path.resolve(baseDir, path.dirname(targetPath));
  ensureDir(outDir);

  const pipeFile = path.join(outDir, `${name}.pipe.ts`);
  const specFile = path.join(outDir, `${name}.pipe.spec.ts`);

  const pipeContent = [
    "import { Pipe, type PipeTransform } from '@jarvis/core';",
    "",
    `@Pipe({ name: '${pipeName}' })`,
    `export class ${className} implements PipeTransform {`,
    "  transform(value: any, ...args: any[]): any {",
    "    return value;",
    "  }",
    "}",
    ""
  ].join('\n');

  const specContent = [
    "import { describe, it } from 'node:test';",
    "import * as assert from 'node:assert';",
    `import { ${className} } from './${name}.pipe.ts';`,
    "",
    `describe('${className}', () => {`,
    "  it('should transform identity values', () => {",
    `    const pipe = new ${className}();`,
    "    assert.strictEqual(pipe.transform('JARVIS'), 'JARVIS');",
    "  });",
    "});",
    ""
  ].join('\n');

  const createdFiles: string[] = [];
  writeFile(pipeFile, pipeContent, options.force);
  createdFiles.push(pipeFile);

  if (!options.skipTests) {
    writeFile(specFile, specContent, options.force);
    createdFiles.push(specFile);
  }

  return createdFiles;
}

/**
 * Generates a Route Guard function/class.
 */
export function generateGuard(targetPath: string, options: GeneratorOptions = {}): string[] {
  const baseDir = options.baseDir || process.cwd();
  const name = toKebabCase(targetPath);
  const functionName = `${toCamelCase(name)}Guard`;
  const outDir = path.resolve(baseDir, path.dirname(targetPath));
  ensureDir(outDir);

  const guardFile = path.join(outDir, `${name}.guard.ts`);
  const specFile = path.join(outDir, `${name}.guard.spec.ts`);

  const guardContent = [
    "import { inject } from '@jarvis/core';",
    "import { Router, type CanActivateFn } from '@jarvis/router';",
    "",
    `export const ${functionName}: CanActivateFn = (route, state) => {`,
    "  const router = inject(Router);",
    "  // Verify authentication or permission criteria",
    "  return true;",
    "};",
    ""
  ].join('\n');

  const specContent = [
    "import { describe, it } from 'node:test';",
    "import * as assert from 'node:assert';",
    `import { ${functionName} } from './${name}.guard.ts';`,
    "",
    `describe('${functionName}', () => {`,
    "  it('should return true for allowed routes', () => {",
    `    const res = ${functionName}({} as any, {} as any);`,
    "    assert.strictEqual(res, true);",
    "  });",
    "});",
    ""
  ].join('\n');

  const createdFiles: string[] = [];
  writeFile(guardFile, guardContent, options.force);
  createdFiles.push(guardFile);

  if (!options.skipTests) {
    writeFile(specFile, specContent, options.force);
    createdFiles.push(specFile);
  }

  return createdFiles;
}

/**
 * Generates a Domain Model type/interface.
 */
export function generateModel(targetPath: string, options: GeneratorOptions = {}): string[] {
  const baseDir = options.baseDir || process.cwd();
  const name = toKebabCase(targetPath);
  const typeName = toPascalCase(name);
  const outDir = path.resolve(baseDir, path.dirname(targetPath));
  ensureDir(outDir);

  const modelFile = path.join(outDir, `${name}.model.ts`);

  const modelContent = [
    `export interface ${typeName} {`,
    "  id: string;",
    "  name: string;",
    "  createdAt: string;",
    "  active: boolean;",
    "}",
    ""
  ].join('\n');

  writeFile(modelFile, modelContent, options.force);
  return [modelFile];
}

/**
 * Generates an OO Repository class with an explicit interface (Dependency Inversion).
 */
export function generateRepository(targetPath: string, options: GeneratorOptions = {}): string[] {
  const baseDir = options.baseDir || process.cwd();
  const name = toKebabCase(targetPath);
  const typeName = toPascalCase(name);
  const interfaceName = `${typeName}Repository`;
  const className = `Http${typeName}Repository`;

  const outDir = path.resolve(baseDir, path.dirname(targetPath));
  ensureDir(outDir);

  const interfaceFile = path.join(outDir, `${name}-repository.interface.ts`);
  const repoFile = path.join(outDir, `${name}.repository.ts`);

  const interfaceContent = [
    `export interface ${interfaceName} {`,
    "  findById(id: string): Promise<any>;",
    "  findAll(): Promise<any[]>;",
    "  save(entity: any): Promise<void>;",
    "  delete(id: string): Promise<void>;",
    "}",
    ""
  ].join('\n');

  const repoContent = [
    "import { Injectable, inject } from '@jarvis/core';",
    "import { HttpClient } from '@jarvis/http';",
    `import type { ${interfaceName} } from './${name}-repository.interface.ts';`,
    "",
    "@Injectable()",
    `export class ${className} implements ${interfaceName} {`,
    "  private readonly http = inject(HttpClient);",
    "",
    "  async findById(id: string): Promise<any> {",
    `    return { id, status: 'loaded' };`,
    "  }",
    "",
    "  async findAll(): Promise<any[]> {",
    "    return [];",
    "  }",
    "",
    "  async save(entity: any): Promise<void> {}",
    "",
    "  async delete(id: string): Promise<void> {}",
    "}",
    ""
  ].join('\n');

  const createdFiles: string[] = [];
  writeFile(interfaceFile, interfaceContent, options.force);
  createdFiles.push(interfaceFile);

  writeFile(repoFile, repoContent, options.force);
  createdFiles.push(repoFile);

  return createdFiles;
}

export function generateResolver(targetPath: string, options: GeneratorOptions = {}): string[] {
  const baseDir = options.baseDir || process.cwd();
  const name = toKebabCase(targetPath);
  const camelName = toCamelCase(name);
  const outDir = path.resolve(baseDir, path.dirname(targetPath));
  ensureDir(outDir);

  const resolverFile = path.join(outDir, `${name}.resolver.ts`);
  const specFile = path.join(outDir, `${name}.resolver.spec.ts`);
  const created: string[] = [];

  const content = [
    "import type { ResolveFn } from '@jarvis/router';",
    "",
    `export const ${camelName}Resolver: ResolveFn<any> = async (route) => {`,
    "  return { id: route.params.id };",
    "};",
    "",
  ].join('\n');
  writeFile(resolverFile, content, options.force);
  created.push(resolverFile);

  if (!options.skipTests) {
    const specContent = [
      "import { describe, it, expect } from 'vitest';",
      `import { ${camelName}Resolver } from './${name}.resolver.ts';`,
      "",
      `describe('${camelName}Resolver', () => {`,
      "  it('should resolve route data', async () => {",
      `    const res = await (${camelName}Resolver as any)({ params: { id: '1' } }, {});`,
      "    expect(res).toBeDefined();",
      "  });",
      "});",
      "",
    ].join('\n');
    writeFile(specFile, specContent, options.force);
    created.push(specFile);
  }

  return created;
}

export function generateRoutes(targetPath: string, options: GeneratorOptions = {}): string[] {
  const baseDir = options.baseDir || process.cwd();
  const name = toKebabCase(targetPath);
  const constName = name.replace(/-/g, '_').toUpperCase() + '_ROUTES';
  const outDir = path.resolve(baseDir, path.dirname(targetPath));
  ensureDir(outDir);

  const routesFile = path.join(outDir, `${name}.routes.ts`);
  const content = [
    "import type { Routes } from '@jarvis/router';",
    "",
    `export const ${constName}: Routes = [`,
    "  { path: '', pathMatch: 'full', redirectTo: 'list' },",
    "];",
    "",
  ].join('\n');
  writeFile(routesFile, content, options.force);
  return [routesFile];
}

/**
 * Creates a complete Angular-inspired, feature-based JARVIS application tree.
 */
export function createApp(appName: string, targetDir?: string, options: GeneratorOptions = {}): string[] {
  const rootDir = targetDir || path.resolve(process.cwd(), appName);
  ensureDir(rootDir);

  const createdFiles: string[] = [];

  // 1. Root configuration files
  const packageJson = {
    name: appName,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'jarvis dev',
      build: 'jarvis build',
      test: 'node --test src/**/*.spec.ts',
    },
    dependencies: {
      '@jarvis/core': '^0.1.0',
      '@jarvis/reactive': '^0.1.0',
      '@jarvis/renderer': '^0.1.0',
      '@jarvis/router': '^0.1.0',
      '@jarvis/http': '^0.1.0',
      '@jarvis/styles': '^0.1.0',
    },
  };
  const pkgPath = path.join(rootDir, 'package.json');
  writeFile(pkgPath, JSON.stringify(packageJson, null, 2), options.force);
  createdFiles.push(pkgPath);

  const jarvisConfig = [
    "export default {",
    "  entry: 'src/main.ts',",
    "  outDir: 'dist',",
    "  baseHref: '/',",
    "  minify: true,",
    "  sourceMap: true,",
    "  contentHash: true,",
    "};",
    ""
  ].join('\n');
  const cfgPath = path.join(rootDir, 'jarvis.config.ts');
  writeFile(cfgPath, jarvisConfig, options.force);
  createdFiles.push(cfgPath);

  const indexHtml = [
    "<!DOCTYPE html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"utf-8\" />",
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    `  <title>${toPascalCase(appName)}</title>`,
    "  <link rel=\"stylesheet\" href=\"./src/styles/styles.css\" />",
    "</head>",
    "<body>",
    "  <div id=\"app\"></div>",
    "  <script type=\"module\" src=\"./src/main.ts\"></script>",
    "</body>",
    "</html>",
    ""
  ].join('\n');
  const htmlPath = path.join(rootDir, 'index.html');
  writeFile(htmlPath, indexHtml, options.force);
  createdFiles.push(htmlPath);

  // 2. Centralized Styles
  const stylesDir = path.join(rootDir, 'src', 'styles');
  ensureDir(stylesDir);

  const stylesCss = [
    "@import './tokens.css';",
    "@import './themes.css';",
    "",
    "/* Centralized Global Styles */",
    "body {",
    "  margin: 0;",
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
    "  background-color: var(--jarvis-surface-ground, #f8fafc);",
    "  color: var(--jarvis-text-color, #1e293b);",
    "}",
    ""
  ].join('\n');
  const stylesPath = path.join(stylesDir, 'styles.css');
  writeFile(stylesPath, stylesCss, options.force);
  createdFiles.push(stylesPath);

  const tokensCss = [
    ":root {",
    "  --jarvis-primary: #4f46e5;",
    "  --jarvis-primary-hover: #4338ca;",
    "  --jarvis-surface: #ffffff;",
    "  --jarvis-surface-ground: #f8fafc;",
    "  --jarvis-border: #e2e8f0;",
    "  --jarvis-radius-sm: 0.25rem;",
    "  --jarvis-radius-md: 0.5rem;",
    "  --jarvis-radius-lg: 0.75rem;",
    "  --jarvis-space-2: 0.5rem;",
    "  --jarvis-space-4: 1rem;",
    "  --jarvis-space-6: 1.5rem;",
    "}",
    ""
  ].join('\n');
  const tokensPath = path.join(stylesDir, 'tokens.css');
  writeFile(tokensPath, tokensCss, options.force);
  createdFiles.push(tokensPath);

  const themesCss = [
    "/* Theme presets (Aura, Lara, Dark overrides) */",
    "[data-theme=\"dark\"] {",
    "  --jarvis-surface: #0f172a;",
    "  --jarvis-surface-ground: #020617;",
    "  --jarvis-border: #1e293b;",
    "  --jarvis-text-color: #f8fafc;",
    "}",
    ""
  ].join('\n');
  const themesPath = path.join(stylesDir, 'themes.css');
  writeFile(themesPath, themesCss, options.force);
  createdFiles.push(themesPath);

  // 3. Root App Component
  const appDir = path.join(rootDir, 'src', 'app');
  ensureDir(appDir);

  const appCompTs = [
    "import { Component } from '@jarvis/core';",
    "import { signal } from '@jarvis/reactive';",
    "",
    "@Component({",
    "  selector: 'app-root',",
    "  templateUrl: './app.component.html',",
    "  styleUrl: './app.component.css',",
    "})",
    "export class AppComponent {",
    `  readonly title = signal('${toPascalCase(appName)}');`,
    "}",
    ""
  ].join('\n');
  const appCompTsPath = path.join(appDir, 'app.component.ts');
  writeFile(appCompTsPath, appCompTs, options.force);
  createdFiles.push(appCompTsPath);

  const appCompHtml = [
    "<div class=\"app-layout\">",
    "  <header class=\"app-header\">",
    "    <h1 class=\"text-2xl font-bold\">{{ title() }}</h1>",
    "  </header>",
    "  <main class=\"app-content\">",
    "    <div id=\"router-outlet\"></div>",
    "  </main>",
    "</div>",
    ""
  ].join('\n');
  const appCompHtmlPath = path.join(appDir, 'app.component.html');
  writeFile(appCompHtmlPath, appCompHtml, options.force);
  createdFiles.push(appCompHtmlPath);

  const appCompCss = [
    ".app-layout {",
    "  display: flex;",
    "  flex-direction: column;",
    "  min-height: 100vh;",
    "}",
    ".app-header {",
    "  padding: 1rem 2rem;",
    "  background: var(--jarvis-surface);",
    "  border-bottom: 1px solid var(--jarvis-border);",
    "}",
    ".app-content {",
    "  padding: 2rem;",
    "  flex: 1;",
    "}",
    ""
  ].join('\n');
  const appCompCssPath = path.join(appDir, 'app.component.css');
  writeFile(appCompCssPath, appCompCss, options.force);
  createdFiles.push(appCompCssPath);

  const appRoutesTs = [
    "import type { Route } from '@jarvis/router';",
    "",
    "export const routes: Route[] = [",
    "  {",
    "    path: '',",
    "    redirectTo: 'employees',",
    "    pathMatch: 'full',",
    "  },",
    "  {",
    "    path: 'employees',",
    "    loadChildren: () => import('../features/employees/employees.routes.ts').then(m => m.employeeRoutes),",
    "  },",
    "];",
    ""
  ].join('\n');
  const appRoutesPath = path.join(appDir, 'app.routes.ts');
  writeFile(appRoutesPath, appRoutesTs, options.force);
  createdFiles.push(appRoutesPath);

  // 4. Application Entrypoint
  const mainTs = [
    "import { bootstrap } from '@jarvis/runtime';",
    "import { provideRouter } from '@jarvis/router';",
    "import { AppComponent } from './app/app.component.ts';",
    "import { routes } from './app/app.routes.ts';",
    "",
    "const container = document.getElementById('app');",
    "if (container) {",
    "  provideRouter(routes);",
    "  bootstrap(AppComponent, container);",
    "}",
    ""
  ].join('\n');
  const mainPath = path.join(rootDir, 'src', 'main.ts');
  writeFile(mainPath, mainTs, options.force);
  createdFiles.push(mainPath);

  // 5. Initial Feature (Employees)
  const featureDir = path.join(rootDir, 'src', 'features', 'employees');
  ensureDir(featureDir);

  const empRoutes = [
    "import type { Route } from '@jarvis/router';",
    "import { EmployeeListPage } from './pages/employee-list/employee-list.page.ts';",
    "",
    "export const employeeRoutes: Route[] = [",
    "  {",
    "    path: '',",
    "    component: EmployeeListPage,",
    "  },",
    "];",
    ""
  ].join('\n');
  const empRoutesPath = path.join(featureDir, 'employees.routes.ts');
  writeFile(empRoutesPath, empRoutes, options.force);
  createdFiles.push(empRoutesPath);

  // Generate feature page, component, model, and repository
  const pageFiles = generatePage('src/features/employees/pages/employee-list', { baseDir: rootDir, force: options.force });
  createdFiles.push(...pageFiles);

  const compFiles = generateComponent('src/features/employees/components/employee-card', { baseDir: rootDir, force: options.force });
  createdFiles.push(...compFiles);

  const modelFiles = generateModel('src/features/employees/models/employee', { baseDir: rootDir, force: options.force });
  createdFiles.push(...modelFiles);

  const repoFiles = generateRepository('src/features/employees/repositories/employee', { baseDir: rootDir, force: options.force });
  createdFiles.push(...repoFiles);

  return createdFiles;
}

/**
 * Copies the canonical templates/app project template and configures appName.
 */
export function createNewApp(appName: string, targetDir?: string, options: GeneratorOptions = {}): string[] {
  const rootDir = targetDir || path.resolve(process.cwd(), appName);
  ensureDir(rootDir);

  const createdFiles: string[] = [];
  const candidates = [
    path.resolve(process.cwd(), 'templates', 'app'),
    path.resolve(process.cwd(), '..', 'templates', 'app'),
    path.resolve(process.cwd(), '..', '..', 'templates', 'app'),
  ];
  const templateDir = candidates.find((p) => fs.existsSync(p));

  if (templateDir) {
    function copyRecursive(src: string, dest: string) {
      ensureDir(dest);
      for (const item of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, item.name);
        const destPath = path.join(dest, item.name);
        if (item.isDirectory()) {
          copyRecursive(srcPath, destPath);
        } else {
          if (!fs.existsSync(destPath) || options.force) {
            fs.copyFileSync(srcPath, destPath);
            createdFiles.push(destPath);
          }
        }
      }
    }
    copyRecursive(templateDir, rootDir);

    const pkgPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        pkg.name = appName;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
      } catch {}
    }
    return createdFiles;
  }

  return createApp(appName, targetDir, options);
}

