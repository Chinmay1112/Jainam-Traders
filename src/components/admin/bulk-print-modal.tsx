'use client';

import React, { useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { Product } from '@/lib/types';
import { generateCode128Svg, generateTsplForTtp244 } from '@/lib/barcode/code128';
import { buildLabelHtml, printThermalLabelsViaIframe } from '@/lib/barcode/thermal-printer';
import { Printer, X, Search, Check, Copy, Download, Layers, Plus, Trash2, Loader2 } from 'lucide-react';

interface BulkPrintModalProps {
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
  preSelectedProductId?: string;
}

interface BatchItem {
  product: Product;
  quantity: number;
}

export function BulkPrintModal({
  products,
  isOpen,
  onClose,
  preSelectedProductId,
}: BulkPrintModalProps) {
  const [selectedItems, setSelectedItems] = useState<BatchItem[]>(() => {
    if (preSelectedProductId) {
      const p = products.find((prod) => prod.id === preSelectedProductId);
      if (p) return [{ product: p, quantity: 10 }];
    }
    // Default to first 3 products if available
    return products.slice(0, 3).map((p) => ({ product: p, quantity: 5 }));
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [template, setTemplate] = useState<'standard' | 'compact'>('standard');
  const [copiedTspl, setCopiedTspl] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const printAreaId = useId();

  if (!isOpen) return null;

  const totalLabels = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleAddProduct = (prod: Product) => {
    if (selectedItems.some((i) => i.product.id === prod.id)) return;
    setSelectedItems([...selectedItems, { product: prod, quantity: 5 }]);
  };

  const handleRemoveItem = (productId: string) => {
    setSelectedItems(selectedItems.filter((i) => i.product.id !== productId));
  };

  const handleQuantityChange = (productId: string, qty: number) => {
    const validQty = Math.max(1, Math.min(qty || 1, 500));
    setSelectedItems(
      selectedItems.map((i) => (i.product.id === productId ? { ...i, quantity: validQty } : i))
    );
  };

  const filteredCatalogue = products.filter(
    (p) =>
      !selectedItems.some((i) => i.product.id === p.id) &&
      (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Generate combined TSPL script for batch
  const combinedTspl = selectedItems
    .map((item) => {
      const mrp = Number(item.product.mrp) || 0;
      const selling = Number(item.product.price) || 0;
      return generateTsplForTtp244({
        productName: item.product.name,
        sku: item.product.barcodeValue || item.product.sku,
        mrp,
        sellingPrice: selling,
        quantity: item.quantity,
        template,
      });
    })
    .join('\r\n');

  const handleCopyTspl = () => {
    navigator.clipboard.writeText(combinedTspl);
    setCopiedTspl(true);
    setTimeout(() => setCopiedTspl(false), 2000);
  };

  const handleDownloadPrn = () => {
    const blob = new Blob([combinedTspl], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batch-labels-${totalLabels}-stickers.prn`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintAll = () => {
    setIsPrinting(true);
    const labelList: string[] = [];
    selectedItems.forEach((item) => {
      const barcodeValue = (item.product.barcodeValue || item.product.sku || '').toUpperCase();
      const mrp = Number(item.product.mrp) || 0;
      const sellingPrice = Number(item.product.price) || 0;
      const discount =
        mrp > sellingPrice && mrp > 0
          ? Math.round(((mrp - sellingPrice) / mrp) * 100)
          : 0;

      const singleHtml = buildLabelHtml({
        productName: item.product.name,
        sku: barcodeValue,
        mrp,
        sellingPrice,
        discountPercentage: discount,
        template,
      });

      for (let i = 0; i < item.quantity; i++) {
        labelList.push(singleHtml);
      }
    });

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
            {selectedItems.map((item) => {
              const barcodeValue = (item.product.barcodeValue || item.product.sku || '').toUpperCase();
              const mrp = Number(item.product.mrp) || 0;
              const sellingPrice = Number(item.product.price) || 0;
              const discount =
                mrp > sellingPrice && mrp > 0
                  ? Math.round(((mrp - sellingPrice) / mrp) * 100)
                  : 0;

              const singleHtml = buildLabelHtml({
                productName: item.product.name,
                sku: barcodeValue,
                mrp,
                sellingPrice,
                discountPercentage: discount,
                template,
              });

              return Array.from({ length: item.quantity }).map((_, idx) => (
                <div
                  key={`${item.product.id}-${idx}`}
                  dangerouslySetInnerHTML={{ __html: singleHtml }}
                />
              ));
            })}
          </div>,
          document.body
        )}

      {/* Screen Modal */}
      <div className="relative w-full max-w-4xl bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                BULK THERMAL LABEL PRINTING
              </h2>
              <p className="text-xs text-stone-400">
                Generate sequential 60mm × 24mm landscape thermal stickers across multiple products
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

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Top Bar: Template Selection & Summary */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-stone-800/70 border border-stone-700/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-300">Template:</span>
              <div className="flex rounded-xl bg-stone-900 p-1 border border-stone-700">
                <button
                  type="button"
                  onClick={() => setTemplate('standard')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    template === 'standard' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => setTemplate('compact')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    template === 'compact' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Compact
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-bold">
              <div>
                <span className="text-stone-400">Products: </span>
                <span className="text-white">{selectedItems.length}</span>
              </div>
              <div className="h-4 w-px bg-stone-700" />
              <div>
                <span className="text-stone-400">Total Stickers: </span>
                <span className="text-amber-400 text-sm font-black">{totalLabels}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Selected Batch Queue */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-300">
                  Batch Print Queue ({selectedItems.length})
                </h3>
                {selectedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedItems([])}
                    className="text-[11px] text-rose-400 hover:text-rose-300 font-bold"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {selectedItems.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-stone-700 text-stone-500 text-xs">
                  No products in batch. Select from the catalogue on the right.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedItems.map((item) => (
                    <div
                      key={item.product.id}
                      className="p-3.5 rounded-2xl bg-stone-800/80 border border-stone-700 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">
                          {item.product.name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-400">
                          <span className="font-mono text-amber-300">{item.product.sku}</span>
                          <span>•</span>
                          <span>₹{item.product.price}</span>
                        </div>
                      </div>

                      {/* Quantity input & quick buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 bg-stone-900 p-1 rounded-xl border border-stone-700">
                          {[5, 10, 20].map((q) => (
                            <button
                              key={q}
                              type="button"
                              onClick={() => handleQuantityChange(item.product.id, q)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.quantity === q ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-white'
                              }`}
                            >
                              +{q}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={item.quantity}
                            onChange={(e) =>
                              handleQuantityChange(item.product.id, parseInt(e.target.value, 10))
                            }
                            className="w-16 px-2 py-1 bg-stone-900 border border-stone-700 rounded-xl text-center text-xs font-bold text-white"
                          />
                          <span className="text-[10px] text-stone-400">pcs</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.product.id)}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-stone-700 transition-colors"
                          title="Remove from batch"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Col: Add More Products from Catalogue */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-300">
                Add More Products
              </h3>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter name or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-stone-800 border border-stone-700 rounded-xl text-xs text-white placeholder:text-stone-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {filteredCatalogue.slice(0, 15).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleAddProduct(p)}
                    className="w-full text-left p-2.5 rounded-xl bg-stone-800/50 hover:bg-stone-800 border border-stone-700/60 hover:border-amber-500/50 flex items-center justify-between gap-2 transition-colors group"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-stone-200 group-hover:text-white truncate">
                        {p.name}
                      </div>
                      <div className="text-[10px] font-mono text-amber-400/80">
                        {p.sku} • ₹{p.price}
                      </div>
                    </div>
                    <div className="p-1 rounded-lg bg-stone-700 text-stone-300 group-hover:bg-amber-500 group-hover:text-stone-950 shrink-0 transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-800 bg-stone-900/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyTspl}
              className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-stone-700"
            >
              {copiedTspl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedTspl ? 'Copied TSPL' : 'Copy TSPL'}
            </button>
            <button
              type="button"
              onClick={handleDownloadPrn}
              className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-stone-700"
            >
              <Download className="w-3.5 h-3.5" />
              Download .PRN
            </button>
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
              disabled={selectedItems.length === 0 || isPrinting}
              onClick={handlePrintAll}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-black rounded-xl text-xs flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-amber-500/20"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Preparing Print...
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  Print All {totalLabels} Labels
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
