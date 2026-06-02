export async function fetchTagSuggestions(
  text: string,
  existingTags: string[] = [],
  token?: string | null,
): Promise<string[]> {
  try {
    const res = await fetch(
      `${process.env.EXPO_PUBLIC_API_URL ?? ""}/api/v1/captures/suggest-tags`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text, existing_tags: existingTags }),
      }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { suggestions: string[] };
    return data.suggestions;
  } catch {
    return [];
  }
}
