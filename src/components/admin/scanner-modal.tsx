'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Product, Order, UserRole } from '@/lib/types';
import { resolveScanInput, ScanResolution } from '@/lib/barcode/barcode-service';
import {
  Camera,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Package,
  Eye,
  PlusCircle,
  Plus,
  Minus,
  ArrowRight,
  RefreshCw,
  QrCode,
  Barcode as BarcodeIcon,
} from 'lucide-react';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  orders: Order[];
  staffRole?: UserRole;
  onSelectOrder?: (order: Order) => void;
  onViewProduct?: (product: Product) => void;
  onPrintLabel?: (product: Product) => void;
  onAddToCounterOrder?: (product: Product) => void;
  onStockAdjusted?: () => void;
}

export function ScannerModal({
  isOpen,
  onClose,
  products,
  orders,
  staffRole = 'staff',
  onSelectOrder,
  onViewProduct,
  onPrintLabel,
  onAddToCounterOrder,
  onStockAdjusted,
}: ScannerModalProps) {
  const [manualCode, setManualCode] = useState('');
  const [scanResult, setScanResult] = useState<ScanResolution | null>(null);
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);
  const [stockAdjustmentSuccess, setStockAdjustmentSuccess] = useState<string | null>(null);
  const [stockAdjustmentError, setStockAdjustmentError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const [customStockChange, setCustomStockChange] = useState('');
  const [isCustomStockOpen, setIsCustomStockOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus manual input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Clean up camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setScanResult(null);
      setManualCode('');
      setStockAdjustmentSuccess(null);
      setStockAdjustmentError(null);
    }
  }, [isOpen, stopCamera]);

  const handleLookup = useCallback(
    (codeToLookup: string) => {
      if (!codeToLookup || !codeToLookup.trim()) return;
      const res = resolveScanInput(products, orders, codeToLookup);
      setScanResult(res);
      setStockAdjustmentSuccess(null);
      setStockAdjustmentError(null);
      setIsCustomStockOpen(false);

      // Play subtle positive beep if audio supported
      try {
        if (typeof window !== 'undefined' && window.AudioContext) {
          const ctx = new window.AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          gain.gain.value = 0.05;
          osc.frequency.value = res.type === 'NOT_FOUND' ? 300 : 880;
          osc.start();
          setTimeout(() => {
            osc.stop();
            ctx.close();
          }, 120);
        }
      } catch {
        // AudioContext not allowed or disabled
      }
    },
    [products, orders]
  );

  // Camera Barcode Scanning Loop
  const startCamera = async () => {
    setCameraError(null);
    setCameraPermissionDenied(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera streaming is not supported on this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      // BarcodeDetector API check
      const BarcodeDetectorClass = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector;
      if (BarcodeDetectorClass) {
        const barcodeDetector = new BarcodeDetectorClass({
          formats: ['code_128', 'qr_code', 'ean_13', 'code_39', 'upc_a'],
        });

        const detectLoop = async () => {
          if (!streamRef.current || !videoRef.current) return;
          try {
            if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const detectedValue = barcodes[0].rawValue;
                if (detectedValue) {
                  stopCamera();
                  setManualCode(detectedValue);
                  handleLookup(detectedValue);
                  return;
                }
              }
            }
          } catch {
            // detection frame skipped
          }
          if (streamRef.current) {
            requestAnimationFrame(detectLoop);
          }
        };

        requestAnimationFrame(detectLoop);
      } else {
        setCameraError(
          'Live barcode recognition requires Chromium/Edge or HTTPS BarcodeDetector. You can point the camera or type/scan via USB scanner below.'
        );
      }
    } catch (err: unknown) {
      stopCamera();
      const msg = err instanceof Error ? err.message : 'Camera access error';
      if (msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('not allowed')) {
        setCameraPermissionDenied(true);
      } else {
        setCameraError(msg);
      }
    }
  };

  const handleSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();
    handleLookup(manualCode);
  };

  // Quick Stock Adjustment (+1, +5, +10, -1, -5, -10, or custom)
  const handleQuickAdjustStock = async (delta: number) => {
    if (!scanResult || scanResult.type !== 'PRODUCT' || !scanResult.product) return;
    const targetProduct = scanResult.product;

    setIsAdjustingStock(true);
    setStockAdjustmentError(null);
    setStockAdjustmentSuccess(null);

    try {
      const res = await fetch('/api/products/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: targetProduct.id,
          quantityChange: delta,
          reason: delta > 0 ? 'restock' : 'manual_correction',
          notes: `Quick barcode scan stock adjustment: ${delta > 0 ? '+' : ''}${delta}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Stock adjustment failed');
      }

      // Update local product view
      const updatedStock = (targetProduct.stockQuantity || 0) + delta;
      targetProduct.stockQuantity = updatedStock;

      setStockAdjustmentSuccess(
        `Stock updated to ${updatedStock} (${delta > 0 ? '+' : ''}${delta})`
      );
      if (onStockAdjusted) onStockAdjusted();
    } catch (err: unknown) {
      setStockAdjustmentError(err instanceof Error ? err.message : 'Failed to update stock');
    } finally {
      setIsAdjustingStock(false);
      setIsCustomStockOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <BarcodeIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                SCAN PRODUCT / ORDER
              </h2>
              <p className="text-xs text-stone-400">
                Code 128 Product SKU • Pickup Order QR • USB Barcode Reader
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

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Camera Viewfinder (if active) */}
          {cameraActive && (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-stone-700 flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Aiming Reticle */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-32 border-2 border-amber-400/80 rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                  <div className="absolute -top-6 left-0 right-0 text-center text-[10px] font-bold text-amber-300 uppercase tracking-widest">
                    Align Barcode or QR
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={stopCamera}
                className="absolute top-3 right-3 px-3 py-1 bg-stone-900/80 hover:bg-stone-900 text-stone-300 text-xs font-bold rounded-lg border border-stone-700"
              >
                Close Camera
              </button>
            </div>
          )}

          {/* Camera Permission Denied / Error Banner */}
          {cameraPermissionDenied && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Camera Access Blocked:</strong> Please allow camera permission in browser settings, or enter the SKU below manually. (USB handheld scanners also work directly).
              </div>
            </div>
          )}

          {cameraError && !cameraPermissionDenied && (
            <div className="p-3.5 rounded-2xl bg-stone-800 border border-stone-700 text-xs text-stone-300">
              {cameraError}
            </div>
          )}

          {/* Scan / Input Form */}
          <form onSubmit={handleSubmitManual} className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-amber-400 absolute left-3.5 top-3" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Scan barcode with USB reader or type SKU (e.g. JT-PF-001)..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-stone-800 border border-stone-700 rounded-2xl text-xs sm:text-sm text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold"
                />
              </div>

              <button
                type="submit"
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs rounded-2xl transition-colors shrink-0"
              >
                Lookup
              </button>

              {!cameraActive && (
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-3.5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
                  title="Open device camera"
                >
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Camera</span>
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-500 px-1">
              <span>Supports: Code 128 Product SKU, Order QR token, Order ID</span>
              <span>Hardware wedge scanner auto-submits</span>
            </div>
          </form>

          {/* SCAN RESULT PRESENTATION */}
          {scanResult && (
            <div className="animate-fade-in space-y-4">
              {/* CASE A: PRODUCT FOUND */}
              {scanResult.type === 'PRODUCT' && scanResult.product && (() => {
                const prod = scanResult.product;
                const mrp = Number(prod.mrp) || 0;
                const selling = Number(prod.price) || 0;
                const discount =
                  mrp > selling && mrp > 0
                    ? Math.round(((mrp - selling) / mrp) * 100)
                    : 0;
                const stockQty = prod.stockQuantity ?? 0;

                return (
                  <div className="p-5 rounded-3xl bg-stone-800/90 border border-amber-500/40 space-y-5 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                          PRODUCT FOUND
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-stone-900 text-amber-300 border border-stone-700">
                        {prod.sku}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-base sm:text-lg font-extrabold text-white leading-tight">
                        {prod.name}
                      </h3>
                      <p className="text-xs text-stone-400">
                        {prod.categoryName || 'General Product'} • {prod.brand || 'Jainam Traders'}
                      </p>
                    </div>

                    {/* Price & Stock Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-stone-900 border border-stone-700/80">
                      <div>
                        <div className="text-[10px] text-stone-400 uppercase font-bold">MRP</div>
                        <div className="text-xs font-bold text-stone-300 line-through">₹{mrp}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-emerald-400 uppercase font-bold">Selling</div>
                        <div className="text-base font-black text-white">₹{selling}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-rose-400 uppercase font-bold">Discount</div>
                        <div className="text-xs font-black text-rose-300">
                          {discount > 0 ? `${discount}% OFF` : 'None'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-amber-400 uppercase font-bold">Stock (Exact)</div>
                        <div className="text-base font-black text-amber-300">
                          {stockQty} <span className="text-[10px] font-normal text-stone-400">units</span>
                        </div>
                      </div>
                    </div>

                    {/* Stock Adjustment Feedback */}
                    {stockAdjustmentSuccess && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{stockAdjustmentSuccess}</span>
                      </div>
                    )}
                    {stockAdjustmentError && (
                      <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span>{stockAdjustmentError}</span>
                      </div>
                    )}

                    {/* Quick Stock Adjustment Workflow (+1, +5, +10, -1, -5, -10) */}
                    {staffRole !== 'staff' && (
                      <div className="p-3.5 rounded-2xl bg-stone-900/60 border border-stone-700 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-stone-300">
                          <span>Quick Adjust Stock:</span>
                          <span className="text-[11px] text-stone-400">Protected Inventory Log</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Additions */}
                          <div className="flex items-center gap-1 bg-emerald-950/40 p-1 rounded-xl border border-emerald-800/40">
                            {[1, 5, 10].map((num) => (
                              <button
                                key={`add-${num}`}
                                type="button"
                                disabled={isAdjustingStock}
                                onClick={() => handleQuickAdjustStock(num)}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-600/30 transition-all flex items-center gap-0.5 active:scale-95"
                              >
                                <Plus className="w-3 h-3" />
                                {num}
                              </button>
                            ))}
                          </div>

                          {/* Deductions */}
                          <div className="flex items-center gap-1 bg-rose-950/40 p-1 rounded-xl border border-rose-800/40">
                            {[1, 5, 10].map((num) => (
                              <button
                                key={`sub-${num}`}
                                type="button"
                                disabled={isAdjustingStock || stockQty < num}
                                onClick={() => handleQuickAdjustStock(-num)}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-600/30 hover:bg-rose-600/50 disabled:opacity-40 text-rose-300 border border-rose-600/30 transition-all flex items-center gap-0.5 active:scale-95"
                              >
                                <Minus className="w-3 h-3" />
                                {num}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => setIsCustomStockOpen(!isCustomStockOpen)}
                            className="px-2.5 py-1 rounded-xl text-xs font-bold bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700"
                          >
                            Custom
                          </button>
                        </div>

                        {/* Custom Adjustment Input */}
                        {isCustomStockOpen && (
                          <div className="flex items-center gap-2 pt-2 border-t border-stone-800">
                            <input
                              type="number"
                              placeholder="Qty (+ or -)"
                              value={customStockChange}
                              onChange={(e) => setCustomStockChange(e.target.value)}
                              className="w-28 px-3 py-1 bg-stone-900 border border-stone-700 rounded-xl text-xs text-white"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const val = parseInt(customStockChange, 10);
                                if (!isNaN(val) && val !== 0) {
                                  handleQuickAdjustStock(val);
                                  setCustomStockChange('');
                                }
                              }}
                              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-bold"
                            >
                              Apply
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons: [View Product], [Adjust Stock], [Print Label], [Add to Order] */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-stone-700/60">
                      <button
                        type="button"
                        onClick={() => {
                          if (onViewProduct) onViewProduct(prod);
                          onClose();
                        }}
                        className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Product
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsCustomStockOpen(true)}
                        className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Package className="w-3.5 h-3.5" />
                        Adjust Stock
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (onPrintLabel) onPrintLabel(prod);
                        }}
                        className="p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print Label
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (onAddToCounterOrder) onAddToCounterOrder(prod);
                          onClose();
                        }}
                        className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Add to Order
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* CASE B: ORDER FOUND */}
              {scanResult.type === 'ORDER' && scanResult.order && (() => {
                const ord = scanResult.order;
                return (
                  <div className="p-5 rounded-3xl bg-stone-800/90 border border-emerald-500/40 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                          ORDER QR VERIFIED
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-stone-900 text-white">
                        {ord.orderNumber}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-stone-900 border border-stone-700">
                      <div>
                        <div className="text-[10px] text-stone-400">Customer</div>
                        <div className="text-xs font-bold text-white">{ord.customerName}</div>
                        <div className="text-[10px] text-stone-400">{ord.customerPhone}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-stone-400">Total &amp; Status</div>
                        <div className="text-sm font-black text-emerald-400">₹{ord.totalAmount}</div>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 mt-0.5">
                          {ord.status}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectOrder) onSelectOrder(ord);
                        onClose();
                      }}
                      className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95"
                    >
                      Open Pickup / Order Details
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                );
              })()}

              {/* CASE C: NOT FOUND */}
              {scanResult.type === 'NOT_FOUND' && (
                <div className="p-6 rounded-3xl bg-rose-950/30 border border-rose-800/50 text-center space-y-2">
                  <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
                  <div className="text-sm font-bold text-rose-200">
                    Product or Order Not Found
                  </div>
                  <p className="text-xs text-rose-300/80 max-w-sm mx-auto">
                    {scanResult.error || `No product SKU or order token matched "${scanResult.query}".`}
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setScanResult(null);
                        setManualCode('');
                        inputRef.current?.focus();
                      }}
                      className="px-3.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border border-stone-700"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Try Another Scan
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-800 bg-stone-900/90 flex items-center justify-between">
          <div className="text-xs text-stone-500">
            Jainam Traders • POS &amp; Inventory Barcode Engine
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
