import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'pages/loader',
    pathMatch: 'full'
  },
  {
    path: 'folder/:id',
    loadChildren: () => import('./folder/folder.module').then( m => m.FolderPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'pages/loader',
    loadChildren: () => import('./pages/loader/loader.module').then( m => m.LoaderPageModule)
  },
  {
    path: 'pages/home',
    loadChildren: () => import('./pages/home/home.module').then( m => m.HomePageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'pages/detect',
    loadChildren: () => import('./pages/detect/detect.module').then( m => m.DetectPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'pages/results',
    loadComponent: () => import('./pages/results/results.page').then( m => m.ResultsPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'pages/verify',
    loadComponent: () => import('./pages/verify/verify.page').then( m => m.VerifyPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'pages/heatmap',
    loadChildren: () => import('./pages/heatmap/heatmap.module').then( m => m.HeatmapPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'pages/history',
    loadChildren: () => import('./pages/history/history.module').then( m => m.HistoryPageModule),
    canActivate: [AuthGuard]
  },
  // Public routes (no guard)
  {
    path: 'pages/login',
    loadChildren: () => import('./pages/login/login.module').then( m => m.LoginPageModule)
  },
  {
    path: 'pages/register',
    loadChildren: () => import('./pages/register/register.module').then( m => m.RegisterPageModule)
  },
  {
    path: 'pages/first-page',
    loadChildren: () => import('./pages/first-page/first-page.module').then( m => m.FirstPagePageModule)
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
