import { config } from "../src/middleware";

function matchesAny(path: string): boolean {
  return config.matcher.some((pattern) => {
    const re = new RegExp("^" + pattern + "$");
    return re.test(path);
  });
}

test("api proxy paths are not matched by Clerk middleware", () => {
  expect(matchesAny("/api/v1/artifacts/")).toBe(false);
  expect(matchesAny("/api/v1/captures/transform")).toBe(false);
  expect(matchesAny("/api/v1/tags/")).toBe(false);
});

test("page routes are still matched by Clerk middleware", () => {
  expect(matchesAny("/dashboard")).toBe(true);
  expect(matchesAny("/capture")).toBe(true);
  expect(matchesAny("/")).toBe(true);
});
