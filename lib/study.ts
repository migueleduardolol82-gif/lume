export type Rating = "again" | "hard" | "good" | "easy";
export function schedule(interval: number, repetitions: number, rating: Rating, now: number) {
  if (rating === "again") return { interval: 0, repetitions: 0, due: now + 600_000 };
  const days = rating === "hard" ? Math.max(1, Math.ceil(interval * 1.2)) : rating === "easy" ? Math.max(4, Math.ceil(interval * 3)) : repetitions === 0 ? 1 : repetitions === 1 ? 3 : Math.max(7, Math.ceil(interval * 2));
  return { interval: Math.min(days, 365), repetitions: repetitions + 1, due: now + Math.min(days, 365) * 86_400_000 };
}
// Case and accents may carry meaning in formulas, units and scientific notation.
export function normalizeAnswer(s: string) { return s.normalize("NFC").trim().replace(/\s+/g, " "); }
