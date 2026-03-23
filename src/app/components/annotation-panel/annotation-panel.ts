import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SelectionCaptureKind } from '../../enums/selection-capture-kind.enum';
import type { Annotation } from '../../interfaces/annotation.interface';
import type { ArticleDraft } from '../../interfaces/article.interface';
import type { PendingSelection } from '../../interfaces/pending-selection.interface';
import type { SelectionCaptureResult } from '../../interfaces/selection-capture-result.interface';
import type { TextSegment } from '../../interfaces/text-segment.interface';

interface AnnotationDraftPayload {
  color: string;
  note: string;
  selection: PendingSelection;
}

interface TooltipState {
  annotation: Annotation;
  x: number;
  y: number;
  visible: boolean;
}

const TOOLTIP_GAP = 6;
const SURFACE_PADDING = 8;

/**
 * Панель текста статьи, аннотаций и подсказки.
 */
@Component({
  selector: 'app-annotation-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './annotation-panel.html',
  styleUrl: './annotation-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnotationPanel {
  protected readonly previewTextRef = viewChild<ElementRef<HTMLElement>>('previewText');
  protected readonly surfaceRef = viewChild<ElementRef<HTMLElement>>('surfaceBox');
  protected readonly tooltipRef = viewChild<ElementRef<HTMLElement>>('tooltipBox');
  protected readonly tooltip = signal<TooltipState | null>(null);
  protected readonly annotationsCount = computed(() => this.annotations().length);

  readonly draft = input.required<ArticleDraft>();
  readonly canAnnotate = input(false);
  readonly annotations = input.required<Annotation[]>();
  readonly renderedSegments = input.required<TextSegment[]>();
  readonly pendingSelection = input<PendingSelection | null>(null);
  readonly palette = input.required<string[]>();
  readonly annotationColor = input.required<string>();
  readonly annotationNote = input.required<string>();

  readonly selectionCaptured = output<SelectionCaptureResult>();
  readonly annotationColorChanged = output<string>();
  readonly annotationNoteChanged = output<string>();
  readonly annotationSaved = output<AnnotationDraftPayload>();
  readonly pendingSelectionCleared = output<void>();
  readonly annotationRemoved = output<string>();

  /**
   * Захватить выделенный фрагмент текста и передать результат родительской странице.
   */
  protected captureSelection(): void {
    if (!this.canAnnotate()) {
      this.selectionCaptured.emit({ kind: SelectionCaptureKind.RequiresSave });
      return;
    }

    const root = this.previewTextRef()?.nativeElement;
    const selection = window.getSelection();

    if (!root || !selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);

    if (range.collapsed) {
      this.selectionCaptured.emit({ kind: SelectionCaptureKind.Cleared });
      return;
    }

    if (!root.contains(range.commonAncestorContainer) && range.commonAncestorContainer !== root) {
      return;
    }

    let start = this.getOffsetWithin(root, range.startContainer, range.startOffset);
    let end = this.getOffsetWithin(root, range.endContainer, range.endOffset);

    if (start > end) {
      [start, end] = [end, start];
    }

    const normalized = this.normalizeSelection(this.draft().content, start, end);

    if (!normalized) {
      this.selectionCaptured.emit({ kind: SelectionCaptureKind.Cleared });
      selection.removeAllRanges();
      return;
    }

    if (this.hasOverlappingAnnotation(normalized.start, normalized.end)) {
      this.selectionCaptured.emit({ kind: SelectionCaptureKind.Overlap });
      selection.removeAllRanges();
      return;
    }

    this.selectionCaptured.emit({ kind: SelectionCaptureKind.Selected, selection: normalized });
    selection.removeAllRanges();
  }

  /**
   * Отправить текущий черновик аннотации после выбора текста и заполнения комментария.
   */
  protected saveAnnotation(): void {
    const selection = this.pendingSelection();

    if (!selection) {
      return;
    }

    this.annotationSaved.emit({
      selection,
      color: this.annotationColor(),
      note: this.annotationNote(),
    });
  }

  /**
   * Измерить и показать всплывающую подсказку рядом с наведенной аннотацией.
   *
   * @param event Событие наведения на аннотированный фрагмент.
   * @param annotation Аннотация, для которой нужно показать подсказку.
   */
  protected showTooltip(event: MouseEvent, annotation: Annotation): void {
    const target = event.currentTarget;
    const surface = this.surfaceRef()?.nativeElement;

    if (!(target instanceof HTMLElement) || !surface) {
      return;
    }

    const anchorRect = target.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();

    this.tooltip.set({
      annotation,
      x: 0,
      y: 0,
      visible: false,
    });

    window.requestAnimationFrame(() => {
      const tooltipElement = this.tooltipRef()?.nativeElement;
      const currentTooltip = this.tooltip();

      if (!tooltipElement || !currentTooltip || currentTooltip.annotation.id !== annotation.id) {
        return;
      }

      const position = this.getTooltipPosition(
        anchorRect,
        surfaceRect,
        tooltipElement.offsetWidth,
        tooltipElement.offsetHeight,
      );

      if (position.x !== currentTooltip.x || position.y !== currentTooltip.y) {
        this.tooltip.set({
          annotation,
          ...position,
          visible: true,
        });
        return;
      }

      this.tooltip.set({
        ...currentTooltip,
        visible: true,
      });
    });
  }

  /**
   * Скрыть подсказку, когда указатель уходит с аннотированного фрагмента.
   */
  protected hideTooltip(): void {
    this.tooltip.set(null);
  }

  /**
   * Проверить, пересекается ли новое выделение с уже существующей аннотацией.
   *
   * @param start Начальная позиция нового выделения.
   * @param end Конечная позиция нового выделения.
   */
  private hasOverlappingAnnotation(start: number, end: number): boolean {
    return this.annotations().some(
      (annotation: Annotation) => start < annotation.end && end > annotation.start,
    );
  }

  /**
   * Убрать начальные и конечные пробелы у захваченного выделения.
   *
   * @param content Полный текст статьи.
   * @param start Начальная позиция выделения.
   * @param end Конечная позиция выделения.
   */
  private normalizeSelection(content: string, start: number, end: number): PendingSelection | null {
    let normalizedStart = start;
    let normalizedEnd = end;

    while (normalizedStart < normalizedEnd && /\s/.test(content[normalizedStart])) {
      normalizedStart += 1;
    }

    while (normalizedEnd > normalizedStart && /\s/.test(content[normalizedEnd - 1])) {
      normalizedEnd -= 1;
    }

    const text = content.slice(normalizedStart, normalizedEnd);

    if (!text) {
      return null;
    }

    return {
      start: normalizedStart,
      end: normalizedEnd,
      text,
    };
  }

  /**
   * Перевести координаты DOM-диапазона в символьное смещение внутри текста превью.
   *
   * @param root Корневой элемент текста превью.
   * @param node Узел, относительно которого вычисляется смещение.
   * @param offset Смещение внутри DOM-узла.
   */
  private getOffsetWithin(root: HTMLElement, node: Node, offset: number): number {
    const range = document.createRange();
    range.selectNodeContents(root);
    range.setEnd(node, offset);

    return range.toString().length;
  }

  /**
   * Вычислить видимую позицию подсказки рядом с аннотированным фрагментом.
   *
   * @param anchorRect Границы аннотированного фрагмента.
   * @param surfaceRect Границы поверхности, внутри которой рисуется подсказка.
   * @param tooltipWidth Фактическая ширина подсказки.
   * @param tooltipHeight Фактическая высота подсказки.
   */
  private getTooltipPosition(
    anchorRect: DOMRect,
    surfaceRect: DOMRect,
    tooltipWidth: number,
    tooltipHeight: number,
  ): { x: number; y: number } {
    const anchorLeft = anchorRect.left - surfaceRect.left;
    const anchorRight = anchorRect.right - surfaceRect.left;
    const anchorTop = anchorRect.top - surfaceRect.top;
    const anchorBottom = anchorRect.bottom - surfaceRect.top;

    const rightX = anchorRight + TOOLTIP_GAP;
    const leftX = anchorLeft - tooltipWidth - TOOLTIP_GAP;
    const fitsRight = rightX + tooltipWidth <= surfaceRect.width - SURFACE_PADDING;

    const x = fitsRight
      ? rightX
      : Math.max(
          SURFACE_PADDING,
          Math.min(leftX, surfaceRect.width - tooltipWidth - SURFACE_PADDING),
        );

    const topY = anchorTop;
    const bottomY = anchorBottom - tooltipHeight;
    const maxY = Math.max(SURFACE_PADDING, surfaceRect.height - tooltipHeight - SURFACE_PADDING);

    if (topY + tooltipHeight <= surfaceRect.height - SURFACE_PADDING) {
      return {
        x,
        y: Math.max(SURFACE_PADDING, Math.min(topY, maxY)),
      };
    }

    return {
      x,
      y: Math.max(SURFACE_PADDING, Math.min(bottomY, maxY)),
    };
  }
}
