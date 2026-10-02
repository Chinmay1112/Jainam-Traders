'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Layers,
  Star,
  Settings,
  Shield,
  ShieldCheck,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  QrCode,
  Printer,
  X,
  Plus,
  RefreshCw,
  TrendingUp,
  DollarSign,
  ArrowRight,
  Eye,
  Check,
  RotateCcw,
  Edit,
  Archive,
  ArchiveRestore,
  ExternalLink,
  Sparkles,
  Phone,
  MessageSquare,
  Ban,
  Copy,
  FileText,
  Download,
  Barcode,
  History,
  LogOut,
  Users,
  Gift,
} from 'lucide-react';
import {
  Order,
  OrderStatus,
  Product,
  ShopSettings,
  Review,
  AuditLog,
  InventoryMovement,
  ReturnRequest,
  RefundRecord,
  Category,
} from '@/lib/types';
import { formatINR, formatDate } from '@/lib/utils';
import { getStatusBadgeInfo } from '@/lib/orders/state-machine';
import { useAuth } from '@/lib/context/auth-context';
import ProductImage from '@/components/ui/product-image';
import {
  normalizeProductInventory,
  calculateStockAdjustment,
  normalizeStockNumber,
} from '@/lib/inventory/normalizer';
import { StaffSession, StaffRole, canPerformAction } from '@/lib/auth/staff-roles';
import { generateProductSearchPreview } from '@/lib/search/product-indexer';
import { useRouter } from 'next/navigation';
import { PrintLabelModal } from '@/components/admin/print-label-modal';
import { ProductMediaUpload } from '@/components/admin/product-media-upload';
import { BulkPrintModal } from '@/components/admin/bulk-print-modal';
import { ScannerModal } from '@/components/admin/scanner-modal';
import { resolveScanInput } from '@/lib/barcode/barcode-service';
import AdminCustomersView from '@/components/admin/admin-customers-view';
import AdminGiftCodesView from '@/components/admin/admin-gift-codes-view';
import { ProductSuggestionBox } from '@/components/admin/product-suggestion-box';
import { DuplicateAuditModal } from '@/components/admin/duplicate-audit-modal';

interface AdminDashboardProps {
  initialStaff?: StaffSession;
}

