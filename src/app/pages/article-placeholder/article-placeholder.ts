import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-article-placeholder',
  standalone: true,
  templateUrl: './article-placeholder.html',
  styleUrl: './article-placeholder.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticlePlaceholder {
  private readonly router = inject(Router);

  protected createArticle(): void {
    void this.router.navigate(['/new']);
  }
}
