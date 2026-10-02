'use client';

// ==============================================================================
// JAINAM TRADERS — CATALOGUE DUPLICATE AUDIT & SAFE MERGE UTILITY
// Scans for existing duplicate products across the catalogue, enables side-by-side
// comparison, and executes reversible Owner-only inventory consolidation.
// (Requirements 18, 19, 20).
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Product, SimilarProductMatch } from '@/lib/types';
import { StaffRole } from '@/lib/auth/staff-roles';
import { formatINR } from '@/lib/utils';
import ProductImage from '@/components/ui/product-image';
import {
  AlertTriangle,
  CheckCircle2,
  X,
  Layers,
  Sparkles,
  GitMerge,
  ArrowRight,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Eye,
  Check,
} from 'lucide-react';

interface DuplicateAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffRole: StaffRole;
  onProductMerged?: () => void;
}

export function DuplicateAuditModal({
  isOpen,
  onClose,
  staffRole,
  onProductMerged,
}: DuplicateAuditModalProps) {
  const [loading, setLoading] = useState(true);
  const [duplicateGroups, setDuplicateGroups] = useState<SimilarProductMatch[][]>([]);
  const [dismissedGroupKeys, setDismissedGroupKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  // Selected comparison view
  const [selectedGroup, setSelectedGroup] = useState<SimilarProductMatch[] | null>(null);

  // Merge Confirmation Modal State
  const [mergeSource, setMergeSource] = useState<Product | null>(null);
  const [mergeTarget, setMergeTarget] = useState<Product | null>(null);
  const [mergeReason, setMergeReason] = useState('Duplicate product entry consolidation');
  const [mergeNotes, setMergeNotes] = useState('');
  const [isMerging, setIsMerging] = useState(false);
  const [mergeImpact, setMergeImpact] = useState<any>(null);
  const [mergeSuccessMsg, setMergeSuccessMsg] = useState('');

  const fetchDuplicates = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/products/duplicates');
      if (!res.ok) {
        throw new Error('Failed to load duplicate catalogue audit');
      }
      const data = await res.json();
      setDuplicateGroups(data.groups || []);
      if (data.groups && data.groups.length > 0) {
        setSelectedGroup(data.groups[0]);
      } else {
        setSelectedGroup(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error auditing duplicates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDuplicates();
    }
  }, [isOpen]);

  const handleInitiateMerge = async (source: Product, target: Product) => {
    setMergeSource(source);
    setMergeTarget(target);
    setMergeSuccessMsg('');
    setError('');

    // Fetch impact preview
    try {
      const res = await fetch('/api/admin/products/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceProductId: source.id,
          targetProductId: target.id,
          previewOnly: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.impact) {
        setMergeImpact(data.impact);
      }
    } catch (err) {
      console.error('Impact calculation error', err);
    }
  };

  const handleConfirmMerge = async () => {
    if (!mergeSource || !mergeTarget) return;

    if (staffRole !== 'owner') {
      setError('Owner authorization is strictly required to merge products (Requirement 20).');
      return;
    }

    setIsMerging(true);
    setError('');
    try {
      const res = await fetch('/api/admin/products/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceProductId: mergeSource.id,
          targetProductId: mergeTarget.id,
          differentiatorReason: mergeReason,
          notes: mergeNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to merge products');
      }

      setMergeSuccessMsg(data.message || 'Products merged successfully!');
      setTimeout(() => {
        setMergeSource(null);
        setMergeTarget(null);
        setMergeImpact(null);
        fetchDuplicates();
        onProductMerged?.();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to execute merge');
    } finally {
      setIsMerging(false);
    }
  };

  if (!isOpen) return null;

  const activeGroups = duplicateGroups.filter((g) => {
    const key = g.map((m) => m.product.id).sort().join('_');
    return !dismissedGroupKeys.has(key);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-5xl w-full p-6 sm:p-8 space-y-6 shadow-elevated my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-100 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                CATALOGUE AUDIT
              </span>
              <h3 className="font-extrabold text-stone-900 text-base sm:text-lg">
                Duplicate Product Audit &amp; Merge
              </h3>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Automated scan across product names, SKUs, barcodes, and model numbers to detect
              redundant physical inventory records.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDuplicates}
              disabled={loading}
              className="p-2 text-stone-500 hover:text-stone-800 rounded-xl hover:bg-stone-100 transition-colors"
              title="Re-scan catalogue"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-600 rounded-xl hover:bg-stone-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body content */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto" />
            <p className="text-xs text-stone-500 font-medium">
              Scanning catalogue for duplicate names, barcodes, and model numbers...
            </p>
          </div>
        ) : activeGroups.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-stone-900 text-sm">No Catalogue Duplicates Detected!</h4>
            <p className="text-xs text-stone-500 max-w-md mx-auto">
              Every product in your catalogue has unique identifiers, distinct naming, and cleanly
              separated inventory records.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 overflow-y-auto">
            {/* Left Column: Duplicate Groups List */}
            <div className="lg:col-span-5 space-y-3 overflow-y-auto max-h-[60vh] pr-1">
              <div className="text-xs font-bold text-stone-700 flex items-center justify-between">
                <span>Possible Duplicate Groups ({activeGroups.length})</span>
              </div>

              {activeGroups.map((group, groupIdx) => {
                const p1 = group[0].product;
                const p2 = group[1]?.product;
                const topScore = group[1]?.score || 90;
                const isSelected = selectedGroup === group;
                const groupKey = group.map((m) => m.product.id).sort().join('_');

                return (
                  <div
                    key={groupKey}
                    onClick={() => setSelectedGroup(group)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-stone-500">
                        Group #{groupIdx + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        {topScore}% Similarity
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-stone-200 text-stone-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                          1
                        </span>
                        <span className="font-bold text-stone-900 truncate">{p1.name}</span>
                        <span className="text-[10px] font-mono text-stone-400">({p1.sku})</span>
                      </div>
                      {p2 && (
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-stone-200 text-stone-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                            2
                          </span>
                          <span className="font-bold text-stone-900 truncate">{p2.name}</span>
                          <span className="text-[10px] font-mono text-stone-400">({p2.sku})</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-[11px]">
                      <span className="text-stone-400">{group.length} items linked</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDismissedGroupKeys((prev) => new Set([...prev, groupKey]));
                        }}
                        className="text-stone-400 hover:text-stone-600 font-semibold"
                      >
                        Keep Separate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Side-by-Side Product Comparison */}
            {selectedGroup && selectedGroup.length >= 2 && (
              <div className="lg:col-span-7 bg-stone-50 rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-4 overflow-y-auto max-h-[60vh]">
                <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                  <h4 className="font-extrabold text-stone-900 text-xs sm:text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    Side-by-Side Product Comparison
                  </h4>
                  <span className="text-xs text-stone-500">
                    Match Confidence:{' '}
                    <strong className="text-amber-700 font-bold">{selectedGroup[1]?.confidence}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  {/* Product 1 */}
                  {(() => {
                    const p = selectedGroup[0].product;
                    return (
                      <div className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-3">
                        <div className="flex items-center gap-2 font-bold text-stone-800 pb-2 border-b border-stone-100">
                          <span className="w-5 h-5 rounded-full bg-stone-900 text-white text-[11px] flex items-center justify-center font-bold">
                            A
                          </span>
                          <span>Existing Item A</span>
                        </div>
                        <div className="w-20 h-20 rounded-xl overflow-hidden mx-auto border border-stone-200">
                          <ProductImage src={p.thumbnailUrl} alt={p.name} width={80} height={80} />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-stone-400 uppercase font-bold block">Name</span>
                          <span className="font-bold text-stone-900 block leading-tight">{p.name}</span>
                        </div>
                        <div className="space-y-0.5 font-mono text-[11px]">
                          <span className="text-[10px] text-stone-400 uppercase font-bold block font-sans">SKU / Barcode</span>
                          <div>SKU: <strong className="text-stone-800">{p.sku}</strong></div>
                          <div>Barcode: {p.barcodeValue || p.sku}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-100">
                          <div>
                            <span className="text-[10px] text-stone-400 uppercase font-bold block">Price</span>
                            <span className="font-extrabold text-stone-900">{formatINR(p.price)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-stone-400 uppercase font-bold block">Stock</span>
                            <span className="font-extrabold text-emerald-700">{p.stockQuantity}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleInitiateMerge(selectedGroup[1].product, p)}
                          className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                        >
                          <GitMerge className="w-3.5 h-3.5" />
                          Set as Canonical &amp; Merge B &rarr; A
                        </button>
                      </div>
                    );
                  })()}

                  {/* Product 2 */}
                  {(() => {
                    const p = selectedGroup[1].product;
                    return (
                      <div className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-3">
                        <div className="flex items-center gap-2 font-bold text-stone-800 pb-2 border-b border-stone-100">
                          <span className="w-5 h-5 rounded-full bg-stone-900 text-white text-[11px] flex items-center justify-center font-bold">
                            B
                          </span>
                          <span>Existing Item B</span>
                        </div>
                        <div className="w-20 h-20 rounded-xl overflow-hidden mx-auto border border-stone-200">
                          <ProductImage src={p.thumbnailUrl} alt={p.name} width={80} height={80} />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-stone-400 uppercase font-bold block">Name</span>
                          <span className="font-bold text-stone-900 block leading-tight">{p.name}</span>
                        </div>
                        <div className="space-y-0.5 font-mono text-[11px]">
                          <span className="text-[10px] text-stone-400 uppercase font-bold block font-sans">SKU / Barcode</span>
                          <div>SKU: <strong className="text-stone-800">{p.sku}</strong></div>
                          <div>Barcode: {p.barcodeValue || p.sku}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-100">
                          <div>
                            <span className="text-[10px] text-stone-400 uppercase font-bold block">Price</span>
                            <span className="font-extrabold text-stone-900">{formatINR(p.price)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-stone-400 uppercase font-bold block">Stock</span>
                            <span className="font-extrabold text-emerald-700">{p.stockQuantity}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleInitiateMerge(selectedGroup[0].product, p)}
                          className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                        >
                          <GitMerge className="w-3.5 h-3.5" />
                          Set as Canonical &amp; Merge A &rarr; B
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Merge Impact Modal Overlay (Requirement 20) */}
        {mergeSource && mergeTarget && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-elevated animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2.5 text-amber-700 pb-2 border-b border-stone-100">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <h4 className="font-extrabold text-stone-900 text-sm">
                  Confirm Product Merge &amp; Inventory Consolidation
                </h4>
              </div>

              {staffRole !== 'owner' ? (
                <div className="p-3 bg-red-50 text-red-800 rounded-xl text-xs font-semibold">
                  ⚠️ Product merging modifies historical records and requires Owner authorization.
                  Please log in as Owner to merge these records.
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <p className="text-stone-600">
                    You are consolidating duplicate physical stock into a single canonical record.
                    Source product will be soft-archived, stock will transfer, and historical orders
                    remain unaltered.
                  </p>

                  {/* Impact Summary Table */}
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-2 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-stone-500 font-sans">Source Product (To Archive):</span>
                      <strong className="text-stone-900">{mergeSource.sku}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500 font-sans">Target Product (Canonical):</span>
                      <strong className="text-stone-900">{mergeTarget.sku}</strong>
                    </div>
                    <div className="flex justify-between border-t border-stone-200 pt-1.5">
                      <span className="text-stone-500 font-sans">Stock to Transfer:</span>
                      <strong className="text-emerald-700">+{mergeSource.stockQuantity} Units</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500 font-sans">Canonical Stock After Merge:</span>
                      <strong className="text-emerald-700">
                        {mergeTarget.stockQuantity + mergeSource.stockQuantity} Units
                      </strong>
                    </div>
                    {mergeImpact && (
                      <>
                        <div className="flex justify-between border-t border-stone-200 pt-1.5">
                          <span className="text-stone-500 font-sans">Past Orders Preserved:</span>
                          <span>{mergeImpact.ordersAffectedCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-500 font-sans">Customer Reviews Re-linked:</span>
                          <span>{mergeImpact.reviewsAffectedCount}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Merge Reason</label>
                    <input
                      type="text"
                      value={mergeReason}
                      onChange={(e) => setMergeReason(e.target.value)}
                      className="w-full p-2 border border-stone-300 rounded-lg text-xs"
                      placeholder="e.g. Accidental duplicate creation by staff"
                    />
                  </div>

                  {mergeSuccessMsg && (
                    <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600" />
                      {mergeSuccessMsg}
                    </div>
                  )}

                  {error && <div className="text-xs text-red-600 font-medium">{error}</div>}

                  <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      disabled={isMerging}
                      onClick={() => {
                        setMergeSource(null);
                        setMergeTarget(null);
                        setMergeImpact(null);
                      }}
                      className="px-3 py-1.5 text-stone-500 hover:text-stone-700 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isMerging}
                      onClick={handleConfirmMerge}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      {isMerging ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Merging...
                        </>
                      ) : (
                        <>
                          <GitMerge className="w-3.5 h-3.5" /> Confirm Reversible Merge
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
