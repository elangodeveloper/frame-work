import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Component, signal, computed, effect, inject, Injector, InjectionToken } from '../src/index.ts';

class UserService {
  getUser(): string {
    return 'Tony Stark';
  }
}

class ConfigService {
  readonly apiUrl = 'https://api.stark.ai';
}

class ConsumerService {
  readonly config: ConfigService;
  constructor() {
    this.config = inject(ConfigService);
  }
}

describe('@jarvis/core - Public API & DI', () => {
  it('should expose signal, computed, effect, inject from @jarvis/core', () => {
    const s = signal(10);
    assert.strictEqual(s(), 10);
    const c = computed(() => s() * 2);
    assert.strictEqual(c(), 20);

    const userSvc = inject(UserService);
    assert.strictEqual(userSvc.getUser(), 'Tony Stark');
  });

  it('should support hierarchical injectors and parent fallbacks', () => {
    const parent = new Injector();
    parent.provide(ConfigService, new ConfigService());

    const child = new Injector(parent);
    const resolvedConfig = child.get(ConfigService);
    assert.strictEqual(resolvedConfig.apiUrl, 'https://api.stark.ai');
  });

  it('should support InjectionToken with factory defaults', () => {
    const API_PORT = new InjectionToken<number>('API_PORT', {
      factory: () => 8080
    });
    const injector = new Injector();
    assert.strictEqual(injector.get(API_PORT), 8080);
  });

  it('should catch circular dependencies with clear diagnostics', () => {
    const A = 'CIRCULAR_A';
    const B = 'CIRCULAR_B';
    const injector = new Injector();

    injector.provide({
      provide: A,
      useFactory: () => injector.get(B)
    });
    injector.provide({
      provide: B,
      useFactory: () => injector.get(A)
    });

    assert.throws(
      () => injector.get(A),
      /\[JARVIS DI\] Circular dependency detected/
    );
  });
});
