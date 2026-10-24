import * as crypto from 'node:crypto';
import * as path from 'node:path';

export interface ComponentInterface {
  selector: string;
  inputs: Set<string>;
  outputs: Set<string>;
  exports: Set<string>;
  hash: string;
}

export interface ComponentRecord {
  id: string; // Component selector or identifier
  tsPath: string;
  htmlPath?: string;
  cssPath?: string;
  tsHash: string;
  htmlHash: string;
  cssHash: string;
  interface: ComponentInterface;
  directDependents: Set<string>; // tsPaths of components importing or using this component
  usedMembersByDependent: Map<string, Set<string>>; // dependentTsPath -> Set of used input/output names
}

export type ChangeKind =
  | 'unchanged'
  | 'style-only'
  | 'template-only'
  | 'script-body'
  | 'script-interface'
  | 'routes'
  | 'config'
  | 'other';

export interface ClassificationResult {
  kind: ChangeKind;
  componentId?: string;
  tsPath?: string;
  changedUnit?: 'template' | 'style' | 'script';
  affectedDependents: string[];
  earlyCutoff: boolean;
  reason?: string;
  oldInterfaceHash?: string;
  newInterfaceHash?: string;
}

export function computeSha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function computeInterfaceHash(
  selector: string,
  inputs: Set<string>,
  outputs: Set<string>,
  exports: Set<string>
): string {
  const parts = [
    selector,
    Array.from(inputs).sort().join(','),
    Array.from(outputs).sort().join(','),
    Array.from(exports).sort().join(','),
  ];
  return computeSha256(parts.join('::'));
}

export class DependencyGraph {
  public components = new Map<string, ComponentRecord>(); // tsPath -> ComponentRecord
  public fileToTsPath = new Map<string, string>(); // any associated path (ts, html, css) -> tsPath
  public reverseDependencies = new Map<string, Set<string>>(); // targetTsPath -> Set of dependentTsPaths
  public routeFiles = new Set<string>();

  normalizePath(p: string): string {
    return path.resolve(p).replace(/\\/g, '/');
  }

  extractInterface(tsContent: string): ComponentInterface {
    let selector = '';
    const selectorMatch = tsContent.match(/selector\s*:\s*['"]([^'"]+)['"]/);
    if (selectorMatch) {
      selector = selectorMatch[1];
    }

    const inputs = new Set<string>();
    // @Input() foo or @Input('name') foo or input() / input.required()
    const inputMatches = tsContent.matchAll(/@Input\s*\([^)]*\)\s*([a-zA-Z0-9_$]+)|([a-zA-Z0-9_$]+)\s*=\s*input(?:\.required)?\(/g);
    for (const m of inputMatches) {
      const name = m[1] || m[2];
      if (name) inputs.add(name);
    }

    const outputs = new Set<string>();
    // @Output() bar or output()
    const outputMatches = tsContent.matchAll(/@Output\s*\([^)]*\)\s*([a-zA-Z0-9_$]+)|([a-zA-Z0-9_$]+)\s*=\s*output\(/g);
    for (const m of outputMatches) {
      const name = m[1] || m[2];
      if (name) outputs.add(name);
    }

    const exports = new Set<string>();
    const exportMatches = tsContent.matchAll(/export\s+(?:class|function|const|let)\s+([a-zA-Z0-9_$]+)/g);
    for (const m of exportMatches) {
      if (m[1]) exports.add(m[1]);
    }

    const hash = computeInterfaceHash(selector, inputs, outputs, exports);
    return { selector, inputs, outputs, exports, hash };
  }

  registerComponent(tsPath: string, tsContent: string, htmlPath?: string, cssPath?: string): ComponentRecord {
    const normTs = this.normalizePath(tsPath);
    const iface = this.extractInterface(tsContent);
    const tsHash = computeSha256(tsContent);

    const normHtml = htmlPath ? this.normalizePath(htmlPath) : undefined;
    const normCss = cssPath ? this.normalizePath(cssPath) : undefined;

    const id = iface.selector || path.basename(normTs, '.component.ts');

    const existing = this.components.get(normTs);
    const record: ComponentRecord = {
      id,
      tsPath: normTs,
      htmlPath: normHtml,
      cssPath: normCss,
      tsHash,
      htmlHash: existing?.htmlHash || '',
      cssHash: existing?.cssHash || '',
      interface: iface,
      directDependents: existing?.directDependents || new Set(),
      usedMembersByDependent: existing?.usedMembersByDependent || new Map(),
    };

    this.components.set(normTs, record);
    this.fileToTsPath.set(normTs, normTs);
    if (normHtml) this.fileToTsPath.set(normHtml, normTs);
    if (normCss) this.fileToTsPath.set(normCss, normTs);

    return record;
  }

  addDependencyEdge(importerTsPath: string, targetTsPath: string, usedMembers: string[] = []): void {
    const normImporter = this.normalizePath(importerTsPath);
    const normTarget = this.normalizePath(targetTsPath);

    if (!this.reverseDependencies.has(normTarget)) {
      this.reverseDependencies.set(normTarget, new Set());
    }
    this.reverseDependencies.get(normTarget)!.add(normImporter);

    const record = this.components.get(normTarget);
    if (record) {
      record.directDependents.add(normImporter);
      if (!record.usedMembersByDependent.has(normImporter)) {
        record.usedMembersByDependent.set(normImporter, new Set());
      }
      const memberSet = record.usedMembersByDependent.get(normImporter)!;
      for (const m of usedMembers) {
        memberSet.add(m);
      }
    }
  }

