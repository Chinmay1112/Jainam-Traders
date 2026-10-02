'use client';

import React, { useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { Product } from '@/lib/types';
import { generateCode128Svg, generateTsplForTtp244 } from '@/lib/barcode/code128';
import { buildLabelHtml, printThermalLabelsViaIframe } from '@/lib/barcode/thermal-printer';
import {
  Printer,
  X,
  Copy,
  Download,
  Check,
  Eye,
  Tag,
  AlertCircle,
  Loader2,
  SlidersHorizontal,
  RotateCcw,
  Type,
} from 'lucide-react';

interface PrintLabelModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onPriceChanged?: () => void;
}

export function PrintLabelModal({ product, isOpen, onClose }: PrintLabelModalProps) {
  const [template, setTemplate] = useState<'standard' | 'compact'>('standard');
  const [quantity, setQuantity] = useState<number>(1);
  const [customQtyInput, setCustomQtyInput] = useState<string>('1');
  const [isCustomQty, setIsCustomQty] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'tspl'>('preview');
  const [copiedTspl, setCopiedTspl] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const printAreaId = useId().replace(/:/g, '_');

  // Label Customization States
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState(product.name);
  const [customSellingPrice, setCustomSellingPrice] = useState<string>(String(product.price ?? ''));
  const [customMrp, setCustomMrp] = useState<string>(
    product.mrp && Number(product.mrp) > 0 ? String(product.mrp) : ''
  );
  const [brandName, setBrandName] = useState('JAINAM TRADERS');
  const [showBrand, setShowBrand] = useState(true);
  const [nameFontSize, setNameFontSize] = useState<'small' | 'normal' | 'large'>('normal');
  const [priceFontSize, setPriceFontSize] = useState<'normal' | 'large'>('normal');
  const [showMrp, setShowMrp] = useState(
    Boolean(product.mrp && Number(product.mrp) > Number(product.price))
  );
  const [showDiscount, setShowDiscount] = useState(true);
  const [barcodeHeight, setBarcodeHeight] = useState<'compact' | 'normal' | 'tall'>('normal');

  if (!isOpen) return null;

  const displayTitle = customTitle.trim().length > 0 ? customTitle.trim() : product.name;

  const handleResetCustomization = () => {
    setCustomTitle(product.name);
    setCustomSellingPrice(String(product.price ?? ''));
    setCustomMrp(product.mrp && Number(product.mrp) > 0 ? String(product.mrp) : '');
    setBrandName('JAINAM TRADERS');
    setShowBrand(true);
    setNameFontSize('normal');
    setPriceFontSize('normal');
    setShowMrp(Boolean(product.mrp && Number(product.mrp) > Number(product.price)));
    setShowDiscount(true);
    setBarcodeHeight('normal');
  };

  // Real MRP + Selling Price (user-customizable on sticker, e.g. for China products)
  const sellingPrice =
    customSellingPrice.trim().length > 0 && !isNaN(Number(customSellingPrice))
      ? Number(customSellingPrice)
      : Number(product.price) || 0;
  const mrp =
    customMrp.trim().length > 0 && !isNaN(Number(customMrp))
      ? Number(customMrp)
      : 0;
  const discount =
    showMrp && mrp > sellingPrice && mrp > 0
      ? Math.round(((mrp - sellingPrice) / mrp) * 100)
      : 0;

  // Barcode value MUST be the permanent SKU
  const barcodeValue = (product.barcodeValue || product.sku || '').trim().toUpperCase();

  // SVG representation for Code 128 (landscape geometry)
  const barHeightPx =
    barcodeHeight === 'compact' ? 20 : barcodeHeight === 'tall' ? 32 : (template === 'standard' ? 26 : 34);

  const barcodeSvg = generateCode128Svg(barcodeValue, {
    height: barHeightPx,
    moduleWidth: 1.5,
    includeText: true,
    fontSize: 9,
    quietZoneModules: 4,
    barColor: '#000000',
    bgColor: '#ffffff',
  });

  // TSPL commands for TSC TTP-244 Pro (60mm x 24mm Landscape)
  const tsplScript = generateTsplForTtp244({
    productName: displayTitle,
    sku: barcodeValue,
    mrp,
    sellingPrice,
    discountPercentage: discount,
    quantity,
    template,
    brandName,
    showBrand,
    showMrp,
    showDiscount,
  });

  const handleCopyTspl = () => {
    navigator.clipboard.writeText(tsplScript);
    setCopiedTspl(true);
    setTimeout(() => setCopiedTspl(false), 2000);
  };

  const handleDownloadPrn = () => {
    const blob = new Blob([tsplScript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `label-${barcodeValue}-${quantity}x.prn`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleQuickQty = (qty: number) => {
    setQuantity(qty);
    setCustomQtyInput(String(qty));
    setIsCustomQty(false);
  };

  const handleCustomQtyChange = (val: string) => {
    setCustomQtyInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      setQuantity(Math.min(num, 500));
    }
  };

  const handlePrint = () => {
    setIsPrinting(true);
    const singleHtml = buildLabelHtml({
      productName: product.name,
      sku: barcodeValue,
      mrp,
      sellingPrice,
      discountPercentage: discount,
      template,
      customTitle,
      brandName,
      showBrand,
      nameFontSize,
      priceFontSize,
      showMrp,
      showDiscount,
      barcodeHeight,
    });
    const labelList = Array.from({ length: quantity }, () => singleHtml);
    printThermalLabelsViaIframe(labelList, () => {
      setIsPrinting(false);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      {/* Portal rendered directly under document.body for direct browser print */}
      {typeof document !== 'undefined' &&
        createPortal(
          <div id="thermal-print-portal" aria-hidden="true">
            <style>{`
              @page {
                size: 60mm 24mm;
                margin: 0;
              }
              @media screen {
                #thermal-print-portal {
                  display: none !important;
                }
              }
              @media print {
                html, body {
                  width: 60mm !important;
                  height: 24mm !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                }
                body > *:not(#thermal-print-portal) {
                  display: none !important;
                }
                #thermal-print-portal {
                  display: block !important;
                  position: absolute !important;
                  top: 0 !important;
                  left: 0 !important;
                  width: 60mm !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                }
              }
            `}</style>
            {Array.from({ length: quantity }).map((_, idx) => (
              <div
                key={idx}
                dangerouslySetInnerHTML={{
                  __html: buildLabelHtml({
                    productName: product.name,
                    sku: barcodeValue,
                    mrp,
                    sellingPrice,
                    discountPercentage: discount,
                    template,
                    customTitle,
                    brandName,
                    showBrand,
                    nameFontSize,
                    priceFontSize,
                    showMrp,
                    showDiscount,
                    barcodeHeight,
                  }),
                }}
              />
            ))}
          </div>,
          document.body
        )}

      {/* Screen Modal Window */}
      <div className="relative w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                PRINT PRODUCT LABEL
              </h2>
              <p className="text-xs text-stone-400">
                TSC TTP-244 Pro • 60mm × 24mm Landscape Sticker
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Product Summary Banner */}
          <div className="p-4 rounded-2xl bg-stone-800/70 border border-stone-700/60 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3" /> Product Identity
              </span>
              <div className="text-sm font-bold text-white line-clamp-1">
                {product.name}
              </div>
              <div className="text-xs font-mono text-stone-300">
                SKU: <strong className="text-amber-300">{barcodeValue}</strong>
              </div>
            </div>

            <div className="flex items-baseline gap-3">
              <div className="text-right">
                <div className="text-[10px] text-stone-400">MRP</div>
                <div className="text-xs text-stone-400 line-through">₹{mrp}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-emerald-400">Selling Price</div>
                <div className="text-base font-extrabold text-white">₹{sellingPrice}</div>
              </div>
              {discount > 0 && (
                <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {discount}% OFF
                </span>
              )}
            </div>
          </div>

          {/* Configuration Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Template Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-300">
                Label Template
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTemplate('standard')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    template === 'standard'
                      ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm'
                      : 'bg-stone-800 text-stone-300 border-stone-700 hover:border-stone-600'
                  }`}
                >
                  Standard (60×24mm)
                </button>
                <button
                  type="button"
                  onClick={() => setTemplate('compact')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    template === 'compact'
                      ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm'
                      : 'bg-stone-800 text-stone-300 border-stone-700 hover:border-stone-600'
                  }`}
                >
                  Compact (2-Column)
                </button>
              </div>
              <p className="text-[11px] text-stone-400">
                {template === 'standard'
                  ? 'Horizontal layout: Brand, Product Name, SKU, MRP, Selling Price, Discount & Barcode.'
                  : 'Side-by-side layout: Details on left, prominent Barcode on right.'}
              </p>
            </div>

            {/* Quantity Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-300">
                Label Quantity
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 5, 10].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => handleQuickQty(qty)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                      quantity === qty && !isCustomQty
                        ? 'bg-amber-500 text-stone-950 border-amber-400'
                        : 'bg-stone-800 text-stone-300 border-stone-700 hover:border-stone-600'
                    }`}
                  >
                    Print {qty}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setIsCustomQty(true)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                    isCustomQty
                      ? 'bg-amber-500 text-stone-950 border-amber-400'
                      : 'bg-stone-800 text-stone-300 border-stone-700 hover:border-stone-600'
                  }`}
                >
                  Custom
                </button>
              </div>
              {isCustomQty && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={customQtyInput}
                    onChange={(e) => handleCustomQtyChange(e.target.value)}
                    className="w-24 px-3 py-1.5 bg-stone-800 border border-stone-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                  />
                  <span className="text-xs text-stone-400">stickers (max 500)</span>
                </div>
              )}
            </div>
          </div>

          {/* Customize Label Accordion */}
          <div className="border border-stone-800 rounded-2xl bg-stone-950/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsCustomizeOpen(!isCustomizeOpen)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-stone-800/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-stone-200">
                  Customize Label (Edit Title, Text Sizes & Elements)
                </span>
                {(customTitle !== product.name ||
                  !showBrand ||
                  nameFontSize !== 'normal' ||
                  priceFontSize !== 'normal' ||
                  !showMrp ||
                  !showDiscount ||
                  barcodeHeight !== 'normal' ||
                  brandName !== 'JAINAM TRADERS') && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Customized
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <span>{isCustomizeOpen ? '▲ Close Customizer' : '▼ Customize Text & Sizes'}</span>
              </div>
            </button>

            {isCustomizeOpen && (
              <div className="p-4 border-t border-stone-800/60 space-y-4 bg-stone-900/40">
                {/* 1. Custom Product Name & Length Recommendation */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-amber-400" />
                      Product Name on Sticker
                    </label>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          customTitle.length <= 15
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {customTitle.length}/15 chars {customTitle.length <= 15 ? '✓ Fits perfect' : '(longer)'}
                      </span>
                      {customTitle !== product.name && (
                        <button
                          type="button"
                          onClick={() => setCustomTitle(product.name)}
                          className="text-[11px] text-amber-400 hover:underline"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Enter short title (e.g. 15 chars max)..."
                    maxLength={40}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[10px] text-stone-400">
                    Keep product name under 15 characters to avoid wasting space and keep font large and readable on the 24mm height sticker.
                  </p>
                </div>

                {/* 1b. Price & China Product Customizer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 p-3 rounded-xl bg-stone-950/40 border border-stone-800">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-300 flex items-center justify-between">
                      <span>Selling Price (₹)</span>
                      <span className="text-[10px] text-emerald-400 font-bold">Sticker Price</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-stone-400">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={customSellingPrice}
                        onChange={(e) => setCustomSellingPrice(e.target.value)}
                        placeholder={String(product.price)}
                        className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-300 flex items-center justify-between">
                      <span>Printed MRP (₹)</span>
                      <span className="text-[10px] text-stone-400">Optional / China item</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-stone-400">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={customMrp}
                        onChange={(e) => {
                          setCustomMrp(e.target.value);
                          if (Number(e.target.value) > 0) setShowMrp(true);
                        }}
                        placeholder="Leave empty if no MRP"
                        className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Text Sizing Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Title Font Size */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-300">
                      Product Name Text Size
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {(['small', 'normal', 'large'] as const).map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setNameFontSize(size)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold capitalize border transition-all ${
                            nameFontSize === size
                              ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm'
                              : 'bg-stone-800 text-stone-300 border-stone-700 hover:border-stone-600'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price Font Size */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-300">
                      Selling Price Size
                    </label>
                    <div className="grid grid-cols-2 gap-1">
                      {(['normal', 'large'] as const).map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setPriceFontSize(size)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold capitalize border transition-all ${
                            priceFontSize === size
                              ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm'
                              : 'bg-stone-800 text-stone-300 border-stone-700 hover:border-stone-600'
                          }`}
                        >
                          {size === 'large' ? 'Large & Bold' : 'Normal'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Brand Header & Barcode Height */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Brand Header */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-stone-300">
                        Brand Header
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-stone-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showBrand}
                          onChange={(e) => setShowBrand(e.target.checked)}
                          className="rounded border-stone-700 text-amber-500 focus:ring-0"
                        />
                        <span>Show Brand</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      disabled={!showBrand}
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="JAINAM TRADERS"
                      maxLength={24}
                      className="w-full px-3 py-1.5 rounded-xl bg-stone-950 border border-stone-700 text-white text-xs disabled:opacity-40 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* Barcode Height */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-300">
                      Barcode Height
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {(['compact', 'normal', 'tall'] as const).map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setBarcodeHeight(h)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold capitalize border transition-all ${
                            barcodeHeight === h
                              ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm'
                              : 'bg-stone-800 text-stone-300 border-stone-700 hover:border-stone-600'
                          }`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Display Toggles & Reset */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-800">
                  <div className="flex items-center gap-4 text-xs text-stone-300">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showMrp}
                        onChange={(e) => setShowMrp(e.target.checked)}
                        className="rounded border-stone-700 text-amber-500 focus:ring-0"
                      />
                      <span>Show MRP</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showDiscount}
                        onChange={(e) => setShowDiscount(e.target.checked)}
                        className="rounded border-stone-700 text-amber-500 focus:ring-0"
                      />
                      <span>Show Discount %</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetCustomization}
                    className="text-xs text-stone-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset all customizations
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mode Switcher: Visual Preview vs Native TSPL Script */}
          <div className="border-t border-stone-800 pt-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    activeTab === 'preview'
                      ? 'bg-stone-100 text-stone-900'
                      : 'text-stone-400 hover:text-white bg-stone-800/60'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  60mm × 24mm Visual Preview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('tspl')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    activeTab === 'tspl'
                      ? 'bg-stone-100 text-stone-900'
                      : 'text-stone-400 hover:text-white bg-stone-800/60'
                  }`}
                >
                  TSPL Code (TTP-244 Pro)
                </button>
              </div>

              <div className="text-[11px] text-stone-400 font-mono flex items-center gap-2">
                <span>Physical: 60mm (W) × 24mm (H)</span>
                <span className="text-amber-400 font-bold">• Landscape</span>
              </div>
            </div>

            {/* TAB 1: VISUAL 60mm x 24mm LANDSCAPE PREVIEW (Aspect ratio 2.5 : 1) */}
            {activeTab === 'preview' && (
              <div className="flex flex-col items-center justify-center gap-4 p-6 rounded-2xl bg-stone-950/60 border border-stone-800">
                {/* 60mm x 24mm Physical Thermal Sticker Preview (Scaled by ~1.67x for comfortable screen viewing at exact 2.5:1 ratio: 400px x 160px) */}
                <div
                  className="w-[400px] h-[160px] bg-white text-black rounded-lg shadow-2xl p-2.5 flex flex-col justify-between border-2 border-stone-300 relative select-none"
                  style={{
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  {/* Notch / Roll feed indicator */}
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-1 bg-stone-400 rounded-full" />

                  {(() => {
                    const titleSizeClass =
                      nameFontSize === 'small'
                        ? 'text-[9.5px]'
                        : nameFontSize === 'large'
                        ? 'text-[13px]'
                        : 'text-[11px]';
                    const priceSizeClass =
                      priceFontSize === 'large' ? 'text-[18px]' : 'text-[15px]';

                    const displayMrp = showMrp && mrp > sellingPrice;
                    const hasDiscount = showDiscount && displayMrp && discount > 0;

                    if (template === 'standard') {
                      return (
                        <div className="h-full flex flex-col justify-between">
                          {/* Line 1: JAINAM TRADERS Centered Header */}
                          {showBrand && (
                            <div className="text-center text-[12px] font-black uppercase tracking-wider text-black border-b border-black pb-0.5">
                              {brandName}
                            </div>
                          )}

                          {/* Line 2: Product Name (Left) + MRP, Price & Discount Tag (Right) */}
                          <div className="flex items-center justify-between gap-2 py-0.5">
                            <span
                              className={`${titleSizeClass} font-bold text-black truncate flex-1 min-w-0 text-left`}
                              title={displayTitle}
                            >
                              {displayTitle}
                            </span>
                            <div className="flex items-baseline gap-1.5 shrink-0">
                              {displayMrp && (
                                <span className="text-[10px] text-stone-500 line-through">
                                  MRP ₹{mrp}
                                </span>
                              )}
                              <span className={`${priceSizeClass} font-black text-black`}>
                                ₹{sellingPrice}
                              </span>
                              {hasDiscount && (
                                <span className="text-[9px] font-black bg-black text-white px-1.5 py-0.5 rounded-[2px] tracking-tight">
                                  {discount}% OFF
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Line 3: Centered Code 128 Barcode with SKU beneath */}
                          <div className="w-full flex justify-center items-center">
                            <div
                              className="w-full max-w-[340px] flex justify-center"
                              dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                            />
                          </div>
                        </div>
                      );
                    }

                    /* Compact 2-column layout */
                    return (
                      <div className="h-full flex items-center justify-between gap-2">
                        <div className="flex-1 flex flex-col justify-between h-full pr-2">
                          <div>
                            {showBrand && (
                              <div className="text-[12px] font-black uppercase tracking-wider text-black">
                                {brandName}
                              </div>
                            )}
                            <div
                              className={`${titleSizeClass} font-bold text-black line-clamp-2 mt-0.5 leading-snug`}
                            >
                              {displayTitle}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className={`${priceSizeClass} font-black text-black`}>
                                ₹{sellingPrice}
                              </span>
                              {displayMrp && (
                                <span className="text-[10px] text-stone-500 line-through">
                                  MRP ₹{mrp}
                                </span>
                              )}
                              {hasDiscount && (
                                <span className="text-[9px] font-black bg-black text-white px-1.5 py-0.5 rounded-[2px]">
                                  {discount}% OFF
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="w-[180px] flex items-center justify-center">
                          <div
                            className="w-full flex justify-center"
                            dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Details & Specs */}
                <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-stone-400 font-mono pt-2">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>60mm × 24mm Landscape (2.5 : 1)</span>
                  </div>
                  <span>•</span>
                  <span>203 DPI (~480 × 192 dots)</span>
                  <span>•</span>
                  <span>Code 128 (Subset B)</span>
                </div>
              </div>
            )}

            {/* TAB 2: RAW TSPL COMMANDS (TSC TTP-244 PRO DIRECT PRINT) */}
            {activeTab === 'tspl' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Direct Spooler / Raw Port Output:</strong> The TSC TTP-244 Pro supports direct TSPL commands over USB. The commands below are calibrated for <code>SIZE 60 mm, 24 mm</code> in landscape orientation.
                  </div>
                </div>

                <div className="relative">
                  <pre className="p-4 rounded-xl bg-stone-950 font-mono text-[11px] text-emerald-400 border border-stone-800 overflow-x-auto max-h-56">
                    {tsplScript}
                  </pre>
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={handleCopyTspl}
                      className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-bold flex items-center gap-1 border border-stone-700"
                    >
                      {copiedTspl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedTspl ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadPrn}
                      className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-bold flex items-center gap-1 border border-stone-700"
                    >
                      <Download className="w-3.5 h-3.5" />
                      .PRN
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-stone-800 bg-stone-900/90 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-stone-400">
            Output: <strong className="text-white">{quantity}</strong> label(s) • <strong className="text-amber-400">60mm × 24mm LANDSCAPE</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-black rounded-xl text-xs flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-amber-500/20"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  Print {quantity} Label{quantity > 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
