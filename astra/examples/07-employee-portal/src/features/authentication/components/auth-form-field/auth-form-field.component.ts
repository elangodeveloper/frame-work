import { Component, input } from '@jarvis/core';
import type { Renderer } from '@jarvis/renderer';
import type { Signal } from '@jarvis/reactive';

/**
 * AuthFormFieldComponent: Reusable Accessible Form Field wrapper
 * Enforces explicit labels, ARIA associations, hints, and error messaging.
 */
export class AuthFormFieldComponent {
  readonly label = input<string>('');
  readonly htmlFor = input<string>('');
  readonly required = input<boolean>(false);
  readonly hint = input<string>('');
  readonly error = input<string | null>(null);

  render(r: Renderer): any {
    const root = r.createElement('div');
    r.setAttribute(root, 'class', 'jarvis-form-group');

    // Label row
    const labelRow = r.createElement('div');
    r.setAttribute(labelRow, 'class', 'form-label-row');

    const labelEl = r.createElement('label');
    r.setAttribute(labelEl, 'class', 'jarvis-form-label');
    r.bindProperty(labelEl, 'htmlFor', () => this.htmlFor());
    r.bindText(labelEl, () => this.label());

    r.appendChild(labelRow, labelEl);

    // Optional required indicator
    if (this.required()) {
      const reqEl = r.createElement('span');
      r.setAttribute(reqEl, 'class', 'required-indicator');
      r.setAttribute(reqEl, 'aria-hidden', 'true');
      reqEl.textContent = ' *';
      r.appendChild(labelRow, reqEl);
    }

    r.appendChild(root, labelRow);

    return root;
  }
}

Component({
  selector: 'jarvis-auth-form-field',
  templateUrl: './auth-form-field.component.html',
  styleUrl: './auth-form-field.component.css',
})(AuthFormFieldComponent);
