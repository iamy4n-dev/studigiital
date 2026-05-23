export type ArtifactType = "note" | "flashcard" | "quiz";

export interface Flashcard {
  front: string;
  back: string;
}

export interface Note {
  title: string;
  markdown: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface Quiz {
  questions: QuizQuestion[];
}

export interface Artifact {
  id: string;
  captureId: string;
  userId: string;
  type: ArtifactType;
  content: Flashcard | Note | Quiz;
  createdAt: string;
}
