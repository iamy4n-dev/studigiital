import { isProtected } from "../src/lib/protectedRoutes";

test("dashboard is protected", () => {
  expect(isProtected("/dashboard")).toBe(true);
});

test("artifacts is protected", () => {
  expect(isProtected("/artifacts")).toBe(true);
});

test("dashboard subpath is protected", () => {
  expect(isProtected("/dashboard/settings")).toBe(true);
});

test("home page is not protected", () => {
  expect(isProtected("/")).toBe(false);
});

test("capture is protected", () => {
  expect(isProtected("/capture")).toBe(true);
});
