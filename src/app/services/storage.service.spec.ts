import { StorageService } from './storage.service';

describe('StorageService', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-24T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    localStorage.clear();
  });

  it('creates an article, persists it and selects it', () => {
    jest.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('article-1');

    const service = new StorageService();
    const article = service.createArticle({
      title: 'Первая статья',
      content: 'Текст статьи',
    });

    expect(article.id).toBe('article-1');
    expect(service.articles()).toHaveLength(1);
    expect(service.selectedArticleId()).toBe('article-1');
    expect(JSON.parse(localStorage.getItem('test-cms.articles') ?? '[]')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('test-cms.selected-article-id') ?? 'null')).toBe(
      'article-1',
    );
  });

  it('keeps annotations when only the title changes', () => {
    jest
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('article-1')
      .mockReturnValueOnce('annotation-1');

    const service = new StorageService();
    const article = service.createArticle({
      title: 'Старый заголовок',
      content: 'Один и тот же текст',
    });

    service.createAnnotation({
      articleId: article.id,
      start: 0,
      end: 4,
      color: '#111111',
      note: 'Комментарий',
      text: 'Один',
    });

    service.updateArticle(article.id, {
      title: 'Новый заголовок',
      content: 'Один и тот же текст',
    });

    expect(service.articleById(article.id)?.title).toBe('Новый заголовок');
    expect(service.annotationsForArticle(article.id)).toHaveLength(1);
  });

  it('clears annotations when article content changes', () => {
    jest
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('article-1')
      .mockReturnValueOnce('annotation-1');

    const service = new StorageService();
    const article = service.createArticle({
      title: 'Статья',
      content: 'Старый текст',
    });

    service.createAnnotation({
      articleId: article.id,
      start: 0,
      end: 6,
      color: '#111111',
      note: 'Комментарий',
      text: 'Старый',
    });

    service.updateArticle(article.id, {
      title: 'Статья',
      content: 'Новый текст',
    });

    expect(service.articleById(article.id)?.content).toBe('Новый текст');
    expect(service.annotationsForArticle(article.id)).toHaveLength(0);
  });

  it('creates and deletes an annotation', () => {
    jest
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('article-1')
      .mockReturnValueOnce('annotation-1');

    const service = new StorageService();
    const article = service.createArticle({
      title: 'Статья',
      content: 'Текст',
    });

    const annotation = service.createAnnotation({
      articleId: article.id,
      start: 0,
      end: 5,
      color: '#111111',
      note: 'Комментарий',
      text: 'Текст',
    });

    expect(service.annotationsForArticle(article.id)).toHaveLength(1);

    service.deleteAnnotation(annotation.id);

    expect(service.annotationsForArticle(article.id)).toHaveLength(0);
  });

  it('deletes an article and switches selection to the next available article', () => {
    jest
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('article-1')
      .mockReturnValueOnce('article-2');

    const service = new StorageService();
    const firstArticle = service.createArticle({
      title: 'Первая статья',
      content: 'Текст 1',
    });
    const secondArticle = service.createArticle({
      title: 'Вторая статья',
      content: 'Текст 2',
    });

    expect(service.selectedArticleId()).toBe(secondArticle.id);

    service.deleteArticle(secondArticle.id);

    expect(service.articleById(secondArticle.id)).toBeNull();
    expect(service.selectedArticleId()).toBe(firstArticle.id);
  });

  it('returns fallback values for broken localStorage data', () => {
    localStorage.setItem('test-cms.articles', '{broken json');
    localStorage.setItem('test-cms.annotations', '{broken json');
    localStorage.setItem('test-cms.selected-article-id', '{broken json');

    const service = new StorageService();

    expect(service.articles()).toEqual([]);
    expect(service.annotationsForArticle('missing')).toEqual([]);
    expect(service.selectedArticleId()).toBeNull();
  });
});
