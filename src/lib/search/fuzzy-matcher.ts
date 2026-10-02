// ==============================================================================
// JAINAM TRADERS — FAST FUZZY MATCHING & STRING SIMILARITY ENGINE
// Typo tolerance and token proximity calculation for Indian English / Hinglish
// ==============================================================================

/**
 * Calculates Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row: number[] = [];
  for (let i = 0; i <= b.length; i++) {
    row[i] = i;
  }

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      let val: number;
      if (a[i - 1] === b[j - 1]) {
        val = row[j - 1];
      } else {
        val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }

  return row[b.length];
}

/**
 * Calculates similarity coefficient between 0.0 (completely distinct) and 1.0 (exact match).
 */
export function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(a, b);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Checks whether a search token fuzzy-matches any word in the candidate text.
 * Returns the highest similarity found, or 0 if below threshold.
 */
export function matchTokenFuzzy(token: string, candidateWords: string[]): {
  matched: boolean;
  score: number;
} {
  const tok = token.toLowerCase();
  if (tok.length < 3) {
    const hasExact = candidateWords.some((w) => w.toLowerCase() === tok);
    return { matched: hasExact, score: hasExact ? 1 : 0 };
  }

  let bestSim = 0;

  for (const word of candidateWords) {
    const w = word.toLowerCase();
    if (w === tok) {
      return { matched: true, score: 1.0 };
    }

    // Prefix match
    if (w.startsWith(tok) && tok.length >= 3) {
      const prefixScore = tok.length / w.length;
      if (prefixScore > bestSim) bestSim = prefixScore;
    }

    // Edit distance
    const dist = levenshteinDistance(tok, w);
    const maxAllowedDist = tok.length <= 4 ? 1 : tok.length <= 8 ? 2 : 3;

    if (dist <= maxAllowedDist) {
      const sim = 1 - dist / Math.max(tok.length, w.length);
      if (sim > bestSim) bestSim = sim;
    }
  }

  // Threshold: at least 0.70 similarity required
  const matched = bestSim >= 0.7;
  return { matched, score: matched ? bestSim : 0 };
}
