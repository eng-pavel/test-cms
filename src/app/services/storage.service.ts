import { computed, Injectable, signal } from '@angular/core';

import type { Annotation } from '../interfaces/annotation.interface';
import type { Article } from '../interfaces/article.interface';

const ARTICLES_STORAGE_KEY = 'test-cms.articles';
const ANNOTATIONS_STORAGE_KEY = 'test-cms.annotations';
const SELECTED_ARTICLE_STORAGE_KEY = 'test-cms.selected-article-id';

@Injectable({
  providedIn: 'root',
})
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
  readonly selectedArticle = computed(
    () =>
      this.articles().find((article: Article) => article.id === this.selectedArticleIdState()) ??
      null,
  );

  articleById(articleId: string | null): Article | null {
    if (!articleId) {
      return null;
    }

    return this.articles().find((article: Article) => article.id === articleId) ?? null;
  }

  annotationsForArticle(articleId: string | null): Annotation[] {
    if (!articleId) {
      return [];
    }

    return this.annotationsState()
      .filter((annotation: Annotation) => annotation.articleId === articleId)
      .sort((left: Annotation, right: Annotation) => left.start - right.start);
  }

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

  selectArticle(articleId: string | null): void {
    this.selectedArticleIdState.set(articleId);
    this.persistSelectedArticleId();
  }

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

  deleteAnnotation(annotationId: string): void {
    this.annotationsState.update((annotations: Annotation[]) =>
      annotations.filter((annotation: Annotation) => annotation.id !== annotationId),
    );
    this.persistAnnotations();
  }

  hasOverlappingAnnotation(articleId: string, start: number, end: number): boolean {
    return this.annotationsForArticle(articleId).some(
      (annotation: Annotation) => start < annotation.end && end > annotation.start,
    );
  }

  private deleteAnnotationsForArticle(articleId: string): void {
    this.annotationsState.update((annotations: Annotation[]) =>
      annotations.filter((annotation: Annotation) => annotation.articleId !== articleId),
    );
    this.persistAnnotations();
  }

  private loadArticles(): Article[] {
    return this.readStorage<Article[]>(ARTICLES_STORAGE_KEY, []);
  }

  private loadAnnotations(): Annotation[] {
    return this.readStorage<Annotation[]>(ANNOTATIONS_STORAGE_KEY, []);
  }

  private loadSelectedArticleId(): string | null {
    const selectedArticleId = this.readStorage<string | null>(SELECTED_ARTICLE_STORAGE_KEY, null);

    if (selectedArticleId) {
      return selectedArticleId;
    }

    return this.articlesState()?.[0]?.id ?? null;
  }

  private persistArticles(): void {
    this.writeStorage(ARTICLES_STORAGE_KEY, this.articlesState());
  }

  private persistAnnotations(): void {
    this.writeStorage(ANNOTATIONS_STORAGE_KEY, this.annotationsState());
  }

  private persistSelectedArticleId(): void {
    this.writeStorage(SELECTED_ARTICLE_STORAGE_KEY, this.selectedArticleIdState());
  }

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

  private writeStorage<T>(key: string, value: T): void {
    if (globalThis.localStorage === undefined) {
      return;
    }

    localStorage.setItem(key, JSON.stringify(value));
  }
}
