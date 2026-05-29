"use client";

import { useEffect, useState } from "react";
import { tagColors } from "@/lib/tagColor";

type ApiTagOut = { name: string; bg: string; text: string };

export function TagConfirm({
  suggestions,
  artifactId,
  getToken,
  onSaved,
}: {
  suggestions: string[];
  artifactId: string;
  getToken: () => Promise<string | null>;
  onSaved?: (tags: string[]) => void;
}) {
  const [existingTags, setExistingTags] = useState<ApiTagOut[]>([]);
  const [tags, setTags] = useState<string[]>(suggestions);
  const [newTag, setNewTag] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function fetchExisting() {
      try {
        const token = await getToken();
        const res = await fetch("/api/v1/tags/", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) setExistingTags(await res.json());
      } catch {
        // non-critical
      }
    }
    fetchExisting();
  }, [getToken]);

  function addTag(name: string) {
    const clean = name.trim().toLowerCase();
    if (!clean || tags.includes(clean)) return;
    setTags((prev) => [...prev, clean]);
  }

  function removeTag(name: string) {
    setTags((prev) => prev.filter((t) => t !== name));
  }

  function handleInput() {
    addTag(newTag);
    setNewTag("");
  }

  async function save() {
    try {
      const token = await getToken();
      await fetch(`/api/v1/artifacts/${artifactId}/tags`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(tags),
      });
      setSaved(true);
      onSaved?.(tags);
    } catch {
      // non-critical; silently ignore
    }
  }

  if (saved) {
    return (
      <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
        {tags.map((tag) => {
          const { bg, text } = tagColors(tag);
          return (
            <span
              key={tag}
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "0.2rem 0.5rem",
                borderRadius: 999,
                background: bg,
                color: text,
              }}
            >
              {tag}
            </span>
          );
        })}
      </div>
    );
  }

  const pickable = existingTags.filter((t) => !tags.includes(t.name));

  return (
    <div style={styles.container}>
      <p style={styles.label}>Tags</p>

      <div style={styles.chipRow}>
        {tags.map((tag) => {
          const { bg, text } = tagColors(tag);
          return (
            <span key={tag} style={{ ...styles.chip, background: bg, color: text }}>
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                onClick={() => removeTag(tag)}
                style={{ ...styles.chipRemove, color: text }}
              >
                ×
              </button>
            </span>
          );
        })}
        {tags.length === 0 && (
          <span style={styles.emptyHint}>No tags yet — add one below</span>
        )}
      </div>

      <div style={styles.inputRow}>
        <input
          style={styles.input}
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleInput())}
          placeholder="Add tag…"
        />
        {newTag.trim() && (
          <button type="button" style={styles.addButton} onClick={handleInput}>
            Add
          </button>
        )}
      </div>

      {pickable.length > 0 && (
        <>
          <p style={styles.label}>Your tags</p>
          <div style={styles.chipRow}>
            {pickable.map(({ name, bg, text }) => (
              <button
                key={name}
                type="button"
                onClick={() => addTag(name)}
                style={{ ...styles.pickable, borderColor: bg, color: text }}
              >
                + {name}
              </button>
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        style={{ ...styles.saveButton, opacity: tags.length === 0 ? 0.4 : 1 }}
        disabled={tags.length === 0}
        onClick={save}
      >
        {tags.length > 0 ? `Save ${tags.length} tag${tags.length !== 1 ? "s" : ""} →` : "Add at least one tag"}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "0.625rem",
    padding: "0.875rem",
    background: "#f9fafb",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
  },
  label: {
    fontSize: "0.75rem",
    color: "#9ca3af",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    margin: 0,
  },
  chipRow: {
    display: "flex",
    gap: "0.375rem",
    flexWrap: "wrap",
    alignItems: "center",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    fontSize: "0.8125rem",
    fontWeight: 600,
    padding: "0.2rem 0.375rem 0.2rem 0.625rem",
    borderRadius: 999,
  },
  chipRemove: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    lineHeight: 1,
    padding: 0,
    opacity: 0.65,
    fontWeight: 400,
  },
  emptyHint: {
    fontSize: "0.8125rem",
    color: "#9ca3af",
    fontStyle: "italic",
  },
  inputRow: {
    display: "flex",
    gap: "0.375rem",
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontSize: "0.8125rem",
    padding: "0.3rem 0.6rem",
    border: "1.5px solid #e5e7eb",
    borderRadius: 6,
    outline: "none",
    fontFamily: "inherit",
    background: "#fff",
  },
  addButton: {
    fontSize: "0.8125rem",
    fontWeight: 600,
    padding: "0.3rem 0.625rem",
    borderRadius: 6,
    border: "1.5px solid #d1d5db",
    background: "#fff",
    color: "#374151",
    cursor: "pointer",
  },
  pickable: {
    fontSize: "0.8125rem",
    fontWeight: 600,
    padding: "0.2rem 0.6rem",
    borderRadius: 999,
    border: "1.5px solid",
    background: "#fff",
    cursor: "pointer",
  },
  saveButton: {
    alignSelf: "flex-start",
    fontSize: "0.8125rem",
    fontWeight: 600,
    padding: "0.35rem 0.875rem",
    borderRadius: 6,
    border: "none",
    background: "#1a1a1a",
    color: "#fff",
    cursor: "pointer",
  },
};
