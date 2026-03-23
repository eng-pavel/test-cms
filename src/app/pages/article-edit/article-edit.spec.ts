import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import type { Observable } from 'rxjs';
import { BehaviorSubject } from 'rxjs';

import type { ArticleDraft } from '../../interfaces/article.interface';
import { StorageService } from '../../services/storage.service';
import { ArticleEdit } from './article-edit';

const ARTICLE_ID_1 = '11111111-1111-4111-8111-111111111111';
const ARTICLE_ID_2 = '22222222-2222-4222-8222-222222222222';
const ANNOTATION_ID_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

class ActivatedRouteStub {
  private readonly paramMapSubject = new BehaviorSubject(convertToParamMap({}));

  snapshot = { paramMap: convertToParamMap({}) };

  get paramMap(): Observable<ReturnType<typeof convertToParamMap>> {
    return this.paramMapSubject.asObservable();
  }

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

  it('создаёт новую статью и переходит на её страницу', () => {
    jest.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(ARTICLE_ID_1);
    route.setParamMap(null);

    const fixture = TestBed.createComponent(ArticleEdit);
    const component = fixture.componentInstance as unknown as ArticleEditAccess;

    fixture.detectChanges();
    component.updateDraft('title', 'Новая статья');
    component.updateDraft('content', 'Текст статьи');
    component.saveArticle();

    expect(storage.articleById(ARTICLE_ID_1)?.title).toBe('Новая статья');
    expect(router.navigate).toHaveBeenCalledWith(['/articles', ARTICLE_ID_1]);
  });

  it('сохраняет изменение заголовка без сброса аннотаций', () => {
    jest
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(ARTICLE_ID_1)
      .mockReturnValueOnce(ANNOTATION_ID_1);

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

  it('запрашивает подтверждение перед сбросом аннотаций при изменении текста', () => {
    jest
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(ARTICLE_ID_1)
      .mockReturnValueOnce(ANNOTATION_ID_1);

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

  it('удаляет текущую статью после подтверждения и переходит к следующей', () => {
    jest
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(ARTICLE_ID_1)
      .mockReturnValueOnce(ARTICLE_ID_2);

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
