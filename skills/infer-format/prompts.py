INFER_FORMAT_PROMPT = """\
Analyze the following learning content and determine the best output format.

Rules:
- Mistake or error correction → "generate-flashcard"
- Concept explanation or summary → "generate-note"
- List of facts or Q&A material → "generate-quiz"

Content:
{text}
"""
