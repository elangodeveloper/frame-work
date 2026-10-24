export type Type<T = any> = new (...args: any[]) => T;

export class InjectionToken<T = any> {
  readonly description: string;
  readonly options?: {
    providedIn?: 'root' | 'platform' | null;
    factory?: () => T;
  };

  constructor(
    description: string,
    options?: {
      providedIn?: 'root' | 'platform' | null;
      factory?: () => T;
    }
  ) {
    this.description = description;
    this.options = options;
  }

  toString(): string {
    return 'InjectionToken(' + this.description + ')';
  }
}

export type ProviderToken<T = any> = Type<T> | InjectionToken<T> | symbol | string;

export interface ValueProvider<T = any> {
  provide: ProviderToken<T>;
  useValue: T;
}

export interface ClassProvider<T = any> {
  provide: ProviderToken<T>;
  useClass: Type<T>;
}

export interface FactoryProvider<T = any> {
  provide: ProviderToken<T>;
  useFactory: (...deps: any[]) => T;
  deps?: ProviderToken<any>[];
}

export interface ExistingProvider<T = any> {
  provide: ProviderToken<T>;
  useExisting: ProviderToken<T>;
}

export type Provider<T = any> =
  | ValueProvider<T>
  | ClassProvider<T>
  | FactoryProvider<T>
  | ExistingProvider<T>
  | Type<T>;

export class Injector {
  private static rootInjector: Injector | null = null;
  private static activeContextInjector: Injector | null = null;

  readonly parent: Injector | null;
  private readonly records = new Map<ProviderToken<any>, any>();
  private readonly resolving = new Set<ProviderToken<any>>();

  constructor(parent: Injector | null = null) {
    this.parent = parent;
  }

  static get root(): Injector {
    if (!this.rootInjector) {
      this.rootInjector = new Injector();
    }
    return this.rootInjector;
  }

  static get current(): Injector | null {
    return this.activeContextInjector || this.rootInjector;
  }

  static setActive(injector: Injector | null): Injector | null {
    const prev = this.activeContextInjector;
    this.activeContextInjector = injector;
    return prev;
  }

  provide<T>(providerOrToken: Provider<T>, value?: T): void {
    if (value !== undefined) {
      this.records.set(providerOrToken as ProviderToken<T>, value);
      return;
    }

    if (typeof providerOrToken === 'function') {
      this.records.set(providerOrToken, { provide: providerOrToken, useClass: providerOrToken });
    } else if (providerOrToken && typeof providerOrToken === 'object' && 'provide' in providerOrToken) {
      this.records.set(providerOrToken.provide, providerOrToken);
    }
  }

  get<T>(token: ProviderToken<T>, notFoundValue?: T): T {
    if (this.resolving.has(token)) {
      const path = Array.from(this.resolving).map(t => String(t)).join(' -> ');
      throw new Error('[JARVIS DI] Circular dependency detected: ' + path + ' -> ' + String(token));
    }

    if (this.records.has(token)) {
      const record = this.records.get(token);
      if (record && typeof record === 'object' && 'provide' in record) {
        this.resolving.add(token);
        try {
          const instance = this.instantiateProvider(record);
          this.records.set(token, instance);
          return instance;
        } finally {
          this.resolving.delete(token);
        }
      }
      return record as T;
    }

    if (this.parent) {
      return this.parent.get(token, notFoundValue);
    }

    if (token instanceof InjectionToken && token.options?.factory) {
      this.resolving.add(token);
      try {
        const val = token.options.factory();
        this.records.set(token, val);
        return val;
      } finally {
        this.resolving.delete(token);
      }
    }

    if (typeof token === 'function') {
      this.resolving.add(token);
      try {
        const instance = new (token as Type<T>)();
        this.records.set(token, instance);
        return instance;
      } finally {
        this.resolving.delete(token);
      }
    }

    if (notFoundValue !== undefined) {
      return notFoundValue;
    }

    throw new Error('[JARVIS DI] No provider found for token: ' + String(token));
  }

  private instantiateProvider(provider: any): any {
    if ('useValue' in provider) {
      return provider.useValue;
    }
    if ('useClass' in provider) {
      return new provider.useClass();
    }
    if ('useFactory' in provider) {
      const deps = (provider.deps || []).map((dep: any) => this.get(dep));
      return provider.useFactory(...deps);
    }
    if ('useExisting' in provider) {
      return this.get(provider.useExisting);
    }
    throw new Error('[JARVIS DI] Invalid provider configuration for token: ' + String(provider.provide));
  }
}

export function inject<T>(token: ProviderToken<T>, notFoundValue?: T): T {
  const current = Injector.current || Injector.root;
  return current.get(token, notFoundValue);
}
