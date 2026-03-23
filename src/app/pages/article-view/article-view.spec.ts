import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import type { Observable } from 'rxjs';
import { BehaviorSubject } from 'rxjs';

import { SelectionCaptureKind } from '../../enums/selection-capture-kind.enum';
import type { PendingSelection } from '../../interfaces/pending-selection.interface';
import type { SelectionCaptureResult } from '../../interfaces/selection-capture-result.interface';
import { StorageService } from '../../services/storage.service';
import { ArticleView } from './article-view';

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

interface AnnotationDraftPayload {
  color: string;
  note: string;
  selection: PendingSelection;
}

interface ArticleViewAccess {
  annotations(): { id: string }[];
  clearPendingSelection(): void;
  confirmDeleteArticle(): void;
  deleteArticle(): void;
  deleteDialogMessage(): string | null;
  editArticle(): void;
  handleSelectionCaptured(result: SelectionCaptureResult): void;
  pendingSelection(): PendingSelection | null;
  removeAnnotation(annotationId: string): void;
  saveAnnotation(payload: AnnotationDraftPayload): void;
  statusMessage(): string;
}

describe('ArticleView', () => {
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
      imports: [ArticleView],
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

  it('выбирает статью из маршрута при инициализации', () => {
    jest.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(ARTICLE_ID_1);

    const article = storage.createArticle({
      title: 'Статья',
      content: 'Текст статьи',
    });
    route.setParamMap(article.id);

    const fixture = TestBed.createComponent(ArticleView);
    const component = fixture.componentInstance as unknown as ArticleViewAccess;

    fixture.detectChanges();

    expect(storage.selectedArticleId()).toBe(article.id);
    expect(component.statusMessage()).toContain(article.title);
  });

  it('переходит в режим редактирования текущей статьи', () => {
    jest.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(ARTICLE_ID_1);

    const article = storage.createArticle({
      title: 'Статья',
      content: 'Текст статьи',
    });
    route.setParamMap(article.id);

    const fixture = TestBed.createComponent(ArticleView);
    const component = fixture.componentInstance as unknown as ArticleViewAccess;

    fixture.detectChanges();
    component.editArticle();

    expect(router.navigate).toHaveBeenCalledWith(['/articles', article.id, 'edit']);
  });

  it('создаёт аннотацию из выбранного фрагмента и очищает черновик', () => {
    jest
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(ARTICLE_ID_1)
      .mockReturnValueOnce(ANNOTATION_ID_1);

    const article = storage.createArticle({
      title: 'Статья',
      content: 'Текст статьи',
    });
    route.setParamMap(article.id);

    const fixture = TestBed.createComponent(ArticleView);
    const component = fixture.componentInstance as unknown as ArticleViewAccess;
    const selection: PendingSelection = {
      start: 0,
      end: 5,
      text: 'Текст',
    };

    fixture.detectChanges();
    component.handleSelectionCaptured({
      kind: SelectionCaptureKind.Selected,
      selection,
    });
    component.saveAnnotation({
      selection,
      color: '#111111',
      note: '  Комментарий  ',
    });

    expect(storage.annotationsForArticle(article.id)).toHaveLength(1);
    expect(storage.annotationsForArticle(article.id)[0]?.note).toBe('Комментарий');
    expect(component.pendingSelection()).toBeNull();
    expect(component.statusMessage()).toBe('Аннотация сохранена.');
  });

  it('удаляет аннотацию и обновляет статусное сообщение', () => {
    jest
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(ARTICLE_ID_1)
      .mockReturnValueOnce(ANNOTATION_ID_1);

    const article = storage.createArticle({
      title: 'Статья',
      content: 'Текст статьи',
    });
    const annotation = storage.createAnnotation({
      articleId: article.id,
      start: 0,
      end: 5,
      color: '#111111',
      note: 'Комментарий',
      text: 'Текст',
    });
    route.setParamMap(article.id);

    const fixture = TestBed.createComponent(ArticleView);
    const component = fixture.componentInstance as unknown as ArticleViewAccess;

    fixture.detectChanges();
    component.removeAnnotation(annotation.id);

    expect(storage.annotationsForArticle(article.id)).toHaveLength(0);
    expect(component.statusMessage()).toBe('Аннотация удалена.');
  });

  it('удаляет текущую статью после подтверждения и открывает следующую', () => {
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

    const fixture = TestBed.createComponent(ArticleView);
    const component = fixture.componentInstance as unknown as ArticleViewAccess;

    fixture.detectChanges();
    component.deleteArticle();

    expect(component.deleteDialogMessage()).toContain(secondArticle.title);

    component.confirmDeleteArticle();

    expect(storage.articleById(secondArticle.id)).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/articles', firstArticle.id]);
  });
});
