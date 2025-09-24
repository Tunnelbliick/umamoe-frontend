import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'inheritance',
    loadComponent: () => import('./pages/inheritance-database/inheritance-database.component').then(m => m.InheritanceDatabaseComponent)
  },
  {
    path: 'support-cards',
    loadComponent: () => import('./pages/support-cards-database/support-cards-database.component').then(m => m.SupportCardsDatabaseComponent)
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
    path: '**',
    redirectTo: ''
  }
];