  classifyChange(filePath: string, newContent: string): ClassificationResult {
    const normPath = this.normalizePath(filePath);
    const basename = path.basename(normPath);
    const newHash = computeSha256(newContent);

    // 1. Config / manifest files
    if (
      basename === 'jarvis.json' ||
      basename === 'package.json' ||
      basename.startsWith('tsconfig')
    ) {
      return {
        kind: 'config',
        affectedDependents: [],
        earlyCutoff: false,
        reason: `Configuration file changed: ${basename}`,
      };
    }

    // 2. Routes file
    if (normPath.endsWith('.routes.ts') || basename === 'app.routes.ts' || this.routeFiles.has(normPath)) {
      return {
        kind: 'routes',
        affectedDependents: [],
        earlyCutoff: false,
        reason: 'Route definition updated',
      };
    }

    // 3. Find associated component
    const parentTsPath = this.fileToTsPath.get(normPath);
    const record = parentTsPath ? this.components.get(parentTsPath) : null;

    if (!record) {
      // Not a registered component
      return {
        kind: 'other',
        affectedDependents: [],
        earlyCutoff: false,
      };
    }

    const componentId = record.id;

    // 4. Style unit change (.css)
    if (normPath.endsWith('.css') || normPath === record.cssPath) {
      if (record.cssHash === newHash) {
        return {
          kind: 'unchanged',
          componentId,
          tsPath: record.tsPath,
          changedUnit: 'style',
          affectedDependents: [],
          earlyCutoff: true,
          reason: 'Identical CSS content hash',
        };
      }
      record.cssHash = newHash;
      return {
        kind: 'style-only',
        componentId,
        tsPath: record.tsPath,
        changedUnit: 'style',
        affectedDependents: [],
        earlyCutoff: true, // Dependents NEVER recompile on style changes
        reason: 'Style-only edit: no JS execution required',
      };
    }

    // 5. Template unit change (.html)
    if (normPath.endsWith('.html') || normPath === record.htmlPath) {
      if (record.htmlHash === newHash) {
        return {
          kind: 'unchanged',
          componentId,
          tsPath: record.tsPath,
          changedUnit: 'template',
          affectedDependents: [],
          earlyCutoff: true,
          reason: 'Identical template content hash',
        };
      }
      record.htmlHash = newHash;
      return {
        kind: 'template-only',
        componentId,
        tsPath: record.tsPath,
        changedUnit: 'template',
        affectedDependents: [],
        earlyCutoff: true, // Dependents NEVER recompile on template changes
        reason: 'Template-only edit: interface unchanged',
      };
    }

    // 6. Script unit change (.component.ts)
    if (normPath === record.tsPath) {
      if (record.tsHash === newHash) {
        return {
          kind: 'unchanged',
          componentId,
          tsPath: record.tsPath,
          changedUnit: 'script',
          affectedDependents: [],
          earlyCutoff: true,
          reason: 'Identical script content hash',
        };
      }

      const oldIface = record.interface;
      const newIface = this.extractInterface(newContent);
      record.tsHash = newHash;

      // Early cutoff: interface hash unchanged
      if (oldIface.hash === newIface.hash) {
        return {
          kind: 'script-body',
          componentId,
          tsPath: record.tsPath,
          changedUnit: 'script',
          affectedDependents: [],
          earlyCutoff: true,
          oldInterfaceHash: oldIface.hash,
          newInterfaceHash: newIface.hash,
          reason: 'Interface hash unchanged: early cutoff applied to all dependents',
        };
      }

      // Interface changed: identify which members changed
      const changedMembers = new Set<string>();
      if (oldIface.selector !== newIface.selector) {
        changedMembers.add(oldIface.selector);
        changedMembers.add(newIface.selector);
      }
      for (const inp of oldIface.inputs) {
        if (!newIface.inputs.has(inp)) changedMembers.add(inp);
      }
      for (const inp of newIface.inputs) {
        if (!oldIface.inputs.has(inp)) changedMembers.add(inp);
      }
      for (const out of oldIface.outputs) {
        if (!newIface.outputs.has(out)) changedMembers.add(out);
      }
      for (const out of newIface.outputs) {
        if (!oldIface.outputs.has(out)) changedMembers.add(out);
      }

      // Filter dependents: recompile ONLY those that use the changed members!
      const affectedDependents: string[] = [];
      for (const dep of record.directDependents) {
        const used = record.usedMembersByDependent.get(dep);
        if (!used || used.size === 0) {
          // If usage not granularly tracked, assume affected
          affectedDependents.push(dep);
        } else {
          // Check if any changed member was used
          let usesChangedMember = false;
          for (const m of changedMembers) {
            if (used.has(m)) {
              usesChangedMember = true;
              break;
            }
          }
          if (usesChangedMember) {
            affectedDependents.push(dep);
          }
        }
      }

      record.interface = newIface;

      return {
        kind: 'script-interface',
        componentId,
        tsPath: record.tsPath,
        changedUnit: 'script',
        affectedDependents,
        earlyCutoff: false,
        oldInterfaceHash: oldIface.hash,
        newInterfaceHash: newIface.hash,
        reason: `Interface changed (${Array.from(changedMembers).join(', ') || 'signature'}) -> ${affectedDependents.length} direct dependents recompiled`,
      };
    }

    return {
      kind: 'other',
      affectedDependents: [],
      earlyCutoff: false,
    };
  }
}
