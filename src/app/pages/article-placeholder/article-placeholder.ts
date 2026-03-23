import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Показать пустое состояние рабочей области до открытия или создания статьи.
 */
@Component({
  selector: 'app-article-placeholder',
  standalone: true,
  templateUrl: './article-placeholder.html',
  styleUrl: './article-placeholder.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticlePlaceholder {
  private readonly router = inject(Router);

  /**
   * Открыть страницу создания новой статьи.
   */
  protected createArticle(): void {
    void this.router.navigate(['/new']);
  }
}
