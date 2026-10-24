/**
 * Component metadata and reflection definitions for JARVIS.
 */

export const JARVIS_COMPONENT_METADATA = Symbol.for('jarvis:component_metadata');

export interface ComponentOptions {
  selector: string;
  template?: string;
  templateUrl?: string;
  styles?: string[];
  styleUrl?: string;
  styleUrls?: string[];
  providers?: any[];
}

export interface ComponentDef<T = any> {
  type: new (...args: any[]) => T;
  selector: string;
  template?: string;
  templateUrl?: string;
  styles?: string[];
  styleUrl?: string;
  styleUrls?: string[];
  templateFn?: (renderer: any, ctx: T) => { root: any };
}

export function setComponentDef<T>(target: any, def: ComponentDef<T>): void {
  Object.defineProperty(target, JARVIS_COMPONENT_METADATA, {
    value: def,
    writable: false,
    enumerable: false,
    configurable: true,
  });
}

export function getComponentDef<T>(target: any): ComponentDef<T> | undefined {
  return target[JARVIS_COMPONENT_METADATA];
}
