export interface Article {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleDraft {
  id: string | null;
  title: string;
  content: string;
}
