import { computed, Injectable, signal } from '@angular/core';

import type { Annotation } from '../interfaces/annotation.interface';
import type { Article } from '../interfaces/article.interface';

const ARTICLES_STORAGE_KEY = 'test-cms.articles';
const ANNOTATIONS_STORAGE_KEY = 'test-cms.annotations';
const SELECTED_ARTICLE_STORAGE_KEY = 'test-cms.selected-article-id';

@Injectable({
  providedIn: 'root',
})
/**
 * Хранить статьи и аннотации в localStorage и отдавать реактивные данные приложению.
 */
export class StorageService {
  private readonly articlesState = signal<Article[]>(this.loadArticles());
  private readonly annotationsState = signal<Annotation[]>(this.loadAnnotations());
  private readonly selectedArticleIdState = signal<string | null>(this.loadSelectedArticleId());

  readonly articles = computed(() =>
    [...this.articlesState()].sort(
      (left: Article, right: Article) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
    ),
  );

  readonly selectedArticleId = computed(() => this.selectedArticleIdState());

  /**
   * Вернуть статью по идентификатору или null, если статья не найдена.
   *
   * @param articleId Идентификатор статьи.
   */
  articleById(articleId: string | null): Article | null {
    if (!articleId) {
      return null;
    }

    return this.articles().find((article: Article) => article.id === articleId) ?? null;
  }

  /**
   * Вернуть все аннотации статьи, отсортированные по позиции в тексте.
   *
   * @param articleId Идентификатор статьи.
   */
  annotationsForArticle(articleId: string | null): Annotation[] {
    if (!articleId) {
      return [];
    }

    return this.annotationsState()
      .filter((annotation: Annotation) => annotation.articleId === articleId)
      .sort((left: Annotation, right: Annotation) => left.start - right.start);
  }

  /**
   * Создать новую статью, сохранить ее и сделать выбранной.
   *
   * @param payload Данные новой статьи.
   */
  createArticle(payload: Pick<Article, 'title' | 'content'>): Article {
    const now = new Date().toISOString();
    const article: Article = {
      id: crypto.randomUUID(),
      title: payload.title,
      content: payload.content,
      createdAt: now,
      updatedAt: now,
    };

    this.articlesState.update((articles: Article[]) => [...articles, article]);
    this.persistArticles();
    this.selectArticle(article.id);

    return article;
  }

  /**
   * Обновить статью и очистить аннотации, если изменился ее текст.
   *
   * @param articleId Идентификатор статьи.
   * @param payload Новые данные статьи.
   */
  updateArticle(articleId: string, payload: Pick<Article, 'title' | 'content'>): Article | null {
    let updatedArticle: Article | null = null;
    let shouldClearAnnotations = false;

    this.articlesState.update((articles: Article[]) =>
      articles.map((article: Article) => {
        if (article.id !== articleId) {
          return article;
        }

        shouldClearAnnotations = article.content !== payload.content;
        updatedArticle = {
          ...article,
          title: payload.title,
          content: payload.content,
          updatedAt: new Date().toISOString(),
        };

        return updatedArticle;
      }),
    );

    if (!updatedArticle) {
      return null;
    }

    if (shouldClearAnnotations) {
      this.deleteAnnotationsForArticle(articleId);
    }

    this.persistArticles();
    return updatedArticle;
  }

  /**
   * Удалить статью вместе с аннотациями и обновить выбранную статью.
   *
   * @param articleId Идентификатор статьи, которую нужно удалить.
   */
  deleteArticle(articleId: string): void {
    this.articlesState.update((articles: Article[]) =>
      articles.filter((article: Article) => article.id !== articleId),
    );
    this.annotationsState.update((annotations: Annotation[]) =>
      annotations.filter((annotation: Annotation) => annotation.articleId !== articleId),
    );

    if (this.selectedArticleIdState() === articleId) {
      const nextArticleId = this.articlesState()[0]?.id ?? null;
      this.selectedArticleIdState.set(nextArticleId);
      this.persistSelectedArticleId();
    }

    this.persistArticles();
    this.persistAnnotations();
  }

