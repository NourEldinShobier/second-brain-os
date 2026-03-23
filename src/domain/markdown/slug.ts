/** Kebab-case slug used in filenames and frontmatter (PRD §9). */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlug(s: string): boolean {
  return s.length > 0 && s.length <= 120 && SLUG_PATTERN.test(s);
}

/** Derive a slug from a human title (best-effort; may need disambiguation by caller). */
export function slugifyTitle(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s.length > 0 ? s : 'untitled';
}
