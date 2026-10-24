import { Component, input, output, type OnInit, type OnDestroy } from '@jarvis/core';
import { signal } from '@jarvis/reactive';

@Component({
  selector: 'app-compact-badge',
  templateUrl: './compact-badge.component.html',
  styleUrl: './compact-badge.component.css',
})
export class CompactBadgeComponent implements OnInit, OnDestroy {
  readonly title = signal('CompactBadge Works!');
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
