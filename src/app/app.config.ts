import { ApplicationConfig, importProvidersFrom, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors, HTTP_INTERCEPTORS } from '@angular/common/http';

import { routes } from './app.routes';
import { TurnstileInterceptor } from './interceptors/turnstile.interceptor';
import { CorsInterceptor } from './interceptors/cors.interceptor';
import { StatsService } from './services/stats.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: CorsInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: TurnstileInterceptor,
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (statsService: StatsService) => () => {
        // This ensures the stats service is initialized and daily tracking happens
        return Promise.resolve();
      },
      deps: [StatsService],
      multi: true
    }
  ]
};
