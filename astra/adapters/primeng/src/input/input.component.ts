import { JarvisPrimeComponent, unwrap } from '../core/component.ts';
import { JarvisEvent, jarvisEvent } from '../core/event.ts';
import type { Renderer } from '../../../../packages/renderer/src/index.ts';
import type { Signal } from '../../../../packages/reactive/src/index.ts';

export type InputVariant = 'outlined' | 'filled';
export type InputSize = 'small' | 'large';

export interface InputTextProps {
  value?: Signal<string> | string;
  placeholder?: Signal<string> | string;
  disabled?: Signal<boolean> | boolean;
  readonly?: Signal<boolean> | boolean;
  invalid?: Signal<boolean> | boolean;
  variant?: Signal<InputVariant> | InputVariant;
  size?: Signal<InputSize> | InputSize;
  type?: string;
  class?: string;
}

/**
 * Jarvis InputText Adapter for PrimeNG v20 InputText.
 * Selector: <jarvis-p-input>
 */
export class JarvisInputText extends JarvisPrimeComponent {
  readonly valueChange: JarvisEvent<string> = jarvisEvent();
  readonly input: JarvisEvent<InputEvent> = jarvisEvent();
  readonly blur: JarvisEvent<FocusEvent> = jarvisEvent();

  private readonly props: InputTextProps;
  private inputEl: any;

  constructor(renderer: Renderer, props: InputTextProps = {}) {
    super(renderer);
    this.props = props;
    this.createDom();
    this.bindProperties();
  }

  private createDom(): void {
    this.inputEl = this.renderer.createElement('input');
    this.hostElement = this.inputEl;

    const inputType = this.props.type || 'text';
    this.renderer.setAttribute(this.inputEl, 'type', inputType);

    // Event listeners
    this.renderer.listen(this.inputEl, 'input', (event: any) => {
      const val = event.target ? event.target.value : (event as any).value ?? '';
      this.valueChange.emit(val);
      this.input.emit(event);
    });

    this.renderer.listen(this.inputEl, 'blur', (event: any) => {
      this.blur.emit(event);
    });
  }

  private bindProperties(): void {
    // 1. Reactive classes
    this.bindReactive(
      () => {
        const invalid = unwrap(this.props.invalid);
        const variant = unwrap(this.props.variant);
        const size = unwrap(this.props.size);
        const customClass = this.props.class || '';

        const classes = ['p-inputtext', 'p-component'];
        if (invalid) classes.push('p-invalid');
        if (variant === 'filled') classes.push('p-variant-filled');
        if (size === 'small') classes.push('p-inputtext-sm');
        if (size === 'large') classes.push('p-inputtext-lg');
        if (customClass) classes.push(customClass);

        return classes.join(' ');
      },
      (classes) => {
        this.renderer.setAttribute(this.inputEl, 'class', classes);
      }
    );

    // 2. Reactive value
    this.bindReactive(
      () => unwrap(this.props.value) ?? '',
      (val) => {
        this.renderer.setProperty(this.inputEl, 'value', val);
      }
    );

    // 3. Reactive placeholder
    this.bindReactive(
      () => unwrap(this.props.placeholder) ?? '',
      (placeholder) => {
        if (placeholder) {
          this.renderer.setAttribute(this.inputEl, 'placeholder', placeholder);
        }
      }
    );

    // 4. Reactive disabled & readonly
    this.bindReactive(
      () => Boolean(unwrap(this.props.disabled)),
      (disabled) => {
        this.renderer.setProperty(this.inputEl, 'disabled', disabled);
      }
    );

    this.bindReactive(
      () => Boolean(unwrap(this.props.readonly)),
      (readonly) => {
        this.renderer.setProperty(this.inputEl, 'readOnly', readonly);
      }
    );
  }

  getElement(): any {
    return this.hostElement;
  }
}

// Backwards-compatible alias
