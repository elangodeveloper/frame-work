import { Component, input, output, type OnInit, type OnDestroy } from '@jarvis/core';
import { signal } from '@jarvis/reactive';

@Component({
  selector: 'app-employee-card',
  templateUrl: './employee-card.component.html',
  styleUrl: './employee-card.component.css',
})
export class EmployeeCardComponent implements OnInit, OnDestroy {
  readonly title = signal('EmployeeCard Works!');
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
