import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { AnnotationPanel } from '../../components/annotation-panel/annotation-panel';
import { ConfirmDialog } from '../../components/confirm-dialog/confirm-dialog';
import { SelectionCaptureKind } from '../../enums/selection-capture-kind.enum';
import type { ArticleDraft } from '../../interfaces/article.interface';
import type { PendingSelection } from '../../interfaces/pending-selection.interface';
import type { SelectionCaptureResult } from '../../interfaces/selection-capture-result.interface';
import type { TextSegment } from '../../interfaces/text-segment.interface';
import { StorageService } from '../../services/storage.service';

interface AnnotationDraftPayload {
  color: string;
  note: string;
  selection: PendingSelection;
}

/**
 * Страница просмотра статьи с созданием и удалением аннотаций.
 */
@Component({
  selector: 'app-article-view',
  standalone: true,
  imports: [AnnotationPanel, ConfirmDialog],
  templateUrl: './article-view.html',
  styleUrl: './article-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleView {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);

  private readonly articleId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('articleId'))),
    { initialValue: this.route.snapshot.paramMap.get('articleId') },
  );

  protected readonly palette = ['#ff6b6b', '#f59f00', '#2f9e44', '#1971c2', '#7b2cbf'];
  protected readonly pendingSelection = signal<PendingSelection | null>(null);
  protected readonly annotationColor = signal(this.palette[0]);
  protected readonly annotationNote = signal('');
  protected readonly deleteDialogMessage = signal<string | null>(null);
  protected readonly statusMessage = signal('Выделите фрагмент текста, чтобы добавить аннотацию.');

  protected readonly article = computed(() => this.storage.articleById(this.articleId()));
  protected readonly draft = computed<ArticleDraft>(() => {
    const article = this.article();

    return {
      id: article?.id ?? null,
      title: article?.title ?? '',
      content: article?.content ?? '',
    };
  });
  protected readonly annotations = computed(() =>
    this.article() ? this.storage.annotationsForArticle(this.article()!.id) : [],
  );
  protected readonly renderedSegments = computed<TextSegment[]>(() => {
    const content = this.draft().content;
    const annotations = this.annotations();

    if (!annotations.length) {
      return [{ text: content, annotation: null }];
    }

    const segments: TextSegment[] = [];
    let cursor = 0;

    for (const annotation of annotations) {
      if (annotation.start > cursor) {
        segments.push({
          text: content.slice(cursor, annotation.start),
          annotation: null,
        });
      }

      segments.push({
        text: content.slice(annotation.start, annotation.end),
        annotation,
      });
      cursor = annotation.end;
    }

    if (cursor < content.length) {
      segments.push({
        text: content.slice(cursor),
        annotation: null,
      });
    }

    return segments;
  });

  /**
   * Синхронизировать выбранную статью с маршрутом и сообщениями страницы.
   */
  constructor() {
    effect(() => {
      const article = this.article();

      if (!article) {
        this.storage.selectArticle(null);
        this.clearPendingSelection();
        this.statusMessage.set('Статья не найдена. Выберите другую статью в меню.');
        return;
      }

      this.storage.selectArticle(article.id);
      this.clearPendingSelection();
      this.statusMessage.set(`Открыта статья «${article.title}».`);
    });
  }

  /**
   * Открыть страницу редактирования текущей статьи.
   */
  protected editArticle(): void {
    const article = this.article();

    if (!article) {
      return;
    }

    void this.router.navigate(['/articles', article.id, 'edit']);
  }

  /**
   * Открыть подтверждение удаления текущей статьи.
   */
  protected deleteArticle(): void {
    const article = this.article();

    if (!article) {
      return;
    }

    this.deleteDialogMessage.set(`Вы действительно хотите удалить "${article.title}"?`);
  }

  /**
   * Закрыть диалог подтверждения удаления статьи.
   */
  protected cancelDeleteArticle(): void {
    this.deleteDialogMessage.set(null);
  }

  /**
   * Удалить текущую статью и перейти на следующую доступную страницу.
   */
  protected confirmDeleteArticle(): void {
    const article = this.article();

    this.deleteDialogMessage.set(null);

    if (!article) {
      return;
    }

    this.storage.deleteArticle(article.id);

    const nextArticleId = this.storage.selectedArticleId();

    if (nextArticleId) {
      void this.router.navigate(['/articles', nextArticleId]);
      return;
    }

    void this.router.navigate(['/']);
  }

  /**
   * Обработать изменения выделения, которые приходят из панели аннотаций.
   *
   * @param result Результат захвата или сброса выделения.
   */
  protected handleSelectionCaptured(result: SelectionCaptureResult): void {
    switch (result.kind) {
      case SelectionCaptureKind.Cleared:
        this.clearPendingSelection();
        return;
      case SelectionCaptureKind.Overlap:
        this.clearPendingSelection();
        this.statusMessage.set(
          'Новая аннотация пересекается с существующей. Удалите старую или выберите другой фрагмент.',
        );
        return;
      case SelectionCaptureKind.RequiresSave:
        this.clearPendingSelection();
        return;
      case SelectionCaptureKind.Selected:
        this.pendingSelection.set(result.selection);
        this.annotationNote.set('');
        this.statusMessage.set('Фрагмент выбран. Добавьте пояснение и цвет.');
        return;
      default:
        return;
    }
  }

  /**
   * Сохранить новую аннотацию для текущей статьи.
   *
   * @param payload Данные новой аннотации вместе с выбранным фрагментом.
   */
  protected saveAnnotation(payload: AnnotationDraftPayload): void {
    const article = this.article();
    const note = payload.note.trim();

    if (!article) {
      return;
    }

    if (!note) {
      this.statusMessage.set('Добавьте текст аннотации.');
      return;
    }

    this.storage.createAnnotation({
      articleId: article.id,
      start: payload.selection.start,
      end: payload.selection.end,
      color: payload.color,
      note,
      text: payload.selection.text,
    });

    this.clearPendingSelection();
    this.statusMessage.set('Аннотация сохранена.');
  }

  /**
   * Удалить сохраненную аннотацию у текущей статьи.
   *
   * @param annotationId Идентификатор аннотации, которую нужно удалить.
   */
  protected removeAnnotation(annotationId: string): void {
    this.storage.deleteAnnotation(annotationId);
    this.statusMessage.set('Аннотация удалена.');
  }

  /**
   * Сбросить локальное состояние черновика аннотации.
   */
  protected clearPendingSelection(): void {
    this.pendingSelection.set(null);
    this.annotationColor.set(this.palette[0]);
    this.annotationNote.set('');
  }
}
