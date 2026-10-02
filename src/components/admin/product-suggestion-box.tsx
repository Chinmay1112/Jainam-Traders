'use client';

// ==============================================================================
// JAINAM TRADERS — SMART PRODUCT SUGGESTION & DUPLICATE PREVENTION UI
// Real-time debounced autocomplete with fuzzy matching, variant differentiation,
// and direct integration into Edit Product / Adjust Stock workflows.
// (Requirements 1, 4, 5, 6, 7, 14, 15, 16, 21, 25, 30).
// ==============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { Product, SimilarProductMatch } from '@/lib/types';
import { formatINR } from '@/lib/utils';
import ProductImage from '@/components/ui/product-image';
import {
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  Info,
} from 'lucide-react';

interface ProductSuggestionBoxProps {
  productName: string;
  sku?: string;
  brand?: string;
  categoryId?: string;
  manufacturerModelNumber?: string;
  excludeProductId?: string;
  onSelectExistingProduct: (product: Product, workflow: 'edit' | 'stock') => void;
  onDifferentiatorConfirmed?: (differentiator: { reason: string; note?: string } | null) => void;
  isCreateMode?: boolean;
}

export const DIFFERENTIATOR_REASONS = [
  'Different size',
  'Different color',
  'Different design',
  'Different brand',
  'Different model',
  'Different variant',
  'Other',
];

