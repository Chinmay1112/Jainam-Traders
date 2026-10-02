/**
 * JAINAM TRADERS — Thermal Label Printing Engine
 * Authoritative 60mm x 24mm Landscape Output for TSC TTP-244 Pro
 */

import { generateCode128Svg } from './code128';

export interface ThermalLabelParams {
  productName: string;
  sku: string;
  mrp: number;
  sellingPrice: number;
  discountPercentage?: number;
  template?: 'standard' | 'compact';
  customTitle?: string;
  brandName?: string;
  showBrand?: boolean;
  nameFontSize?: 'small' | 'normal' | 'large';
  priceFontSize?: 'normal' | 'large';
  showMrp?: boolean;
  showDiscount?: boolean;
  barcodeHeight?: 'compact' | 'normal' | 'tall';
}

/**
 * Builds standalone, zero-dependency inline HTML for a 60mm x 24mm landscape label.
 * Designed for 203 DPI thermal printing with pure black (#000) on white (#fff).
 */
export function buildLabelHtml(params: ThermalLabelParams): string {
  const {
    productName,
    sku,
    mrp,
    sellingPrice,
    discountPercentage = 0,
    template = 'standard',
    customTitle,
    brandName = 'JAINAM TRADERS',
    showBrand = true,
    nameFontSize = 'normal',
    priceFontSize = 'normal',
    showMrp = true,
    showDiscount = true,
    barcodeHeight = 'normal',
  } = params;

  // Use custom title if provided, otherwise product name
  const displayTitle = (customTitle !== undefined && customTitle.trim().length > 0)
    ? customTitle.trim()
    : productName;

  // Font sizing calculations
  const titleSizePt = nameFontSize === 'small' ? '5.5pt' : nameFontSize === 'large' ? '8pt' : '6.5pt';
  const priceSizePt = priceFontSize === 'large' ? '10.5pt' : '8.5pt';

  // Barcode heights
  const barHeightPx = barcodeHeight === 'compact' ? 20 : barcodeHeight === 'tall' ? 32 : (template === 'standard' ? 26 : 34);
  const barcodeRowHeightMm = barcodeHeight === 'compact' ? '10mm' : barcodeHeight === 'tall' ? '13.5mm' : '12mm';

  const barcodeSvg = generateCode128Svg(sku, {
    height: barHeightPx,
    moduleWidth: 1.5,
    includeText: true,
    fontSize: 8,
    quietZoneModules: 4,
    barColor: '#000000',
    bgColor: '#ffffff',
  });

  const hasDiscount = showDiscount && mrp > sellingPrice && discountPercentage > 0;
  const displayMrp = showMrp && mrp > sellingPrice;

  if (template === 'compact') {
    return `
      <div class="thermal-label-page compact-layout" style="width:60mm;height:24mm;max-width:60mm;max-height:24mm;box-sizing:border-box;padding:1mm 2mm;display:flex;flex-direction:row;justify-content:space-between;align-items:center;background:#fff;color:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;overflow:hidden;page-break-inside:avoid;break-inside:avoid;">
        <!-- Left Column: Details -->
        <div style="display:flex;flex-direction:column;justify-content:space-between;width:31mm;height:22mm;overflow:hidden;">
          <div>
            ${showBrand ? `<div style="font-size:7pt;font-weight:900;text-transform:uppercase;letter-spacing:0.3px;line-height:1;">${escapeHtml(brandName)}</div>` : ''}
            <div style="font-size:${titleSizePt};font-weight:700;line-height:1.15;max-height:8mm;overflow:hidden;margin-top:0.8mm;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(displayTitle)}</div>
          </div>
          <div>
            <div style="display:flex;align-items:baseline;gap:1.5mm;flex-wrap:wrap;">
              <span style="font-size:${priceSizePt};font-weight:900;line-height:1;">₹${sellingPrice}</span>
              ${displayMrp ? `<span style="font-size:5.5pt;text-decoration:line-through;color:#555;">MRP ₹${mrp}</span>` : ''}
              ${hasDiscount ? `<span style="font-size:5pt;font-weight:800;background:#000;color:#fff;padding:0.2mm 0.6mm;border-radius:1px;">${discountPercentage}% OFF</span>` : ''}
            </div>
            <div style="font-size:6pt;font-family:monospace;font-weight:700;line-height:1;margin-top:0.8mm;">SKU: ${escapeHtml(sku)}</div>
          </div>
        </div>

        <!-- Right Column: Barcode with SKU below -->
        <div style="width:25mm;height:22mm;display:flex;align-items:center;justify-content:center;overflow:hidden;">
          <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
            ${barcodeSvg}
          </div>
        </div>
      </div>
    `.trim();
  }

  // Standard Template (3-tier horizontal: Line 1 Shop Header, Line 2 Product Name + Prices, Line 3 Barcode + SKU)
  return `
    <div class="thermal-label-page standard-layout" style="width:60mm;height:24mm;max-width:60mm;max-height:24mm;box-sizing:border-box;padding:0.6mm 1.5mm 0.8mm 1.5mm;display:flex;flex-direction:column;justify-content:space-between;background:#fff;color:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;overflow:hidden;page-break-inside:avoid;break-inside:avoid;">
      <!-- Line 1: Shop Name (prominent top header) -->
      ${showBrand ? `
        <div style="text-align:center;font-size:7pt;font-weight:900;text-transform:uppercase;letter-spacing:0.8px;border-bottom:0.75px solid #000;padding-bottom:0.3mm;line-height:1;margin-bottom:0.3mm;">
          ${escapeHtml(brandName)}
        </div>
      ` : ''}

      <!-- Line 2: Product Name (Left) + MRP, Selling Price & Discount Tag (Right) -->
      <div style="display:flex;justify-content:space-between;align-items:center;line-height:1;margin-bottom:0.4mm;gap:1.5mm;">
        <!-- Left: Product Name (short, <= 15 chars recommended) -->
        <span style="font-size:${titleSizePt};font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;text-align:left;">
          ${escapeHtml(displayTitle)}
        </span>

        <!-- Right: Pricing details (Selling Price + optional MRP & Discount Tag) -->
        <div style="display:flex;align-items:baseline;gap:1.2mm;flex-shrink:0;">
          ${displayMrp ? `<span style="font-size:5.5pt;text-decoration:line-through;color:#555;">MRP ₹${mrp}</span>` : ''}
          <span style="font-size:${priceSizePt};font-weight:900;">₹${sellingPrice}</span>
          ${hasDiscount ? `<span style="font-size:5pt;font-weight:800;background:#000;color:#fff;padding:0.2mm 0.8mm;border-radius:1px;letter-spacing:0.2px;">${discountPercentage}% OFF</span>` : ''}
        </div>
      </div>

      <!-- Line 3: Barcode with human-readable SKU centered directly beneath -->
      <div style="width:100%;height:${barcodeRowHeightMm};display:flex;align-items:center;justify-content:center;overflow:hidden;">
        <div style="width:52mm;height:100%;display:flex;align-items:center;justify-content:center;">
          ${barcodeSvg}
        </div>
      </div>
    </div>
  `.trim();
}

