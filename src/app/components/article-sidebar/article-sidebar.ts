import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import type { Article } from '../../interfaces/article.interface';

/**
 * Боковая панель со списком статей и созданием новой статьи.
 */
@Component({
  selector: 'app-article-sidebar',
  standalone: true,
  templateUrl: './article-sidebar.html',
  styleUrl: './article-sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleSidebar {
  readonly articles = input.required<Article[]>();
  readonly selectedArticleId = input<string | null>(null);
  readonly annotationCounts = input.required<Record<string, number>>();

  readonly articleSelected = output<string>();
  readonly newArticleRequested = output<void>();
}
