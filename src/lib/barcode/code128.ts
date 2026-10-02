// ==============================================================================
// JAINAM TRADERS - CODE 128 BARCODE & TSPL THERMAL PRINTER ENGINE
// Supports: Code 128 Auto/B SVG rendering & TSC TTP-244 Pro TSPL commands
// Physical label target: 60mm x 24mm Landscape @ 203 DPI (TSC TTP-244 Pro)
// ==============================================================================

// Code 128 character patterns: 107 symbols (0 to 106).
// Each pattern consists of alternating widths of 3 bars and 3 spaces (total 11 modules).
// Stop symbol 106 has 4 bars and 3 spaces (total 13 modules).
export const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',                                // 100-106
];

export const START_CODE_B = 104;
export const STOP_CODE = 106;

export interface BarcodeElement {
  isBar: boolean;
  width: number;
}

export interface EncodedBarcode {
  text: string;
  elements: BarcodeElement[];
  totalModules: number;
  checksum: number;
}

/**
 * Encodes ASCII string into Code 128 (Subset B)
 */
export function encodeCode128B(text: string): EncodedBarcode {
  if (!text) {
    throw new Error('Barcode text cannot be empty');
  }

  // Filter and check for printable ASCII
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 32 || code > 126) {
      throw new Error(`Unsupported character in Code 128B: "${text[i]}" (code: ${code})`);
    }
  }

  const symbolIndices: number[] = [START_CODE_B];
  let checksumSum = START_CODE_B;

  for (let i = 0; i < text.length; i++) {
    const val = text.charCodeAt(i) - 32;
    symbolIndices.push(val);
    checksumSum += val * (i + 1);
  }

  const checksum = checksumSum % 103;
  symbolIndices.push(checksum);
  symbolIndices.push(STOP_CODE);

  const elements: BarcodeElement[] = [];
  let totalModules = 0;

  for (const index of symbolIndices) {
    const pattern = CODE128_PATTERNS[index];
    for (let p = 0; p < pattern.length; p++) {
      const width = parseInt(pattern[p], 10);
      const isBar = p % 2 === 0; // Alternates: bar, space, bar, space...
      elements.push({ isBar, width });
      totalModules += width;
    }
  }

  return {
    text,
    elements,
    totalModules,
    checksum,
  };
}

/**
 * Generates an SVG string for Code 128 barcode
 */
export function generateCode128Svg(
  text: string,
  options: {
    height?: number;
    moduleWidth?: number;
    includeText?: boolean;
    fontSize?: number;
    quietZoneModules?: number;
    barColor?: string;
    bgColor?: string;
  } = {}
): string {
  const {
    height = 50,
    moduleWidth = 2,
    includeText = false,
    fontSize = 11,
    quietZoneModules = 10,
    barColor = '#000000',
    bgColor = 'transparent',
  } = options;

  const encoded = encodeCode128B(text);
  const quietZoneWidth = quietZoneModules * moduleWidth;
  const barcodeCoreWidth = encoded.totalModules * moduleWidth;
  const totalWidth = barcodeCoreWidth + quietZoneWidth * 2;
  const textHeight = includeText ? fontSize + 4 : 0;
  const totalHeight = height + textHeight;

  let currentX = quietZoneWidth;
  const rects: string[] = [];

  for (const el of encoded.elements) {
    const w = el.width * moduleWidth;
    if (el.isBar) {
      rects.push(`<rect x="${currentX}" y="0" width="${w}" height="${height}" fill="${barColor}" />`);
    }
    currentX += w;
  }

  const textElement = includeText
    ? `<text x="${totalWidth / 2}" y="${height + fontSize}" font-family="monospace, -apple-system, sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle" fill="${barColor}" letter-spacing="1.5">${text}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="100%" height="100%" style="background-color: ${bgColor}; display: block;">
    ${rects.join('\n    ')}
    ${textElement}
  </svg>`;
}

/**
 * Generates printer-native TSPL / TSPL2 command script for TSC TTP-244 Pro
 * 203 DPI: 1 mm ≈ 8 dots
 * 60mm width ≈ 480 dots
 * 24mm height ≈ 192 dots
 * Orientation: Landscape
 */
export interface TsplLabelData {
  productName: string;
  sku: string;
  mrp: number;
  sellingPrice: number;
  discountPercentage?: number;
  quantity?: number;
  template?: 'standard' | 'compact';
  brandName?: string;
  showBrand?: boolean;
  showMrp?: boolean;
  showDiscount?: boolean;
}

export function generateTsplForTtp244(data: TsplLabelData): string {
  const qty = data.quantity && data.quantity > 0 ? data.quantity : 1;
  const brand = data.brandName || 'JAINAM TRADERS';
  const showBrand = data.showBrand !== false;
  const showMrp = data.showMrp !== false;
  const showDiscount = data.showDiscount !== false;

  const discount =
    data.discountPercentage ??
    (data.mrp > data.sellingPrice ? Math.round(((data.mrp - data.sellingPrice) / data.mrp) * 100) : 0);

  // Clean strings for TSPL single-line text (no quotes inside quotes)
  const cleanName = data.productName.replace(/"/g, "'").slice(0, 36);
  const cleanSku = data.sku.replace(/"/g, '');

  if (data.template === 'compact') {
    return [
      'SIZE 60 mm, 24 mm',
      'GAP 3 mm, 0 mm',
      'DIRECTION 1',
      'CLS',
      showBrand ? `TEXT 16,10,"2",0,1,1,"${brand}"` : '',
      `TEXT 16,36,"1",0,1,1,"${cleanName.slice(0, 24)}"`,
      `TEXT 16,62,"3",0,1,1,"Rs.${data.sellingPrice}"`,
      showMrp && data.mrp > data.sellingPrice ? `TEXT 16,98,"1",0,1,1,"MRP Rs.${data.mrp}"` : '',
      `TEXT 16,122,"1",0,1,1,"SKU: ${cleanSku}"`,
      `BARCODE 230,40,"128",85,1,0,2,2,"${cleanSku}"`,
      `PRINT ${qty},1`,
      '',
    ]
      .filter(Boolean)
      .join('\r\n');
  }

  // Standard 60mm x 24mm Landscape template (Line 1: Brand, Line 2: Product Name + Prices, Line 3: Barcode + SKU)
  const hasMrp = showMrp && data.mrp > data.sellingPrice;
  return [
    'SIZE 60 mm, 24 mm',
    'GAP 3 mm, 0 mm',
    'DIRECTION 1',
    'CLS',
    showBrand ? `TEXT 120,8,"2",0,1,1,"${brand}"` : '',
    `TEXT 16,34,"2",0,1,1,"${cleanName.slice(0, 18)}"`,
    hasMrp ? `TEXT 230,36,"1",0,1,1,"MRP Rs.${data.mrp}"` : '',
    `TEXT ${hasMrp ? 330 : 360},32,"3",0,1,1,"Rs.${data.sellingPrice}"`,
    hasMrp && showDiscount && discount > 0 ? `TEXT 410,34,"1",0,1,1,"${discount}% OFF"` : '',
    `BARCODE 45,75,"128",55,1,0,2,2,"${cleanSku}"`,
    `PRINT ${qty},1`,
    '',
  ]
    .filter(Boolean)
    .join('\r\n');
}
