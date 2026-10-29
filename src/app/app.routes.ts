import { Routes } from '@angular/router';
import { guard } from './guard';

export const routes: Routes = [
  {
    path: 'sign-in',
    loadComponent: () => import('./sign-in.component').then((file) => file.SignInComponent),
  },
  {
    path: '',
    canActivate: [guard],
    loadComponent: () => import('./shell.component').then((file) => file.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'desk' },
      { path: 'desk', loadComponent: () => import('./desk.component').then((file) => file.DeskComponent) },
      {
        path: 'templates',
        loadComponent: () => import('./templates.component').then((file) => file.TemplatesComponent),
      },
      { path: 'wallet', loadComponent: () => import('./wallet.component').then((file) => file.WalletComponent) },
      { path: 'report', loadComponent: () => import('./report.component').then((file) => file.ReportComponent) },
    ],
  },
];
