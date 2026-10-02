// ==============================================================================
// JAINAM TRADERS - CUSTOMER CRM & RELATIONSHIP MANAGEMENT SERVICE
// Authoritative CRM service for customer profiles, timelines, internal staff notes,
// financial summaries, and role-based privacy protection.
// ==============================================================================

import {
  CustomerAccountStatus,
  CustomerActivityEvent,
  CustomerActivityEventType,
  CustomerCrmSummary,
  CustomerProfile,
  CustomerStaffNote,
  Order,
  RefundRecord,
  Review,
} from '@/lib/types';
import { customerStore, SafeCustomerAccount } from '@/lib/auth/customer-store';
import { storeDb } from '@/lib/db/store-service';
import { StaffRole } from '@/lib/auth/staff-roles';

export interface CustomerListItem {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  accountStatus: CustomerAccountStatus;
  orderCount: number;
  totalSpend: number;
  lastActivityAt: string;
  registeredOn: string;
}

export interface CustomerListResult {
  customers: CustomerListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CustomerDetailResult {
  profile: CustomerProfile;
  summary: CustomerCrmSummary;
  orders: Order[];
  reviews: Review[];
  refunds: RefundRecord[];
  timeline: CustomerActivityEvent[];
  staffNotes?: CustomerStaffNote[]; // Hidden from customers and unauthorized staff
}

/**
 * Record an immutable chronological activity event for a customer
 */
export function recordCustomerActivity(params: {
  customerId: string;
  eventType: CustomerActivityEventType;
  description: string;
  metadata?: Record<string, unknown>;
  actorId?: string;
  actorRole: 'customer' | 'staff' | 'system';
}): CustomerActivityEvent {
  const event: CustomerActivityEvent = {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    customerId: params.customerId,
    eventType: params.eventType,
    description: params.description,
    metadata: params.metadata,
    actorId: params.actorId,
    actorRole: params.actorRole,
    createdAt: new Date().toISOString(),
  };

  storeDb.customerActivity.unshift(event);
  return event;
}

/**
 * Query searchable, filtered, and paginated customer list for Admin CRM (Parts 6 & 42)
 */
export function getCustomerList(params: {
  search?: string;
  status?: CustomerAccountStatus;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'spend' | 'orders' | 'date';
  sortOrder?: 'asc' | 'desc';
}): CustomerListResult {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 10));

  // Sync any customers who placed orders as guest/account
  const accounts = customerStore.getAllAccounts();
  const allOrders = storeDb.orders;

  // Build unified map of customers
  const customerMap = new Map<string, CustomerListItem>();

  // 1. Ingest registered accounts
  for (const acc of accounts) {
    const custOrders = allOrders.filter(
      (o) => o.customerId === acc.id || o.customerId === acc.userId || (acc.email && o.customerEmail?.toLowerCase() === acc.email.toLowerCase())
    );
    const completedOrders = custOrders.filter((o) => o.status === 'PICKED_UP');
    const totalSpend = completedOrders.reduce((sum, o) => sum + (o.netPayableAtCounter ?? o.totalAmount), 0);

    // Latest activity
    let lastActivityAt = acc.lastKnownLoginAt || acc.createdAt;
    if (custOrders.length > 0) {
      const latestOrderTime = custOrders[0].createdAt;
      if (new Date(latestOrderTime) > new Date(lastActivityAt)) {
        lastActivityAt = latestOrderTime;
      }
    }

    customerMap.set(acc.id, {
      id: acc.id,
      userId: acc.userId,
      fullName: acc.fullName,
      email: acc.email,
      phone: acc.phone,
      accountStatus: acc.accountStatus,
      orderCount: custOrders.length,
      totalSpend,
      lastActivityAt,
      registeredOn: acc.createdAt,
    });
  }

  // 2. Ingest customers from historical orders if not already in customerStore (prevent missing records)
  for (const order of allOrders) {
    if (!order.customerId) continue;
    let existing = customerMap.get(order.customerId);
    if (!existing) {
      // Find if email matches an existing account
      if (order.customerEmail) {
        const found = customerStore.findByEmail(order.customerEmail);
        if (found && customerMap.has(found.id)) {
          existing = customerMap.get(found.id);
        }
      }
    }

    if (!existing) {
      const custOrders = allOrders.filter((o) => o.customerId === order.customerId);
      const completedOrders = custOrders.filter((o) => o.status === 'PICKED_UP');
      const totalSpend = completedOrders.reduce((sum, o) => sum + (o.netPayableAtCounter ?? o.totalAmount), 0);

      customerMap.set(order.customerId, {
        id: order.customerId,
        userId: order.customerId,
        fullName: order.customerName,
        email: order.customerEmail || 'Not provided',
        phone: order.customerPhone,
        accountStatus: 'ACTIVE',
        orderCount: custOrders.length,
        totalSpend,
        lastActivityAt: custOrders[0]?.createdAt || order.createdAt,
        registeredOn: order.createdAt,
      });
    }
  }

  let list = Array.from(customerMap.values());

  // Filter by status
  if (params.status) {
    list = list.filter((c) => c.accountStatus === params.status);
  }

  // Search filter (name, email, phone, customer ID)
  if (params.search && params.search.trim()) {
    const q = params.search.toLowerCase().trim();
    list = list.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.userId.toLowerCase().includes(q)
    );
  }

  // Sorting
  const sortBy = params.sortBy || 'date';
  const sortOrder = params.sortOrder || 'desc';

  list.sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'name') {
      comparison = a.fullName.localeCompare(b.fullName);
    } else if (sortBy === 'spend') {
      comparison = a.totalSpend - b.totalSpend;
    } else if (sortBy === 'orders') {
      comparison = a.orderCount - b.orderCount;
    } else {
      comparison = new Date(a.registeredOn).getTime() - new Date(b.registeredOn).getTime();
    }
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  const total = list.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginated = list.slice(startIndex, startIndex + limit);

  return {
    customers: paginated,
    total,
    page,
    limit,
    totalPages,
  };
}

