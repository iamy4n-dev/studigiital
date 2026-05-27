const PROTECTED = [/^\/dashboard(\/|$)/, /^\/artifacts(\/|$)/, /^\/capture(\/|$)/];

export function isProtected(pathname: string): boolean {
  return PROTECTED.some((re) => re.test(pathname));
}
