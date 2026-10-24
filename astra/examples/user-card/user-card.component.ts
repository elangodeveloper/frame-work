import { Component, type OnInit, type OnDestroy } from '../../packages/core/src/index.ts';
import { signal, type Signal } from '../../packages/reactive/src/index.ts';
import { JarvisEvent, jarvisEvent } from '../../packages/core/src/index.ts';

export class UserCardComponent implements OnInit, OnDestroy {
  name: Signal<string> = signal('Tony Stark');
  email: Signal<string> = signal('tony@starkindustries.com');
  selected: JarvisEvent<string> = jarvisEvent<string>();

  onInit(): void {
    // Lifecycle setup
  }

  onSelect(): void {
    this.selected.emit(this.name());
  }

  onDestroy(): void {
    this.selected.clear();
  }
}

Component({
  selector: 'user-card',
  template: '<div class="user-card ss"><h2>{{ name() }}</h2><p>{{ email() }}</p></div>'
})(UserCardComponent);
