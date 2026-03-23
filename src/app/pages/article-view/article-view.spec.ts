import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { SelectionCaptureKind } from '../../enums/selection-capture-kind.enum';
import type { PendingSelection } from '../../interfaces/pending-selection.interface';
import type { SelectionCaptureResult } from '../../interfaces/selection-capture-result.interface';
import { StorageService } from '../../services/storage.service';
import { ArticleView } from './article-view';

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

  it('selects the article from the route on init', () => {
    jest.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('article-1');

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

  it('navigates to edit mode for the current article', () => {
    jest.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('article-1');

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

  it('creates an annotation from the selected fragment and clears the draft', () => {
    jest
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('article-1')
      .mockReturnValueOnce('annotation-1');

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

  it('deletes an annotation and updates the status message', () => {
    jest
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('article-1')
      .mockReturnValueOnce('annotation-1');

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

  it('deletes the current article after confirmation and opens the next one', () => {
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
