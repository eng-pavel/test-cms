import type { OnInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  Injector,
  input,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import type { ArticleDraft } from '../../interfaces/article.interface';

/**
 * Форма создания и редактирования черновика статьи.
 */
@Component({
  selector: 'app-article-editor',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './article-editor.html',
  styleUrl: './article-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleEditor implements OnInit {
  private readonly injector = inject(Injector);
  protected readonly titleControl = new FormControl('', { nonNullable: true });
  protected readonly contentControl = new FormControl('', { nonNullable: true });

  readonly draft = input.required<ArticleDraft>();
  readonly statusMessage = input.required<string>();
  readonly hasUnsavedContentChanges = input(false);

  readonly draftTitleChanged = output<string>();
  readonly draftContentChanged = output<string>();
  readonly articleSaved = output<void>();
  readonly articleDeleted = output<void>();

  /**
   * Настроить подписки на изменения формы редактора.
   */
  constructor() {
    this.titleControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value: string) => this.draftTitleChanged.emit(value));

    this.contentControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value: string) => this.draftContentChanged.emit(value));
  }

  /**
   * Синхронизировать реактивные контролы с текущим черновиком статьи.
   */
  ngOnInit(): void {
    effect(
      () => {
        const draft = this.draft();

        if (this.titleControl.value !== draft.title) {
          this.titleControl.setValue(draft.title, { emitEvent: false });
        }

        if (this.contentControl.value !== draft.content) {
          this.contentControl.setValue(draft.content, { emitEvent: false });
        }
      },
      { injector: this.injector },
    );
  }
}
