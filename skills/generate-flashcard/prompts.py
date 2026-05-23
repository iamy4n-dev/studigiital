GENERATE_FLASHCARD_PROMPT = """\
Convert the following learning content into Anki-compatible flashcards.

Requirements:
- Each card has a clear question (front) and concise answer (back)
- One card per distinct concept or mistake
- Front: short question or prompt
- Back: direct answer, no padding
- Tags: {tags}

Content:
{text}
"""
