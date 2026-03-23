import type { Annotation } from './annotation.interface';

export interface TextSegment {
  text: string;
  annotation: Annotation | null;
}
