// ==============================================================================
// JAINAM TRADERS — ENTERPRISE SEARCH ENGINE (MULTILINGUAL & FUZZY)
// Shared deterministic search engine for text search, voice recognition, and category filtering.
// Guarantees all results strictly come from the verified Jainam Traders database.
// ==============================================================================

import { Product } from '@/lib/types';
import { cleanSearchText, extractSearchIntent, ExtractedSearchIntent } from './normalizer';
import { matchTokenFuzzy, stringSimilarity } from './fuzzy-matcher';
import { SUGGESTED_SEARCH_ALTERNATIVES } from './alias-dictionary';
import { buildProductSearchIndex } from './product-indexer';
import { searchAnalytics } from './search-analytics';
import { INITIAL_CATEGORIES } from '@/lib/db/initial-data';

export interface SearchOptions {
  query?: string;
  categorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  featured?: boolean;
  newArrival?: boolean;
  bestSeller?: boolean;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest';
  limit?: number;
}

export interface SearchResult {
  products: Product[];
  total: number;
  intent?: ExtractedSearchIntent;
  suggestedAlternatives?: typeof SUGGESTED_SEARCH_ALTERNATIVES;
}

export interface ParsedSearchQuery {
  cleanedText: string;
  tokens: string[];
  inferredMaxPrice?: number;
  inferredMinPrice?: number;
  conceptId?: string;
}

/**
 * Parses and extracts intent from raw search query string without DB or server dependencies
 */
export function parseSearchQuery(rawQuery: string): ParsedSearchQuery {
  if (!rawQuery || !rawQuery.trim()) {
    return { cleanedText: '', tokens: [] };
  }
  const intent = extractSearchIntent(rawQuery);
  return {
    cleanedText: intent.normalizedQuery || rawQuery.trim(),
    tokens: intent.tokens,
    inferredMaxPrice: intent.maxPrice,
    inferredMinPrice: intent.minPrice,
    conceptId: intent.conceptId,
  };
}

interface ScoredProduct {
  product: Product;
  score: number;
}

/**
 * Searches and ranks products against query using normalization, concept aliases,
 * multi-token analysis, fuzzy matching, and price constraints.
 */
