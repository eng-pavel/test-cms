import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import type { ArticleDraft } from '../../interfaces/article.interface';
import { StorageService } from '../../services/storage.service';
import { ArticleEdit } from './article-edit';

class ActivatedRouteStub {
  private readonly paramMapSubject = new BehaviorSubject(convertToParamMap({}));

  readonly paramMap = this.paramMapSubject.asObservable();
  snapshot = { paramMap: convertToParamMap({}) };

  setParamMap(articleId: string | null): void {
    const paramMap = convertToParamMap(articleId ? { articleId } : {});

    this.snapshot = { paramMap };
    this.paramMapSubject.next(paramMap);
  }
}

interface ArticleEditAccess {
  cancelDeleteArticle(): void;
  confirmDeleteArticle(): void;
  confirmResetAnnotations(): void;
  deleteCurrentArticle(): void;
  deleteDialogMessage(): string | null;
  draft(): ArticleDraft;
  resetAnnotationsDialogMessage(): string | null;
  saveArticle(): void;
  updateDraft<K extends keyof ArticleDraft>(key: K, value: ArticleDraft[K]): void;
}

describe('ArticleEdit', () => {
  let route: ActivatedRouteStub;
  let router: { navigate: jest.Mock<Promise<boolean>, [unknown[]]> };
  let storage: StorageService;

  beforeEach(async () => {
    localStorage.clear();
    jest.restoreAllMocks();
    route = new ActivatedRouteStub();
    router = {
      navigate: jest.fn().mockResolvedValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [ArticleEdit],
      providers: [
        StorageService,
        { provide: ActivatedRoute, useValue: route },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    storage = TestBed.inject(StorageService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('creates a new article and navigates to its page', () => {
    jest.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('article-1');
    route.setParamMap(null);

    const fixture = TestBed.createComponent(ArticleEdit);
    const component = fixture.componentInstance as unknown as ArticleEditAccess;

    fixture.detectChanges();
    component.updateDraft('title', 'Новая статья');
    component.updateDraft('content', 'Текст статьи');
    component.saveArticle();

    expect(storage.articleById('article-1')?.title).toBe('Новая статья');
    expect(router.navigate).toHaveBeenCalledWith(['/articles', 'article-1']);
  });

  it('saves title changes without resetting annotations', () => {
    jest
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('article-1')
      .mockReturnValueOnce('annotation-1');

    const article = storage.createArticle({
      title: 'Исходный заголовок',
      content: 'Текст статьи',
    });

    storage.createAnnotation({
      articleId: article.id,
      start: 0,
      end: 5,
      color: '#111111',
      note: 'Комментарий',
      text: 'Текст',
    });
    route.setParamMap(article.id);

    const fixture = TestBed.createComponent(ArticleEdit);
    const component = fixture.componentInstance as unknown as ArticleEditAccess;

    fixture.detectChanges();
    component.updateDraft('title', 'Новый заголовок');
    component.saveArticle();

    expect(component.resetAnnotationsDialogMessage()).toBeNull();
    expect(storage.articleById(article.id)?.title).toBe('Новый заголовок');
    expect(storage.annotationsForArticle(article.id)).toHaveLength(1);
    expect(router.navigate).toHaveBeenCalledWith(['/articles', article.id]);
  });

  it('asks for confirmation before resetting annotations on content change', () => {
    jest
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('article-1')
      .mockReturnValueOnce('annotation-1');

    const article = storage.createArticle({
      title: 'Статья',
      content: 'Старый текст',
    });

    storage.createAnnotation({
      articleId: article.id,
      start: 0,
      end: 6,
      color: '#111111',
      note: 'Комментарий',
      text: 'Старый',
    });
    route.setParamMap(article.id);

    const fixture = TestBed.createComponent(ArticleEdit);
    const component = fixture.componentInstance as unknown as ArticleEditAccess;

    fixture.detectChanges();
    component.updateDraft('content', 'Новый текст');
    component.saveArticle();

    expect(component.resetAnnotationsDialogMessage()).toContain(article.title);
    expect(storage.articleById(article.id)?.content).toBe('Старый текст');

    component.confirmResetAnnotations();

    expect(storage.articleById(article.id)?.content).toBe('Новый текст');
    expect(storage.annotationsForArticle(article.id)).toHaveLength(0);
    expect(router.navigate).toHaveBeenCalledWith(['/articles', article.id]);
  });

  it('deletes the current article after confirmation and navigates to the next one', () => {
    jest
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('article-1')
      .mockReturnValueOnce('article-2');

    const firstArticle = storage.createArticle({
      title: 'Первая статья',
      content: 'Текст 1',
    });
    const secondArticle = storage.createArticle({
      title: 'Вторая статья',
      content: 'Текст 2',
    });
    route.setParamMap(secondArticle.id);

    const fixture = TestBed.createComponent(ArticleEdit);
    const component = fixture.componentInstance as unknown as ArticleEditAccess;

    fixture.detectChanges();
    component.deleteCurrentArticle();

    expect(component.deleteDialogMessage()).toContain(secondArticle.title);

    component.confirmDeleteArticle();

    expect(storage.articleById(secondArticle.id)).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/articles', firstArticle.id]);
  });
});
