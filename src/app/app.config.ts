import { ApplicationConfig, importProvidersFrom, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { routes } from './app.routes';
import { CorsInterceptor } from './interceptors/cors.interceptor';
import { RateLimitInterceptor } from './interceptors/rate-limit.interceptor';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { StatsService } from './services/stats.service';
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: CorsInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: RateLimitInterceptor,
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
