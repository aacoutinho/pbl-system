/**
 * Returns the current academic semester in the format "YYYY.S"
 * where S is 1 (January–June) or 2 (July–December).
 * Example: March 2026 → "2026.1", August 2026 → "2026.2"
 */
export function getCurrentSemester(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  const sem = month <= 6 ? 1 : 2;
  return `${year}.${sem}`;
}
