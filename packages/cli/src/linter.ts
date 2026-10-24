import * as fs from 'node:fs';
import * as path from 'node:path';

export interface LintDiagnostic {
  file: string;
  rule: string;
  message: string;
  line?: number;
}

export interface LintResult {
  valid: boolean;
  diagnostics: LintDiagnostic[];
  filesChecked: number;
}

const ALLOWED_SUFFIXES = [
  '.component.ts',
  '.component.html',
  '.component.css',
  '.component.spec.ts',
  '.service.ts',
  '.service.spec.ts',
  '.guard.ts',
  '.guard.spec.ts',
  '.resolver.ts',
  '.resolver.spec.ts',
  '.interceptor.ts',
  '.interceptor.spec.ts',
  '.routes.ts',
  '.pipe.ts',
  '.pipe.spec.ts',
  '.directive.ts',
  '.directive.spec.ts',
  '.model.ts',
  '.spec.ts',
  'main.ts',
  'app.config.ts',
  'index.html',
  'styles.css',
  'tokens.css',
];

function isKebabCase(name: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);
}

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
        getAllFiles(fullPath, fileList);
      }
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

export function lintProject(targetDir: string = process.cwd()): LintResult {
  const diagnostics: LintDiagnostic[] = [];
  const srcDir = fs.existsSync(path.join(targetDir, 'src'))
    ? path.join(targetDir, 'src')
    : targetDir;

  const files = getAllFiles(srcDir);

  // 1. Check file naming conventions and suffixes
  for (const file of files) {
    const basename = path.basename(file);
    const rel = path.relative(targetDir, file);

    // Skip non-code files (like images, markdown)
    if (!/\.(ts|html|css)$/.test(basename)) continue;

    // Check suffix
    const matchesSuffix = ALLOWED_SUFFIXES.some(suffix => basename.endsWith(suffix));
    if (!matchesSuffix) {
      diagnostics.push({
        file: rel,
        rule: 'naming/suffix',
        message: `File '${basename}' does not use a standard Jarvis suffix (.component.ts, .service.ts, .guard.ts, .routes.ts, etc.)`,
      });
    }

    // Extract prefix name before first dot
    const prefixName = basename.split('.')[0];
    if (prefixName && !isKebabCase(prefixName)) {
      diagnostics.push({
        file: rel,
        rule: 'naming/kebab-case',
        message: `File name '${prefixName}' should be kebab-case (e.g. 'employee-list')`,
      });
    }

    // Content-based checks for TS files
    if (file.endsWith('.ts')) {
      const content = fs.readFileSync(file, 'utf8');

      // Rule: No NgModule (standalone components only)
      if (content.includes('@NgModule')) {
        diagnostics.push({
          file: rel,
          rule: 'architecture/standalone-only',
          message: `Found @NgModule in '${basename}'. Jarvis uses standalone components only.`,
        });
      }

      // Rule: Check component class name matching
      if (basename.endsWith('.component.ts')) {
        const classMatch = content.match(/export\s+class\s+([A-Za-z0-9_]+)/);
        if (classMatch) {
          const className = classMatch[1];
          if (!className.endsWith('Component')) {
            diagnostics.push({
              file: rel,
              rule: 'naming/class-suffix',
              message: `Component class '${className}' in '${basename}' must end with 'Component'.`,
            });
          }
        }
      }

      // Rule: Check service class name matching
      if (basename.endsWith('.service.ts')) {
        const classMatch = content.match(/export\s+class\s+([A-Za-z0-9_]+)/);
        if (classMatch) {
          const className = classMatch[1];
          if (!className.endsWith('Service')) {
            diagnostics.push({
              file: rel,
              rule: 'naming/class-suffix',
              message: `Service class '${className}' in '${basename}' must end with 'Service'.`,
            });
          }
        }
      }
    }
  }

  // 2. Circular dependency check
  const circulars = checkCircularDependencies(files, targetDir);
  diagnostics.push(...circulars);

  return {
    valid: diagnostics.length === 0,
    diagnostics,
    filesChecked: files.length,
  };
}

export function checkCircularDependencies(files: string[], rootDir: string): LintDiagnostic[] {
  const tsFiles = files.filter(f => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
  const graph = new Map<string, string[]>();

  for (const file of tsFiles) {
    const normFile = path.resolve(file);
    const content = fs.readFileSync(file, 'utf8');
    const dir = path.dirname(normFile);
    const edges: string[] = [];

    const importRegex = /(?:import|export)\s+(?:.*?from\s+)?['"](\.[^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      let targetPath = path.resolve(dir, match[1]);
      if (!path.extname(targetPath)) {
        if (fs.existsSync(targetPath + '.ts')) {
          targetPath = targetPath + '.ts';
        } else if (fs.existsSync(path.join(targetPath, 'index.ts'))) {
          targetPath = path.join(targetPath, 'index.ts');
        }
      }
      if (fs.existsSync(targetPath)) {
        edges.push(targetPath);
      }
    }
    graph.set(normFile, edges);
  }

  const diagnostics: LintDiagnostic[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const currentPath: string[] = [];

  function dfs(node: string) {
    visited.add(node);
    recursionStack.add(node);
    currentPath.push(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recursionStack.has(neighbor)) {
        const cycleStartIndex = currentPath.indexOf(neighbor);
        const cycle = [...currentPath.slice(cycleStartIndex), neighbor]
          .map(p => path.relative(rootDir, p))
          .join(' -> ');
        diagnostics.push({
          file: path.relative(rootDir, node),
          rule: 'architecture/no-circular-deps',
          message: `Circular dependency detected: ${cycle}`,
        });
      }
    }

    currentPath.pop();
    recursionStack.delete(node);
  }

  for (const file of graph.keys()) {
    if (!visited.has(file)) {
      dfs(file);
    }
  }

  return diagnostics;
}