  /**
   * Сохранить идентификатор выбранной статьи для следующих посещений.
   *
   * @param articleId Идентификатор статьи или null для сброса выбора.
   */
  selectArticle(articleId: string | null): void {
    this.selectedArticleIdState.set(articleId);
    this.persistSelectedArticleId();
  }

  /**
   * Создать и сохранить новую аннотацию для статьи.
   *
   * @param payload Данные новой аннотации.
   */
  createAnnotation(payload: Omit<Annotation, 'id' | 'createdAt'>): Annotation {
    const annotation: Annotation = {
      ...payload,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    this.annotationsState.update((annotations: Annotation[]) => [...annotations, annotation]);
    this.persistAnnotations();

    return annotation;
  }

  /**
   * Удалить одну аннотацию по идентификатору.
   *
   * @param annotationId Идентификатор аннотации.
   */
  deleteAnnotation(annotationId: string): void {
    this.annotationsState.update((annotations: Annotation[]) =>
      annotations.filter((annotation: Annotation) => annotation.id !== annotationId),
    );
    this.persistAnnotations();
  }

  /**
   * Удалить все аннотации, которые относятся к указанной статье.
   *
   * @param articleId Идентификатор статьи.
   */
  private deleteAnnotationsForArticle(articleId: string): void {
    this.annotationsState.update((annotations: Annotation[]) =>
      annotations.filter((annotation: Annotation) => annotation.articleId !== articleId),
    );
    this.persistAnnotations();
  }

  /**
   * Прочитать список статей из localStorage.
   */
  private loadArticles(): Article[] {
    return this.readStorage<Article[]>(ARTICLES_STORAGE_KEY, []);
  }

  /**
   * Прочитать список аннотаций из localStorage.
   */
  private loadAnnotations(): Annotation[] {
    return this.readStorage<Annotation[]>(ANNOTATIONS_STORAGE_KEY, []);
  }

  /**
   * Восстановить выбранную статью или взять первую сохраненную статью.
   */
  private loadSelectedArticleId(): string | null {
    const selectedArticleId = this.readStorage<string | null>(SELECTED_ARTICLE_STORAGE_KEY, null);

    if (selectedArticleId) {
      return selectedArticleId;
    }

    return this.articlesState()?.[0]?.id ?? null;
  }

  /**
   * Сохранить текущий список статей.
   */
  private persistArticles(): void {
    this.writeStorage(ARTICLES_STORAGE_KEY, this.articlesState());
  }

  /**
   * Сохранить текущий список аннотаций.
   */
  private persistAnnotations(): void {
    this.writeStorage(ANNOTATIONS_STORAGE_KEY, this.annotationsState());
  }

  /**
   * Сохранить идентификатор выбранной статьи.
   */
  private persistSelectedArticleId(): void {
    this.writeStorage(SELECTED_ARTICLE_STORAGE_KEY, this.selectedArticleIdState());
  }

  /**
   * Прочитать JSON-значение из localStorage с fallback для пустых и битых данных.
   *
   * @param key Ключ в localStorage.
   * @param fallback Значение по умолчанию при отсутствии или ошибке чтения.
   */
  private readStorage<T>(key: string, fallback: T): T {
    if (globalThis.localStorage === undefined) {
      return fallback;
    }

    const rawValue = localStorage.getItem(key);

    if (!rawValue) {
      return fallback;
    }

    try {
      return JSON.parse(rawValue) as T;
    } catch {
      return fallback;
    }
  }

  /**
   * Записать JSON-сериализуемое значение в localStorage.
   *
   * @param key Ключ в localStorage.
   * @param value Значение для записи.
   */
  private writeStorage<T>(key: string, value: T): void {
    if (globalThis.localStorage === undefined) {
      return;
    }

    localStorage.setItem(key, JSON.stringify(value));
  }
}
