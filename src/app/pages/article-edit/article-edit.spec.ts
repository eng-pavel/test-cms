import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { ParamMap } from '@angular/router';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import type { Observable } from 'rxjs';
import { BehaviorSubject } from 'rxjs';

import { ArticleEditor } from '../../components/article-editor/article-editor';
import { ConfirmDialog } from '../../components/confirm-dialog/confirm-dialog';
import { StorageService } from '../../services/storage.service';
import { ArticleEdit } from './article-edit';

const ARTICLE_ID_1 = '11111111-1111-4111-8111-111111111111';
const ARTICLE_ID_2 = '22222222-2222-4222-8222-222222222222';
const ANNOTATION_ID_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function createActivatedRouteStub(): {
  readonly paramMap: Observable<ParamMap>;
  readonly snapshot: { paramMap: ParamMap };
  setParamMap(articleId: string | null): void;
} {
  const paramMapSubject = new BehaviorSubject(convertToParamMap({}));
  let snapshot = { paramMap: convertToParamMap({}) };

  return {
    get paramMap(): Observable<ParamMap> {
      return paramMapSubject.asObservable();
    },
    get snapshot(): { paramMap: ParamMap } {
      return snapshot;
    },
    setParamMap(articleId: string | null): void {
      const paramMap = convertToParamMap(articleId ? { articleId } : {});

      snapshot = { paramMap };
      paramMapSubject.next(paramMap);
    },
  };
}

describe('ArticleEdit', () => {
  let route: ReturnType<typeof createActivatedRouteStub>;
  let router: { navigate: jest.Mock<Promise<boolean>, [unknown[]]> };
  let storage: StorageService;

  beforeEach(async () => {
    localStorage.clear();
    jest.restoreAllMocks();
    route = createActivatedRouteStub();
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

  function getArticleEditor(fixture: ComponentFixture<ArticleEdit>): ArticleEditor {
    return fixture.debugElement.query(By.directive(ArticleEditor)).componentInstance;
  }

  function getConfirmDialog(fixture: ComponentFixture<ArticleEdit>): ConfirmDialog | null {
    return fixture.debugElement.query(By.directive(ConfirmDialog))?.componentInstance ?? null;
  }

  it('должен создавать новую статью и переходить на её страницу', () => {
    jest.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(ARTICLE_ID_1);
    route.setParamMap(null);

    const fixture = TestBed.createComponent(ArticleEdit);

    fixture.detectChanges();

    const editor = getArticleEditor(fixture);

    editor.draftTitleChanged.emit('Новая статья');
    editor.draftContentChanged.emit('Текст статьи');
    editor.articleSaved.emit();

    expect(storage.articleById(ARTICLE_ID_1)?.title).toBe('Новая статья');
    expect(router.navigate).toHaveBeenCalledWith(['/articles', ARTICLE_ID_1]);
  });

  it('должен сохранять изменение заголовка без сброса аннотаций', () => {
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

    fixture.detectChanges();

    const editor = getArticleEditor(fixture);

    editor.draftTitleChanged.emit('Новый заголовок');
    editor.articleSaved.emit();
    fixture.detectChanges();

    expect(getConfirmDialog(fixture)).toBeNull();
    expect(storage.articleById(article.id)?.title).toBe('Новый заголовок');
    expect(storage.annotationsForArticle(article.id)).toHaveLength(1);
    expect(router.navigate).toHaveBeenCalledWith(['/articles', article.id]);
  });

  it('должен запрашивать подтверждение перед сбросом аннотаций при изменении текста', () => {
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

    fixture.detectChanges();

    const editor = getArticleEditor(fixture);

    editor.draftContentChanged.emit('Новый текст');
    editor.articleSaved.emit();
    fixture.detectChanges();

    const dialog = getConfirmDialog(fixture);

    expect(dialog?.message()).toContain(article.title);
    expect(storage.articleById(article.id)?.content).toBe('Старый текст');

    dialog?.confirmed.emit();

    expect(storage.articleById(article.id)?.content).toBe('Новый текст');
    expect(storage.annotationsForArticle(article.id)).toHaveLength(0);
    expect(router.navigate).toHaveBeenCalledWith(['/articles', article.id]);
  });

  it('должен удалять текущую статью после подтверждения и переходить к следующей', () => {
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

    fixture.detectChanges();

    const editor = getArticleEditor(fixture);

    editor.articleDeleted.emit();
    fixture.detectChanges();

    const dialog = getConfirmDialog(fixture);

    expect(dialog?.message()).toContain(secondArticle.title);

    dialog?.confirmed.emit();

    expect(storage.articleById(secondArticle.id)).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/articles', firstArticle.id]);
  });
});
