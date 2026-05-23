export interface Tag {
  id: string;
  userId: string;
  name: string;
  color: string;
  masteryScore: number;
}

export interface TagSuggestion {
  name: string;
  confidence: number;
}
