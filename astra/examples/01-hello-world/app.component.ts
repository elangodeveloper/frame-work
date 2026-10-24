import { Component } from '../../packages/core/src/index.ts';

export class App {
  title = 'Hello Jarvis';
}

Component({
  selector: 'app',
  template: `<h1>Hello Jarvis</h1>`,
})(App);
