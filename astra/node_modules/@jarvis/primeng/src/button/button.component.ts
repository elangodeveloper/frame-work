import { JarvisPrimeComponent, unwrap } from '../core/component.ts';
import { JarvisEvent, jarvisEvent } from '../core/event.ts';
import type { Renderer } from '../../../../packages/renderer/src/index.ts';
import type { Signal } from '../../../../packages/reactive/src/index.ts';

export type ButtonSeverity =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'info'
  | 'warn'
  | 'help'
  | 'danger'
  | 'contrast';

export type ButtonVariant = 'outlined' | 'text' | 'link';
export type ButtonSize = 'small' | 'large';

export interface ButtonProps {
  label?: Signal<string> | string;
  icon?: Signal<string> | string;
  severity?: Signal<ButtonSeverity> | ButtonSeverity;
  variant?: Signal<ButtonVariant> | ButtonVariant;
  size?: Signal<ButtonSize> | ButtonSize;
  raised?: Signal<boolean> | boolean;
  rounded?: Signal<boolean> | boolean;
  loading?: Signal<boolean> | boolean;
  disabled?: Signal<boolean> | boolean;
  class?: string;
}

/**
 * Jarvis Button Adapter for PrimeNG v20 Button.
 * Selector: <jarvis-p-button>
 */
export class JarvisButton extends JarvisPrimeComponent {
  readonly clicked: JarvisEvent<MouseEvent> = jarvisEvent();
  private readonly props: ButtonProps;
  private buttonEl: any;
  private labelTextNode: any;
  private iconEl: any;

  constructor(renderer: Renderer, props: ButtonProps = {}) {
    super(renderer);
    this.props = props;
    this.createDom();
    this.bindProperties();
  }

  private createDom(): void {
    this.buttonEl = this.renderer.createElement('button');
    this.hostElement = this.buttonEl;

    // Optional icon element
    this.iconEl = this.renderer.createElement('span');
    this.renderer.appendChild(this.buttonEl, this.iconEl);

    // Label text node
    const labelSpan = this.renderer.createElement('span');
    this.renderer.setAttribute(labelSpan, 'class', 'p-button-label');
    this.labelTextNode = this.renderer.createText('');
    this.renderer.appendChild(labelSpan, this.labelTextNode);
    this.renderer.appendChild(this.buttonEl, labelSpan);

    // Click event listener
    this.renderer.listen(this.buttonEl, 'click', (event: MouseEvent) => {
      const isDisabled = Boolean(unwrap(this.props.disabled) || unwrap(this.props.loading));
      if (!isDisabled) {
        this.clicked.emit(event);
      }
    });
  }

  private bindProperties(): void {
    // 1. Reactive class construction
    this.bindReactive(
      () => {
        const severity = unwrap(this.props.severity) || 'primary';
        const variant = unwrap(this.props.variant);
        const size = unwrap(this.props.size);
        const raised = unwrap(this.props.raised);
        const rounded = unwrap(this.props.rounded);
        const loading = unwrap(this.props.loading);
        const customClass = this.props.class || '';

        const classes = ['p-button', 'p-component'];
        if (severity && severity !== 'primary') classes.push(`p-button-${severity}`);
        if (variant === 'outlined') classes.push('p-button-outlined');
        if (variant === 'text') classes.push('p-button-text');
        if (variant === 'link') classes.push('p-button-link');
        if (size === 'small') classes.push('p-button-sm');
        if (size === 'large') classes.push('p-button-lg');
        if (raised) classes.push('p-button-raised');
        if (rounded) classes.push('p-button-rounded');
        if (loading) classes.push('p-button-loading');
        if (customClass) classes.push(customClass);

        return classes.join(' ');
      },
      (classes) => {
        this.renderer.setAttribute(this.buttonEl, 'class', classes);
      }
    );

    // 2. Reactive disabled state
    this.bindReactive(
      () => Boolean(unwrap(this.props.disabled) || unwrap(this.props.loading)),
      (disabled) => {
        if (disabled) {
          this.renderer.setAttribute(this.buttonEl, 'disabled', '');
        } else {
          // If renderer supports removeAttribute or setProperty
          this.renderer.setProperty(this.buttonEl, 'disabled', false);
        }
      }
    );

    // 3. Reactive label
    this.bindReactive(
      () => unwrap(this.props.label) ?? '',
      (label) => {
        this.renderer.setText(this.labelTextNode, label);
      }
    );

    // 4. Reactive icon / loading spinner
    this.bindReactive(
      () => {
        const isLoading = unwrap(this.props.loading);
        const icon = unwrap(this.props.icon);
        if (isLoading) {
          return 'p-button-icon pi pi-spinner pi-spin';
        }
        if (icon) {
          return `p-button-icon ${icon}`;
        }
        return '';
      },
      (iconClass) => {
        if (iconClass) {
          this.renderer.setAttribute(this.iconEl, 'class', iconClass);
          this.renderer.setProperty(this.iconEl, 'style', 'display: inline-block');
        } else {
          this.renderer.setAttribute(this.iconEl, 'class', '');
          this.renderer.setProperty(this.iconEl, 'style', 'display: none');
        }
      }
    );
  }

  getElement(): any {
    return this.hostElement;
  }
}

// Backwards-compatible alias
