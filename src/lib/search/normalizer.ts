// ==============================================================================
// JAINAM TRADERS — MULTILINGUAL QUERY NORMALIZER & INTENT EXTRACTOR
// Normalizes Hindi (Nukta/Unicode), Hinglish, transliteration, conversational fillers,
// and extracts price bounds (minPrice/maxPrice) and shopping intents.
// ==============================================================================

import {
  OCCASION_INTENT_MAP,
  SEARCH_CONCEPTS,
  STOP_WORDS,
  TRANSLITERATION_MAP,
} from './alias-dictionary';

export interface ExtractedSearchIntent {
  rawQuery: string;
  normalizedQuery: string;
  conceptId?: string;
  categorySlug?: string;
  tokens: string[];
  translatedTokens: string[];
  minPrice?: number;
  maxPrice?: number;
  occasion?: string;
  recipient?: string;
}

/**
 * Normalizes Devanagari text by removing nuktas and decomposing common variants:
 * e.g. घड़ी -> घड़ी, फ़्रेम -> फ्रेम, ड़ -> ड, ढ़ -> ढ, फ़ -> फ, etc.
 */
export function normalizeDevanagari(input: string): string {
  if (!input) return '';

  return (
    input
      .normalize('NFC')
      // Normalize precomposed nukta characters to base characters
      .replace(/\u0958/g, '\u0915') // क़ -> क
      .replace(/\u0959/g, '\u0916') // ख़ -> ख
      .replace(/\u095A/g, '\u0917') // ग़ -> ग
      .replace(/\u095B/g, '\u091C') // ज़ -> ज
      .replace(/\u095C/g, '\u0921') // ड़ -> ड
      .replace(/\u095D/g, '\u0922') // ढ़ -> ढ
      .replace(/\u095E/g, '\u092B') // फ़ -> फ
      .replace(/\u095F/g, '\u092F') // य़ -> य
      // Remove standalone combining nukta sign (\u093C)
      .replace(/\u093C/g, '')
  );
}

export const normalizeHindiText = normalizeDevanagari;

/**
 * Clean and lowercase text while preserving alphanumeric English and Devanagari letters.
 */
export function cleanSearchText(input: string): string {
  if (!input) return '';
  const devanagariCleaned = normalizeDevanagari(input.toLowerCase().trim());

  // Replace punctuation and special characters with spaces, preserving English and Hindi characters
  // \u0900-\u097F represents the standard Devanagari Unicode block
  return devanagariCleaned
    .replace(/[^\w\s\u0900-\u097F₹]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts price filters (minPrice, maxPrice) from natural phrasing in Hindi, Hinglish, and English.
 */
export function extractPriceConstraints(text: string): {
  minPrice?: number;
  maxPrice?: number;
  cleanedText: string;
} {
  let cleaned = ` ${text.toLowerCase()} `;
  let minPrice: number | undefined;
  let maxPrice: number | undefined;

  // 1. Range Pattern: e.g. "1000 se 1500 ke beech", "500 to 1000", "500-1000", "between 500 and 1000", "500 से 1000 तक"
  const rangeRegex =
    /(?:between|from)?\s*(?:₹|rs\.?|rupees|rupaye)?\s*(\d+)\s*(?:se|to|-|and|aur|से)\s*(?:₹|rs\.?|rupees|rupaye)?\s*(\d+)\s*(?:ke beech|tak|mein|me|के बीच|तक)?/i;
  const rangeMatch = cleaned.match(rangeRegex);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    const p1 = parseInt(rangeMatch[1], 10);
    const p2 = parseInt(rangeMatch[2], 10);
    if (!isNaN(p1) && !isNaN(p2) && p1 > 0 && p2 > 0) {
      minPrice = Math.min(p1, p2);
      maxPrice = Math.max(p1, p2);
      cleaned = cleaned.replace(rangeMatch[0], ' ');
    }
  }

  // 2. Max Price / Budget Patterns:
  // e.g. "500 ke andar", "500 रुपये के अंदर", "500 rupees ke andar", "under 500", "below 500", "₹500 तक", "500 rs tak", "upto 500"
  if (maxPrice === undefined) {
    const maxRegexes = [
      // "under 500", "below 500", "less than 500", "upto 500", "up to 500"
      /(?:under|below|less than|upto|up to|maximum)\s*(?:₹|rs\.?|rupees|rupaye)?\s*(\d+)/i,
      // "500 ke andar", "500 rupees ke andar", "500 ke neeche", "500 tak", "500 रुपये के अंदर", "₹500 तक"
      /(\d+)\s*(?:₹|rs\.?|rupees|rupaye|रुपये|रुपया|रु)?\s*(?:ke andar|ke neeche|tak|mein|me|के अंदर|के नीचे|तक)/i,
      // "₹500 tak", "rs 500 tak"
      /(?:₹|rs\.?|rupees|rupaye)\s*(\d+)\s*(?:ke andar|tak|के अंदर|तक)/i,
    ];

    for (const rx of maxRegexes) {
      const match = cleaned.match(rx);
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > 0) {
          maxPrice = val;
          cleaned = cleaned.replace(match[0], ' ');
          break;
        }
      }
    }
  }

  // 3. Min Price Patterns: e.g. "above 500", "more than 500", "500 se upar", "500 se jyada"
  if (minPrice === undefined) {
    const minRegexes = [
      /(?:above|more than|greater than|at least)\s*(?:₹|rs\.?|rupees|rupaye)?\s*(\d+)/i,
      /(\d+)\s*(?:₹|rs\.?|rupees|rupaye|रुपये|रुपया)?\s*(?:se upar|se jyada|se zyaada|se adhik|से ऊपर|से ज्यादा)/i,
    ];
    for (const rx of minRegexes) {
      const match = cleaned.match(rx);
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > 0) {
          minPrice = val;
          cleaned = cleaned.replace(match[0], ' ');
          break;
        }
      }
    }
  }

  return {
    minPrice,
    maxPrice,
    cleanedText: cleaned.replace(/\s+/g, ' ').trim(),
  };
}

