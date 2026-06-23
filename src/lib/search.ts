/**
 * Case-insensitive substring match for list filters: true when any of
 * `fields` contains `q`. `q` is expected already normalized (trimmed and
 * lowercased) so callers can short-circuit the empty-query case and reuse
 * the original array reference.
 */
export function fieldsMatch(
  q: string,
  ...fields: (string | null | undefined)[]
): boolean {
  return fields.some((f) => f?.toLowerCase().includes(q) ?? false);
}
