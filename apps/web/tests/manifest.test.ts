import manifest from "@/app/manifest";

test("manifest includes app name", () => {
  const m = manifest();
  expect(m.name).toBe("Studigital");
});

test("manifest display is standalone for PWA installability", () => {
  const m = manifest();
  expect(m.display).toBe("standalone");
});

test("manifest declares 192x192 and 512x512 icons", () => {
  const m = manifest();
  const sizes = m.icons?.map((i) => i.sizes) ?? [];
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
});