export function searchCatalogue(
  allProducts: Product[],
  options: SearchOptions = {}
): SearchResult {
  // Base filter: active, published, non-archived, non-draft products only
  let pool = allProducts.filter(
    (p) => p.isActive && !p.isArchived && p.status !== 'archived' && p.status !== 'draft' && p.status !== 'hidden'
  );

  // 1. Category Slug filter (if explicitly passed in options)
  if (options.categorySlug) {
    const targetSlug = options.categorySlug.toLowerCase().trim();
    const matchedCategory = INITIAL_CATEGORIES.find(
      (c) =>
        c.slug.toLowerCase() === targetSlug ||
        c.id.toLowerCase() === targetSlug ||
        c.name.toLowerCase() === targetSlug
    );

    pool = pool.filter((p) => {
      // Direct categorySlug match
      if (p.categorySlug && p.categorySlug.toLowerCase() === targetSlug) {
        return true;
      }
      // Direct categoryId match against target or matched category ID
      if (p.categoryId) {
        if (p.categoryId.toLowerCase() === targetSlug) return true;
        if (matchedCategory && p.categoryId.toLowerCase() === matchedCategory.id.toLowerCase()) return true;
      }
      // Match against categoryName or slugified categoryName
      if (p.categoryName) {
        const catNameLower = p.categoryName.toLowerCase().trim();
        if (matchedCategory && catNameLower === matchedCategory.name.toLowerCase()) return true;
        if (catNameLower === targetSlug) return true;
        const slugified = catNameLower.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (slugified === targetSlug) return true;
      }
      return false;
    });
  }

  // 2. Process query intent if provided
  let intent: ExtractedSearchIntent | undefined;
  let effectiveMinPrice = options.minPrice;
  let effectiveMaxPrice = options.maxPrice;

  if (options.query && options.query.trim()) {
    intent = extractSearchIntent(options.query);

    // Apply natural language price constraints if not explicitly overridden
    if (intent.minPrice !== undefined && effectiveMinPrice === undefined) {
      effectiveMinPrice = intent.minPrice;
    }
    if (intent.maxPrice !== undefined && effectiveMaxPrice === undefined) {
      effectiveMaxPrice = intent.maxPrice;
    }
  }

  // 3. Strict price boundary filtering
  if (effectiveMinPrice !== undefined) {
    pool = pool.filter((p) => p.price >= effectiveMinPrice!);
  }
  if (effectiveMaxPrice !== undefined) {
    pool = pool.filter((p) => p.price <= effectiveMaxPrice!);
  }

  // 4. Feature badge filters
  if (options.featured) pool = pool.filter((p) => p.isFeatured);
  if (options.newArrival) pool = pool.filter((p) => p.isNewArrival);
  if (options.bestSeller) pool = pool.filter((p) => p.isBestSeller);

  // If no search query was passed, apply standard sorting and return
  if (!options.query || !options.query.trim()) {
    const sorted = sortProducts(pool, options.sort || 'newest');
    const paginated = options.limit ? sorted.slice(0, options.limit) : sorted;
    return {
      products: paginated,
      total: sorted.length,
    };
  }

  // 5. Query matching & scoring
  const cleanQuery = cleanSearchText(options.query);
  const scoredProducts: ScoredProduct[] = [];

  for (const product of pool) {
    const score = computeProductMatchScore(product, cleanQuery, intent!);
    if (score >= 120) {
      scoredProducts.push({ product, score });
    }
  }

  // 6. Ranking
  if (options.sort && options.sort !== 'relevance') {
    const sortedList = sortProducts(
      scoredProducts.map((sp) => sp.product),
      options.sort
    );
    const paginated = options.limit ? sortedList.slice(0, options.limit) : sortedList;
    return {
      products: paginated,
      total: sortedList.length,
      intent,
      suggestedAlternatives:
        sortedList.length === 0 ? SUGGESTED_SEARCH_ALTERNATIVES : undefined,
    };
  }

  // Default relevance sorting: highest score first, then rating, then best-seller
  scoredProducts.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if ((b.product.averageRating || 0) !== (a.product.averageRating || 0)) {
      return (b.product.averageRating || 0) - (a.product.averageRating || 0);
    }
    return (b.product.isBestSeller ? 1 : 0) - (a.product.isBestSeller ? 1 : 0);
  });

  const finalProducts = scoredProducts.map((sp) => sp.product);
  const paginated = options.limit ? finalProducts.slice(0, options.limit) : finalProducts;

  if (options.query && options.query.trim()) {
    searchAnalytics.record(options.query, finalProducts.length);
  }

  return {
    products: paginated,
    total: finalProducts.length,
    intent,
    suggestedAlternatives:
      finalProducts.length === 0 ? SUGGESTED_SEARCH_ALTERNATIVES : undefined,
  };
}

/**
 * Computes a weighted matching score for a product against query and extracted intent.
 */
