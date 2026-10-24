/**
 * @jarvis/primeng - PrimeNG v20 Adapter for Jarvis Framework
 *
 * Provides fine-grained reactive component bridges for PrimeNG v20,
 * powered by Jarvis Signals and DOMRenderer with strictly ZERO RxJS dependencies.
 */

// Core Services & Utilities
export * from './core/event.ts';
export * from './core/component.ts';
export * from './core/overlay.ts';
export * from './core/registry.ts';
export * from './core/theme.ts';

// PrimeNG Adapters
export * from './button/index.ts';
export * from './input/index.ts';
export * from './select/index.ts';
export * from './checkbox/index.ts';
export * from './dialog/index.ts';
export * from './table/index.ts';

// Auto-register components with PrimeComponentRegistry
import { PrimeComponentRegistry } from './core/registry.ts';
import { JarvisButton } from './button/button.component.ts';
import { JarvisInputText } from './input/input.component.ts';
import { JarvisSelect } from './select/select.component.ts';
import { JarvisCheckbox } from './checkbox/checkbox.component.ts';
import { JarvisDialog } from './dialog/dialog.component.ts';
import { JarvisTable } from './table/table.component.ts';

// 1. Primary Jarvis Selectors
PrimeComponentRegistry.register({
  selector: 'jarvis-p-button',
  inputs: ['label', 'icon', 'severity', 'variant', 'size', 'raised', 'rounded', 'loading', 'disabled'],
  outputs: ['clicked'],
  adapterClass: JarvisButton,
});

PrimeComponentRegistry.register({
  selector: 'jarvis-p-input',
  inputs: ['value', 'placeholder', 'disabled', 'readonly', 'type', 'variant', 'size', 'invalid'],
  outputs: ['valueChange', 'input', 'blur'],
  adapterClass: JarvisInputText,
});

PrimeComponentRegistry.register({
  selector: 'jarvis-p-select',
  inputs: ['value', 'options', 'optionLabel', 'optionValue', 'placeholder', 'disabled', 'filter'],
  outputs: ['valueChange', 'change'],
  adapterClass: JarvisSelect,
});

PrimeComponentRegistry.register({
  selector: 'jarvis-p-checkbox',
  inputs: ['checked', 'label', 'disabled', 'binary'],
  outputs: ['checkedChange', 'change'],
  adapterClass: JarvisCheckbox,
});

PrimeComponentRegistry.register({
  selector: 'jarvis-p-dialog',
  inputs: ['visible', 'header', 'width', 'modal', 'closable', 'dismissableMask'],
  outputs: ['visibleChange', 'onShow', 'onHide'],
  adapterClass: JarvisDialog,
});

PrimeComponentRegistry.register({
  selector: 'jarvis-p-table',
  inputs: ['value', 'columns', 'loading', 'paginator', 'rows', 'totalRecords', 'sortField', 'sortOrder'],
  outputs: ['sortChange', 'pageChange'],
  adapterClass: JarvisTable,
});

