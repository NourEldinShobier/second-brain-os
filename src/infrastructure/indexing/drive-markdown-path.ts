/**
 * Paths that index as vault drive `item.md` authorities (PRD §8.1).
 * Excludes anything under `files/` payload trees.
 */
export function isDriveItemMarkdownPath(relPath: string): boolean {
  const norm = relPath.replace(/\\/g, '/');
  if (/(^|\/)files\//u.test(norm)) {
    return false;
  }
  return (
    /^07-drive\/items\/[^/]+\/item\.md$/u.test(norm) || /^99-archive\/drive\/[^/]+\/item\.md$/u.test(norm)
  );
}
