import { signal, type Signal } from '../../reactive/src/index.ts';

export type ValidatorFn<T> = (value: T) => string | null;

export class FormControl<T = any> {
  readonly value: Signal<T>;
  readonly errors: Signal<string[]>;
  readonly touched: Signal<boolean>;
  readonly dirty: Signal<boolean>;
  private readonly initialValue: T;
  private readonly validators: ValidatorFn<T>[];

  constructor(initialValue: T, validators: ValidatorFn<T>[] = []) {
    this.initialValue = initialValue;
    this.validators = validators;
    this.value = signal<T>(initialValue);
    this.touched = signal<boolean>(false);
    this.dirty = signal<boolean>(false);
    this.errors = signal<string[]>(this.runValidators(initialValue));
  }

  setValue(newValue: T): void {
    this.value.set(newValue);
    this.dirty.set(true);
    this.errors.set(this.runValidators(newValue));
  }

  markAsTouched(): void {
    this.touched.set(true);
  }

  reset(): void {
    this.value.set(this.initialValue);
    this.touched.set(false);
    this.dirty.set(false);
    this.errors.set(this.runValidators(this.initialValue));
  }

  get valid(): boolean {
    return this.errors().length === 0;
  }

  get invalid(): boolean {
    return !this.valid;
  }

  private runValidators(val: T): string[] {
    const errs: string[] = [];
    for (const v of this.validators) {
      const res = v(val);
      if (res) errs.push(res);
    }
    return errs;
  }
}

export class FormGroup {
  readonly controls: Record<string, FormControl>;

  constructor(controls: Record<string, FormControl>) {
    this.controls = controls;
  }

  get valid(): boolean {
    return Object.values(this.controls).every(c => c.valid);
  }

  get value(): Record<string, any> {
    const res: Record<string, any> = {};
    for (const [k, c] of Object.entries(this.controls)) {
      res[k] = c.value();
    }
    return res;
  }

  reset(): void {
    for (const c of Object.values(this.controls)) {
      c.reset();
    }
  }
}