/**
 * Escapes unsafe HTML characters in user text
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Prints labels in a completely isolated hidden iframe.
 * Guarantees zero interference from app DOM, zero blank pages, and exact 60mm x 24mm page geometry.
 */
export function printThermalLabelsViaIframe(
  labelHtmlList: string[],
  onComplete?: () => void
): void {
  // Remove any previously created print frames
  const oldFrame = document.getElementById('jainam-thermal-print-frame');
  if (oldFrame) {
    oldFrame.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'jainam-thermal-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '60mm';
  iframe.style.height = '24mm';
  iframe.style.border = 'none';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    window.print();
    onComplete?.();
    return;
  }

  const fullDocHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Print Label - Jainam Traders</title>
  <style>
    @page {
      size: 60mm 24mm;
      margin: 0;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 60mm;
      height: 24mm;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .thermal-label-page {
      width: 60mm;
      height: 24mm;
      max-width: 60mm;
      max-height: 24mm;
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
      break-inside: avoid;
      overflow: hidden;
      background: #ffffff;
      color: #000000;
    }
    .thermal-label-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
  </style>
</head>
<body>
  ${labelHtmlList.join('\n')}
</body>
</html>
  `.trim();

  doc.open();
  doc.write(fullDocHtml);
  doc.close();

  // Allow DOM to finish laying out and rendering SVGs before calling print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('Error invoking iframe.print():', err);
      window.print();
    } finally {
      onComplete?.();
      setTimeout(() => {
        iframe.remove();
      }, 3000);
    }
  }, 300);
}
