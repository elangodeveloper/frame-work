/**
 * Component adapter registry for UI component suites.
 */

export interface PrimeComponentMetadata {
  selector: string;
  inputs: string[];
  outputs: string[];
  adapterClass: any;
}

export class PrimeComponentRegistry {
  private static readonly adapters = new Map<string, PrimeComponentMetadata>();

  static register(metadata: PrimeComponentMetadata): void {
    this.adapters.set(metadata.selector, metadata);
  }

  static get(selector: string): PrimeComponentMetadata | undefined {
    return this.adapters.get(selector);
  }

  static has(selector: string): boolean {
    return this.adapters.has(selector);
  }

  static all(): PrimeComponentMetadata[] {
    return Array.from(this.adapters.values());
  }
}
