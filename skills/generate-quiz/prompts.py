GENERATE_QUIZ_PROMPT = """\
Generate {question_count} multiple-choice quiz questions from the following content.

Requirements:
- 3-4 answer options per question
- Exactly one correct answer
- Distractors should be plausible but clearly wrong
- Tags: {tags}

Content:
{text}
"""
