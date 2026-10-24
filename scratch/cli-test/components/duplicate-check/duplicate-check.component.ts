import { Component, input, output, type OnInit, type OnDestroy } from '@jarvis/core';
import { signal } from '@jarvis/reactive';

@Component({
  selector: 'app-duplicate-check',
  templateUrl: './duplicate-check.component.html',
  styleUrl: './duplicate-check.component.css',
})
export class DuplicateCheckComponent implements OnInit, OnDestroy {
  readonly title = signal('DuplicateCheck Works!');
  readonly selected = output<string>();

  onInit(): void {
    // Lifecycle initialization
  }

  onSelect(): void {
    this.selected.emit(this.title());
  }

  onDestroy(): void {
    // Cleanup lifecycle
  }
}
