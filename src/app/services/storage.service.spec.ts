import { StorageService } from './storage.service';

const ARTICLE_ID_1 = '11111111-1111-4111-8111-111111111111';
const ARTICLE_ID_2 = '22222222-2222-4222-8222-222222222222';
const ANNOTATION_ID_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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

  it('создаёт статью, сохраняет её и делает выбранной', () => {
    jest.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(ARTICLE_ID_1);

    const service = new StorageService();
    const article = service.createArticle({
      title: 'Первая статья',
      content: 'Текст статьи',
    });

    expect(article.id).toBe(ARTICLE_ID_1);
    expect(service.articles()).toHaveLength(1);
    expect(service.selectedArticleId()).toBe(ARTICLE_ID_1);
    expect(JSON.parse(localStorage.getItem('test-cms.articles') ?? '[]')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('test-cms.selected-article-id') ?? 'null')).toBe(
      ARTICLE_ID_1,
    );
  });

  it('сохраняет аннотации при изменении только заголовка', () => {
    jest
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(ARTICLE_ID_1)
      .mockReturnValueOnce(ANNOTATION_ID_1);

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

  it('сбрасывает аннотации при изменении текста статьи', () => {
    jest
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(ARTICLE_ID_1)
      .mockReturnValueOnce(ANNOTATION_ID_1);

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

  it('создаёт и удаляет аннотацию', () => {
    jest
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(ARTICLE_ID_1)
      .mockReturnValueOnce(ANNOTATION_ID_1);

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

  it('удаляет статью и переключает выбор на следующую доступную', () => {
    jest
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(ARTICLE_ID_1)
      .mockReturnValueOnce(ARTICLE_ID_2);

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

  it('возвращает fallback-значения для битых данных в localStorage', () => {
    localStorage.setItem('test-cms.articles', '{broken json');
    localStorage.setItem('test-cms.annotations', '{broken json');
    localStorage.setItem('test-cms.selected-article-id', '{broken json');

    const service = new StorageService();

    expect(service.articles()).toEqual([]);
    expect(service.annotationsForArticle('missing')).toEqual([]);
    expect(service.selectedArticleId()).toBeNull();
  });
});