/**
 * Main intent extraction pipeline: Normalizes query, extracts price, maps aliases,
 * extracts occasions, and produces structured intent.
 */
export function extractSearchIntent(rawQuery: string): ExtractedSearchIntent {
  if (!rawQuery || !rawQuery.trim()) {
    return {
      rawQuery: '',
      normalizedQuery: '',
      tokens: [],
      translatedTokens: [],
    };
  }

  const rawClean = cleanSearchText(rawQuery);
  const { minPrice, maxPrice, cleanedText: textWithoutPrice } = extractPriceConstraints(rawClean);

  const cleanNoPrice = cleanSearchText(textWithoutPrice);

  // 1. Check if the query matches any centralized concept in alias dictionary
  let matchedConceptId: string | undefined;
  let matchedCategorySlug: string | undefined;

  for (const concept of SEARCH_CONCEPTS) {
    const matchesAlias = concept.aliases.some((alias) => {
      const normalizedAlias = cleanSearchText(alias);
      if (!normalizedAlias) return false;
      return (
        cleanNoPrice === normalizedAlias ||
        cleanNoPrice.includes(normalizedAlias) ||
        normalizedAlias.includes(cleanNoPrice)
      );
    });

    if (matchesAlias) {
      matchedConceptId = concept.id;
      matchedCategorySlug = concept.categorySlug;
      break;
    }
  }

  // 2. Tokenize and filter stop words
  const rawTokens = cleanNoPrice.split(/\s+/).filter(Boolean);
  const meaningfulTokens = rawTokens.filter((tok) => !STOP_WORDS.has(tok) && tok.length > 1);
  const effectiveTokens = meaningfulTokens.length > 0 ? meaningfulTokens : rawTokens;

  // 3. Transliterate tokens and extract occasions/recipients
  const translatedTokens: string[] = [];
  let detectedOccasion: string | undefined;
  let detectedRecipient: string | undefined;

  for (const tok of effectiveTokens) {
    // Check transliteration
    const mapped = TRANSLITERATION_MAP[tok];
    if (mapped) {
      translatedTokens.push(mapped);
    } else {
      translatedTokens.push(tok);
    }

    // Check occasion
    if (!detectedOccasion && OCCASION_INTENT_MAP[tok]) {
      detectedOccasion = OCCASION_INTENT_MAP[tok];
    }

    // Check recipient
    if (!detectedRecipient) {
      if (['boy', 'boys', 'ladka', 'ladke', 'men'].includes(tok)) {
        detectedRecipient = 'men';
      } else if (['girl', 'girls', 'ladki', 'women', 'ladies'].includes(tok)) {
        detectedRecipient = 'women';
      }
    }
  }

  // If a concept was matched, ensure concept tokens are included in translatedTokens
  if (matchedConceptId) {
    const concept = SEARCH_CONCEPTS.find((c) => c.id === matchedConceptId);
    if (concept) {
      concept.searchTokens.forEach((t) => {
        if (!translatedTokens.includes(t)) {
          translatedTokens.push(t);
        }
      });
    }
  }

  return {
    rawQuery,
    normalizedQuery: cleanNoPrice,
    conceptId: matchedConceptId,
    categorySlug: matchedCategorySlug,
    tokens: effectiveTokens,
    translatedTokens,
    minPrice,
    maxPrice,
    occasion: detectedOccasion,
    recipient: detectedRecipient,
  };
}
