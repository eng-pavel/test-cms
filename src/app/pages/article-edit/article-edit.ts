import type { OnInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { ArticleEditor } from '../../components/article-editor/article-editor';
import { ConfirmDialog } from '../../components/confirm-dialog/confirm-dialog';
import type { ArticleDraft } from '../../interfaces/article.interface';
import { StorageService } from '../../services/storage.service';

/**
 * Страница создания и редактирования статьи.
 */
@Component({
  selector: 'app-article-edit',
  standalone: true,
  imports: [ArticleEditor, ConfirmDialog],
  templateUrl: './article-edit.html',
  styleUrl: './article-edit.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleEdit implements OnInit {
  private readonly injector = inject(Injector);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);

  private readonly articleId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('articleId'))),
    { initialValue: this.route.snapshot.paramMap.get('articleId') },
  );

  protected readonly article = computed(() => this.storage.articleById(this.articleId()));
  protected readonly draft = signal<ArticleDraft>({
    id: null,
    title: '',
    content: '',
  });
  protected readonly deleteDialogMessage = signal<string | null>(null);
  protected readonly resetAnnotationsDialogMessage = signal<string | null>(null);
  protected readonly statusMessage = signal('Создайте новую статью.');
  protected readonly hasUnsavedContentChanges = computed(() => {
    const article = this.article();
    const draft = this.draft();

    return !!article && (article.title !== draft.title || article.content !== draft.content);
  });
  protected readonly isMissingArticle = computed(() => !!this.articleId() && !this.article());

  /**
   * Синхронизировать редактируемый черновик с текущей статьей из маршрута.
   */
  ngOnInit(): void {
    effect(
      () => {
        const article = this.article();
        const articleId = this.articleId();

        if (articleId && !article) {
          this.statusMessage.set('Статья не найдена. Выберите другую статью в боковом меню.');
          return;
        }

        if (article) {
          this.storage.selectArticle(article.id);
          this.draft.set({
            id: article.id,
            title: article.title,
            content: article.content,
          });
          this.statusMessage.set(`Редактирование статьи «${article.title}».`);
          return;
        }

        this.storage.selectArticle(null);
        this.draft.set({
          id: null,
          title: '',
          content: '',
        });
        this.statusMessage.set('Создайте новую статью.');
      },
      { injector: this.injector },
    );
  }

  /**
   * Обновить одно поле текущего черновика статьи.
   *
   * @param key Ключ поля черновика, которое нужно обновить.
   * @param value Новое значение поля черновика.
   */
  protected updateDraft<K extends keyof ArticleDraft>(key: K, value: ArticleDraft[K]): void {
    this.draft.update((draft: ArticleDraft) => ({
      ...draft,
      [key]: value,
    }));
  }

  /**
   * Сохранить черновик как новую или существующую статью и перейти на просмотр.
   */
  protected saveArticle(): void {
    this.persistArticle(false);
  }

  /**
   * Закрыть предупреждение о сбросе аннотаций.
   */
  protected cancelResetAnnotations(): void {
    this.resetAnnotationsDialogMessage.set(null);
  }

  /**
   * Подтвердить сохранение статьи со сбросом аннотаций.
   */
  protected confirmResetAnnotations(): void {
    this.resetAnnotationsDialogMessage.set(null);
    this.persistArticle(true);
  }

  /**
   * Открыть подтверждение удаления для текущего черновика.
   */
  protected deleteCurrentArticle(): void {
    const draft = this.draft();

    if (!draft.id) {
      void this.router.navigate(['/']);
      return;
    }

    this.deleteDialogMessage.set(`Вы действительно хотите удалить "${draft.title}"?`);
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
    const articleId = this.draft().id;

    this.deleteDialogMessage.set(null);

    if (!articleId) {
      void this.router.navigate(['/']);
      return;
    }

    this.storage.deleteArticle(articleId);

    const nextArticleId = this.storage.selectedArticleId();

    if (nextArticleId) {
      void this.router.navigate(['/articles', nextArticleId]);
      return;
    }

    void this.router.navigate(['/']);
  }

  /**
   * Сохранить статью и при необходимости запросить подтверждение сброса аннотаций.
   *
   * @param skipResetWarning Пропустить предупреждение о сбросе аннотаций.
   */
  private persistArticle(skipResetWarning: boolean): void {
    const draft = this.draft();
    const title = draft.title.trim();
    const content = draft.content.trim();
    const article = this.article();

    if (!title || !content) {
      this.statusMessage.set('У статьи должны быть заполнены заголовок и текст.');
      return;
    }

    if (!draft.id) {
      const createdArticle = this.storage.createArticle({ title, content });
      void this.router.navigate(['/articles', createdArticle.id]);
      return;
    }

    if (
      article &&
      article.content !== content &&
      this.storage.annotationsForArticle(article.id).length > 0 &&
      !skipResetWarning
    ) {
      this.resetAnnotationsDialogMessage.set(
        `Изменение текста удалит все аннотации статьи "${article.title}". Продолжить?`,
      );
      return;
    }

    this.storage.updateArticle(draft.id, { title, content });
    void this.router.navigate(['/articles', draft.id]);
  }
}