/**
 * Retrieve comprehensive Customer Profile, Activity, Summary, and internal Notes
 * Strictly respects role permissions: Customer and Counter Staff NEVER receive internal notes!
 */
export function getCustomerDetails(
  idOrUserId: string,
  requestingRole: 'owner' | 'store_manager' | 'staff' | 'customer',
  requestingUserId?: string
): CustomerDetailResult | null {
  // Find customer account
  const account = customerStore.findByIdOrUserId(idOrUserId);
  let resolvedId = idOrUserId;
  let resolvedUserId = idOrUserId;
  let profile: CustomerProfile;

  if (account) {
    resolvedId = account.id;
    resolvedUserId = account.userId;
    profile = {
      id: account.id,
      userId: account.userId,
      fullName: account.fullName,
      email: account.email,
      phone: account.phone,
      address: account.address,
      languagePreference: account.languagePreference,
      authenticationMethod: account.authenticationMethod,
      accountStatus: account.accountStatus,
      profileCompleted: account.profileCompleted,
      marketingCommunicationPreference: account.marketingCommunicationPreference,
      lastKnownLoginAt: account.lastKnownLoginAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      deactivatedAt: account.deactivatedAt,
      anonymizedAt: account.anonymizedAt,
    };
  } else {
    // Look up in historical orders
    const ordersWithCustomer = storeDb.orders.filter(
      (o) => o.customerId === idOrUserId
    );
    if (ordersWithCustomer.length === 0) {
      return null;
    }
    const sample = ordersWithCustomer[0];
    profile = {
      id: sample.customerId,
      userId: sample.customerId,
      fullName: sample.customerName,
      email: sample.customerEmail || '',
      phone: sample.customerPhone,
      address: '',
      languagePreference: 'en',
      authenticationMethod: 'otp',
      accountStatus: 'ACTIVE',
      profileCompleted: false,
      marketingCommunicationPreference: true,
      createdAt: sample.createdAt,
      updatedAt: sample.createdAt,
    };
  }

  // Customer Privacy Check: Customer can only view their own profile!
  if (requestingRole === 'customer') {
    if (
      requestingUserId &&
      requestingUserId !== resolvedId &&
      requestingUserId !== resolvedUserId
    ) {
      return null; // Block access to another customer's data
    }
  }

  // Retrieve customer's historical orders
  const customerOrders = storeDb.orders.filter(
    (o) =>
      o.customerId === resolvedId ||
      o.customerId === resolvedUserId ||
      (profile.email && o.customerEmail?.toLowerCase() === profile.email.toLowerCase())
  );

  // Completed pickups & financial summary
  const completedPickups = customerOrders.filter((o) => o.status === 'PICKED_UP');
  const cancelledOrders = customerOrders.filter((o) => o.status === 'CANCELLED');
  const totalPurchaseValue = completedPickups.reduce(
    (sum, o) => sum + (o.netPayableAtCounter ?? o.totalAmount),
    0
  );

  // Customer's refunds
  const orderIds = new Set(customerOrders.map((o) => o.id));
  const refunds = storeDb.refundRecords.filter((r) => orderIds.has(r.orderId));
  const totalRefunded = refunds.reduce((sum, r) => sum + r.refundAmount, 0);

  // Customer's reviews
  const reviews = storeDb.reviews.filter(
    (r) => r.customerId === resolvedId || r.customerId === resolvedUserId
  );

  // Customer's active gift code balance
  const assignedGiftCodes = storeDb.giftCodes.filter(
    (g) =>
      (g.customerId === resolvedId || g.customerId === resolvedUserId) &&
      g.status === 'ACTIVE'
  );
  const activeGiftCodeBalance = assignedGiftCodes.reduce((sum, g) => sum + g.remainingValue, 0);

  const summary: CustomerCrmSummary = {
    totalOrders: customerOrders.length,
    completedPickups: completedPickups.length,
    cancelledOrders: cancelledOrders.length,
    totalPurchaseValue,
    totalRefunded,
    activeGiftCodeBalance,
    reviewsCount: reviews.length,
    wishlistCount: 0, // Computed from customer sessions/wishlist if active
  };

  // Activity Timeline (chronological real events only)
  const timeline = storeDb.customerActivity.filter(
    (a) => a.customerId === resolvedId || a.customerId === resolvedUserId
  );

  // Staff Notes: STRICTLY OWNER & STORE_MANAGER ONLY (Part 9 & 10)
  let staffNotes: CustomerStaffNote[] | undefined = undefined;
  if (requestingRole === 'owner' || requestingRole === 'store_manager') {
    staffNotes = storeDb.customerNotes.filter(
      (n) => n.customerId === resolvedId || n.customerId === resolvedUserId
    );
  }

  return {
    profile,
    summary,
    orders: customerOrders,
    reviews,
    refunds,
    timeline,
    staffNotes,
  };
}