export function ProductSuggestionBox({
  productName,
  sku,
  brand,
  categoryId,
  manufacturerModelNumber,
  excludeProductId,
  onSelectExistingProduct,
  onDifferentiatorConfirmed,
  isCreateMode = true,
}: ProductSuggestionBoxProps) {
  const [matches, setMatches] = useState<SimilarProductMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const [error, setError] = useState('');

  // High confidence duplicate acknowledgement state
  const [showDifferentiatorForm, setShowDifferentiatorForm] = useState(false);
  const [selectedReason, setSelectedReason] = useState(DIFFERENTIATOR_REASONS[0]);
  const [differentiatorNote, setDifferentiatorNote] = useState('');
  const [differentiatorConfirmed, setDifferentiatorConfirmed] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const onDifferentiatorConfirmedRef = useRef(onDifferentiatorConfirmed);
  onDifferentiatorConfirmedRef.current = onDifferentiatorConfirmed;

  // Debounced query effect (250-350ms per Requirement 16)
  useEffect(() => {
    const trimmedName = productName.trim();
    const trimmedSku = sku?.trim() || '';
    const trimmedModel = manufacturerModelNumber?.trim() || '';

    // Only search if user typed at least 3 characters in name or an SKU/model
    if (trimmedName.length < 3 && !trimmedSku && !trimmedModel) {
      setMatches([]);
      setHasQueried(false);
      setLoading(false);
      setShowDifferentiatorForm(false);
      setDifferentiatorConfirmed(false);
      onDifferentiatorConfirmedRef.current?.(null);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError('');

    const timer = setTimeout(async () => {
      try {
        const queryParams = new URLSearchParams();
        if (trimmedName) queryParams.set('name', trimmedName);
        if (trimmedSku) queryParams.set('sku', trimmedSku);
        if (brand?.trim()) queryParams.set('brand', brand.trim());
        if (categoryId?.trim()) queryParams.set('categoryId', categoryId.trim());
        if (trimmedModel) queryParams.set('manufacturerModelNumber', trimmedModel);
        if (excludeProductId) queryParams.set('excludeProductId', excludeProductId);

        const res = await fetch(`/api/products/similar?${queryParams.toString()}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error('Failed to fetch product suggestions');
        }

        const data = await res.json();
        const foundMatches: SimilarProductMatch[] = data.matches || [];
        setMatches(foundMatches);
        setHasQueried(true);

        // Reset confirmation if user significantly changes the name
        const hasHighConfidence = foundMatches.some(
          (m) => m.confidence === 'EXACT' || (m.confidence === 'HIGH' && m.score >= 85)
        );
        if (!hasHighConfidence) {
          setShowDifferentiatorForm(false);
          setDifferentiatorConfirmed(true);
          onDifferentiatorConfirmedRef.current?.(null);
        } else {
          setDifferentiatorConfirmed(false);
          onDifferentiatorConfirmedRef.current?.(null);
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          setError('Could not verify existing products');
        }
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [productName, sku, brand, categoryId, manufacturerModelNumber, excludeProductId]);

  const handleConfirmDifferentiator = () => {
    setDifferentiatorConfirmed(true);
    setShowDifferentiatorForm(false);
    onDifferentiatorConfirmed?.({
      reason: selectedReason,
      note: differentiatorNote.trim() || undefined,
    });
  };

  const topMatch = matches[0];
  const hasHighConfidenceMatch = Boolean(
    topMatch && (topMatch.confidence === 'EXACT' || topMatch.confidence === 'HIGH')
  );

  if (!productName.trim() && !sku?.trim() && !manufacturerModelNumber?.trim()) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2.5">
      {/* Loading Indicator */}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-stone-500 py-1 px-2 animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
          <span>Checking Jainam Traders catalogue for similar products...</span>
        </div>
      )}

      {/* No Matches Found State */}
      {!loading && hasQueried && matches.length === 0 && (
        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>✓ No similar existing products found in catalogue. Safe to create.</span>
        </div>
      )}

      {/* High Confidence Duplicate Warning Banner */}
      {!loading && hasHighConfidenceMatch && isCreateMode && (
        <div className="p-3.5 bg-amber-50 border-2 border-amber-400 rounded-2xl space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-extrabold text-amber-950 text-xs sm:text-sm">
                ⚠️ POSSIBLE DUPLICATE PRODUCT DETECTED
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                This item looks very similar to an existing product in your inventory (
                <strong className="underline">{topMatch.product.name}</strong>, SKU:{' '}
                <span className="font-mono font-bold">{topMatch.product.sku}</span>).
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {topMatch.matchReasons.map((reason, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-amber-200/70 text-amber-900 rounded-md text-[10px] font-bold"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/70">
            <button
              type="button"
              onClick={() => onSelectExistingProduct(topMatch.product, 'stock')}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Package className="w-3.5 h-3.5" />
              Adjust Stock on Existing Product
            </button>
            <button
              type="button"
              onClick={() => onSelectExistingProduct(topMatch.product, 'edit')}
              className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
              Open Existing Product
            </button>
            {!differentiatorConfirmed ? (
              <button
                type="button"
                onClick={() => setShowDifferentiatorForm(true)}
                className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-semibold ml-auto transition-colors"
              >
                Create New Product Anyway
              </button>
            ) : (
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-lg ml-auto flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Differentiator confirmed: {selectedReason}
              </span>
            )}
          </div>

          {/* Differentiator requirement form */}
          {showDifferentiatorForm && !differentiatorConfirmed && (
            <div className="p-3 bg-white rounded-xl border border-amber-300 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                <Info className="w-4 h-4 text-amber-600" />
                <span>Why is this a different product? (Required)</span>
              </div>
              <p className="text-[11px] text-stone-500">
                To prevent accidental duplicate catalogue entries, please record the differentiating
                attribute before publishing:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {DIFFERENTIATOR_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSelectedReason(reason)}
                    className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border text-left transition-all ${
                      selectedReason === reason
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Optional differentiator note (e.g. 18-inch jumbo size vs standard 12-inch)"
                  value={differentiatorNote}
                  onChange={(e) => setDifferentiatorNote(e.target.value)}
                  className="w-full p-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDifferentiatorForm(false)}
                  className="px-2.5 py-1 text-xs text-stone-500 hover:text-stone-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDifferentiator}
                  className="px-3 py-1 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Confirm &amp; Proceed
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Suggestion List Cards (Requirements 1, 15, 21, 30) */}
      {!loading && matches.length > 0 && (
        <div className="border border-stone-200 rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="bg-stone-50 px-3.5 py-2 border-b border-stone-200 flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Existing Products ({matches.length})
            </span>
            <span className="text-[10px] text-stone-400">Tap to use or view stock</span>
          </div>

          <div className="divide-y divide-stone-100 max-h-60 overflow-y-auto">
            {matches.map(({ product: p, score, confidence, matchReasons }) => {
              const badgeColor =
                confidence === 'EXACT'
                  ? 'bg-red-100 text-red-800 border-red-200'
                  : confidence === 'HIGH'
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-stone-100 text-stone-700 border-stone-200';

              return (
                <div
                  key={p.id}
                  className="p-3 hover:bg-amber-50/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  {/* Left: Thumbnail & Details */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-stone-200 bg-stone-100">
                      <ProductImage src={p.thumbnailUrl} alt={p.name} width={48} height={48} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-stone-900 truncate max-w-xs">{p.name}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${badgeColor}`}
                        >
                          {score}% Match ({confidence})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-stone-500 text-[11px] font-mono">
                        <span>SKU: {p.sku}</span>
                        <span>&bull;</span>
                        <span>{p.brand}</span>
                        {p.manufacturerModelNumber && (
                          <>
                            <span>&bull;</span>
                            <span>Model: {p.manufacturerModelNumber}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-extrabold text-stone-900">{formatINR(p.price)}</span>
                        {p.mrp > p.price && (
                          <span className="text-[10px] text-stone-400 line-through">
                            {formatINR(p.mrp)}
                          </span>
                        )}
                        <span className="text-[10px] text-stone-300">&bull;</span>
                        <span
                          className={`font-bold text-[11px] ${
                            p.stockQuantity <= 3 ? 'text-amber-600' : 'text-emerald-700'
                          }`}
                        >
                          {p.stockQuantity} in stock
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick Action Buttons */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectExistingProduct(p, 'stock')}
                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors"
                      title="Adjust inventory for this existing product"
                    >
                      <Package className="w-3.5 h-3.5" />
                      Adjust Stock
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectExistingProduct(p, 'edit')}
                      className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold text-[11px] flex items-center gap-1 transition-colors"
                      title="Edit this existing product"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Use This Product
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && <div className="text-[11px] text-red-500 font-medium px-1">{error}</div>}
    </div>
  );
}
