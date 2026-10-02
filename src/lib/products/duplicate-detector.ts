// ==============================================================================
// JAINAM TRADERS — PRODUCT NORMALIZATION & SIMILARITY ENGINE
// Deterministic tokenization, Levenshtein distance, n-gram Jaccard similarity,
// and multi-attribute duplicate detection across Name, SKU, Barcode, Brand, Category,
// and Manufacturer Model Number.
// (Requirement 27: No external AI dependencies; fast, deterministic, zero-cost).
// ==============================================================================

import { Product, SimilarProductMatch, DuplicateConfidence, DuplicateCheckParams } from '@/lib/types';
import { cleanSearchText } from '@/lib/search/normalizer';

/**
 * Standardize text: lowercases, removes non-alphanumerics, collapses spaces,
 * and strips common retail filler words ("inch", "in", "cm", "mm", etc.).
 */
export function normalizeProductText(text?: string): string {
  if (!text) return '';
  return cleanSearchText(text)
    .toLowerCase()
    .replace(/[-_.,/\\()[\]{}:;'"!@#$%^&*+`~=]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes SKU or Barcode: uppercase, trims, removes spaces and hyphens for canonical comparison.
 */
export function normalizeIdentifier(val?: string): string {
  if (!val) return '';
  return val.toUpperCase().replace(/[\s\-_]/g, '').trim();
}

/**
 * Tokenize string into meaningful distinct words, filtering single-letter noise.
 */
export function tokenizeProductText(text: string): string[] {
  const norm = normalizeProductText(text);
  if (!norm) return [];
  return norm.split(/\s+/).filter((t) => t.length > 1);
}

/**
 * Standard Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // deletion
        d[i][j - 1] + 1,      // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return d[m][n];
}

/**
 * Normalized string similarity score between 0.0 and 1.0 based on edit distance.
 */
export function stringSimilarity(s1: string, s2: string): number {
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Jaccard token overlap between two strings (0.0 to 1.0).
 */
export function tokenOverlapRatio(s1: string, s2: string): number {
  const tokens1 = new Set(tokenizeProductText(s1));
  const tokens2 = new Set(tokenizeProductText(s2));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) {
      intersection++;
    } else {
      // Check for minor typos (length > 3 and distance <= 1)
      for (const t2 of tokens2) {
        if (Math.abs(t.length - t2.length) <= 1 && levenshteinDistance(t, t2) <= 1) {
          intersection += 0.85;
          break;
        }
      }
    }
  }

  const union = tokens1.size + tokens2.size - intersection;
  const jaccard = union > 0 ? intersection / union : 0;
  const minSize = Math.min(tokens1.size, tokens2.size);
  const containment = minSize > 0 ? intersection / minSize : 0;
  return Math.min(1.0, jaccard * 0.4 + containment * 0.6);
}

/**
 * Checks whether two products differ primarily by a known variant differentiator
 * (e.g. "12 inch" vs "18 inch", "Black" vs "White", "Small" vs "Large").
 */
export function detectVariantDifference(name1: string, name2: string): { isVariant: boolean; differentiator?: string } {
  const t1 = tokenizeProductText(name1);
  const t2 = tokenizeProductText(name2);

  const set1 = new Set(t1);
  const set2 = new Set(t2);

  const diff1 = t1.filter((x) => !set2.has(x));
  const diff2 = t2.filter((x) => !set1.has(x));

  // If both have substantial core token overlap (> 50%), but differ by numeric size or color tokens:
  const coreOverlap = tokenOverlapRatio(name1, name2);
  if (coreOverlap >= 0.5) {
    const numericOrSizeTokens = /^\d+(\.\d+)?$|inch|in|cm|mm|gm|kg|small|medium|large|xl|xxl|black|white|gold|silver|brown|red|blue|matte|gloss/i;
    const isSizeOrColorDiff =
      diff1.some((d) => numericOrSizeTokens.test(d)) || diff2.some((d) => numericOrSizeTokens.test(d));

    if (isSizeOrColorDiff) {
      const diffSummary = [...diff1, ...diff2].join(', ');
      return { isVariant: true, differentiator: diffSummary };
    }
  }

  return { isVariant: false };
}

/**
 * Core Duplicate & Similarity Matching Algorithm (Requirements 1 - 14 & 26).
 * Computes a weighted confidence score and returns ranked candidates.
 */
export function findSimilarProducts(
  catalog: Product[],
  candidate: DuplicateCheckParams
): SimilarProductMatch[] {
  const matches: SimilarProductMatch[] = [];

  const candNormName = normalizeProductText(candidate.name);
  if (!candNormName && !candidate.sku && !candidate.barcodeValue && !candidate.manufacturerModelNumber) {
    return [];
  }

  const candSkuNorm = normalizeIdentifier(candidate.sku);
  const candBarcodeNorm = normalizeIdentifier(candidate.barcodeValue);
  const candModelNorm = normalizeIdentifier(candidate.manufacturerModelNumber);
  const candBrandNorm = normalizeProductText(candidate.brand);

  for (const existing of catalog) {
    if (candidate.excludeProductId && existing.id === candidate.excludeProductId) {
      continue;
    }
    // Skip archived products if they were permanently removed
    if (existing.isArchived && existing.status === 'archived') {
      continue;
    }

    let score = 0;
    const matchedFields: SimilarProductMatch['matchedFields'] = [];
    const matchReasons: string[] = [];

    const existNormName = normalizeProductText(existing.name);
    const existSkuNorm = normalizeIdentifier(existing.sku);
    const existBarcodeNorm = normalizeIdentifier(existing.barcodeValue || existing.sku);
    const existModelNorm = normalizeIdentifier(existing.manufacturerModelNumber);
    const existBrandNorm = normalizeProductText(existing.brand);

    // 1. EXACT IDENTIFIER CONFLICTS (100% Score)
    if (candSkuNorm && candSkuNorm === existSkuNorm) {
      score = 100;
      matchedFields.push('sku');
      matchReasons.push(`Exact matching SKU: "${existing.sku}"`);
    }

    if (candBarcodeNorm && (candBarcodeNorm === existBarcodeNorm || candBarcodeNorm === existSkuNorm)) {
      score = 100;
      matchedFields.push('barcode');
      matchReasons.push(`Exact matching Barcode: "${existing.barcodeValue || existing.sku}"`);
    }

    if (candModelNorm && candModelNorm === existModelNorm) {
      score = Math.max(score, 95);
      matchedFields.push('modelNumber');
      matchReasons.push(`Matching manufacturer model number: "${existing.manufacturerModelNumber}"`);
    }

    // 2. NAME SIMILARITY & LEVENSHTEIN (Weighted)
    if (candNormName && existNormName) {
      if (candNormName === existNormName) {
        score = Math.max(score, 90);
        matchedFields.push('exactName');
        matchReasons.push('Normalized product name is identical');
      } else {
        const strSim = stringSimilarity(candNormName, existNormName);
        const tokenSim = tokenOverlapRatio(candNormName, existNormName);
        const nameScore = Math.round(strSim * 40 + tokenSim * 60);

        if (nameScore >= 50) {
          score = Math.max(score, nameScore);
          matchedFields.push('fuzzyName');
          matchReasons.push(`High name similarity (${nameScore}% token & edit match)`);
        }
      }
    }

    // 3. BRAND & CATEGORY REINFORCEMENT
    if (score >= 45) {
      if (candBrandNorm && existBrandNorm && candBrandNorm === existBrandNorm) {
        score = Math.min(100, score + 10);
        matchedFields.push('brandCategory');
        matchReasons.push(`Same brand: "${existing.brand}"`);
      }

      if (candidate.categoryId && candidate.categoryId === existing.categoryId) {
        score = Math.min(100, score + 5);
      }
    }

    // 4. TAGS OVERLAP
    if (candidate.tags && candidate.tags.length > 0 && existing.tags && existing.tags.length > 0) {
      const candTagSet = new Set(candidate.tags.map((t) => t.toLowerCase().trim()));
      const commonTags = existing.tags.filter((t) => candTagSet.has(t.toLowerCase().trim()));
      if (commonTags.length > 0 && score >= 40) {
        score = Math.min(100, score + commonTags.length * 2);
        matchedFields.push('tags');
      }
    }

    // 5. VARIANT CHECK: If they have high overlap but distinct dimensions/color, soften to prevent false block
    let isVariant = false;
    if (score >= 60 && !matchedFields.includes('sku') && !matchedFields.includes('barcode')) {
      const variantInfo = detectVariantDifference(candidate.name, existing.name);
      if (variantInfo.isVariant) {
        isVariant = true;
        matchReasons.push(`Possible variant detected (differentiator: ${variantInfo.differentiator})`);
        score = Math.min(score, 70);
      }
    }

    // Determine Confidence Level (Requirement 5 & 13)
    let confidence: DuplicateConfidence = 'LOW';
    if (isVariant) {
      confidence = 'MEDIUM';
    } else if (score >= 90) {
      confidence = matchedFields.includes('sku') || matchedFields.includes('barcode') ? 'EXACT' : 'HIGH';
    } else if (score >= 70) {
      confidence = 'HIGH';
    } else if (score >= 45) {
      confidence = 'MEDIUM';
    }

    if (score >= 40) {
      matches.push({
        product: existing,
        score,
        confidence,
        matchedFields,
        matchReasons,
      });
    }
  }

  // Sort descending by similarity score
  matches.sort((a, b) => b.score - a.score);

  return matches;
}

/**
 * Full Catalogue Duplicate Audit Utility (Requirement 19).
 * Scans all products in the catalogue and groups potential duplicates.
 */
export function auditCatalogueDuplicates(catalog: Product[]): SimilarProductMatch[][] {
  const groupedDuplicates: SimilarProductMatch[][] = [];
  const processedIds = new Set<string>();

  for (let i = 0; i < catalog.length; i++) {
    const p1 = catalog[i];
    if (processedIds.has(p1.id) || (p1.isArchived && p1.status === 'archived')) continue;

    const matches = findSimilarProducts(catalog, {
      name: p1.name,
      sku: p1.sku,
      barcodeValue: p1.barcodeValue,
      brand: p1.brand,
      categoryId: p1.categoryId,
      manufacturerModelNumber: p1.manufacturerModelNumber,
      excludeProductId: p1.id,
    }).filter((m) => m.score >= 70); // Only medium-high to high duplicates

    if (matches.length > 0) {
      processedIds.add(p1.id);
      matches.forEach((m) => processedIds.add(m.product.id));

      // Include p1 as the first item (canonical candidate)
      groupedDuplicates.push([
        {
          product: p1,
          score: 100,
          confidence: 'EXACT',
          matchedFields: ['exactName'],
          matchReasons: ['Base catalogue reference'],
        },
        ...matches,
      ]);
    }
  }

  return groupedDuplicates;
}
