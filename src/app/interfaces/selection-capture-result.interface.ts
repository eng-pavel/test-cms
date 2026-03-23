import type { SelectionCaptureKind } from '../enums/selection-capture-kind.enum';
import type { PendingSelection } from './pending-selection.interface';

export type SelectionCaptureResult =
  | { kind: SelectionCaptureKind.Cleared }
  | { kind: SelectionCaptureKind.Selected; selection: PendingSelection }
  | { kind: SelectionCaptureKind.Overlap }
  | { kind: SelectionCaptureKind.RequiresSave };
