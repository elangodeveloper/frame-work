import { JarvisPrimeComponent, unwrap } from '../core/component.ts';
import { JarvisEvent, jarvisEvent } from '../core/event.ts';
import type { Renderer } from '../../../../packages/renderer/src/index.ts';
import type { Signal } from '../../../../packages/reactive/src/index.ts';
import { OverlayService } from '../core/overlay.ts';

export interface SelectProps<T = any> {
  options?: Signal<T[]> | T[];
  value?: Signal<any> | any;
  optionLabel?: string;
  optionValue?: string;
  placeholder?: string;
  disabled?: Signal<boolean> | boolean;
  loading?: Signal<boolean> | boolean;
  class?: string;
}

/**
 * Jarvis Select Adapter for PrimeNG v20 Select.
 * Selector: <jarvis-p-select>
 */
export class JarvisSelect<T = any> extends JarvisPrimeComponent {
  readonly valueChange: JarvisEvent<any> = jarvisEvent();
  readonly change: JarvisEvent<{ originalEvent: any; value: any }> = jarvisEvent();

  private readonly props: SelectProps<T>;
  private containerEl: any;
  private labelTextNode: any;
  private overlayEl: any;
  private listEl: any;
  private isOpen = false;
  private overlayId: number | null = null;

  constructor(renderer: Renderer, props: SelectProps<T> = {}) {
    super(renderer);
    this.props = props;
    this.createDom();
    this.bindProperties();
  }

  private createDom(): void {
    this.containerEl = this.renderer.createElement('div');
    this.hostElement = this.containerEl;

    // Label container
    const labelSpan = this.renderer.createElement('span');
    this.renderer.setAttribute(labelSpan, 'class', 'p-select-label');
    this.labelTextNode = this.renderer.createText('');
    this.renderer.appendChild(labelSpan, this.labelTextNode);
    this.renderer.appendChild(this.containerEl, labelSpan);

    // Dropdown trigger icon
    const trigger = this.renderer.createElement('div');
    this.renderer.setAttribute(trigger, 'class', 'p-select-dropdown');
    const icon = this.renderer.createElement('span');
    this.renderer.setAttribute(icon, 'class', 'p-select-dropdown-icon pi pi-chevron-down');
    this.renderer.appendChild(trigger, icon);
    this.renderer.appendChild(this.containerEl, trigger);

    // Overlay panel
    this.overlayEl = this.renderer.createElement('div');
    this.renderer.setAttribute(this.overlayEl, 'class', 'p-select-overlay p-component');
    this.renderer.setProperty(this.overlayEl, 'style', 'display: none;');

    this.listEl = this.renderer.createElement('ul');
    this.renderer.setAttribute(this.listEl, 'class', 'p-select-list');
    this.renderer.appendChild(this.overlayEl, this.listEl);
    this.renderer.appendChild(this.containerEl, this.overlayEl);

    // Toggle open/close on click
    this.renderer.listen(this.containerEl, 'click', (event: any) => {
      const isDisabled = Boolean(unwrap(this.props.disabled) || unwrap(this.props.loading));
      if (!isDisabled) {
        this.toggle();
      }
    });
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    this.isOpen = true;
    this.renderer.setProperty(this.overlayEl, 'style', 'display: block;');
    this.renderer.setAttribute(this.containerEl, 'class', 'p-select p-component p-select-open');
    this.overlayId = OverlayService.register({
      onDismiss: () => this.close(),
    });
  }

  close(): void {
    this.isOpen = false;
    this.renderer.setProperty(this.overlayEl, 'style', 'display: none;');
    this.renderer.setAttribute(this.containerEl, 'class', 'p-select p-component');
    if (this.overlayId != null) {
      OverlayService.unregister(this.overlayId);
      this.overlayId = null;
    }
  }

  private bindProperties(): void {
    // 1. Reactive options and selected label
    this.bindReactive(
      () => {
        const options = (unwrap(this.props.options) || []) as T[];
        const selectedVal = unwrap(this.props.value);
        const labelProp = this.props.optionLabel || 'label';
        const valProp = this.props.optionValue || 'value';
        const placeholder = this.props.placeholder || 'Select an option';

        let displayLabel = placeholder;
        const items: Array<{ label: string; val: any; selected: boolean }> = [];

        for (const opt of options) {
          const optLabel = typeof opt === 'object' && opt !== null ? (opt as any)[labelProp] : String(opt);
          const optValue = typeof opt === 'object' && opt !== null ? (opt as any)[valProp] : opt;
          const isSelected = Object.is(optValue, selectedVal);
          if (isSelected) {
            displayLabel = optLabel;
          }
          items.push({ label: optLabel, val: optValue, selected: isSelected });
        }

        return { displayLabel, items };
      },
      ({ displayLabel, items }) => {
        this.renderer.setText(this.labelTextNode, displayLabel);

        // Render options list
        while ((this.listEl as any).children?.length > 0) {
          this.renderer.removeChild(this.listEl, (this.listEl as any).children[0]);
        }

        for (const item of items) {
          const li = this.renderer.createElement('li');
          const liClass = item.selected ? 'p-select-option p-select-option-selected' : 'p-select-option';
          this.renderer.setAttribute(li, 'class', liClass);

          const txt = this.renderer.createText(item.label);
          this.renderer.appendChild(li, txt);

          this.renderer.listen(li, 'click', (event: any) => {
            event.stopPropagation?.();
            this.valueChange.emit(item.val);
            this.change.emit({ originalEvent: event, value: item.val });
            this.close();
          });

          this.renderer.appendChild(this.listEl, li);
        }
      }
    );
  }

  override destroy(): void {
    this.close();
    super.destroy();
  }

  getElement(): any {
    return this.hostElement;
  }
}

// Backwards-compatible alias