function computeProductMatchScore(
  product: Product,
  cleanQuery: string,
  intent: ExtractedSearchIntent
): number {
  let score = 0;

  const pNameClean = cleanSearchText(product.name);
  const pSkuClean = cleanSearchText(product.sku);
  const pBrandClean = cleanSearchText(product.brand || '');
  const pCategoryClean = cleanSearchText(product.categoryName || '');
  const pTagsClean = (product.tags || []).map((t) => cleanSearchText(t));
  const pOccasionClean = cleanSearchText(product.occasion || '');
  const pMaterialClean = cleanSearchText(product.material || '');
  const pDescClean = cleanSearchText(product.shortDescription || '');

  const corpusWords = [
    ...pNameClean.split(' '),
    ...pBrandClean.split(' '),
    ...pCategoryClean.split(' '),
    ...pTagsClean.flatMap((t) => t.split(' ')),
    ...pOccasionClean.split(' '),
    ...pMaterialClean.split(' '),
    ...pDescClean.split(' '),
  ].filter((w) => w.length > 1);

  // ----------------------------------------------------
  // TIER 1: Exact Name or SKU Match (Highest Priority)
  // ----------------------------------------------------
  if (pNameClean === cleanQuery) {
    score += 1200;
  } else if (pNameClean.startsWith(cleanQuery)) {
    score += 850;
  } else if (pNameClean.includes(cleanQuery)) {
    score += 650;
  }

  if (pSkuClean === cleanQuery || pSkuClean.includes(cleanQuery)) {
    score += 900;
  }

  // ----------------------------------------------------
  // TIER 2: Concept / Alias Match
  // ----------------------------------------------------
  if (intent.conceptId) {
    if (intent.conceptId === 'wall_clock') {
      const isClockCategory =
        pCategoryClean.includes('clock') ||
        product.categoryId === 'b0000000-0000-0000-0000-000000000003';
      const hasWallInName = pNameClean.includes('wall') || pTagsClean.includes('wall decor') || pNameClean.includes('clock');

      if (isClockCategory && hasWallInName) {
        score += 750;
      } else if (isClockCategory) {
        score += 500;
      }
    } else if (intent.conceptId === 'watch') {
      const isWatchCategory =
        pCategoryClean.includes('watch') ||
        product.categoryId === 'b0000000-0000-0000-0000-000000000004';
      if (isWatchCategory) {
        score += 700;
      }
    } else if (intent.conceptId === 'photo_frame') {
      const isFrame =
        pCategoryClean.includes('frame') ||
        pNameClean.includes('frame') ||
        product.categoryId === 'b0000000-0000-0000-0000-000000000002';
      if (isFrame) {
        score += 750;
      }
    } else if (intent.conceptId === 'gift') {
      const isGift =
        pCategoryClean.includes('gift') ||
        pTagsClean.some((t) => t.includes('gift')) ||
        pNameClean.includes('gift') ||
        product.categoryId === 'b0000000-0000-0000-0000-000000000001';
      if (isGift) {
        score += 600;
      }
    } else if (intent.conceptId === 'toy') {
      const isToy =
        pCategoryClean.includes('toy') ||
        pCategoryClean.includes('game') ||
        pTagsClean.some((t) => t.includes('toy') || t.includes('game')) ||
        product.categoryId === 'b0000000-0000-0000-0000-000000000007';
      if (isToy) {
        score += 700;
      }
    } else if (intent.conceptId === 'wallet_belt') {
      const isLeather =
        pCategoryClean.includes('belt') ||
        pCategoryClean.includes('purse') ||
        pNameClean.includes('belt') ||
        pNameClean.includes('wallet') ||
        pNameClean.includes('purse');
      if (isLeather) {
        score += 700;
      }
    } else if (intent.conceptId === 'perfume') {
      const isPerfume =
        pCategoryClean.includes('perfume') ||
        pNameClean.includes('parfum') ||
        pTagsClean.includes('perfume');
      if (isPerfume) {
        score += 700;
      }
    } else if (intent.conceptId === 'stationery') {
      const isStationery =
        pCategoryClean.includes('stationery') ||
        pNameClean.includes('pen') ||
        pNameClean.includes('journal') ||
        pNameClean.includes('diary');
      if (isStationery) {
        score += 700;
      }
    } else if (intent.conceptId === 'decorative_showpiece') {
      const isDec =
        pCategoryClean.includes('decorative') ||
        pNameClean.includes('diya') ||
        pNameClean.includes('fountain') ||
        pNameClean.includes('idol');
      if (isDec) {
        score += 700;
      }
    }
  }

  // ----------------------------------------------------
  // TIER 3 & 4: Multi-Token Matching (Exact & Fuzzy)
  // ----------------------------------------------------
  const searchTokens =
    intent.translatedTokens.length > 0 ? intent.translatedTokens : intent.tokens;

  if (searchTokens.length > 0) {
    let matchedTokenCount = 0;
    let totalTokenScore = 0;

    for (const tok of searchTokens) {
      if (tok.length < 2) continue;

      // Exact match in name gets highest token bonus
      if (pNameClean.includes(tok)) {
        matchedTokenCount++;
        totalTokenScore += 200;
        continue;
      }

      // Exact match in brand
      if (pBrandClean.includes(tok)) {
        matchedTokenCount++;
        totalTokenScore += 160;
        continue;
      }

      // Exact match in category
      if (pCategoryClean.includes(tok)) {
        matchedTokenCount++;
        totalTokenScore += 150;
        continue;
      }

      // Exact match in tags
      if (pTagsClean.some((t) => t.includes(tok))) {
        matchedTokenCount++;
        totalTokenScore += 140;
        continue;
      }

      // Fuzzy matching across corpus words
      const fuzzyRes = matchTokenFuzzy(tok, corpusWords);
      if (fuzzyRes.matched) {
        matchedTokenCount++;
        totalTokenScore += Math.round(130 * fuzzyRes.score);
      }
    }

    score += totalTokenScore;

    // Bonus if ALL tokens match
    if (matchedTokenCount === searchTokens.length && searchTokens.length >= 2) {
      score += 250;
    } else if (matchedTokenCount >= 1 && searchTokens.length >= 2) {
      score += Math.round((matchedTokenCount / searchTokens.length) * 100);
    }
  }

  // ----------------------------------------------------
  // TIER 5: Occasion & Recipient Intent Matching
  // ----------------------------------------------------
  if (intent.occasion) {
    const occLower = intent.occasion.toLowerCase();
    if (pOccasionClean.includes(occLower)) {
      score += 250;
    }
  }

  if (intent.recipient) {
    if (intent.recipient === 'men') {
      if (
        pNameClean.includes('men') ||
        pTagsClean.includes('gift for him') ||
        pOccasionClean.includes('groom') ||
        pNameClean.includes('boy')
      ) {
        score += 220;
      }
    } else if (intent.recipient === 'women') {
      if (
        pNameClean.includes('women') ||
        pNameClean.includes('ladies') ||
        pTagsClean.includes('gift for her') ||
        pNameClean.includes('girl')
      ) {
        score += 220;
      }
    }
  }

  // ----------------------------------------------------
  // TIER 6: Automatic Product Search Index & Admin Keywords
  // ----------------------------------------------------
  const pIndex = product.searchIndex || buildProductSearchIndex(product);
  if (pIndex && pIndex.length > 0) {
    for (const tok of searchTokens) {
      if (pIndex.includes(tok)) {
        score += 180;
      }
    }
  }

  if (product.searchKeywords) {
    const kwClean = cleanSearchText(product.searchKeywords);
    if (kwClean.includes(cleanQuery)) {
      score += 350;
    } else {
      for (const tok of searchTokens) {
        if (kwClean.includes(tok)) {
          score += 150;
        }
      }
    }
  }

  // ----------------------------------------------------
  // TIER 7: Fuzzy Full-String Similarity
  // ----------------------------------------------------
  const nameSim = stringSimilarity(cleanQuery, pNameClean);
  if (nameSim >= 0.6) {
    score += Math.round(nameSim * 180);
  }

  return score;
}

/**
 * Sorts product array by requested criteria.
 */
function sortProducts(
  products: Product[],
  sort: NonNullable<SearchOptions['sort']>
): Product[] {
  const copy = [...products];
  switch (sort) {
    case 'price_asc':
      return copy.sort((a, b) => a.price - b.price);
    case 'price_desc':
      return copy.sort((a, b) => b.price - a.price);
    case 'rating':
      return copy.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
    case 'newest':
      return copy.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    default:
      return copy;
  }
}
