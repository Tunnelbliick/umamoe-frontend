import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'inheritance',
    redirectTo: 'database',
    pathMatch: 'full'
  },
  {
    path: 'support-cards',
    redirectTo: 'database',
    pathMatch: 'full'
  },
  {
    path: 'database',
    loadComponent: () => import('./pages/inheritance-database/inheritance-database.component').then(m => m.InheritanceDatabaseComponent)
  },
  {
    path: 'circles',
    loadComponent: () => import('./pages/circles/circles.component').then(m => m.CirclesComponent)
  },
  {
    path: 'circles/:id',
    loadComponent: () => import('./pages/circles/circle-details/circle-details.component').then(m => m.CircleDetailsComponent)
  },
  {
    path: 'rankings',
    loadComponent: () => import('./pages/rankings/rankings.component').then(m => m.RankingsComponent)
  },
  {
    path: 'timeline',
    loadComponent: () => import('./pages/timeline/timeline.component').then(m => m.TimelineComponent)
  },
  {
    path: 'tierlist',
    loadComponent: () => import('./pages/tierlist/tierlist.component').then(m => m.TierlistComponent)
  },
  {
    path: 'tools',
    loadComponent: () => import('./pages/tools/tools.component').then(m => m.ToolsComponent)
  },
  {
    path: 'tools/statistics',
    loadComponent: () => import('./pages/statistics/statistics.component').then(m => m.StatisticsComponent)
  },
  {
    path: 'wip',
    loadComponent: () => import('./components/wip-placeholder/wip-placeholder.component').then(m => m.WipPlaceholderComponent)
  },
  {
    path: 'privacy-policy',
    loadComponent: () => import('./pages/privacy-policy/privacy-policy.component').then(m => m.PrivacyPolicyComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'signin',
    loadComponent: () => import('./pages/auth-callback/auth-callback.component').then(m => m.AuthCallbackComponent)
  },
  {
    path: 'profile/:accountId',
    loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
    children: [
      {
        path: 'veterans',
        loadComponent: () => import('./pages/profile/veterans/veterans.component').then(m => m.VeteransComponent)
      },
      {
        path: 'cm',
        loadComponent: () => import('./pages/profile/cm/cm.component').then(m => m.CmComponent)
      },
      {
        path: 'achievements',
        loadComponent: () => import('./pages/profile/achievements/achievements.component').then(m => m.AchievementsComponent)
      },
      {
        path: 'titles',
        loadComponent: () => import('./pages/profile/titles/titles.component').then(m => m.TitlesComponent)
      }
    ]
  },
  // Example guarded route — add canActivate: [authGuard] to any route that needs authentication
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
