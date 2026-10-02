// ==============================================================================
// JAINAM TRADERS — AUTOMATIC PRODUCT SEARCH INDEXER & VOCABULARY EXPANDER
// Generates searchable concepts, generic multilingual transliterations, and synonyms
// automatically whenever ANY product (existing or future) is indexed or saved.
// ==============================================================================

import { Product } from '@/lib/types';
import { cleanSearchText } from './normalizer';
import { TRANSLITERATION_MAP } from './alias-dictionary';

// Generic concept expansions applicable to any retail product
const GENERIC_CONCEPT_EXPANSIONS: Record<string, string[]> = {
  // Clocks
  clock: ['ghadi', 'gadi', 'घड़ी', 'घड़ी', 'wall clock', 'deewar ghadi', 'diwar ghadi', 'divar ghadi', 'दीवार घड़ी', 'दीवार घड़ी'],
  wall: ['deewar', 'diwar', 'divar', 'दीवार', 'wall decor'],
  sweep: ['silent clock', 'silent sweep', 'no sound clock'],
  pendulum: ['pendulum clock', 'hanging clock'],

  // Watches
  watch: ['watches', 'ghadi', 'gadi', 'घड़ी', 'घड़ी', 'wrist watch', 'wristwatch', 'haath ki ghadi', 'hath ki ghadi', 'हाथ की घड़ी'],
  analog: ['analog watch', 'dial watch'],
  quartz: ['quartz watch'],

  // Frames
  frame: ['frames', 'photo frame', 'photo frames', 'picture frame', 'photoframe', 'photofram', 'foto frame', 'fotho frame', 'फोटो फ्रेम', 'फ़ोटो फ़्रेम', 'तस्वीर फ्रेम', 'fram'],
  photo: ['picture', 'tasveer', 'tasvir', 'तस्वीर', 'photo frame'],
  collage: ['collage frame', 'multi frame', 'gallery wall'],

  // Wallets & Purses & Belts
  wallet: ['walet', 'wallets', 'purse', 'batua', 'batuwa', 'बटुआ', 'पर्स', 'men wallet', 'bifold'],
  purse: ['purses', 'wallet', 'clutch', 'handbag', 'पर्स', 'बटुआ'],
  belt: ['belts', 'leather belt', 'chamde ka belt', 'बेल्ट', 'कमरबंद'],
  leather: ['genuine leather', 'chamda', 'chamde', 'चमड़ा'],

  // Perfumes
  perfume: ['perfumes', 'perfum', 'scent', 'cent', 'fragrance', 'attar', 'ittar', 'itar', 'oud', 'इत्र', 'परफ्यूम', 'सेंट', 'खुशबू', 'khushboo'],
  attar: ['ittar', 'itar', 'perfume', 'इत्र', 'खुशबू'],

  // Stationery
  pen: ['pens', 'ball pen', 'rollerball', 'fountain pen', 'kalam', 'कलम', 'पेन'],
  diary: ['journal', 'notebook', 'diary journal', 'डायरी', 'नोटबुक'],
  stationery: ['office stationery', 'desk organizer', 'स्टेशनरी'],

  // Toys
  toy: ['toys', 'khilona', 'khilone', 'khilonay', 'खिलौना', 'खिलौने', 'game', 'games', 'खेल', 'kids gift'],
  car: ['rc car', 'remote car', 'stunt car', 'toy car', 'गाड़ी', 'रिमोट गाड़ी'],
  chess: ['chess set', 'board game', 'शतरंज'],

  // Gifts
  gift: ['gifts', 'present', 'presents', 'hamper', 'gift set', 'gift item', 'tohfa', 'tofa', 'uphaar', 'upahar', 'गिफ्ट', 'उपहार', 'तोहफा'],
  memento: ['trophy', 'memento', 'souvenir', 'award', 'स्मृति चिन्ह'],

  // Idols & Decorative
  idol: ['murti', 'statue', 'मूर्ति', 'प्रतिमा', 'god statue', 'bhagwan', 'भगवान'],
  diya: ['lamp', 'deepak', 'brass diya', 'दीया', 'दीपक', 'akhand diya'],
  ganesha: ['ganesh', 'ganpati', 'vinayaka', 'गणेश', 'गणपति'],
  buddha: ['buddha statue', 'water fountain', 'बुद्ध', 'फव्वारा'],

  // Kitchen / Accessories (e.g. for new products added tomorrow!)
  bottle: ['botl', 'water bottle', 'steel bottle', 'flask', 'botal', 'बोतल', 'पानी की बोतल', 'milton', 'thermos'],
  flask: ['bottle', 'thermos', 'vacuum flask', 'फ्लास्क'],
  sunglasses: ['goggles', 'shades', 'eyewear', 'chashma', 'धूप का चश्मा', 'चश्मा'],
  umbrella: ['chhata', 'chhatri', 'छाता', 'छतरी'],
};

/**
 * Builds a comprehensive, normalized search index for any product.
 * Combines standard metadata with automatic generic concept expansions.
 */
