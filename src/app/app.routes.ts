import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/shell/shell').then((module) => module.Shell),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/article-placeholder/article-placeholder').then(
            (module) => module.ArticlePlaceholder,
          ),
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./pages/article-edit/article-edit').then((module) => module.ArticleEdit),
      },
      {
        path: 'articles/:articleId',
        loadComponent: () =>
          import('./pages/article-view/article-view').then((module) => module.ArticleView),
      },
      {
        path: 'articles/:articleId/edit',
        loadComponent: () =>
          import('./pages/article-edit/article-edit').then((module) => module.ArticleEdit),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
