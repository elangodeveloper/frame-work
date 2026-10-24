import { Component, input, output, type OnInit, type OnDestroy } from '@jarvis/core';
import { signal } from '@jarvis/reactive';

@Component({
  selector: '{{selector}}',
  templateUrl: './{{kebabName}}.component.html',
  styleUrl: './{{kebabName}}.component.css',
})
export class {{className}} implements OnInit, OnDestroy {
  readonly title = signal('{{pascalName}} Works!');
  readonly selected = output<string>();

  onInit(): void {}

  onSelect(): void {
    this.selected.emit(this.title());
  }

  onDestroy(): void {}
}
