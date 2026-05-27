import type {
  FlashcardTransformResponse,
  NoteTransformResponse,
  QuizTransformResponse,
} from "@studigiital/api-client";

export type TransformResponse =
  | FlashcardTransformResponse
  | NoteTransformResponse
  | QuizTransformResponse;
