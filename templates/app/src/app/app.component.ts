import { Component, signal } from '@jarvis/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly title = signal('Jarvis Enterprise Portal');
}