export function buildProductSearchIndex(product: Partial<Product>): string[] {
  const rawTerms = new Set<string>();

  const addTerm = (text?: string) => {
    if (!text) return;
    const clean = cleanSearchText(text);
    if (!clean) return;

    rawTerms.add(clean);
    clean.split(/\s+/).forEach((w) => {
      if (w.length > 1) rawTerms.add(w);
    });
  };

  // 1. Metadata sources
  addTerm(product.name);
  addTerm(product.brand);
  addTerm(product.categoryName);
  addTerm(product.subcategoryId);
  addTerm(product.material);
  addTerm(product.colour);
  addTerm(product.occasion);
  addTerm(product.sku);
  addTerm(product.barcodeValue);
  addTerm(product.manufacturerModelNumber);
  addTerm(product.shortDescription);
  addTerm(product.searchKeywords);

  if (Array.isArray(product.tags)) {
    product.tags.forEach((t) => addTerm(t));
  }

  if (Array.isArray(product.variants)) {
    product.variants.forEach((v) => {
      addTerm(v.title);
      addTerm(v.variantValue);
    });
  }

  // 2. Generic concept and vocabulary expansion
  const expandedTerms = new Set<string>(rawTerms);

  rawTerms.forEach((term) => {
    // Check transliteration map
    if (Object.prototype.hasOwnProperty.call(TRANSLITERATION_MAP, term)) {
      const translit = TRANSLITERATION_MAP[term];
      if (typeof translit === 'string' && translit.trim()) {
        expandedTerms.add(translit);
      }
    }

    // Check generic concept expansion
    if (Object.prototype.hasOwnProperty.call(GENERIC_CONCEPT_EXPANSIONS, term)) {
      const expansions = GENERIC_CONCEPT_EXPANSIONS[term];
      if (Array.isArray(expansions)) {
        expansions.forEach((exp) => {
          expandedTerms.add(cleanSearchText(exp));
          exp.split(/\s+/).forEach((w) => {
            if (w.length > 1) expandedTerms.add(cleanSearchText(w));
          });
        });
      }
    }
  });

  return Array.from(expandedTerms).filter(Boolean);
}

/**
 * Generates natural customer search query examples for Admin "Search Preview".
 * Shows store staff how customers can discover this item.
 */
export function generateProductSearchPreview(product: Partial<Product> & { category?: string }): string[] {
  const previews = new Set<string>();

  const name = product.name?.trim();
  if (name) {
    // Shorter clean title
    const cleanName = cleanSearchText(name);
    previews.add(name);

    // Extract core noun keywords
    const lower = name.toLowerCase();
    if (lower.includes('wall clock') || lower.includes('clock')) {
      previews.add('wall clock');
      previews.add('clock');
      previews.add('ghadi');
      previews.add('deewar ghadi');
      previews.add('दीवार घड़ी');
    } else if (lower.includes('watch')) {
      previews.add('watch');
      previews.add('wrist watch');
      previews.add('ghadi');
      previews.add('haath ki ghadi');
      previews.add('हाथ की घड़ी');
    } else if (lower.includes('frame')) {
      previews.add('photo frame');
      previews.add('frame');
      previews.add('photoframe');
      previews.add('फोटो फ्रेम');
      previews.add('picture frame');
    } else if (lower.includes('wallet') || lower.includes('purse')) {
      previews.add('wallet');
      previews.add('purse');
      previews.add('batua');
      previews.add('बटुआ');
      previews.add('men wallet');
    } else if (lower.includes('belt')) {
      previews.add('belt');
      previews.add('leather belt');
      previews.add('बेल्ट');
    } else if (lower.includes('perfume') || lower.includes('attar')) {
      previews.add('perfume');
      previews.add('attar');
      previews.add('इत्र');
      previews.add('सेंट');
    } else if (lower.includes('bottle')) {
      previews.add('water bottle');
      previews.add('bottle');
      previews.add('steel bottle');
      previews.add('बोतल');
      previews.add('पानी की बोतल');
    } else if (lower.includes('toy') || lower.includes('car')) {
      previews.add('toy');
      previews.add('khilona');
      previews.add('खिलौना');
      previews.add('toy car');
    } else if (lower.includes('pen') || lower.includes('diary')) {
      previews.add('pen');
      previews.add('diary');
      previews.add('पेन');
      previews.add('डायरी');
    } else if (lower.includes('diya') || lower.includes('idol') || lower.includes('ganesha')) {
      previews.add('idol');
      previews.add('diya');
      previews.add('मूर्ति');
      previews.add('दीया');
    } else {
      // General fallbacks from tags and category
      if (product.categoryName) {
        previews.add(cleanSearchText(product.categoryName));
      }
      if (Array.isArray(product.tags) && product.tags.length > 0) {
        previews.add(product.tags.slice(0, 3).join(' '));
      }
    }
  }

  // Admin keywords
  if (product.searchKeywords) {
    product.searchKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 3)
      .forEach((k) => previews.add(k));
  }

  return Array.from(previews).slice(0, 8);
}
