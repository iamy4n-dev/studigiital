import type { learning_type } from "@studigiital/api-client";

const PLACEHOLDERS: Record<learning_type, string> = {
  language_learner: "Paste a phrase, dialogue, or vocab you just encountered…",
  professional: "Jot down a concept, decision, or insight from work…",
  student: "Type a key idea, definition, or question from your studies…",
  generic: "What did you just learn? Capture it here…",
};

export function getPlaceholder(learningType: learning_type | null): string {
  if (!learningType) return PLACEHOLDERS.generic;
  return PLACEHOLDERS[learningType];
}
