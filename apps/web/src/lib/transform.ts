export type FlashcardPair = {
  front: string;
  back: string;
};

export type FlashcardResult = {
  skill_name: "generate_flashcard";
  cards: FlashcardPair[];
  source_summary: string;
  suggested_tags: string[];
  artifact_id: string;
};

export type NoteResult = {
  skill_name: "generate_note";
  title: string;
  body_markdown: string;
  key_points: string[];
  suggested_tags: string[];
  artifact_id: string;
};

export type QuizQuestion = {
  stem: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

export type QuizResult = {
  skill_name: "generate_quiz";
  questions: QuizQuestion[];
  suggested_tags: string[];
  artifact_id: string;
};

export type SuggestTagsResult = {
  suggestions: string[];
};

export type TransformResult = FlashcardResult | NoteResult | QuizResult;