export default function AdminDashboard({ initialStaff }: AdminDashboardProps = {}) {
  const router = useRouter();
  const { user } = useAuth();
  const staffRole: StaffRole = initialStaff?.role || 'owner';
  const staffEmail = initialStaff?.email || user?.email || 'admin@jainamtraders.com';
  const staffName = initialStaff?.fullName || user?.fullName || 'Staff Member';

  const defaultTab = staffRole === 'staff' ? 'orders' : 'overview';
  const [activeTab, setActiveTab] = useState<
    'overview' | 'orders' | 'inventory' | 'products' | 'reviews' | 'settings' | 'audit' | 'customers' | 'gift-codes'
  >(defaultTab);

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/staff/logout', { method: 'POST' });
    } finally {
      window.location.href = '/admin';
    }
  };

  // Main Entities State
  const [analytics, setAnalytics] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [refundRecords, setRefundRecords] = useState<RefundRecord[]>([]);

  // Search and Filters
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [qrInput, setQrInput] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Products Tab Filters
  const [productFilter, setProductFilter] = useState<'all' | 'active' | 'archived' | 'low_stock'>('all');
  const [productSearch, setProductSearch] = useState('');

  // Inventory Tab Search
  const [inventorySearch, setInventorySearch] = useState('');

  // Modal 1: Adjust Stock
  const [isAdjustStockModalOpen, setIsAdjustStockModalOpen] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockChangeQty, setStockChangeQty] = useState<number>(1);
  const [stockReason, setStockReason] = useState<
    'restock' | 'manual_correction' | 'damage' | 'missing' | 'purchase' | 'sale' | 'return' | 'other'
  >('restock');
  const [stockNotes, setStockNotes] = useState('');
  const [stockAdjustmentError, setStockAdjustmentError] = useState('');
  const [adjustingStockLoading, setAdjustingStockLoading] = useState(false);

  // Modal 2: Add Product
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdModelNumber, setNewProdModelNumber] = useState('');
  const [newProdDifferentiator, setNewProdDifferentiator] = useState<{ reason: string; note?: string } | null>(null);
  const [isDuplicateAuditOpen, setIsDuplicateAuditOpen] = useState(false);
  const [newProdBrand, setNewProdBrand] = useState('Jainam Traders');
  const [newProdCategory, setNewProdCategory] = useState('');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdShortDesc, setNewProdShortDesc] = useState('');
  const [newProdPrice, setNewProdPrice] = useState(0);
  const [newProdMrp, setNewProdMrp] = useState(0);
  const [newProdStock, setNewProdStock] = useState(0);
  const [newProdLowStock, setNewProdLowStock] = useState(3);
  const [newProdMaterial, setNewProdMaterial] = useState('');
  const [newProdDimensions, setNewProdDimensions] = useState('');
  const [newProdWeight, setNewProdWeight] = useState('');
  const [newProdOccasion, setNewProdOccasion] = useState('');
  const [newProdTags, setNewProdTags] = useState('');
  const [newProdSearchKeywords, setNewProdSearchKeywords] = useState('');
  const [newProdStatus, setNewProdStatus] = useState<'published' | 'draft' | 'hidden'>('published');
  const [newProdPhotos, setNewProdPhotos] = useState<string[]>([]);
  const [newProdVideo, setNewProdVideo] = useState<string | undefined>(undefined);
  const [addProductLoading, setAddProductLoading] = useState(false);
  const [addProductError, setAddProductError] = useState('');

  // Modal 3: Edit Product
  const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editModelNumber, setEditModelNumber] = useState('');
  const [isEditDuplicateCheckOpen, setIsEditDuplicateCheckOpen] = useState(false);
  const [editBrand, setEditBrand] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editShortDesc, setEditShortDesc] = useState('');
  const [editPrice, setEditPrice] = useState(0);
  const [editMrp, setEditMrp] = useState(0);
  const [editLowStock, setEditLowStock] = useState(3);
  const [editMaterial, setEditMaterial] = useState('');
  const [editDimensions, setEditDimensions] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editOccasion, setEditOccasion] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editSearchKeywords, setEditSearchKeywords] = useState('');
  const [editStatus, setEditStatus] = useState<'published' | 'draft' | 'hidden' | 'archived'>('published');
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [editVideo, setEditVideo] = useState<string | undefined>(undefined);
  const [editProductLoading, setEditProductLoading] = useState(false);
  const [editProductError, setEditProductError] = useState('');

  // Modal 4: Archive Confirmation
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [productToArchive, setProductToArchive] = useState<Product | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  // Thermal Label & Scanner Modals (60mm x 24mm Landscape TSC TTP-244 Pro)
  const [isPrintLabelModalOpen, setIsPrintLabelModalOpen] = useState(false);
  const [labelProduct, setLabelProduct] = useState<Product | null>(null);
  const [isBulkPrintModalOpen, setIsBulkPrintModalOpen] = useState(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);

  const handleOpenPrintLabel = (p: Product) => {
    setLabelProduct(p);
    setIsPrintLabelModalOpen(true);
  };

  // Modal 5: Refund Record
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundMethod, setRefundMethod] = useState<'cash' | 'upi' | 'manual'>('cash');
  const [refundReceiptNumber, setRefundReceiptNumber] = useState('');
  const [refundNotes, setRefundNotes] = useState('');

  // Modal 6: Cancel Order Modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReasonPreset, setCancelReasonPreset] = useState(
    'Customer requested cancellation via phone/message'
  );
  const [cancelReasonCustom, setCancelReasonCustom] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Modal 7: Print Pickup Slip Modal
  const [isPrintSlipModalOpen, setIsPrintSlipModalOpen] = useState(false);

  // Order Details: Admin internal notes & timeline state
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const [isSavingAdminNote, setIsSavingAdminNote] = useState(false);
  const [showStatusHistory, setShowStatusHistory] = useState(false);
  const [copiedOrderNumber, setCopiedOrderNumber] = useState(false);

  const [loading, setLoading] = useState(true);
  const [bannerNotice, setBannerNotice] = useState('');

  // Live Search Preview generators (Admin UX)
  const editSearchPreview = useMemo(() => {
    return generateProductSearchPreview({
      name: editName,
      categoryId: editCategory,
      category: editCategory,
      tags: editTags ? editTags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      material: editMaterial,
      occasion: editOccasion,
      searchKeywords: editSearchKeywords,
      brand: editBrand,
      description: editDesc,
    });
  }, [editName, editCategory, editTags, editMaterial, editOccasion, editSearchKeywords, editBrand, editDesc]);

  const newProdSearchPreview = useMemo(() => {
    return generateProductSearchPreview({
      name: newProdName,
      categoryId: newProdCategory,
      category: newProdCategory,
      tags: newProdTags ? newProdTags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      material: newProdMaterial,
      occasion: newProdOccasion,
      searchKeywords: newProdSearchKeywords,
      brand: newProdBrand,
      description: newProdDesc,
    });
  }, [newProdName, newProdCategory, newProdTags, newProdMaterial, newProdOccasion, newProdSearchKeywords, newProdBrand, newProdDesc]);


  // Fetch all admin data (Single Source of Truth)
  const refreshData = async () => {
    setLoading(true);
    try {
      const [ordRes, prodRes, setRes, revRes, retRes, refRes, catRes] = await Promise.all([
        fetch('/api/orders').then((r) => r.json()),
        fetch('/api/products?admin=true').then((r) => r.json()),
        fetch('/api/settings').then((r) => r.json()),
        fetch('/api/reviews?admin=true').then((r) => r.json()),
        fetch('/api/returns').then((r) => r.json()),
        fetch('/api/refunds').then((r) => r.json()),
        fetch('/api/categories').then((r) => r.json()).catch(() => ({ categories: [] })),
      ]);

      const loadedOrders = ordRes.orders || [];
      const loadedProducts = prodRes.products || [];
      const loadedCats = catRes.categories || [];

      setOrders(loadedOrders);
      setProducts(loadedProducts);
      setCategories(loadedCats);
      if (loadedCats.length > 0 && !newProdCategory) {
        setNewProdCategory(loadedCats[0].id);
      }
      setSettings(setRes);
      setReviews(revRes.reviews || []);
      setReturnRequests(retRes.requests || []);
      setRefundRecords(refRes.refunds || []);

      // Calculate overview analytics
      const todayStr = new Date().toISOString().split('T')[0];
      const todaysOrders = loadedOrders.filter((o: Order) => o.createdAt.startsWith(todayStr));
      const pickedUp = loadedOrders.filter((o: Order) => o.status === 'PICKED_UP');
      const sales = pickedUp.reduce((acc: number, o: Order) => acc + o.totalAmount, 0);

      setAnalytics({
        totalOrders: loadedOrders.length,
        todaysOrders: todaysOrders.length,
        pending: loadedOrders.filter((o: Order) => o.status === 'PENDING').length,
        ready: loadedOrders.filter((o: Order) => o.status === 'READY_FOR_PICKUP').length,
        pickedUp: pickedUp.length,
        totalSales: sales,
      });
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Quick Barcode / QR / Order ID lookup
  const handleQrLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrInput.trim()) {
      setIsScannerModalOpen(true);
      return;
    }
    const clean = qrInput.trim();
    const resolved = resolveScanInput(products, orders, clean);
    if (resolved.type === 'ORDER' && resolved.order) {
      setSelectedOrder(resolved.order);
      setActiveTab('orders');
      setBannerNotice(`Loaded Order ${resolved.order.orderNumber} for counter pickup verification`);
    } else {
      // Open scanner modal to view product details or report not found
      setIsScannerModalOpen(true);
    }
    setQrInput('');
  };

  // State machine transition helper
  const handleTransition = async (orderId: string, nextStatus: OrderStatus, note?: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          actorRole: staffRole,
          actorId: initialStaff?.staffId || user?.id || 'admin',
          note: note || `Staff updated status to ${nextStatus}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transition failed');

      setBannerNotice(`Order ${data.orderNumber} successfully updated to ${nextStatus}`);
      setSelectedOrder(data);
      refreshData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Transition error');
    }
  };

  // Sync internal admin notes input whenever selectedOrder changes
  useEffect(() => {
    if (selectedOrder) {
      setAdminNoteInput(selectedOrder.adminNotes || '');
    }
  }, [selectedOrder]);

  // Save internal staff note
  const handleSaveAdminNote = async () => {
    if (!selectedOrder) return;
    setIsSavingAdminNote(true);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotes: adminNoteInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save note');
      setSelectedOrder(data);
      setBannerNotice(`Internal note saved for order ${data.orderNumber}`);
      refreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update note';
      setBannerNotice(`Error: ${msg}`);
    } finally {
      setIsSavingAdminNote(false);
    }
  };

  // Confirm cancellation with preset/custom reason
  const handleConfirmCancel = async () => {
    if (!selectedOrder) return;
    setCancelLoading(true);
    try {
      const fullReason = cancelReasonCustom.trim()
        ? `${cancelReasonPreset}: ${cancelReasonCustom.trim()}`
        : cancelReasonPreset;
      await handleTransition(selectedOrder.id, 'CANCELLED', fullReason);
      setIsCancelModalOpen(false);
    } finally {
      setCancelLoading(false);
    }
  };

  // Generate WhatsApp message link for customer communication
  const getWhatsAppLink = (order: Order) => {
    const cleanPhone = order.customerPhone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const itemsSummary = order.items.map((i) => `${i.productName} (x${i.quantity})`).join(', ');
    const message = `Namaste ${order.customerName}! 🙏\nThis is Jainam Traders regarding your reservation *${order.orderNumber}* (${order.items.length} item${order.items.length > 1 ? 's' : ''}, Total: ${formatINR(order.totalAmount)}).\nItems: ${itemsSummary}\nStatus: *${getStatusBadgeInfo(order.status).label}*.\nStore Address: Jainam Traders, Main Market. Timings: 09:30 AM - 09:30 PM.\nPlease let us know if you have any questions or want to update your pickup!`;
    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
  };

  // Export filtered orders as CSV for ledger / accountant bookkeeping
  const exportOrdersToCSV = () => {
    if (filteredOrders.length === 0) {
      alert('No orders to export in current filter.');
      return;
    }
    const headers = [
      'Order Number',
      'Created Date',
      'Customer Name',
      'Phone',
      'Email',
      'Items Count',
      'Total Amount (INR)',
      'Status',
      'Payment Status',
      'Admin Notes',
    ];
    const rows = filteredOrders.map((o) => [
      `"${o.orderNumber}"`,
      `"${o.createdAt}"`,
      `"${o.customerName.replace(/"/g, '""')}"`,
      `"${o.customerPhone}"`,
      `"${o.customerEmail || ''}"`,
      o.items.length,
      o.totalAmount,
      `"${o.status}"`,
      `"${o.paymentStatus}"`,
      `"${(o.adminNotes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `jainam-traders-orders-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. STOCK ADJUSTMENT (Fully wired, server-side validated, concurrency-locked)
  const handleOpenStockAdjust = (p: Product) => {
    setStockProduct(p);
    setStockChangeQty(1);
    setStockReason('restock');
    setStockNotes('');
    setStockAdjustmentError('');
    setIsAdjustStockModalOpen(true);
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockProduct) return;

    const currentInv = normalizeProductInventory(stockProduct);
    const validation = calculateStockAdjustment(currentInv.totalStock, stockChangeQty);

    if (!validation.isValid) {
      setStockAdjustmentError(validation.error || 'Invalid stock change');
      return;
    }

    setAdjustingStockLoading(true);
    setStockAdjustmentError('');

    try {
      const res = await fetch('/api/products/stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: stockProduct.id,
          quantityChange: stockChangeQty,
          reason: stockReason,
          notes: stockNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Stock adjustment failed');
      }

      setBannerNotice(data.message || `Stock adjusted successfully for ${stockProduct.name}`);
      setIsAdjustStockModalOpen(false);
      refreshData();
    } catch (err: unknown) {
      setStockAdjustmentError(err instanceof Error ? err.message : 'Failed to adjust stock');
    } finally {
      setAdjustingStockLoading(false);
    }
  };

  // 2. EDIT PRODUCT
  const handleOpenEditProduct = (p: Product) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditSku(p.sku);
    setEditModelNumber(p.manufacturerModelNumber || '');
    setIsEditDuplicateCheckOpen(false);
    setEditBrand(p.brand || 'Jainam Heritage');
    setEditCategory(p.categoryId);
    setEditDesc(p.description || '');
    setEditShortDesc(p.shortDescription || '');
    setEditPrice(p.price);
    setEditMrp(p.mrp);
    setEditLowStock(normalizeStockNumber(p.lowStockThreshold, 3));
    setEditMaterial(p.material || '');
    setEditDimensions(p.dimensions || '');
    setEditWeight(p.weight || '');
    setEditOccasion(p.occasion || '');
    setEditTags(p.tags ? p.tags.join(', ') : '');
    setEditSearchKeywords(p.searchKeywords || '');
    setEditStatus(
      p.isArchived || p.status === 'archived'
        ? 'archived'
        : p.isActive
        ? (p.status === 'draft' ? 'draft' : 'published')
        : 'hidden'
    );
    const initialPhotos = (p.images && p.images.length > 0) ? p.images : (p.thumbnailUrl && p.thumbnailUrl !== '/images/product-placeholder.svg' ? [p.thumbnailUrl] : []);
    setEditPhotos(initialPhotos);
    setEditVideo(p.videoUrl);
    setEditProductError('');
    setIsEditProductModalOpen(true);
  };

  const handleSaveEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (editPrice <= 0) {
      setEditProductError('Selling price must be greater than zero');
      return;
    }
    if (editPrice > editMrp) {
      setEditProductError(`Selling price (₹${editPrice}) cannot exceed MRP (₹${editMrp})`);
      return;
    }

    if (editStatus === 'published' && editPhotos.length === 0) {
      setEditProductError('At least 1 product photo is recommended/required to publish. Set status to "Draft" if photos are pending.');
      return;
    }

    setEditProductLoading(true);
    setEditProductError('');

    try {
      const tagsArray = editTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const categoryObj = categories.find((c) => c.id === editCategory);

      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editName.trim(),
          sku: editSku.trim(),
          brand: editBrand.trim(),
          categoryId: editCategory,
          categoryName: categoryObj?.name || editingProduct.categoryName,
          description: editDesc.trim(),
          shortDescription: editShortDesc.trim(),
          price: Number(editPrice),
          mrp: Number(editMrp),
          lowStockThreshold: Number(editLowStock),
          material: editMaterial.trim(),
          dimensions: editDimensions.trim(),
          weight: editWeight.trim(),
          occasion: editOccasion.trim(),
          tags: tagsArray,
          searchKeywords: editSearchKeywords.trim(),
          manufacturerModelNumber: editModelNumber.trim() || undefined,
          status: editStatus,
          thumbnailUrl: editPhotos[0] || '/images/product-placeholder.svg',
          images: editPhotos,
          videoUrl: editVideo || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update product');
      }

      const priceChanged = editingProduct.price !== Number(editPrice) || editingProduct.mrp !== Number(editMrp);
      setIsEditProductModalOpen(false);
      refreshData();

      if (priceChanged && data.product) {
        setBannerNotice(`Price updated for "${editName}"! SKU barcode identity (${data.product.sku}) preserved. Ready to reprint 60x24mm labels.`);
        setLabelProduct(data.product);
        setIsPrintLabelModalOpen(true);
      } else {
        setBannerNotice(`Product "${editName}" updated successfully`);
      }
    } catch (err: unknown) {
      setEditProductError(err instanceof Error ? err.message : 'Error updating product');
    } finally {
      setEditProductLoading(false);
    }
  };

  // 3. ADD PRODUCT
  const handleAddProduct = async (e?: React.FormEvent, forceDraft = false) => {
    if (e) e.preventDefault();
    if (!newProdName.trim()) {
      setAddProductError('Product name is required');
      return;
    }
    if (!newProdSku.trim()) {
      setAddProductError('Product SKU is required');
      return;
    }
    if (newProdPrice <= 0) {
      setAddProductError('Selling price must be greater than zero');
      return;
    }
    if (newProdPrice > newProdMrp) {
      setAddProductError(`Selling price (₹${newProdPrice}) cannot exceed MRP (₹${newProdMrp})`);
      return;
    }

    const targetStatus = forceDraft ? 'draft' : newProdStatus;
    if (targetStatus === 'published' && newProdPhotos.length === 0) {
      setAddProductError('At least 1 product photo is recommended/required to publish. You can click "Save as Draft" if photos are pending.');
      return;
    }

    setAddProductLoading(true);
    setAddProductError('');

    try {
      const tagsArray = newProdTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const categoryObj = categories.find((c) => c.id === newProdCategory);

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newProdName.trim(),
          sku: newProdSku.trim(),
          brand: newProdBrand.trim(),
          categoryId: newProdCategory || (categories[0]?.id ?? 'cat-1'),
          categoryName: categoryObj?.name || 'Retail',
          description: newProdDesc.trim() || newProdName.trim(),
          shortDescription: newProdShortDesc.trim() || newProdName.trim(),
          price: Number(newProdPrice),
          mrp: Number(newProdMrp),
          stockQuantity: Number(newProdStock),
          lowStockThreshold: Number(newProdLowStock),
          material: newProdMaterial.trim(),
          dimensions: newProdDimensions.trim(),
          weight: newProdWeight.trim(),
          occasion: newProdOccasion.trim(),
          tags: tagsArray,
          searchKeywords: newProdSearchKeywords.trim(),
          manufacturerModelNumber: newProdModelNumber.trim() || undefined,
          confirmDifferentiator: newProdDifferentiator || undefined,
          status: targetStatus,
          thumbnailUrl: newProdPhotos[0] || '/images/product-placeholder.svg',
          images: newProdPhotos,
          videoUrl: newProdVideo || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create product');
      }

      setBannerNotice(`Product "${newProdName}" created successfully (${targetStatus}) with initial stock of ${newProdStock}`);
      setIsAddProductModalOpen(false);
      // Reset form
      setNewProdName('');
      setNewProdSku('');
      setNewProdModelNumber('');
      setNewProdDifferentiator(null);
      setNewProdDesc('');
      setNewProdShortDesc('');
      setNewProdPrice(0);
      setNewProdMrp(0);
      setNewProdStock(0);
      setNewProdSearchKeywords('');
      setNewProdPhotos([]);
      setNewProdVideo(undefined);
      refreshData();
    } catch (err: unknown) {
      setAddProductError(err instanceof Error ? err.message : 'Error creating product');
    } finally {
      setAddProductLoading(false);
    }
  };

  // 4. ARCHIVE / UNARCHIVE (Soft Delete)
  const handleOpenArchiveModal = (p: Product) => {
    setProductToArchive(p);
    setIsArchiveModalOpen(true);
  };

  const handleConfirmArchive = async () => {
    if (!productToArchive) return;
    setArchiveLoading(true);
    const action = productToArchive.isArchived || productToArchive.status === 'archived' ? 'unarchive' : 'archive';

    try {
      const res = await fetch(`/api/products/${productToArchive.id}?action=${action}`, {
        method: 'PATCH',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Archive action failed');

      setBannerNotice(data.message || `Product ${action}d successfully`);
      setIsArchiveModalOpen(false);
      refreshData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to archive product');
    } finally {
      setArchiveLoading(false);
    }
  };

  // 5. REFUND RECORD (Cash/UPI register)
  const handleRecordRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      const res = await fetch('/api/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          refundAmount,
          refundMethod,
          receiptNumber: refundReceiptNumber || `REF-${Date.now()}`,
          notes: refundNotes,
          staffId: user?.id || 'staff-1',
          staffName: user?.fullName || 'Counter Staff',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBannerNotice(`Physical refund of ${formatINR(refundAmount)} recorded under receipt ${data.receiptNumber}`);
        setIsRefundModalOpen(false);
        refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      let matchStatus = true;
      if (orderStatusFilter === 'ALL') {
        matchStatus = true;
      } else if (orderStatusFilter === 'ACTIVE') {
        matchStatus = ['PENDING', 'CONFIRMED', 'PREPARING'].includes(o.status);
      } else if (orderStatusFilter === 'RETURNS') {
        matchStatus = [
          'RETURN_REQUESTED',
          'RETURN_APPROVED',
          'RETURNED',
          'RETURN_REJECTED',
          'REFUND_RECORDED',
        ].includes(o.status);
      } else {
        matchStatus = o.status === orderStatusFilter;
      }

      const matchQuery =
        !orderSearch ||
        o.orderNumber.toLowerCase().includes(orderSearch.toLowerCase()) ||
        o.customerName.toLowerCase().includes(orderSearch.toLowerCase()) ||
        o.customerPhone.includes(orderSearch) ||
        (o.customerEmail && o.customerEmail.toLowerCase().includes(orderSearch.toLowerCase())) ||
        (o.adminNotes && o.adminNotes.toLowerCase().includes(orderSearch.toLowerCase()));

      return matchStatus && matchQuery;
    });
  }, [orders, orderStatusFilter, orderSearch]);

  // Filtered Products (for Products Tab)
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const inv = normalizeProductInventory(p);
      const isArchived = Boolean(p.isArchived || p.status === 'archived');

      // Filter by category status
      if (productFilter === 'active' && isArchived) return false;
      if (productFilter === 'archived' && !isArchived) return false;
      if (productFilter === 'low_stock' && !inv.isLowStock) return false;

      // Filter by search query
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase().trim();
        const nameMatch = p.name.toLowerCase().includes(q);
        const skuMatch = p.sku.toLowerCase().includes(q);
        const brandMatch = p.brand?.toLowerCase().includes(q);
        const catMatch = p.categoryName?.toLowerCase().includes(q);
        return nameMatch || skuMatch || brandMatch || catMatch;
      }

      return true;
    });
  }, [products, productFilter, productSearch]);

  // Filtered Inventory (for Inventory Tab)
  const filteredInventory = useMemo(() => {
    if (!inventorySearch.trim()) return products;
    const q = inventorySearch.toLowerCase().trim();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.categoryName?.toLowerCase().includes(q)
    );
  }, [products, inventorySearch]);

  // Derived counts for filter badges
  const activeProductsCount = products.filter((p) => !p.isArchived && p.status !== 'archived').length;
  const archivedProductsCount = products.filter((p) => p.isArchived || p.status === 'archived').length;
  const lowStockCount = products.filter((p) => normalizeProductInventory(p).isLowStock).length;

  return (
    <div className="space-y-6">
      {/* Top Admin Header */}
      <div className="bg-stone-900 text-white rounded-3xl p-6 sm:p-8 border border-stone-800 shadow-elevated">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                STORE MANAGEMENT CONSOLE
              </span>
              <span className="text-xs text-stone-300">
                Role: <strong className="text-amber-400 font-black uppercase">{staffRole.replace('_', ' ')}</strong>
              </span>
              <span className="text-xs text-stone-400">
                ({staffEmail})
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight">
              Jainam Traders Admin Portal
            </h1>
            <p className="text-xs text-stone-400 mt-0.5">
              Pickup verification, inventory reservation, catalogue management &amp; counter orders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Counter Scanner: Product Barcode, Order QR or Order ID */}
            <div className="flex items-center gap-2 bg-stone-800/90 p-1.5 sm:p-2 rounded-2xl border border-stone-700/80">
              <button
                type="button"
                onClick={() => setIsScannerModalOpen(true)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-sm shrink-0"
                title="Open Camera / Barcode & QR Scanner"
              >
                <Barcode className="w-3.5 h-3.5" />
                <span>Scan Product / Order</span>
              </button>

              <form onSubmit={handleQrLookup} className="flex items-center gap-1.5">
                <div className="relative">
                  <QrCode className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    placeholder="SKU or Order ID..."
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    className="pl-8 pr-2.5 py-1 bg-stone-900 border border-stone-700 rounded-xl text-xs text-white placeholder:text-stone-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono w-32 sm:w-44"
                  />
                </div>
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-stone-700 hover:bg-stone-600 text-stone-200 font-bold text-xs rounded-xl transition-colors shrink-0"
                >
                  Find
                </button>
              </form>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="px-3.5 py-2 bg-stone-800 hover:bg-rose-950/60 text-stone-300 hover:text-rose-200 border border-stone-700 hover:border-rose-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
              title="Sign out of staff portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Admin Navigation Tabs (Role Protected) */}
        <div className="flex items-center gap-2 overflow-x-auto pt-6 mt-4 border-t border-stone-800 text-xs font-bold no-scrollbar">
          {(staffRole === 'owner' || staffRole === 'store_manager') && (
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'overview' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" /> Overview
            </button>
          )}

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'orders' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> Orders ({orders.length})
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'inventory' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" /> Inventory &amp; Stock
          </button>

          {(staffRole === 'owner' || staffRole === 'store_manager') && (
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'products' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" /> Products ({products.length})
            </button>
          )}

          {(staffRole === 'owner' || staffRole === 'store_manager') && (
            <button
              onClick={() => setActiveTab('reviews')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'reviews' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-white'
              }`}
            >
              <Star className="w-4 h-4" /> Reviews ({reviews.length})
            </button>
          )}

          {(staffRole === 'owner' || staffRole === 'store_manager') && (
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'customers' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" /> Customers (CRM)
            </button>
          )}

          {(staffRole === 'owner' || staffRole === 'store_manager') && (
            <button
              onClick={() => setActiveTab('gift-codes')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'gift-codes' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-white'
              }`}
            >
              <Gift className="w-4 h-4" /> Gift Codes
            </button>
          )}

          {staffRole === 'owner' && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'settings' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4" /> Shop Settings
            </button>
          )}
        </div>
      </div>

      {bannerNotice && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 font-bold flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <span>{bannerNotice}</span>
          <button onClick={() => setBannerNotice('')} className="text-amber-700 hover:text-amber-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {activeTab === 'overview' && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider block">Total Orders</span>
              <span className="text-2xl font-black text-stone-900 mt-1 block">{analytics.totalOrders}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[11px] text-amber-600 font-bold uppercase tracking-wider block">Today&apos;s Orders</span>
              <span className="text-2xl font-black text-amber-700 mt-1 block">{analytics.todaysOrders}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[11px] text-orange-600 font-bold uppercase tracking-wider block">Pending</span>
              <span className="text-2xl font-black text-orange-700 mt-1 block">{analytics.pending}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[11px] text-blue-600 font-bold uppercase tracking-wider block">Ready for Pickup</span>
              <span className="text-2xl font-black text-blue-700 mt-1 block">{analytics.ready}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[11px] text-emerald-600 font-bold uppercase tracking-wider block">Picked Up</span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">{analytics.pickedUp}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[11px] text-brand-700 font-bold uppercase tracking-wider block">Counter Sales</span>
              <span className="text-xl sm:text-2xl font-black text-brand-700 mt-1 block">{formatINR(analytics.totalSales)}</span>
            </div>
          </div>

          {/* Quick Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 bg-gradient-to-br from-brand-50 to-amber-50 rounded-3xl border border-brand-200/60 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-bold">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-stone-900 text-sm">Active Orders Queue</h3>
              <p className="text-xs text-stone-600">
                Review incoming customer reservations, mark items ready, and process counter pick up payments.
              </p>
              <button
                onClick={() => setActiveTab('orders')}
                className="text-xs font-bold text-brand-700 hover:text-brand-800 flex items-center gap-1"
              >
                Go to Orders <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl border border-emerald-200/60 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                <Package className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-stone-900 text-sm">Inventory & Low Stock</h3>
              <p className="text-xs text-stone-600">
                {lowStockCount > 0 ? `${lowStockCount} product(s) are low in stock.` : 'All inventory levels are healthy.'}
              </p>
              <button
                onClick={() => setActiveTab('inventory')}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
              >
                Manage Inventory <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-6 bg-gradient-to-br from-stone-50 to-stone-100 rounded-3xl border border-stone-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-stone-900 text-white flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-stone-900 text-sm">Product Catalogue</h3>
              <p className="text-xs text-stone-600">
                {activeProductsCount} active products published. Add new items, update prices, or archive old lines.
              </p>
              <button
                onClick={() => setActiveTab('products')}
                className="text-xs font-bold text-stone-900 hover:text-stone-700 flex items-center gap-1"
              >
                Catalogue Actions <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ORDERS MANAGEMENT */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* Selected Order Detail Drawer / Panel */}
          {selectedOrder && (
            <div className="bg-white rounded-3xl p-6 border-2 border-brand-500 shadow-elevated space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-200 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-lg text-brand-700">{selectedOrder.orderNumber}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                        getStatusBadgeInfo(selectedOrder.status).bgClass
                      } ${getStatusBadgeInfo(selectedOrder.status).textClass}`}
                    >
                      {getStatusBadgeInfo(selectedOrder.status).label}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Customer: <strong>{selectedOrder.customerName}</strong> ({selectedOrder.customerPhone}) &bull; Created: {formatDate(selectedOrder.createdAt)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={getWhatsAppLink(selectedOrder)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                    title="Chat with customer on WhatsApp regarding this order"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>

                  <a
                    href={`tel:${selectedOrder.customerPhone}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                    title="Call customer directly"
                  >
                    <Phone className="w-3.5 h-3.5 text-sky-600" />
                    <span className="hidden sm:inline">Call</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setIsPrintSlipModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                    title="Print counter pickup packaging slip / receipt"
                  >
                    <Printer className="w-3.5 h-3.5 text-stone-600" />
                    <span className="hidden sm:inline">Print Slip</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedOrder.orderNumber);
                      setCopiedOrderNumber(true);
                      setTimeout(() => setCopiedOrderNumber(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 rounded-xl text-xs font-medium transition-colors"
                    title="Copy Order ID"
                  >
                    {copiedOrderNumber ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="text-[11px]">{copiedOrderNumber ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="p-2 text-stone-400 hover:text-stone-600 rounded-xl hover:bg-stone-100"
                    title="Close Order Panel"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Order State Transition Actions */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold text-stone-700 uppercase">Available State Actions:</span>
                <div className="flex flex-wrap gap-2 items-center">
                  {selectedOrder.status === 'PENDING' && (
                    <button
                      onClick={() => handleTransition(selectedOrder.id, 'CONFIRMED')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow"
                    >
                      Confirm Order
                    </button>
                  )}

                  {selectedOrder.status === 'CONFIRMED' && (
                    <button
                      onClick={() => handleTransition(selectedOrder.id, 'PREPARING')}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow"
                    >
                      Start Packing / Preparing
                    </button>
                  )}

                  {selectedOrder.status === 'PREPARING' && (
                    <button
                      onClick={() => handleTransition(selectedOrder.id, 'READY_FOR_PICKUP')}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow"
                    >
                      Mark Ready for Counter Pickup
                    </button>
                  )}

                  {selectedOrder.status === 'READY_FOR_PICKUP' && (
                    <button
                      onClick={() => handleTransition(selectedOrder.id, 'PICKED_UP', 'Customer verified QR and paid at counter')}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-lg shadow-emerald-600/30 flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Confirm Pickup &amp; Cash/UPI Payment Received
                    </button>
                  )}

                  {/* CANCEL ORDER ACTION (For all active / non-terminal orders) */}
                  {['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'].includes(selectedOrder.status) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCancelReasonPreset('Customer requested cancellation via phone/message');
                        setCancelReasonCustom('');
                        setIsCancelModalOpen(true);
                      }}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                    >
                      <Ban className="w-3.5 h-3.5 text-rose-600" /> Cancel Reservation &amp; Release Stock
                    </button>
                  )}

                  {selectedOrder.status === 'CANCELLED' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold">
                      <Ban className="w-3.5 h-3.5 text-rose-600" /> Order Cancelled &bull; Stock Released
                    </span>
                  )}

                  {selectedOrder.status === 'PICKED_UP' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Order Completed &bull; Paid
                    </span>
                  )}

                  {selectedOrder.status === 'RETURN_REQUESTED' && (
                    <>
                      <button
                        onClick={() => handleTransition(selectedOrder.id, 'RETURN_APPROVED')}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold"
                      >
                        Approve Return
                      </button>
                      <button
                        onClick={() => handleTransition(selectedOrder.id, 'RETURN_REJECTED')}
                        className="px-4 py-2 bg-stone-600 text-white rounded-xl text-xs font-bold"
                      >
                        Reject Return
                      </button>
                    </>
                  )}

                  {selectedOrder.status === 'RETURN_APPROVED' && (
                    <button
                      onClick={() => handleTransition(selectedOrder.id, 'RETURNED', 'Customer returned item physically to counter')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                    >
                      Mark Item Returned at Counter
                    </button>
                  )}

                  {selectedOrder.status === 'RETURNED' && (
                    <button
                      onClick={() => {
                        setRefundAmount(selectedOrder.totalAmount);
                        setIsRefundModalOpen(true);
                      }}
                      className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" /> Record Physical Cash / UPI Refund
                    </button>
                  )}
                </div>
              </div>

              {/* Items in this order */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-stone-700 uppercase">Items in this reservation:</h4>
                <div className="space-y-2">
                  {selectedOrder.items.map((i) => {
                    const discount =
                      i.discountPercentage ??
                      (i.mrp && i.mrp > i.unitPrice ? Math.round(((i.mrp - i.unitPrice) / i.mrp) * 100) : 0);
                    return (
                      <div key={i.id} className="flex justify-between p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs">
                        <div className="flex-1 pr-3">
                          <span className="font-bold text-stone-900 block">{i.productName}</span>
                          {i.variantName && <span className="text-stone-500 text-[11px] block">Variant: {i.variantName}</span>}
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-stone-600">
                            {i.mrp && i.mrp > i.unitPrice ? (
                              <>
                                <span>MRP: <span className="line-through text-stone-400">{formatINR(i.mrp)}</span></span>
                                <span>Price: <strong className="text-stone-900">{formatINR(i.unitPrice)}</strong></span>
                                <span className="text-brand-700 font-bold">{discount}% OFF</span>
                              </>
                            ) : (
                              <span>Price: <strong className="text-stone-900">{formatINR(i.unitPrice)}</strong></span>
                            )}
                            <span className="text-stone-400">• Qty: {i.quantity}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-stone-400 block">Total</span>
                          <span className="font-extrabold text-stone-900">{formatINR(i.totalPrice)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 rounded-xl bg-stone-100 flex justify-between items-center text-sm font-black">
                  <span>Total Payable:</span>
                  <span className="text-brand-700 text-base">{formatINR(selectedOrder.totalAmount)}</span>
                </div>
              </div>

              {/* Staff Internal Notes */}
              <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-700" />
                    Internal Staff Notes (Shop counter use only)
                  </span>
                  {selectedOrder.adminNotes && (
                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                      Saved Note
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Customer called; requested gift wrapping. Will pick up tomorrow at 5 PM."
                    value={adminNoteInput}
                    onChange={(e) => setAdminNoteInput(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveAdminNote}
                    disabled={isSavingAdminNote}
                    className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition-colors shrink-0 disabled:opacity-50"
                  >
                    {isSavingAdminNote ? 'Saving...' : 'Save Note'}
                  </button>
                </div>
              </div>

              {/* Order Status Timeline & Transition Audit */}
              <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowStatusHistory(!showStatusHistory)}
                  className="w-full flex items-center justify-between text-xs font-bold text-stone-700 hover:text-stone-900"
                >
                  <span className="flex items-center gap-1.5">
                    <History className="w-4 h-4 text-stone-500" />
                    Order Status History &amp; Audit Log ({selectedOrder.statusHistory?.length || 0})
                  </span>
                  <span className="text-[11px] text-brand-700 font-semibold hover:underline">
                    {showStatusHistory ? 'Hide Timeline ▲' : 'View Timeline ▼'}
                  </span>
                </button>

                {showStatusHistory && (
                  <div className="pt-2 border-t border-stone-200 space-y-2">
                    {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 ? (
                      selectedOrder.statusHistory.map((h, idx) => (
                        <div
                          key={h.id || idx}
                          className="p-3 bg-white rounded-xl border border-stone-200 text-xs flex justify-between items-start gap-3 shadow-2xs"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              {h.fromStatus && (
                                <>
                                  <span className="font-semibold text-stone-500 text-[11px]">
                                    {h.fromStatus}
                                  </span>
                                  <span className="text-stone-400">&rarr;</span>
                                </>
                              )}
                              <span className="font-extrabold text-stone-900">{h.toStatus}</span>
                            </div>
                            {h.note && (
                              <p className="text-stone-600 text-[11px] mt-1 bg-stone-50 p-1.5 rounded-lg border border-stone-100">
                                {h.note}
                              </p>
                            )}
                          </div>
                          <div className="text-right text-[10px] text-stone-400 shrink-0">
                            <div>{formatDate(h.createdAt)}</div>
                            {h.changedBy && (
                              <div className="text-stone-500 font-mono text-[9px] mt-0.5">
                                by: {h.changedBy}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-stone-400 italic">No transition history logged yet.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Orders Filter & Table */}
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-4">
            {/* Quick Status Filter Pills + CSV Export */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL', label: 'All Orders', count: orders.length },
                  {
                    id: 'ACTIVE',
                    label: 'In Progress',
                    count: orders.filter((o) =>
                      ['PENDING', 'CONFIRMED', 'PREPARING'].includes(o.status)
                    ).length,
                  },
                  {
                    id: 'READY_FOR_PICKUP',
                    label: 'Ready for Pickup',
                    count: orders.filter((o) => o.status === 'READY_FOR_PICKUP').length,
                  },
                  {
                    id: 'PICKED_UP',
                    label: 'Picked Up',
                    count: orders.filter((o) => o.status === 'PICKED_UP').length,
                  },
                  {
                    id: 'CANCELLED',
                    label: 'Cancelled',
                    count: orders.filter((o) => o.status === 'CANCELLED').length,
                  },
                  {
                    id: 'RETURNS',
                    label: 'Returns & Refunds',
                    count: orders.filter((o) =>
                      [
                        'RETURN_REQUESTED',
                        'RETURN_APPROVED',
                        'RETURNED',
                        'RETURN_REJECTED',
                        'REFUND_RECORDED',
                      ].includes(o.status)
                    ).length,
                  },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setOrderStatusFilter(pill.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      orderStatusFilter === pill.id
                        ? 'bg-stone-900 text-white shadow-sm'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    <span>{pill.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        orderStatusFilter === pill.id
                          ? 'bg-white/20 text-white'
                          : 'bg-stone-200 text-stone-700 font-semibold'
                      }`}
                    >
                      {pill.count}
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={exportOrdersToCSV}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                title="Download filtered orders as CSV file"
              >
                <Download className="w-3.5 h-3.5 text-stone-600" />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search orders by number, customer, phone, email, or admin note..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white"
                />
              </div>

              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-bold text-stone-700"
              >
                <option value="ALL">All Statuses ({orders.length})</option>
                <option value="ACTIVE">All In Progress</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PREPARING">Preparing</option>
                <option value="READY_FOR_PICKUP">Ready for Pickup</option>
                <option value="PICKED_UP">Picked Up</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="RETURNS">Returns & Refunds</option>
                <option value="RETURN_REQUESTED">Return Requested</option>
                <option value="RETURNED">Returned</option>
                <option value="REFUND_RECORDED">Refund Recorded</option>
              </select>
            </div>

            {/* Mobile Card List View (< md) */}
            <div className="md:hidden divide-y divide-stone-100">
              {filteredOrders.length === 0 ? (
                <div className="p-8 text-center text-stone-400 text-xs">No orders found in current filter.</div>
              ) : (
                filteredOrders.map((ord) => {
                  const b = getStatusBadgeInfo(ord.status);
                  return (
                    <div key={`m-ord-${ord.id}`} className="p-4 space-y-3 bg-white hover:bg-stone-50/80 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono font-black text-brand-700 text-sm block">{ord.orderNumber}</span>
                          <span className="text-[10px] text-stone-400">{formatDate(ord.createdAt)}</span>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${b.bgClass} ${b.textClass}`}>
                          {b.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-stone-600 bg-stone-50 p-2.5 rounded-xl">
                        <div>
                          <span className="text-[10px] text-stone-400 uppercase font-semibold block">Customer</span>
                          <strong className="text-stone-900 block truncate">{ord.customerName}</strong>
                          <span className="text-stone-500 text-[11px]">{ord.customerPhone}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-stone-400 uppercase font-semibold block">Total</span>
                          <span className="font-extrabold text-stone-900 text-sm block">{formatINR(ord.totalAmount)}</span>
                          <span className="text-stone-500 text-[11px]">{ord.items.length} items</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedOrder(ord)}
                        className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors active-press flex items-center justify-center gap-1.5"
                      >
                        <span>Manage Order & Pickup</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-400 uppercase font-semibold">
                    <th className="py-3 px-3">Order ID</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Items</th>
                    <th className="py-3 px-3">Total Amount</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Created</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredOrders.map((ord) => {
                    const b = getStatusBadgeInfo(ord.status);
                    return (
                      <tr key={ord.id} className="hover:bg-stone-50 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-brand-700">{ord.orderNumber}</td>
                        <td className="py-3 px-3">
                          <strong className="text-stone-900 block">{ord.customerName}</strong>
                          <span className="text-stone-400 text-[11px]">{ord.customerPhone}</span>
                        </td>
                        <td className="py-3 px-3 text-stone-600">{ord.items.length} items</td>
                        <td className="py-3 px-3 font-extrabold text-stone-900">{formatINR(ord.totalAmount)}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${b.bgClass} ${b.textClass}`}>
                            {b.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-stone-400">{formatDate(ord.createdAt)}</td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setSelectedOrder(ord)}
                            className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-[11px] font-bold"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INVENTORY DASHBOARD (Total vs Reserved vs Available) — ZERO NaN GUARANTEED */}
      {activeTab === 'inventory' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
            <div>
              <h2 className="text-xl font-display font-extrabold text-stone-900">
                Inventory & Stock Management
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Staff view of total physical stock, customer-reserved units, and available counter stock.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter inventory..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setStockProduct(null);
                  setStockChangeQty(1);
                  setStockReason('restock');
                  setStockNotes('');
                  setStockAdjustmentError('');
                  setIsAdjustStockModalOpen(true);
                }}
                className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                title="Search existing product by name/model to record new stock shipment"
              >
                <Plus className="w-3.5 h-3.5" /> Adjust Stock
              </button>
              <button
                type="button"
                onClick={() => setIsScannerModalOpen(true)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                title="Scan barcode to adjust physical stock"
              >
                <Barcode className="w-3.5 h-3.5" /> Scan Product
              </button>
              <button
                onClick={refreshData}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
          </div>

          {/* Mobile Card List View (< md) */}
          <div className="md:hidden divide-y divide-stone-100">
            {filteredInventory.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-xs">No matching products found in stock.</div>
            ) : (
              filteredInventory.map((p) => {
                const inv = normalizeProductInventory(p);
                return (
                  <div key={`m-inv-${p.id}`} className="p-4 space-y-3 bg-white hover:bg-stone-50/80 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-stone-200">
                        <ProductImage src={p.thumbnailUrl} alt={p.name} width={48} height={48} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-stone-900 text-sm block truncate">{p.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-xs text-stone-500">{p.sku}</span>
                          <span className="text-[10px] text-stone-400">&bull;</span>
                          <span className="text-xs text-stone-600">{p.brand}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                      <div>
                        <span className="text-[10px] text-stone-400 uppercase font-semibold block">Total</span>
                        <span className="font-bold text-stone-800 text-sm">{inv.totalStock}</span>
                      </div>
                      <div className="border-x border-stone-200">
                        <span className="text-[10px] text-amber-600 uppercase font-semibold block">Reserved</span>
                        <span className="font-bold text-amber-700 text-sm">{inv.reservedStock}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-600 uppercase font-semibold block">Available</span>
                        <span className="font-black text-emerald-700 text-sm">{inv.availableStock}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {staffRole !== 'staff' && (
                        <button
                          type="button"
                          onClick={() => handleOpenStockAdjust(p)}
                          className="flex-1 py-2 px-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-colors active-press flex items-center justify-center gap-1"
                        >
                          <span>Adjust Stock</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenPrintLabel(p)}
                        className="py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition-colors active-press flex items-center justify-center gap-1"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Label</span>
                      </button>
                      {staffRole !== 'staff' && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditProduct(p)}
                          className="py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors active-press"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400 uppercase font-semibold">
                  <th className="py-3 px-3">Product Name</th>
                  <th className="py-3 px-3">SKU</th>
                  <th className="py-3 px-3 text-center">Total Stock</th>
                  <th className="py-3 px-3 text-center">Reserved Units</th>
                  <th className="py-3 px-3 text-center">Available Units</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredInventory.map((p) => {
                  const inv = normalizeProductInventory(p);
                  return (
                    <tr key={p.id} className="hover:bg-stone-50">
                      <td className="py-3 px-3 font-semibold text-stone-900">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-stone-200">
                            <ProductImage src={p.thumbnailUrl} alt={p.name} width={32} height={32} />
                          </div>
                          <div>
                            <span className="block">{p.name}</span>
                            <span className="text-[10px] text-stone-400">{p.brand}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-stone-500">{p.sku}</td>
                      <td className="py-3 px-3 text-center font-bold text-stone-800">
                        {inv.totalStock}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-amber-600 bg-amber-50/50">
                        {inv.reservedStock}
                      </td>
                      <td className="py-3 px-3 text-center font-black text-emerald-700 bg-emerald-50/50">
                        {inv.availableStock}
                      </td>
                      <td className="py-3 px-3">
                        {inv.stockStatus === 'archived' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-200 text-stone-700">
                            Archived
                          </span>
                        ) : inv.isOutOfStock ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            Out of Stock (0)
                          </span>
                        ) : inv.isLowStock ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1 w-max">
                            <AlertTriangle className="w-3 h-3" /> Low Stock ({inv.availableStock})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Healthy ({inv.availableStock})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {staffRole === 'staff' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenPrintLabel(p)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold"
                              title="Print 60x24mm label"
                            >
                              Print Label
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenStockAdjust(p)}
                              className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-sm"
                              title="Adjust inventory level"
                            >
                              Adjust Stock
                            </button>
                            <button
                              onClick={() => handleOpenPrintLabel(p)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1"
                              title="Print 60x24mm thermal label"
                            >
                              <Printer className="w-3 h-3" /> Print Label
                            </button>
                            <button
                              onClick={() => handleOpenEditProduct(p)}
                              className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold"
                              title="Edit product details"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PRODUCTS MANAGEMENT (Full CRUD: Edit, Stock, Archive) */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
            <div>
              <h2 className="text-xl font-display font-extrabold text-stone-900">
                Store Catalogue Management
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Add new items, update specifications, manage stock, and archive product lines.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsDuplicateAuditOpen(true)}
                className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                title="Audit catalogue for potential duplicates and perform safe product merging"
              >
                <Sparkles className="w-4 h-4 text-amber-600" /> Duplicate Audit
              </button>
              <button
                type="button"
                onClick={() => setIsBulkPrintModalOpen(true)}
                className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                title="Bulk print 60x24mm landscape thermal labels across multiple products"
              >
                <Printer className="w-4 h-4 text-amber-600" /> Bulk Print Labels
              </button>
              <button
                onClick={() => {
                  setAddProductError('');
                  setIsAddProductModalOpen(true);
                }}
                className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <Plus className="w-4 h-4" /> Add New Product
              </button>
            </div>
          </div>

          {/* Filter Tabs and Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setProductFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  productFilter === 'all' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                All ({products.length})
              </button>
              <button
                onClick={() => setProductFilter('active')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  productFilter === 'active' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Active ({activeProductsCount})
              </button>
              <button
                onClick={() => setProductFilter('archived')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  productFilter === 'archived' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Archived ({archivedProductsCount})
              </button>
              <button
                onClick={() => setProductFilter('low_stock')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  productFilter === 'low_stock' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Low Stock ({lowStockCount})
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search catalogue..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white"
              />
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProducts.map((p) => {
              const inv = normalizeProductInventory(p);
              const isArchived = Boolean(p.isArchived || p.status === 'archived');
              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    isArchived
                      ? 'border-stone-300 bg-stone-100/70 opacity-80'
                      : 'border-stone-200 bg-white hover:shadow-elevated'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      {/* Product Thumbnail with Error Fallback */}
                      <div className="w-20 h-20 rounded-xl bg-stone-100 border border-stone-200 overflow-hidden relative shrink-0">
                        <ProductImage
                          src={p.thumbnailUrl}
                          alt={p.name}
                          fill
                          sizes="80px"
                          categoryName={p.categoryName}
                        />
                      </div>

                      {/* Product Title & Identifiers */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-mono text-stone-400 truncate">{p.sku}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                              isArchived
                                ? 'bg-stone-300 text-stone-700'
                                : p.isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-stone-200 text-stone-600'
                            }`}
                          >
                            {isArchived ? 'Archived' : p.isActive ? 'Published' : 'Hidden'}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-stone-900 line-clamp-2 mt-0.5" title={p.name}>
                          {p.name}
                        </h4>
                        <p className="text-[10px] text-stone-500 truncate">{p.brand} &bull; {p.categoryName}</p>

                        <div className="p-2.5 mt-2 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1 text-xs">
                          <div className="flex justify-between items-baseline">
                            <span className="text-stone-500 font-medium">MRP:</span>
                            <span className="font-semibold text-stone-700">{formatINR(p.mrp)}</span>
                          </div>
                          <div className="flex justify-between items-baseline">
                            <span className="text-stone-500 font-medium">Selling:</span>
                            <span className="font-extrabold text-stone-900 text-sm">{formatINR(p.price)}</span>
                          </div>
                          <div className="flex justify-between items-baseline pt-0.5 border-t border-stone-200/60">
                            <span className="text-stone-500 font-medium">Discount:</span>
                            {p.mrp > p.price && Math.round(((p.mrp - p.price) / p.mrp) * 100) > 0 ? (
                              <span className="font-black text-brand-700">
                                {Math.round(((p.mrp - p.price) / p.mrp) * 100)}% OFF
                              </span>
                            ) : (
                              <span className="text-stone-500 font-semibold">No discount</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stock Health Counter Pill (Zero NaN) */}
                    <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="text-stone-500">Total: </span>
                        <strong className="text-stone-900">{inv.totalStock}</strong>
                      </div>
                      <div>
                        <span className="text-amber-600">Reserved: </span>
                        <strong className="text-amber-700">{inv.reservedStock}</strong>
                      </div>
                      <div>
                        <span className="text-emerald-700">Available: </span>
                        <strong className="text-emerald-800 font-black">{inv.availableStock}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons: [Edit], [Stock], [Print Label], [Archive] */}
                  <div className="grid grid-cols-4 gap-1.5 mt-4 pt-3 border-t border-stone-100">
                    <button
                      onClick={() => handleOpenEditProduct(p)}
                      className="py-1.5 px-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                      title="Edit product information and pricing"
                    >
                      <Edit className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={() => handleOpenStockAdjust(p)}
                      className="py-1.5 px-1 bg-brand-50 hover:bg-brand-100 text-brand-800 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                      title="Adjust inventory count"
                    >
                      <Package className="w-3 h-3" /> Stock
                    </button>
                    <button
                      onClick={() => handleOpenPrintLabel(p)}
                      className="py-1.5 px-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors shadow-sm"
                      title="Print 60x24mm thermal label"
                    >
                      <Printer className="w-3 h-3 text-amber-600" /> Print Label
                    </button>
                    <button
                      onClick={() => handleOpenArchiveModal(p)}
                      className={`py-1.5 px-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors ${
                        isArchived
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                      }`}
                      title={isArchived ? 'Restore to active storefront' : 'Archive (soft-delete)'}
                    >
                      {isArchived ? (
                        <>
                          <ArchiveRestore className="w-3 h-3" /> Restore
                        </>
                      ) : (
                        <>
                          <Archive className="w-3 h-3" /> Archive
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: REVIEWS MODERATION */}
      {activeTab === 'reviews' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-6">
          <h2 className="text-xl font-display font-extrabold text-stone-900 border-b border-stone-100 pb-4">
            Customer Review Moderation Queue
          </h2>

          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-bold text-stone-900 text-xs">{r.customerName}</span>
                    <span className="text-[11px] text-stone-400 ml-2">Order: {r.orderId}</span>
                  </div>
                  <span className="text-xs font-bold text-amber-600">{r.rating} &#9733;</span>
                </div>
                <p className="text-xs text-stone-700">{r.comment}</p>
                <div className="flex gap-2 pt-1">
                  <span className="text-[10px] font-bold uppercase bg-stone-200 px-2 py-0.5 rounded">
                    Status: {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: SHOP SETTINGS CONFIGURATION (Owner Only) */}
      {activeTab === 'settings' && (
        staffRole !== 'owner' ? (
          <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm text-center space-y-3 max-w-xl mx-auto">
            <Shield className="w-12 h-12 text-rose-500 mx-auto" />
            <h3 className="text-lg font-bold text-stone-900">Restricted to Store Owner</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Store identity, canonical address, and store pickup policies can only be modified by an account with Owner / Administrator privileges.
            </p>
          </div>
        ) : settings && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-6 max-w-3xl">
            <div>
              <h2 className="text-xl font-display font-extrabold text-stone-900 pb-1">
                Store Settings &amp; Canonical Information
              </h2>
              <p className="text-xs text-stone-500">
                Updating these settings propagates across header, footer, checkout, AI assistant, and pickup orders.
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (settings.latitude !== null && settings.latitude !== undefined && (settings.latitude as unknown) !== '') {
                  const lat = Number(settings.latitude);
                  if (isNaN(lat) || lat < -90 || lat > 90) {
                    alert('Latitude must be a valid number between -90 and 90.');
                    return;
                  }
                }
                if (settings.longitude !== null && settings.longitude !== undefined && (settings.longitude as unknown) !== '') {
                  const lng = Number(settings.longitude);
                  if (isNaN(lng) || lng < -180 || lng > 180) {
                    alert('Longitude must be a valid number between -180 and 180.');
                    return;
                  }
                }
                const mapsUrl = settings.googleMapsPlaceUrl || settings.googleMapsUrl;
                if (mapsUrl && !mapsUrl.startsWith('https://')) {
                  alert('Google Maps URL must use HTTPS (start with https://).');
                  return;
                }
                if (settings.phone && settings.phone.trim()) {
                  const digits = settings.phone.replace(/[\s\-\+]/g, '');
                  if (!/^\d{10,15}$/.test(digits)) {
                    alert('Phone number must contain between 10 and 15 digits.');
                    return;
                  }
                }
                if (settings.whatsappNumber && settings.whatsappNumber.trim()) {
                  const digits = settings.whatsappNumber.replace(/[\s\-\+]/g, '');
                  if (!/^\d{10,15}$/.test(digits)) {
                    alert('WhatsApp number must contain between 10 and 15 digits.');
                    return;
                  }
                }
                if (settings.email && settings.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) {
                  alert('Email format is invalid.');
                  return;
                }
                try {
                  const res = await fetch('/api/settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(settings),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setBannerNotice('Canonical store settings updated and propagated successfully.');
                    refreshData();
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new Event('shop-settings-updated'));
                    }
                  } else {
                    alert(data.error || 'Failed to update shop settings');
                  }
                } catch (err: unknown) {
                  alert(err instanceof Error ? err.message : 'Failed to update settings');
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-stone-700 uppercase mb-1">Store Name</label>
                <input
                  type="text"
                  value={settings.shopName}
                  onChange={(e) => setSettings({ ...settings, shopName: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 uppercase mb-1">Full Physical Address</label>
                <textarea
                  rows={2}
                  value={settings.shopAddress}
                  onChange={(e) => setSettings({ ...settings, shopAddress: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-700 uppercase mb-1">Short Address / Area</label>
                  <input
                    type="text"
                    value={settings.shortAddress || ''}
                    onChange={(e) => setSettings({ ...settings, shortAddress: e.target.value })}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 uppercase mb-1">Landmark</label>
                  <input
                    type="text"
                    value={settings.landmark || ''}
                    onChange={(e) => setSettings({ ...settings, landmark: e.target.value })}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-700 uppercase mb-1">Opening Time</label>
                  <input
                    type="text"
                    value={settings.openingTime}
                    onChange={(e) => setSettings({ ...settings, openingTime: e.target.value })}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 uppercase mb-1">Closing Time</label>
                  <input
                    type="text"
                    value={settings.closingTime}
                    onChange={(e) => setSettings({ ...settings, closingTime: e.target.value })}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-stone-700 uppercase mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 uppercase mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    value={settings.whatsappNumber}
                    onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 uppercase mb-1">Public Shop Email</label>
                  <input
                    type="email"
                    value={settings.email || ''}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Google Maps Location & Verification */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-stone-700 uppercase">
                    Google Maps Location & Verification
                  </label>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      settings.isLocationVerified
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {settings.isLocationVerified ? '✓ VERIFIED' : '⚠ NOT VERIFIED'}
                  </span>
                </div>

                {settings.isLocationVerified && (
                  <p className="text-[11px] text-emerald-700 bg-emerald-50/80 p-2 rounded-lg border border-emerald-200">
                    Location verified by {settings.locationVerifiedBy || 'Owner'}
                    {settings.locationVerifiedAt ? ` on ${new Date(settings.locationVerifiedAt).toLocaleDateString()}` : ''}.
                  </p>
                )}

                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    Google Maps Place URL / Authoritative Share Link
                  </label>
                  <input
                    type="url"
                    value={settings.googleMapsPlaceUrl || settings.googleMapsUrl || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSettings({
                        ...settings,
                        googleMapsUrl: val,
                        googleMapsPlaceUrl: val,
                        isLocationVerified: val === 'https://maps.app.goo.gl/8ZJCWbBVtrHep7UcA',
                      });
                    }}
                    placeholder="e.g. https://maps.app.goo.gl/8ZJCWbBVtrHep7UcA"
                    className="w-full p-2.5 bg-white border border-stone-300 rounded-xl font-mono text-xs"
                  />
                  <p className="text-[10px] text-stone-500 mt-1">
                    Authoritative Google Maps place link for Jainam Traders.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Place ID (Optional)</label>
                    <input
                      type="text"
                      value={settings.googleMapsPlaceId || ''}
                      onChange={(e) => setSettings({ ...settings, googleMapsPlaceId: e.target.value })}
                      placeholder="e.g. 11npvmc_v9"
                      className="w-full p-2 bg-white border border-stone-300 rounded-xl font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Coordinates (Optional)</label>
                    <div className="grid grid-cols-2 gap-1">
                      <input
                        type="text"
                        placeholder="Lat"
                        value={settings.latitude ?? ''}
                        onChange={(e) => {
                          const val = e.target.value ? parseFloat(e.target.value) : null;
                          setSettings({ ...settings, latitude: val });
                        }}
                        className="w-full p-2 bg-white border border-stone-300 rounded-xl font-mono text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Lng"
                        value={settings.longitude ?? ''}
                        onChange={(e) => {
                          const val = e.target.value ? parseFloat(e.target.value) : null;
                          setSettings({ ...settings, longitude: val });
                        }}
                        className="w-full p-2 bg-white border border-stone-300 rounded-xl font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Verification Actions */}
                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const url = settings.googleMapsPlaceUrl || settings.googleMapsUrl;
                      if (!url) {
                        alert('Please enter a Google Maps URL first.');
                        return;
                      }
                      window.open(url, '_blank');
                      const confirmVerified = window.confirm(
                        'Does the opened link show the exact Jainam Traders store on Google Maps?\n\nClick OK to confirm and mark as VERIFIED.'
                      );
                      if (confirmVerified) {
                        setSettings({
                          ...settings,
                          isLocationVerified: true,
                          locationVerifiedAt: new Date().toISOString(),
                          locationVerifiedBy: `${staffName} (${staffRole})`,
                        });
                      }
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Verify Google Maps Location
                  </button>

                  {settings.isLocationVerified && (
                    <button
                      type="button"
                      onClick={() => {
                        setSettings({
                          ...settings,
                          isLocationVerified: false,
                          locationVerifiedAt: undefined,
                          locationVerifiedBy: undefined,
                        });
                      }}
                      className="px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs font-medium"
                    >
                      Mark as Not Verified
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 uppercase mb-1">Pickup Instructions</label>
                <textarea
                  rows={3}
                  value={settings.pickupInstructions}
                  onChange={(e) => setSettings({ ...settings, pickupInstructions: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>

              <button
                type="submit"
                className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow"
              >
                Save Canonical Shop Settings
              </button>
            </form>
          </div>
        )
      )}

      {/* TAB: CUSTOMERS (CRM) */}
      {activeTab === 'customers' && (staffRole === 'owner' || staffRole === 'store_manager') && (
        <AdminCustomersView staffRole={staffRole} staffName={staffName} />
      )}

      {/* TAB: GIFT CODES */}
      {activeTab === 'gift-codes' && (staffRole === 'owner' || staffRole === 'store_manager') && (
        <AdminGiftCodesView staffRole={staffRole} staffName={staffName} />
      )}

      {/* ============================================================== */}
      {/* MODAL 1: ADJUST INVENTORY (Zero NaN & Negative Stock Protection) */}
      {/* ============================================================== */}
      {isAdjustStockModalOpen && !stockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-4 shadow-elevated">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="font-extrabold text-stone-900 text-sm sm:text-base">
                  Search Existing Product to Adjust Stock
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Type product name, brand, or model number to add incoming stock (Requirement 8 &amp; 24)
                </p>
              </div>
              <button
                onClick={() => setIsAdjustStockModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1 text-xs">Product Name or SKU *</label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Wall Clock, Photo Frame, or JT-CLK..."
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                className="w-full p-2.5 border border-stone-300 rounded-xl text-xs font-semibold focus:bg-white"
              />
              <ProductSuggestionBox
                productName={inventorySearch}
                sku={inventorySearch}
                onSelectExistingProduct={(p) => {
                  handleOpenStockAdjust(p);
                }}
                isCreateMode={false}
              />
            </div>
          </div>
        </div>
      )}

      {isAdjustStockModalOpen && stockProduct && (() => {
        const inv = normalizeProductInventory(stockProduct);
        const adj = calculateStockAdjustment(inv.totalStock, stockChangeQty);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-4 shadow-elevated">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-stone-200 shrink-0">
                    <ProductImage src={stockProduct.thumbnailUrl} alt={stockProduct.name} width={40} height={40} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-stone-900 text-sm">{stockProduct.name}</h3>
                    <p className="text-[10px] font-mono text-stone-400">SKU: {stockProduct.sku}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAdjustStockModalOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Current Stock Baseline */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-stone-50 rounded-2xl border border-stone-200 text-center text-xs">
                <div>
                  <span className="text-[10px] text-stone-400 uppercase font-semibold block">Total Stock</span>
                  <strong className="text-sm font-bold text-stone-900">{inv.totalStock}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-amber-600 uppercase font-semibold block">Reserved</span>
                  <strong className="text-sm font-bold text-amber-700">{inv.reservedStock}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-600 uppercase font-semibold block">Available</span>
                  <strong className="text-sm font-black text-emerald-700">{inv.availableStock}</strong>
                </div>
              </div>

              <form onSubmit={handleStockAdjustment} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Quantity Change (+ to add, - to deduct)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={stockChangeQty}
                      onChange={(e) => {
                        setStockChangeQty(Number(e.target.value));
                        setStockAdjustmentError('');
                      }}
                      className="flex-1 p-2.5 border border-stone-300 rounded-xl font-mono text-sm font-bold focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                  {/* Quick change pills */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => setStockChangeQty(1)}
                      className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-[10px] font-bold"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockChangeQty(5)}
                      className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-[10px] font-bold"
                    >
                      +5
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockChangeQty(10)}
                      className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-[10px] font-bold"
                    >
                      +10
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockChangeQty(-1)}
                      className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockChangeQty(-5)}
                      className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold"
                    >
                      -5
                    </button>
                  </div>
                </div>

                {/* Live Adjustment Result Preview */}
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    adj.isValid
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}
                >
                  <div className="flex justify-between items-center font-bold">
                    <span>Resulting Total Stock:</span>
                    <span className="text-sm font-mono">{adj.newStock}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] mt-0.5">
                    <span>Resulting Shelf Available:</span>
                    <span className="font-mono font-bold">
                      {Math.max(0, adj.newStock - inv.reservedStock)}
                    </span>
                  </div>
                  {!adj.isValid && (
                    <p className="mt-1 text-[11px] font-bold text-rose-700">{adj.error}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Reason for Audit Log</label>
                  <select
                    value={stockReason}
                    onChange={(e) => setStockReason(e.target.value as any)}
                    className="w-full p-2.5 border border-stone-300 rounded-xl bg-stone-50 font-semibold"
                  >
                    <option value="restock">Restock / New Shipment</option>
                    <option value="manual_correction">Manual Correction</option>
                    <option value="damage">Damaged in Store</option>
                    <option value="missing">Missing / Inventory Count Audit</option>
                    <option value="purchase">Store Purchase</option>
                    <option value="return">Returned Item</option>
                    <option value="sale">Sale Adjustment</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Notes / Invoice Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. Received new lot from supplier"
                    value={stockNotes}
                    onChange={(e) => setStockNotes(e.target.value)}
                    className="w-full p-2 border border-stone-300 rounded-xl"
                  />
                </div>

                {stockAdjustmentError && (
                  <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2 rounded-lg">
                    {stockAdjustmentError}
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAdjustStockModalOpen(false)}
                    className="w-1/3 py-2.5 bg-stone-100 hover:bg-stone-200 rounded-xl font-bold text-stone-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!adj.isValid || adjustingStockLoading}
                    className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-stone-300 text-white rounded-xl font-bold shadow transition-colors"
                  >
                    {adjustingStockLoading ? 'Saving...' : 'Apply Stock Change'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* MODAL 2: EDIT PRODUCT MODAL */}
      {/* ============================================================== */}
      {isEditProductModalOpen && editingProduct && (() => {
        const inv = normalizeProductInventory(editingProduct);
        const derivedDiscount =
          editMrp > 0 ? Math.round(((editMrp - editPrice) / editMrp) * 100) : 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-elevated my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div>
                  <h3 className="font-extrabold text-stone-900 text-base">Edit Product</h3>
                  <p className="text-xs text-stone-500">Updating catalogue details for {editingProduct.name}</p>
                </div>
                <button
                  onClick={() => setIsEditProductModalOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditProduct} className="space-y-4 text-xs">
                {/* Basic Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Product Name *</label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full p-2.5 border border-stone-300 rounded-xl focus:bg-white"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-stone-700">SKU (Barcode Identity) *</label>
                      {staffRole === 'staff' && (
                        <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded">Owner/Admin Only</span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      disabled={staffRole === 'staff'}
                      value={editSku}
                      onChange={(e) => setEditSku(e.target.value.toUpperCase())}
                      className="w-full p-2.5 border border-stone-300 rounded-xl font-mono disabled:bg-stone-100 disabled:text-stone-500 uppercase"
                    />
                    <p className="text-[10px] text-amber-700 font-semibold mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      Warning: Changing SKU changes the product barcode identity.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Brand</label>
                    <input
                      type="text"
                      value={editBrand}
                      onChange={(e) => setEditBrand(e.target.value)}
                      className="w-full p-2.5 border border-stone-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Category</label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full p-2.5 border border-stone-300 rounded-xl bg-stone-50 font-semibold"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Manufacturer Model Number & Catalogue Duplicate Check (Requirement 11 & 18) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      Manufacturer Model Number / Item Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. XYZ-100 or ITEM-441"
                      value={editModelNumber}
                      onChange={(e) => setEditModelNumber(e.target.value)}
                      className="w-full p-2.5 border border-stone-300 rounded-xl font-mono text-xs"
                    />
                    <p className="text-[10px] text-stone-400 mt-1">Cross-brand canonical model number</p>
                  </div>
                  <div className="flex flex-col justify-end">
                    <button
                      type="button"
                      onClick={() => setIsEditDuplicateCheckOpen(!isEditDuplicateCheckOpen)}
                      className="w-full p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      {isEditDuplicateCheckOpen ? 'Hide Similar Products' : 'Check Duplicate Products in Catalogue'}
                    </button>
                  </div>
                </div>

                {/* Similar Products in Catalogue Accordion (Requirement 18) */}
                {isEditDuplicateCheckOpen && (
                  <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        Similar Catalogue Items (Duplicate Check)
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsDuplicateAuditOpen(true)}
                        className="text-[11px] font-bold text-amber-800 underline hover:text-amber-950"
                      >
                        Open Full Audit Tool
                      </button>
                    </div>
                    <ProductSuggestionBox
                      productName={editName}
                      sku={editSku}
                      brand={editBrand}
                      categoryId={editCategory}
                      manufacturerModelNumber={editModelNumber}
                      excludeProductId={editingProduct.id}
                      onSelectExistingProduct={(p, workflow) => {
                        if (workflow === 'stock') {
                          setIsEditProductModalOpen(false);
                          handleOpenStockAdjust(p);
                        } else {
                          handleOpenEditProduct(p);
                        }
                      }}
                      isCreateMode={false}
                    />
                  </div>
                )}

                {/* PRICE INFORMATION */}
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-200/80 pb-2">
                    <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                      Price Information
                    </span>
                    {staffRole !== 'owner' && (
                      <span className="text-[11px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md font-semibold">
                        Owner Only (Locked for Staff)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-stone-700 mb-1">
                        Real MRP (₹) *
                      </label>
                      <input
                        type="number"
                        required
                        disabled={staffRole !== 'owner'}
                        min={1}
                        placeholder="e.g. 1000"
                        value={editMrp}
                        onChange={(e) => {
                          setEditMrp(Number(e.target.value));
                          setEditProductError('');
                        }}
                        className="w-full p-2.5 border border-stone-300 disabled:bg-stone-100 disabled:text-stone-500 rounded-xl font-mono text-sm"
                      />
                      <span className="text-[10px] text-stone-400 mt-1 block">Actual printed/declared reference price</span>
                    </div>

                    <div>
                      <label className="block font-bold text-stone-700 mb-1">
                        Special Selling Price (₹) *
                      </label>
                      <input
                        type="number"
                        required
                        disabled={staffRole !== 'owner'}
                        min={1}
                        placeholder="e.g. 500"
                        value={editPrice}
                        onChange={(e) => {
                          setEditPrice(Number(e.target.value));
                          setEditProductError('');
                        }}
                        className="w-full p-2.5 border border-stone-300 disabled:bg-stone-100 disabled:text-stone-500 rounded-xl font-mono font-bold text-sm"
                      />
                      <span className="text-[10px] text-stone-400 mt-1 block">Actual Jainam Traders selling price</span>
                    </div>
                  </div>

                  {/* Live Calculation Preview Box */}
                  <div className="p-3 bg-white rounded-xl border border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-stone-500 mr-1.5">MRP:</span>
                      <strong className="font-mono text-stone-900">{formatINR(editMrp)}</strong>
                    </div>
                    <div>
                      <span className="text-stone-500 mr-1.5">Selling Price:</span>
                      <strong className="font-mono text-stone-900">{formatINR(editPrice)}</strong>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-stone-500">Calculated Discount:</span>
                      {editMrp > editPrice && Math.round(((editMrp - editPrice) / editMrp) * 100) > 0 ? (
                        <span className="font-black text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-lg border border-brand-200">
                          {Math.round(((editMrp - editPrice) / editMrp) * 100)}% OFF
                        </span>
                      ) : (
                        <span className="text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-lg font-semibold">
                          No discount
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Inventory info (Read-only total & reserved; low stock threshold editable) */}
                <div className="p-3 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-900">Current Stock Levels</span>
                    <span className="text-[11px] text-amber-700">
                      Total: <strong>{inv.totalStock}</strong> | Reserved: <strong>{inv.reservedStock}</strong> | Available: <strong>{inv.availableStock}</strong>
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Note: To alter physical stock, use the <strong>[Stock]</strong> button. This ensures an immutable audit log.
                  </p>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Low Stock Alert Threshold</label>
                    <input
                      type="number"
                      min={0}
                      value={editLowStock}
                      onChange={(e) => setEditLowStock(Number(e.target.value))}
                      className="w-32 p-1.5 border border-stone-300 rounded-lg font-mono"
                    />
                  </div>
                </div>

                {/* Descriptions */}
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Short Description</label>
                  <input
                    type="text"
                    value={editShortDesc}
                    onChange={(e) => setEditShortDesc(e.target.value)}
                    className="w-full p-2.5 border border-stone-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Full Description</label>
                  <textarea
                    rows={3}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full p-2.5 border border-stone-300 rounded-xl"
                  />
                </div>

                {/* Specifications */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Material</label>
                    <input
                      type="text"
                      value={editMaterial}
                      onChange={(e) => setEditMaterial(e.target.value)}
                      className="w-full p-2 border border-stone-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Dimensions</label>
                    <input
                      type="text"
                      value={editDimensions}
                      onChange={(e) => setEditDimensions(e.target.value)}
                      className="w-full p-2 border border-stone-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Weight</label>
                    <input
                      type="text"
                      value={editWeight}
                      onChange={(e) => setEditWeight(e.target.value)}
                      className="w-full p-2 border border-stone-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Occasion</label>
                    <input
                      type="text"
                      value={editOccasion}
                      onChange={(e) => setEditOccasion(e.target.value)}
                      className="w-full p-2 border border-stone-300 rounded-xl"
                    />
                  </div>
                </div>

                {/* Tags and Visibility */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Tags (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. photo frame, gifts, rosewood"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      className="w-full p-2.5 border border-stone-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Visibility Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      className="w-full p-2.5 border border-stone-300 rounded-xl bg-stone-50 font-semibold"
                    >
                      <option value="published">Published (Visible on Storefront)</option>
                      <option value="hidden">Hidden (Storefront draft)</option>
                      <option value="archived">Archived (Soft deleted)</option>
                    </select>
                  </div>
                </div>

                {/* Search Keywords (Optional) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-stone-700">
                      Search Keywords <span className="text-xs font-normal text-stone-500">(Optional - auto-generated synonyms apply automatically)</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. wooden clock, wall clock, home decor"
                    value={editSearchKeywords}
                    onChange={(e) => setEditSearchKeywords(e.target.value)}
                    className="w-full p-2.5 border border-stone-300 rounded-xl text-sm"
                  />
                  <p className="text-[11px] text-stone-500 mt-1">
                    Store staff do not need to enter linguistic translations or Hindi words; our search engine handles transliterations automatically.
                  </p>
                </div>

                {/* Live Search Preview */}
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Search Preview — Customers can find this product with:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {editSearchPreview.length > 0 ? (
                      editSearchPreview.map((kw, i) => (
                        <span key={i} className="text-[11px] bg-white text-amber-950 font-medium px-2 py-0.5 rounded-md border border-amber-200 shadow-2xs">
                          {kw}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-stone-400 italic">Enter product name/category to see preview...</span>
                    )}
                  </div>
                </div>

                {/* Product Media Upload */}
                <ProductMediaUpload
                  photos={editPhotos}
                  videoUrl={editVideo}
                  onChangePhotos={setEditPhotos}
                  onChangeVideo={setEditVideo}
                  productId={editingProduct.id}
                />

                {editProductError && (
                  <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    {editProductError}
                  </p>
                )}

                <div className="flex gap-2 pt-3 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setIsEditProductModalOpen(false)}
                    className="w-1/3 py-2.5 bg-stone-100 hover:bg-stone-200 rounded-xl font-bold text-stone-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editProductLoading}
                    className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow transition-colors"
                  >
                    {editProductLoading ? 'Saving Changes...' : 'Save Product Updates'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* MODAL 3: ADD NEW PRODUCT MODAL */}
      {/* ============================================================== */}
      {isAddProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-elevated my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="font-extrabold text-stone-900 text-base">Add New Product</h3>
                <p className="text-xs text-stone-500">Create a new catalogue item with initial stock &amp; audit tracking</p>
              </div>
              <button
                onClick={() => setIsAddProductModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-4 text-xs">
              {/* Product Name & Smart Duplicate Suggestion (Requirements 1, 15, 21) */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Silent Sweep 12-inch Wooden Wall Clock"
                  value={newProdName}
                  onChange={(e) => {
                    setNewProdName(e.target.value);
                    setNewProdDifferentiator(null);
                  }}
                  className="w-full p-2.5 border border-stone-300 rounded-xl focus:bg-white text-xs font-semibold"
                />
                {/* Live suggestion dropdown directly below product name */}
                <ProductSuggestionBox
                  productName={newProdName}
                  sku={newProdSku}
                  brand={newProdBrand}
                  categoryId={newProdCategory}
                  manufacturerModelNumber={newProdModelNumber}
                  onSelectExistingProduct={(p, workflow) => {
                    setIsAddProductModalOpen(false);
                    if (workflow === 'stock') {
                      handleOpenStockAdjust(p);
                    } else {
                      handleOpenEditProduct(p);
                    }
                  }}
                  onDifferentiatorConfirmed={(diff) => setNewProdDifferentiator(diff)}
                  isCreateMode={true}
                />
              </div>

              {/* SKU & Manufacturer Model Number (Requirement 10 & 11) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. JT-CK-009"
                    value={newProdSku}
                    onChange={(e) => setNewProdSku(e.target.value.toUpperCase())}
                    className="w-full p-2.5 border border-stone-300 rounded-xl font-mono uppercase"
                  />
                  <p className="text-[10px] text-stone-400 mt-1">Unique store SKU or barcode value</p>
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Manufacturer Model Number / Item Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. XYZ-100 or ITEM-441"
                    value={newProdModelNumber}
                    onChange={(e) => setNewProdModelNumber(e.target.value)}
                    className="w-full p-2.5 border border-stone-300 rounded-xl font-mono"
                  />
                  <p className="text-[10px] text-stone-400 mt-1">Manufacturer item code for cross-referencing</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Brand</label>
                  <input
                    type="text"
                    value={newProdBrand}
                    onChange={(e) => setNewProdBrand(e.target.value)}
                    className="w-full p-2.5 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Category</label>
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="w-full p-2.5 border border-stone-300 rounded-xl bg-stone-50 font-semibold"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* PRICE INFORMATION */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                <div className="border-b border-stone-200/80 pb-2">
                  <span className="text-xs font-bold text-stone-800 uppercase tracking-wider block">
                    PRICE INFORMATION
                  </span>
                  <span className="text-[11px] text-stone-500">
                    The discount percentage is calculated automatically. Manual discount entry is disabled.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      Real MRP (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="e.g. 1000"
                      value={newProdMrp}
                      onChange={(e) => {
                        setNewProdMrp(Number(e.target.value));
                        setAddProductError('');
                      }}
                      className="w-full p-2.5 border border-stone-300 rounded-xl font-mono text-sm"
                    />
                    <span className="text-[10px] text-stone-400 mt-1 block">Actual printed/declared reference price</span>
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      Jainam Traders Selling Price (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="e.g. 500"
                      value={newProdPrice}
                      onChange={(e) => {
                        setNewProdPrice(Number(e.target.value));
                        setAddProductError('');
                      }}
                      className="w-full p-2.5 border border-stone-300 rounded-xl font-mono font-bold text-sm"
                    />
                    <span className="text-[10px] text-stone-400 mt-1 block">The actual price Jainam Traders sells at</span>
                  </div>
                </div>

                {/* LIVE calculation */}
                <div className="p-3 bg-white rounded-xl border border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-stone-500 mr-1.5">MRP:</span>
                    <strong className="font-mono text-stone-900">{formatINR(newProdMrp)}</strong>
                  </div>
                  <div>
                    <span className="text-stone-500 mr-1.5">Selling Price:</span>
                    <strong className="font-mono text-stone-900">{formatINR(newProdPrice)}</strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-stone-500">You are giving:</span>
                    {newProdMrp > newProdPrice && Math.round(((newProdMrp - newProdPrice) / newProdMrp) * 100) > 0 ? (
                      <span className="font-black text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-lg border border-brand-200">
                        {Math.round(((newProdMrp - newProdPrice) / newProdMrp) * 100)}% OFF
                      </span>
                    ) : (
                      <span className="text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-lg font-semibold">
                        No discount
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* INVENTORY INFORMATION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-stone-50 rounded-2xl border border-stone-200">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Initial Stock *</label>
                  <input
                    type="number"
                    min={0}
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(Number(e.target.value))}
                    className="w-full p-2.5 border border-stone-300 rounded-xl font-mono font-bold"
                  />
                  <span className="text-[10px] text-stone-400 mt-0.5 block">Physical units currently in store</span>
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Low Stock Alert</label>
                  <input
                    type="number"
                    min={0}
                    value={newProdLowStock}
                    onChange={(e) => setNewProdLowStock(Number(e.target.value))}
                    className="w-full p-2.5 border border-stone-300 rounded-xl font-mono"
                  />
                  <span className="text-[10px] text-stone-400 mt-0.5 block">Alert badge when stock falls below</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Key features, craftsmanship details, and highlights..."
                  value={newProdDesc}
                  onChange={(e) => setNewProdDesc(e.target.value)}
                  className="w-full p-2.5 border border-stone-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Material</label>
                  <input
                    type="text"
                    placeholder="e.g. Teakwood"
                    value={newProdMaterial}
                    onChange={(e) => setNewProdMaterial(e.target.value)}
                    className="w-full p-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Dimensions</label>
                  <input
                    type="text"
                    placeholder="e.g. 25 x 30 cm"
                    value={newProdDimensions}
                    onChange={(e) => setNewProdDimensions(e.target.value)}
                    className="w-full p-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Weight</label>
                  <input
                    type="text"
                    placeholder="e.g. 500g"
                    value={newProdWeight}
                    onChange={(e) => setNewProdWeight(e.target.value)}
                    className="w-full p-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Occasion</label>
                  <input
                    type="text"
                    placeholder="e.g. Festival"
                    value={newProdOccasion}
                    onChange={(e) => setNewProdOccasion(e.target.value)}
                    className="w-full p-2 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. clock, gifts, vintage"
                    value={newProdTags}
                    onChange={(e) => setNewProdTags(e.target.value)}
                    className="w-full p-2.5 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Status</label>
                  <select
                    value={newProdStatus}
                    onChange={(e) => setNewProdStatus(e.target.value as any)}
                    className="w-full p-2.5 border border-stone-300 rounded-xl bg-stone-50 font-semibold"
                  >
                    <option value="published">Published (Visible on storefront)</option>
                    <option value="hidden">Hidden Draft</option>
                  </select>
                </div>
              </div>

              {/* Search Keywords (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-stone-700">
                    Search Keywords <span className="text-xs font-normal text-stone-500">(Optional - auto-generated synonyms apply automatically)</span>
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="e.g. wooden clock, wall clock, home decor"
                  value={newProdSearchKeywords}
                  onChange={(e) => setNewProdSearchKeywords(e.target.value)}
                  className="w-full p-2.5 border border-stone-300 rounded-xl text-sm"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Store staff do not need to enter linguistic translations or Hindi words; our search engine handles transliterations automatically.
                </p>
              </div>

              {/* Live Search Preview */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Search Preview — Customers can find this product with:</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {newProdSearchPreview.length > 0 ? (
                    newProdSearchPreview.map((kw, i) => (
                      <span key={i} className="text-[11px] bg-white text-amber-950 font-medium px-2 py-0.5 rounded-md border border-amber-200 shadow-2xs">
                        {kw}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-stone-400 italic">Enter product name/category to see preview...</span>
                  )}
                </div>
              </div>

              {/* Product Media Upload */}
              <ProductMediaUpload
                photos={newProdPhotos}
                videoUrl={newProdVideo}
                onChangePhotos={setNewProdPhotos}
                onChangeVideo={setNewProdVideo}
                productId="new_product"
              />

              {addProductError && (
                <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  {addProductError}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(false)}
                  className="py-2.5 px-4 bg-stone-100 hover:bg-stone-200 rounded-xl font-bold text-stone-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={addProductLoading}
                  onClick={(e) => handleAddProduct(e, true)}
                  className="py-2.5 px-4 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold text-sm shadow-sm transition-colors"
                >
                  Save as Draft
                </button>
                <button
                  type="submit"
                  disabled={addProductLoading}
                  className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-sm shadow transition-colors"
                >
                  {addProductLoading ? 'Creating Product...' : 'Create & Publish Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: ARCHIVE CONFIRMATION MODAL (Soft Delete) */}
      {/* ============================================================== */}
      {isArchiveModalOpen && productToArchive && (() => {
        const isCurrentlyArchived = Boolean(
          productToArchive.isArchived || productToArchive.status === 'archived'
        );
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-elevated">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${
                    isCurrentlyArchived ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {isCurrentlyArchived ? <ArchiveRestore className="w-6 h-6" /> : <Archive className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-stone-900 text-base">
                    {isCurrentlyArchived ? 'Restore Product?' : 'Archive Product?'}
                  </h3>
                  <p className="text-xs text-stone-500">{productToArchive.name}</p>
                </div>
              </div>

              <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 text-xs text-stone-600 space-y-2 leading-relaxed">
                {isCurrentlyArchived ? (
                  <p>
                    Restoring this product will make it visible again on the customer storefront and allow new pickup reservations.
                  </p>
                ) : (
                  <>
                    <p>
                      <strong>Non-destructive soft delete:</strong> This product will be hidden from the customer storefront and cannot be newly reserved.
                    </p>
                    <p className="text-stone-500">
                      All historical orders, counter pickup passes, and reviews will remain 100% intact.
                    </p>
                  </>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsArchiveModalOpen(false)}
                  className="w-1/2 py-2.5 bg-stone-100 hover:bg-stone-200 rounded-xl font-bold text-stone-700 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmArchive}
                  disabled={archiveLoading}
                  className={`w-1/2 py-2.5 rounded-xl font-bold text-xs text-white shadow transition-colors ${
                    isCurrentlyArchived
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {archiveLoading
                    ? 'Processing...'
                    : isCurrentlyArchived
                    ? 'Yes, Restore'
                    : 'Yes, Archive'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* MODAL 5: PHYSICAL REFUND RECORD (Cash/UPI ledger) */}
      {/* ============================================================== */}
      {isRefundModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-elevated">
            <h3 className="font-bold text-stone-900 text-base">Record Counter Cash / UPI Refund</h3>
            <p className="text-xs text-stone-500">
              For order {selectedOrder.orderNumber}. Payment was made at shop, so refund must be given at shop counter.
            </p>
            <form onSubmit={handleRecordRefund} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Refund Amount (₹)</label>
                <input
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value))}
                  className="w-full p-2 border border-stone-300 rounded-xl font-bold text-sm"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Disbursement Method</label>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value as any)}
                  className="w-full p-2 border border-stone-300 rounded-xl font-semibold bg-stone-50"
                >
                  <option value="cash">Cash (Counter Cash Register)</option>
                  <option value="upi">UPI (GPay/PhonePe to Customer)</option>
                  <option value="manual">Store Credit / Manual</option>
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">Receipt Number</label>
                <input
                  type="text"
                  placeholder="e.g. JT-REF-001"
                  value={refundReceiptNumber}
                  onChange={(e) => setRefundReceiptNumber(e.target.value)}
                  className="w-full p-2 border border-stone-300 rounded-xl"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRefundModalOpen(false)}
                  className="w-1/3 py-2 bg-stone-100 rounded-xl font-bold text-stone-700"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white rounded-xl font-bold shadow">
                  Confirm Refund Disbursed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ============================================================== */}
      {/* MODAL 6: CANCEL ORDER / RESERVATION MODAL */}
      {/* ============================================================== */}
      {isCancelModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-elevated">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0">
                <Ban className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-stone-900 text-base">
                  Cancel Order Reservation?
                </h3>
                <p className="text-xs text-stone-500">
                  {selectedOrder.orderNumber} &bull; {selectedOrder.customerName}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                Automatic Stock Release
              </p>
              <p className="text-amber-800 text-[11px] leading-relaxed">
                Cancelling will automatically release all reserved items ({selectedOrder.items.reduce((acc, i) => acc + i.quantity, 0)} units) back to counter shelf inventory immediately.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">Reason for Cancellation</label>
                <select
                  value={cancelReasonPreset}
                  onChange={(e) => setCancelReasonPreset(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-semibold text-stone-800"
                >
                  <option value="Customer requested cancellation via phone/message">Customer requested cancellation via phone/message</option>
                  <option value="Customer did not collect within pickup window">Customer did not collect within pickup window</option>
                  <option value="Customer changed mind / wanted different item">Customer changed mind / wanted different item</option>
                  <option value="Item damaged or out of stock at counter">Item damaged or out of stock at counter</option>
                  <option value="Duplicate reservation placed">Duplicate reservation placed</option>
                  <option value="Customer unable to visit shop">Customer unable to visit shop</option>
                  <option value="Other reason">Other reason (describe below)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Additional Staff Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Customer called at 09000000000 and requested cancellation."
                  value={cancelReasonCustom}
                  onChange={(e) => setCancelReasonCustom(e.target.value)}
                  className="w-full p-2.5 border border-stone-300 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="w-1/2 py-2.5 bg-stone-100 hover:bg-stone-200 rounded-xl font-bold text-stone-700 text-xs transition-colors"
              >
                Keep Order Active
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelLoading}
                className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow transition-colors flex items-center justify-center gap-1.5"
              >
                {cancelLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 7: PRINTABLE PICKUP RECEIPT / PACKAGING SLIP */}
      {/* ============================================================== */}
      {isPrintSlipModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-elevated max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-brand-700" />
                <h3 className="font-extrabold text-stone-900 text-sm sm:text-base">
                  Counter Pickup Slip &bull; Jainam Traders
                </h3>
              </div>
              <button
                onClick={() => setIsPrintSlipModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* The Printable Slip Document */}
            <div
              id="printable-pickup-slip"
              className="p-6 bg-stone-50 rounded-2xl border border-stone-300 text-stone-900 font-sans space-y-4 text-xs"
            >
              <div className="text-center border-b border-stone-300 pb-3">
                <h2 className="text-lg font-black uppercase tracking-wider text-stone-900">JAINAM TRADERS</h2>
                <p className="text-[11px] text-stone-600 font-medium">Gifts &bull; Toys &bull; Accessories &bull; Home Décor</p>
                <p className="text-[10px] text-stone-500">Retail Store &bull; Pay at Counter Upon Pickup</p>
                <p className="text-[10px] text-stone-500 mt-0.5">{settings?.phone ? `Phone: ${settings.phone} • ` : ''}Timings: {settings?.openingTime || '07:30 AM'} - {settings?.closingTime || '09:30 PM'}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-stone-300 pb-3">
                <div>
                  <span className="text-stone-500 block text-[10px] uppercase font-bold">Order Number</span>
                  <span className="font-mono font-black text-sm text-brand-800">{selectedOrder.orderNumber}</span>
                </div>
                <div className="text-right">
                  <span className="text-stone-500 block text-[10px] uppercase font-bold">Date &amp; Time</span>
                  <span className="font-semibold">{formatDate(selectedOrder.createdAt)}</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px] uppercase font-bold">Customer</span>
                  <strong className="block text-stone-900">{selectedOrder.customerName}</strong>
                  <span className="text-stone-600">{selectedOrder.customerPhone}</span>
                </div>
                <div className="text-right">
                  <span className="text-stone-500 block text-[10px] uppercase font-bold">Status</span>
                  <span className="font-bold uppercase text-stone-800">{selectedOrder.status.replace(/_/g, ' ')}</span>
                  <span className="block text-[10px] text-stone-500">Payment: {selectedOrder.paymentStatus}</span>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-stone-300 text-stone-500 font-bold uppercase text-[9px]">
                      <th className="py-1">Item</th>
                      <th className="py-1 text-center">Qty</th>
                      <th className="py-1 text-right">Price</th>
                      <th className="py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {selectedOrder.items.map((i) => (
                      <tr key={i.id}>
                        <td className="py-1.5 pr-2">
                          <span className="font-bold text-stone-900 block">{i.productName}</span>
                          {i.variantName && <span className="text-[10px] text-stone-500 block">Var: {i.variantName}</span>}
                        </td>
                        <td className="py-1.5 text-center font-bold">{i.quantity}</td>
                        <td className="py-1.5 text-right text-stone-600">{formatINR(i.unitPrice)}</td>
                        <td className="py-1.5 text-right font-bold text-stone-900">{formatINR(i.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t-2 border-stone-400 pt-2 flex justify-between items-center text-sm font-black">
                <span>TOTAL PAYABLE AT COUNTER:</span>
                <span className="text-base text-brand-800">{formatINR(selectedOrder.totalAmount)}</span>
              </div>

              {selectedOrder.adminNotes && (
                <div className="p-2 bg-amber-50 rounded border border-amber-200 text-[10px] text-amber-900">
                  <strong>Counter Note:</strong> {selectedOrder.adminNotes}
                </div>
              )}

              <div className="text-center pt-2 border-t border-dashed border-stone-300 text-[10px] text-stone-500 space-y-0.5">
                <p className="font-semibold text-stone-700">&bull; Please present this slip or QR code at counter &bull;</p>
                <p>Inspect your items thoroughly before making cash or UPI payment.</p>
                <p className="font-mono text-[9px] text-stone-400 pt-1">QR Token: {selectedOrder.qrToken}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPrintSlipModalOpen(false)}
                className="w-1/3 py-2.5 bg-stone-100 hover:bg-stone-200 rounded-xl font-bold text-stone-700 text-xs transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs shadow flex items-center justify-center gap-2 transition-colors"
              >
                <Printer className="w-4 h-4" /> Print Counter Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 60mm x 24mm Landscape Thermal Label Print Modal (TSC TTP-244 Pro) */}
      {isPrintLabelModalOpen && labelProduct && (
        <PrintLabelModal
          isOpen={isPrintLabelModalOpen}
          product={labelProduct}
          onClose={() => {
            setIsPrintLabelModalOpen(false);
            setLabelProduct(null);
          }}
        />
      )}

      {/* Bulk Thermal Label Print Modal */}
      {isBulkPrintModalOpen && (
        <BulkPrintModal
          isOpen={isBulkPrintModalOpen}
          products={products}
          onClose={() => setIsBulkPrintModalOpen(false)}
        />
      )}

      {/* Barcode & QR Scanner Modal */}
      {isScannerModalOpen && (
        <ScannerModal
          isOpen={isScannerModalOpen}
          products={products}
          orders={orders}
          staffRole={staffRole}
          onClose={() => setIsScannerModalOpen(false)}
          onSelectOrder={(ord) => {
            setSelectedOrder(ord);
            setActiveTab('orders');
            setBannerNotice(`Loaded Order ${ord.orderNumber} for counter pickup verification`);
          }}
          onViewProduct={(prod) => {
            setActiveTab('products');
            setProductSearch(prod.sku);
          }}
          onPrintLabel={(prod) => {
            setLabelProduct(prod);
            setIsPrintLabelModalOpen(true);
          }}
          onAddToCounterOrder={(prod) => {
            setActiveTab('overview');
            setBannerNotice(`Selected ${prod.name} (SKU: ${prod.sku}) for counter checkout`);
          }}
          onStockAdjusted={() => {
            refreshData();
          }}
        />
      )}

      {/* MODAL: DUPLICATE CATALOGUE AUDIT & REVERSIBLE OWNER MERGE (Requirements 19 & 20) */}
      <DuplicateAuditModal
        isOpen={isDuplicateAuditOpen}
        onClose={() => setIsDuplicateAuditOpen(false)}
        staffRole={staffRole}
        onProductMerged={refreshData}
      />

      {/* Global Print Styles (Scoped to Counter Pickup Receipt only; never interferes with 60x24mm thermal labels) */}
      <style jsx global>{`
        @media print {
          body:not(.printing-thermal-label) * {
            visibility: hidden;
          }
          body:not(.printing-thermal-label) #printable-pickup-slip,
          body:not(.printing-thermal-label) #printable-pickup-slip * {
            visibility: visible;
          }
          body:not(.printing-thermal-label) #printable-pickup-slip {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            background: white !important;
            padding: 20px !important;
          }
          body.printing-thermal-label #printable-pickup-slip {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>
    </div>
  );
}