/**
 * Add internal staff note (Parts 9 & 10)
 * Only authorized Owner or Store Manager can add notes. Never visible to customer.
 */
export function addCustomerStaffNote(params: {
  customerId: string;
  note: string;
  authorId: string;
  authorName: string;
  authorRole: StaffRole;
}): { success: boolean; note?: CustomerStaffNote; error?: string } {
  if (params.authorRole !== 'owner' && params.authorRole !== 'store_manager') {
    return { success: false, error: 'Unauthorized: Only owner and managers can add internal notes.' };
  }

  const cleanNote = params.note.trim();
  if (!cleanNote) {
    return { success: false, error: 'Note content cannot be empty.' };
  }

  const newNote: CustomerStaffNote = {
    id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    customerId: params.customerId,
    note: cleanNote,
    authorId: params.authorId,
    authorName: params.authorName,
    authorRole: params.authorRole,
    createdAt: new Date().toISOString(),
  };

  storeDb.customerNotes.unshift(newNote);

  storeDb.logAudit(params.authorId, params.authorRole, 'ADD_CUSTOMER_NOTE', 'customers', params.customerId, {
    noteId: newNote.id,
    authorName: params.authorName,
  });

  return { success: true, note: newNote };
}

/**
 * Update Customer Account Status (Part 4)
 * Only authorized Owner or Store Manager can change customer status.
 */
export function updateCustomerAccountStatus(params: {
  customerId: string;
  status: CustomerAccountStatus;
  actorId: string;
  actorName: string;
  actorRole: StaffRole;
  reason?: string;
}): { success: boolean; customer?: SafeCustomerAccount; error?: string } {
  if (params.actorRole !== 'owner' && params.actorRole !== 'store_manager') {
    return { success: false, error: 'Unauthorized: Insufficient role permissions to modify customer status.' };
  }

  const result = customerStore.updateStatus(params.customerId, params.status);
  if (!result.success || !result.customer) {
    return { success: false, error: result.error || 'Failed to update customer status.' };
  }

  // Record immutable activity event
  recordCustomerActivity({
    customerId: params.customerId,
    eventType: 'STATUS_CHANGED',
    description: `Account status updated to ${params.status}${params.reason ? `: ${params.reason}` : ''}`,
    actorId: params.actorId,
    actorRole: 'staff',
    metadata: { newStatus: params.status, reason: params.reason, updatedBy: params.actorName },
  });

  storeDb.logAudit(params.actorId, params.actorRole, 'UPDATE_CUSTOMER_STATUS', 'customers', params.customerId, {
    newStatus: params.status,
    reason: params.reason,
  });

  return { success: true, customer: result.customer };
}

/**
 * Deactivate / Anonymize Customer Account (Part 14)
 * Preserves financial and order integrity while scrubbing PII.
 */
export function anonymizeCustomerProfile(params: {
  customerId: string;
  actorId: string;
  actorRole: 'owner' | 'customer';
}): { success: boolean; error?: string } {
  const result = customerStore.anonymizeAccount(params.customerId);
  if (!result.success) {
    return result;
  }

  recordCustomerActivity({
    customerId: params.customerId,
    eventType: 'STATUS_CHANGED',
    description: 'Account anonymized and deactivated for customer privacy compliance.',
    actorId: params.actorId,
    actorRole: params.actorRole === 'owner' ? 'staff' : 'customer',
  });

  storeDb.logAudit(params.actorId, params.actorRole, 'ANONYMIZE_CUSTOMER', 'customers', params.customerId, {
    action: 'privacy_anonymization',
  });

  return { success: true };
}
