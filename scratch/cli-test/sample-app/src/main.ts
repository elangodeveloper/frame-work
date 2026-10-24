import { bootstrap } from '@jarvis/runtime';
import { provideRouter } from '@jarvis/router';
import { AppComponent } from './app/app.component.ts';
import { routes } from './app/app.routes.ts';

const container = document.getElementById('app');
if (container) {
  provideRouter(routes);
  bootstrap(AppComponent, container);
}
