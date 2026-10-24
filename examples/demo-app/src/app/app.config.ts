import { type ApplicationConfig } from '@jarvis/runtime';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@jarvis/router';
import { provideHttp, withInterceptors } from '@jarvis/http';
import { routes } from './app.routes.ts';
import { authInterceptor } from './core/interceptors/auth.interceptor.ts';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideHttp(withInterceptors([authInterceptor])),
  ],
};
