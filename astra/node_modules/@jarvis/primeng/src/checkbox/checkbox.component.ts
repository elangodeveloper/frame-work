import { JarvisPrimeComponent, unwrap } from '../core/component.ts';
import { JarvisEvent, jarvisEvent } from '../core/event.ts';
import type { Renderer } from '../../../../packages/renderer/src/index.ts';
import type { Signal } from '../../../../packages/reactive/src/index.ts';

export interface CheckboxProps {
  checked?: Signal<boolean> | boolean;
  disabled?: Signal<boolean> | boolean;
  label?: Signal<string> | string;
  binary?: boolean;
  invalid?: Signal<boolean> | boolean;
  class?: string;
}

/**
 * Jarvis Checkbox Adapter for PrimeNG v20 Checkbox.
 * Selector: <jarvis-p-checkbox>
 */
export class JarvisCheckbox extends JarvisPrimeComponent {
  readonly checkedChange: JarvisEvent<boolean> = jarvisEvent();
  readonly change: JarvisEvent<{ originalEvent: any; checked: boolean }> = jarvisEvent();

  private readonly props: CheckboxProps;
  private containerEl: any;
  private boxEl: any;
  private iconEl: any;
  private labelTextNode: any;

  constructor(renderer: Renderer, props: CheckboxProps = {}) {
    super(renderer);
    this.props = props;
    this.createDom();
    this.bindProperties();
  }

  private createDom(): void {
    this.containerEl = this.renderer.createElement('div');
    this.hostElement = this.containerEl;

    // Checkbox box
    this.boxEl = this.renderer.createElement('div');
    this.renderer.setAttribute(this.boxEl, 'class', 'p-checkbox-box');

    this.iconEl = this.renderer.createElement('span');
    this.renderer.setAttribute(this.iconEl, 'class', 'p-checkbox-icon pi pi-check');
    this.renderer.appendChild(this.boxEl, this.iconEl);
    this.renderer.appendChild(this.containerEl, this.boxEl);

    // Label element
    const labelEl = this.renderer.createElement('label');
    this.renderer.setAttribute(labelEl, 'class', 'p-checkbox-label');
    this.labelTextNode = this.renderer.createText('');
    this.renderer.appendChild(labelEl, this.labelTextNode);
    this.renderer.appendChild(this.containerEl, labelEl);

    // Click handler on container
    this.renderer.listen(this.containerEl, 'click', (event: any) => {
      const isDisabled = Boolean(unwrap(this.props.disabled));
      if (!isDisabled) {
        const nextVal = !Boolean(unwrap(this.props.checked));
        this.checkedChange.emit(nextVal);
        this.change.emit({ originalEvent: event, checked: nextVal });
      }
    });
  }

  private bindProperties(): void {
    // 1. Reactive checked state
    this.bindReactive(
      () => Boolean(unwrap(this.props.checked)),
      (isChecked) => {
        const baseClass = 'p-checkbox-box';
        const checkedClass = isChecked ? `${baseClass} p-highlight` : baseClass;
        this.renderer.setAttribute(this.boxEl, 'class', checkedClass);
        this.renderer.setProperty(this.iconEl, 'style', isChecked ? 'display: block;' : 'display: none;');
      }
    );

    // 2. Reactive container classes
    this.bindReactive(
      () => {
        const isChecked = Boolean(unwrap(this.props.checked));
        const isDisabled = Boolean(unwrap(this.props.disabled));
        const isInvalid = Boolean(unwrap(this.props.invalid));
        const customClass = this.props.class || '';

        const classes = ['p-checkbox', 'p-component'];
        if (isChecked) classes.push('p-checkbox-checked');
        if (isDisabled) classes.push('p-checkbox-disabled');
        if (isInvalid) classes.push('p-invalid');
        if (customClass) classes.push(customClass);

        return classes.join(' ');
      },
      (classes) => {
        this.renderer.setAttribute(this.containerEl, 'class', classes);
      }
    );

    // 3. Reactive label
    this.bindReactive(
      () => unwrap(this.props.label) ?? '',
      (label) => {
        this.renderer.setText(this.labelTextNode, label);
      }
    );
  }

  getElement(): any {
    return this.hostElement;
  }
}

// Backwards-compatible alias
