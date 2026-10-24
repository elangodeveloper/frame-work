import type { ParamMap } from './types.ts';

class ParamMapImpl implements ParamMap {
  private readonly params: Map<string, string[]>;

  constructor(raw: Record<string, string | string[]>) {
    this.params = new Map();
    if (raw) {
      for (const [k, v] of Object.entries(raw)) {
        if (Array.isArray(v)) {
          this.params.set(k, v.map(String));
        } else if (v !== undefined && v !== null) {
          this.params.set(k, [String(v)]);
        }
      }
    }
  }

  has(name: string): boolean {
    return this.params.has(name);
  }

  get(name: string): string | null {
    const list = this.params.get(name);
    return list && list.length > 0 ? list[0] : null;
  }

  getAll(name: string): string[] {
    return this.params.get(name) ?? [];
  }

  get keys(): string[] {
    return Array.from(this.params.keys());
  }
}

export function convertToParamMap(params: Record<string, string | string[]>): ParamMap {
  return new ParamMapImpl(params);
}
