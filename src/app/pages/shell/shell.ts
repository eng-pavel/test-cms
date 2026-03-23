import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { ArticleSidebar } from '../../components/article-sidebar/article-sidebar';
import { StorageService } from '../../services/storage.service';

/**
 * Построить основной каркас интерфейса с боковой панелью и маршрутизируемой рабочей областью.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [ArticleSidebar, RouterOutlet],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);

  protected readonly articles = this.storage.articles;
  protected readonly selectedArticleId = this.storage.selectedArticleId;
  protected readonly annotationCounts = computed(() =>
    Object.fromEntries(
      this.articles().map((article) => [
        article.id,
        this.storage.annotationsForArticle(article.id).length,
      ]),
    ),
  );

  /**
   * Открыть выбранную статью в правой рабочей области.
   *
   * @param articleId Идентификатор статьи, которую нужно открыть.
   */
  protected openArticle(articleId: string): void {
    this.storage.selectArticle(articleId);
    void this.router.navigate(['/articles', articleId]);
  }

  /**
   * Открыть страницу создания новой статьи из боковой панели.
   */
  protected openArticleCreation(): void {
    this.storage.selectArticle(null);
    void this.router.navigate(['/new']);
  }
}
