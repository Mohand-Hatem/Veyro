/** Only same-site paths are allowed as a post-login target, otherwise `?next=//evil.com` is an open redirect. */
export function safeNext(value: string | null, fallback = "/dashboard"): string {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : fallback;
}
