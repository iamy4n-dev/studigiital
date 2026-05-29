const PROTECTED = [
  /^\/dashboard(\/|$)/,
  /^\/artifacts(\/|$)/,
  /^\/capture(\/|$)/,
  /^\/review(\/|$)/,
  /^\/profile(\/|$)/,
];

export function isProtected(pathname: string): boolean {
  return PROTECTED.some((re) => re.test(pathname));
}
