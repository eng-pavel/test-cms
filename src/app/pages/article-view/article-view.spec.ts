import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { ParamMap } from '@angular/router';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import type { Observable } from 'rxjs';
import { BehaviorSubject } from 'rxjs';

import { AnnotationPanel } from '../../components/annotation-panel/annotation-panel';
import { ConfirmDialog } from '../../components/confirm-dialog/confirm-dialog';
import { SelectionCaptureKind } from '../../enums/selection-capture-kind.enum';
import type { PendingSelection } from '../../interfaces/pending-selection.interface';
import { StorageService } from '../../services/storage.service';
import { ArticleView } from './article-view';

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

describe('ArticleView', () => {
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

  function getAnnotationPanel(fixture: ComponentFixture<ArticleView>): AnnotationPanel {
    return fixture.debugElement.query(By.directive(AnnotationPanel)).componentInstance;
  }

  function getConfirmDialog(fixture: ComponentFixture<ArticleView>): ConfirmDialog | null {
    return fixture.debugElement.query(By.directive(ConfirmDialog))?.componentInstance ?? null;
  }

  function getStatusMessage(fixture: ComponentFixture<ArticleView>): string {
    return fixture.nativeElement.querySelector('.status-strip span')?.textContent?.trim() ?? '';
  }

  it('должен выбирать статью из маршрута при инициализации', () => {
    jest.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(ARTICLE_ID_1);

    const article = storage.createArticle({
      title: 'Статья',
      content: 'Текст статьи',
    });
    route.setParamMap(article.id);

    const fixture = TestBed.createComponent(ArticleView);

    fixture.detectChanges();

    expect(storage.selectedArticleId()).toBe(article.id);
    expect(getStatusMessage(fixture)).toContain(article.title);
  });

  it('должен переходить в режим редактирования текущей статьи', () => {
    jest.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(ARTICLE_ID_1);

    const article = storage.createArticle({
      title: 'Статья',
      content: 'Текст статьи',
    });
    route.setParamMap(article.id);

    const fixture = TestBed.createComponent(ArticleView);

    fixture.detectChanges();
    fixture.nativeElement.querySelector('.article-actions button')?.click();

    expect(router.navigate).toHaveBeenCalledWith(['/articles', article.id, 'edit']);
  });

  it('должен создавать аннотацию из выбранного фрагмента и очищать черновик', () => {
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
    const selection: PendingSelection = {
      start: 0,
      end: 5,
      text: 'Текст',
    };

    fixture.detectChanges();

    const panel = getAnnotationPanel(fixture);

    panel.selectionCaptured.emit({
      kind: SelectionCaptureKind.Selected,
      selection,
    });
    panel.annotationSaved.emit({
      selection,
      color: '#111111',
      note: '  Комментарий  ',
    });
    fixture.detectChanges();

    expect(storage.annotationsForArticle(article.id)).toHaveLength(1);
    expect(storage.annotationsForArticle(article.id)[0]?.note).toBe('Комментарий');
    expect(getStatusMessage(fixture)).toBe('Аннотация сохранена.');
  });

  it('должен удалять аннотацию и обновлять статусное сообщение', () => {
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

    fixture.detectChanges();

    const panel = getAnnotationPanel(fixture);

    panel.annotationRemoved.emit(annotation.id);
    fixture.detectChanges();

    expect(storage.annotationsForArticle(article.id)).toHaveLength(0);
    expect(getStatusMessage(fixture)).toBe('Аннотация удалена.');
  });

  it('должен удалять текущую статью после подтверждения и открывать следующую', () => {
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

    fixture.detectChanges();
    fixture.nativeElement.querySelector('.danger-button')?.click();
    fixture.detectChanges();

    const dialog = getConfirmDialog(fixture);

    expect(dialog?.message()).toContain(secondArticle.title);

    dialog?.confirmed.emit();

    expect(storage.articleById(secondArticle.id)).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/articles', firstArticle.id]);
  });
});
