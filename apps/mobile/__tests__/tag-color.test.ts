import { getTagColor } from "../src/tag-color";

test("same tag name always returns the same color", () => {
  const color1 = getTagColor("biology", {});
  const color2 = getTagColor("biology", {});
  expect(color1).toBe(color2);
});

test("returns existing color for a tag that already has one", () => {
  const existing = { biology: "#ff6b6b" };
  expect(getTagColor("biology", existing)).toBe("#ff6b6b");
});

test("different tag names return colors from the palette", () => {
  const colorA = getTagColor("math", {});
  const colorB = getTagColor("chemistry", {});
  expect(colorA).toMatch(/^#[0-9a-f]{6}$/i);
  expect(colorB).toMatch(/^#[0-9a-f]{6}$/i);
});

test("tags already in use are not re-assigned the same color for a new tag", () => {
  const used: Record<string, string> = {};
  const colors = new Set<string>();

  // Assign colors to 8 unique tags and collect them
  const names = ["math", "biology", "chemistry", "physics", "history", "art", "music", "sports"];
  for (const name of names) {
    const color = getTagColor(name, used);
    used[name] = color;
    colors.add(color);
  }

  // With 8 distinct tags and a palette ≥ 8 colors, there should be no collision
  expect(colors.size).toBe(names.length);
});
