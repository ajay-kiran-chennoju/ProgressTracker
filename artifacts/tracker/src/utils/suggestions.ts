export function matchSuggestions(input: string, pool: string[]): string[] {
  const q = input.trim().toLowerCase();
  if (!q) return [];
  const prefix = pool.filter((s) => s.toLowerCase().startsWith(q));
  const fuzzy = pool.filter(
    (s) => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q),
  );
  return [...new Set([...prefix, ...fuzzy])].slice(0, 8);
}

export function isDuplicate(input: string, existing: string[]): boolean {
  const q = input.trim().toLowerCase();
  return existing.some((s) => s.toLowerCase() === q);
}
