import { Component, signal } from '@jarvis/core';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  readonly greeting = signal('Welcome to the Jarvis Enterprise Framework');
  readonly featureCount = signal(4);
}
