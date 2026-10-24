import { Component, input, output, type OnInit, type OnDestroy } from '@jarvis/core';
import { signal } from '@jarvis/reactive';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.css',
})
export class UserProfileComponent implements OnInit, OnDestroy {
  readonly title = signal('UserProfile Works!');
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
