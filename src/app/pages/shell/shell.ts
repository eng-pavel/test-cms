import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { StorageService } from '../../services/storage.service';
import { ArticleSidebar } from '../cms/components/article-sidebar/article-sidebar';

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

  protected openArticle(articleId: string): void {
    this.storage.selectArticle(articleId);
    void this.router.navigate(['/articles', articleId]);
  }

  protected openArticleCreation(): void {
    this.storage.selectArticle(null);
    void this.router.navigate(['/new']);
  }
}
