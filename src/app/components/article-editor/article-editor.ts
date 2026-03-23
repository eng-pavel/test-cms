import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import type { ArticleDraft } from '../../interfaces/article.interface';

/**
 * Отобразить форму создания и редактирования черновика статьи.
 */
@Component({
  selector: 'app-article-editor',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './article-editor.html',
  styleUrl: './article-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleEditor {
  readonly draft = input.required<ArticleDraft>();
  readonly statusMessage = input.required<string>();
  readonly hasUnsavedContentChanges = input(false);

  readonly draftTitleChanged = output<string>();
  readonly draftContentChanged = output<string>();
  readonly articleSaved = output<void>();
  readonly articleDeleted = output<void>();
}
