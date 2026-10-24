import { Component } from '@jarvis/core';
import { signal } from '@jarvis/reactive';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly title = signal('SampleApp');
}
