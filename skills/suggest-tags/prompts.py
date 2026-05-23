SUGGEST_TAGS_PROMPT = """\
Given the following learning content, suggest 2-3 concise tags that categorize it.
Prefer existing tags when relevant. Return only tag names, no explanations.

Existing tags: {existing_tags}

Content:
{text}
"""
