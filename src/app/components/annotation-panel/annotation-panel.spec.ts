import { TestBed } from '@angular/core/testing';

import { SelectionCaptureKind } from '../../enums/selection-capture-kind.enum';
import type { Annotation } from '../../interfaces/annotation.interface';
import type { ArticleDraft } from '../../interfaces/article.interface';
import type { PendingSelection } from '../../interfaces/pending-selection.interface';
import type { TextSegment } from '../../interfaces/text-segment.interface';
import { AnnotationPanel } from './annotation-panel';

interface AnnotationPanelAccess {
  annotationSaved: { emit(payload: unknown): void };
  captureSelection(): void;
  getTooltipPosition(
    anchorRect: DOMRect,
    surfaceRect: DOMRect,
    tooltipWidth: number,
    tooltipHeight: number,
  ): { x: number; y: number };
  hasOverlappingAnnotation(start: number, end: number): boolean;
  normalizeSelection(content: string, start: number, end: number): PendingSelection | null;
  noteControl: { setValue(value: string): void; value: string };
  saveAnnotation(): void;
  selectionCaptured: { emit(payload: unknown): void };
}

describe('AnnotationPanel', () => {
  const draft: ArticleDraft = {
    id: 'article-1',
    title: 'Статья',
    content: '  Текст статьи  ',
  };
  const renderedSegments: TextSegment[] = [
    {
      text: '  Текст статьи  ',
      annotation: null,
    },
  ];
  const annotations: Annotation[] = [
    {
      id: 'annotation-1',
      articleId: 'article-1',
      start: 2,
      end: 7,
      color: '#111111',
      note: 'Комментарий',
      text: 'Текст',
      createdAt: '2026-03-24T10:00:00.000Z',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnnotationPanel],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function createComponent(
    overrides?: Partial<{
      annotationColor: string;
      annotationNote: string;
      annotations: Annotation[];
      canAnnotate: boolean;
      pendingSelection: PendingSelection | null;
    }>,
  ): ReturnType<typeof TestBed.createComponent<AnnotationPanel>> {
    const fixture = TestBed.createComponent(AnnotationPanel);

    fixture.componentRef.setInput('draft', draft);
    fixture.componentRef.setInput('canAnnotate', overrides?.canAnnotate ?? true);
    fixture.componentRef.setInput('annotations', overrides?.annotations ?? annotations);
    fixture.componentRef.setInput('renderedSegments', renderedSegments);
    fixture.componentRef.setInput('pendingSelection', overrides?.pendingSelection ?? null);
    fixture.componentRef.setInput('palette', ['#111111', '#222222']);
    fixture.componentRef.setInput('annotationColor', overrides?.annotationColor ?? '#111111');
    fixture.componentRef.setInput('annotationNote', overrides?.annotationNote ?? '');
    fixture.detectChanges();

    return fixture;
  }

  it('эмитит сохранённые данные аннотации', () => {
    const selection: PendingSelection = {
      start: 2,
      end: 7,
      text: 'Текст',
    };
    const fixture = createComponent({
      pendingSelection: selection,
      annotationColor: '#222222',
      annotationNote: 'Исходный комментарий',
    });
    const component = fixture.componentInstance as unknown as AnnotationPanelAccess;
    const emitSpy = jest.spyOn(component.annotationSaved, 'emit');

    component.noteControl.setValue('Новый комментарий');
    component.saveAnnotation();

    expect(emitSpy).toHaveBeenCalledWith({
      selection,
      color: '#222222',
      note: 'Новый комментарий',
    });
  });

  it('эмитит специальный результат, когда аннотации недоступны', () => {
    const fixture = createComponent({ canAnnotate: false });
    const component = fixture.componentInstance as unknown as AnnotationPanelAccess;
    const emitSpy = jest.spyOn(component.selectionCaptured, 'emit');

    component.captureSelection();

    expect(emitSpy).toHaveBeenCalledWith({
      kind: SelectionCaptureKind.RequiresSave,
    });
  });

  it('нормализует выделение, обрезая пробелы по краям', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as unknown as AnnotationPanelAccess;

    expect(component.normalizeSelection('  Текст статьи  ', 0, 9)).toEqual({
      start: 2,
      end: 9,
      text: 'Текст с',
    });
  });

  it('определяет пересечение выделения с существующими аннотациями', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as unknown as AnnotationPanelAccess;

    expect(component.hasOverlappingAnnotation(4, 8)).toBe(true);
    expect(component.hasOverlappingAnnotation(8, 10)).toBe(false);
  });

  it('сдвигает tooltip влево и удерживает его в границах поверхности', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as unknown as AnnotationPanelAccess;
    const anchorRect = new DOMRect(220, 210, 40, 20);
    const surfaceRect = new DOMRect(100, 100, 180, 120);

    expect(component.getTooltipPosition(anchorRect, surfaceRect, 100, 90)).toEqual({
      x: 14,
      y: 22,
    });
  });
});
