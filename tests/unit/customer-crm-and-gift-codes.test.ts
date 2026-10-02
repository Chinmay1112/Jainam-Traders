import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { customerStore } from '@/lib/auth/customer-store';
import {
  getCustomerList,
  getCustomerDetails,
  addCustomerStaffNote,
  updateCustomerAccountStatus,
  anonymizeCustomerProfile,
  recordCustomerActivity,
} from '@/lib/crm/crm-service';
import {
  createGiftCode,
  validateGiftCodeForCheckout,
  redeemGiftCodeAtomic,
  maskGiftCode,
  hashGiftCode,
  getCustomerGiftCodes,
  getGiftCodeRedemptionHistory,
  restoreGiftCodeOnCancellation,
} from '@/lib/gift-codes/gift-code-service';
import { calculateOrderDiscounts } from '@/lib/pricing/discount-engine';
import { validateCoupon } from '@/lib/pricing/engine';
import { canPerformAction, StaffRole } from '@/lib/auth/staff-auth';
import {
  storeDb,
  createPickupOrder,
  transitionOrderStatus,
  recordPhysicalRefund,
  seedTestFixtures,
} from '@/lib/db/store-service';
import { Coupon, GiftCode } from '@/lib/types';
import { TEST_DEMO_PRODUCTS } from '../fixtures/test-fixtures';

beforeAll(() => {
  seedTestFixtures({ products: TEST_DEMO_PRODUCTS });
});

describe('1. Customer Identity, Deduplication & Profile Persistence', () => {
  beforeEach(() => {
    storeDb.customerNotes = [];
    storeDb.customerActivity = [];
  });

  it('creates a persistent profile linked to Supabase Auth User ID without duplicating on login', () => {
    const userId = 'auth-user-101';
    const email = 'rajesh.patel@example.com';
    const phone = '9000000000';
    const fullName = 'Rajesh Patel';

    // 1. Initial profile creation
    const res1 = customerStore.completeProfile(email, {
      userId,
      phone,
      fullName,
      address: '12 VIP Road, Indore',
    });

    expect(res1.success).toBe(true);
    expect(res1.customer).toBeDefined();
    expect(res1.customer?.userId).toBe(userId);
    expect(res1.customer?.email).toBe(email);
    expect(res1.customer?.accountStatus).toBe('ACTIVE');

    // 2. Second login/update for same user returns identical record, no duplicates
    const res2 = customerStore.completeProfile(email, {
      userId,
      phone,
      fullName: 'Rajesh Patel Updated',
      address: 'Shop No 4, Main Bazar',
    });

    expect(res2.success).toBe(true);
    expect(res2.customer?.id).toBe(res1.customer?.id);
    expect(res2.customer?.fullName).toBe('Rajesh Patel Updated');
  });

  it('retrieves customer by email or userId correctly', () => {
    const userId = 'auth-user-102';
    const email = 'anita.shah@example.com';

    customerStore.completeProfile(email, {
      userId,
      phone: '9822334455',
      fullName: 'Anita Shah',
      address: 'Station Road',
    });

    const byEmail = customerStore.findByEmail(email);
    expect(byEmail).toBeDefined();
    expect(byEmail?.userId).toBe(userId);

    const byUserId = customerStore.findByIdOrUserId(userId);
    expect(byUserId).toBeDefined();
    expect(byUserId?.email).toBe(email);
  });

  it('anonymizes customer personal data when requested under privacy policies', () => {
    const userId = 'auth-user-103';
    const email = 'privacy.test@example.com';

    const created = customerStore.completeProfile(email, {
      userId,
      phone: '9988776655',
      fullName: 'Privacy User',
      address: 'Secret Address',
    });

    const anonRes = customerStore.anonymizeAccount(created.customer!.id);
    expect(anonRes.success).toBe(true);

    const fetched = customerStore.findByIdOrUserId(created.customer!.id);
    expect(fetched?.fullName).toBe('Former Customer');
    expect(fetched?.phone).toBe('0000000000');
    expect(fetched?.accountStatus).toBe('DEACTIVATED');
    expect(fetched?.anonymizedAt).toBeDefined();
  });
});

describe('2. Account Status Enforcement (Active, Suspended, Deactivated)', () => {
  beforeEach(() => {
    storeDb.orders = [];
    storeDb.customerActivity = [];
  });

  it('blocks suspended or deactivated customers from creating pickup orders', async () => {
    const suspendedUserId = 'auth-user-suspended';
    const email = 'suspended@example.com';

    const cust = customerStore.completeProfile(email, {
      userId: suspendedUserId,
      phone: '9111222333',
      fullName: 'Suspended Customer',
      address: 'City Center',
    });

    // Update status to SUSPENDED via CRM service
    const statusUpdate = updateCustomerAccountStatus({
      customerId: cust.customer!.id,
      status: 'SUSPENDED',
      actorId: 'owner-1',
      actorName: 'Store Owner',
      actorRole: 'owner',
      reason: 'Repeated non-pickup of reserved items',
    });
    expect(statusUpdate.success).toBe(true);

    const product = TEST_DEMO_PRODUCTS[0];

    // Attempt to create order as suspended customer
    await expect(
      createPickupOrder({
        customerName: 'Suspended Customer',
        customerPhone: '9111222333',
        customerEmail: email,
        customerId: cust.customer!.id,
        pickupSlotDate: '2026-10-05',
        pickupSlotTime: '10:00 AM - 12:00 PM',
        pickupMode: 'SLOT',
        items: [{ productId: product.id, quantity: 1 }],
      })
    ).rejects.toThrow(/suspended/i);
  });

  it('allows active customers to place orders normally', async () => {
    const activeUserId = 'auth-user-active';
    const email = 'active@example.com';

    const cust = customerStore.completeProfile(email, {
      userId: activeUserId,
      phone: '9123456780',
      fullName: 'Active Customer',
      address: 'Civil Lines',
    });

    const product = TEST_DEMO_PRODUCTS[0];
    const order = await createPickupOrder({
      customerName: 'Active Customer',
      customerPhone: '9123456780',
      customerEmail: email,
      customerId: cust.customer!.id,
      pickupSlotDate: '2026-10-05',
      pickupSlotTime: '10:00 AM - 12:00 PM',
      pickupMode: 'SLOT',
      items: [{ productId: product.id, quantity: 1 }],
    });

    expect(order).toBeDefined();
    expect(order.orderNumber).toBeDefined();
    expect(order.status).toBe('PENDING');
  });
});

describe('3. Staff Notes and Activity Timeline Privacy Isolation', () => {
  beforeEach(() => {
    storeDb.customerNotes = [];
    storeDb.customerActivity = [];
  });

  it('allows Owner and Store Manager to add internal notes but masks them from customer access', () => {
    const customerId = 'cust-notes-test';
    const email = 'notes.test@example.com';

    const cust = customerStore.completeProfile(email, {
      userId: customerId,
      phone: '9444555666',
      fullName: 'Notes Test Customer',
      address: 'Market Yard',
    });

    // 1. Staff adds note
    const noteRes = addCustomerStaffNote({
      customerId: cust.customer!.id,
      note: 'Customer requested brass items with specific polishing.',
      authorId: 'staff-owner-1',
      authorName: 'Store Owner',
      authorRole: 'owner',
    });

    expect(noteRes.success).toBe(true);
    expect(noteRes.note?.note).toContain('brass items');

    // 2. Fetch full CRM details with staff role = 'owner' -> notes visible
    const ownerView = getCustomerDetails(cust.customer!.id, 'owner');
    expect(ownerView?.staffNotes?.length).toBe(1);
    expect(ownerView?.staffNotes?.[0].note).toContain('brass items');

    // 3. Fetch with staff role = 'staff' (counter staff) -> notes hidden
    const staffView = getCustomerDetails(cust.customer!.id, 'staff');
    expect(staffView?.staffNotes).toBeUndefined();

    // 4. Fetch as customer attempting to view another customer's data -> returns null
    const unauthorizedView = getCustomerDetails(cust.customer!.id, 'customer', 'different-customer-id');
    expect(unauthorizedView).toBeNull();
  });

  it('logs activity events on status changes and profile updates', () => {
    const customerId = 'cust-activity-test';
    const email = 'activity.test@example.com';

    const cust = customerStore.completeProfile(email, {
      userId: customerId,
      phone: '9333222111',
      fullName: 'Activity Test Customer',
      address: 'Tower Chowk',
    });

    updateCustomerAccountStatus({
      customerId: cust.customer!.id,
      status: 'SUSPENDED',
      actorId: 'owner-1',
      actorName: 'Store Owner',
      actorRole: 'owner',
      reason: 'Verification test',
    });

    const details = getCustomerDetails(cust.customer!.id, 'owner');
    expect(details?.profile.accountStatus).toBe('SUSPENDED');
    const statusEvents = details?.timeline.filter((a) => a.eventType === 'STATUS_CHANGED');
    expect(statusEvents?.length).toBeGreaterThan(0);
  });
});

describe('4. Gift Code Generation, Validation, Hashing & Masking', () => {
  beforeEach(() => {
    storeDb.giftCodes = [];
    storeDb.giftCodeRedemptions = [];
  });

  it('creates unique gift codes with masked codes and SHA-256 secure hash', () => {
    const res = createGiftCode({
      code: 'JAINAMFESTIVE500',
      originalValue: 500,
      createdBy: 'owner-1',
      createdByName: 'Store Owner',
      actorRole: 'owner',
      notes: 'Festive promotion',
    });

    expect(res.success).toBe(true);
    const giftCode = res.giftCode!;
    expect(giftCode.originalValue).toBe(500);
    expect(giftCode.remainingValue).toBe(500);
    expect(giftCode.status).toBe('ACTIVE');
    expect(giftCode.maskedCode).toBe('JAI***500');
    expect(giftCode.codeHash).toBeDefined();
    // Raw code should never match hash directly
    expect(giftCode.codeHash).not.toBe('JAINAMFESTIVE500');
  });

  it('rejects duplicate code creation', () => {
    createGiftCode({
      code: 'DUPLICATE500',
      originalValue: 500,
      createdBy: 'owner-1',
      createdByName: 'Store Owner',
      actorRole: 'owner',
    });

    const dupRes = createGiftCode({
      code: 'duplicate500', // Case-insensitive duplicate check
      originalValue: 500,
      createdBy: 'owner-1',
      createdByName: 'Store Owner',
      actorRole: 'owner',
    });

    expect(dupRes.success).toBe(false);
    expect(dupRes.error).toContain('already exists');
  });

  it('validates customer restriction when gift code is assigned to a specific customer', () => {
    createGiftCode({
      code: 'EXCLUSIVEVIP1000',
      originalValue: 1000,
      customerId: 'cust-vip-1',
      customerName: 'VIP Customer',
      createdBy: 'owner-1',
      createdByName: 'Store Owner',
      actorRole: 'owner',
    });

    // Validated by another customer -> REJECTED
    const valOther = validateGiftCodeForCheckout({
      code: 'EXCLUSIVEVIP1000',
      customerId: 'cust-other-2',
      subtotal: 2000,
    });
    expect(valOther.valid).toBe(false);
    expect(valOther.errorReason).toContain('specific customer');

    // Validated by assigned customer -> ACCEPTED
    const valAssigned = validateGiftCodeForCheckout({
      code: 'EXCLUSIVEVIP1000',
      customerId: 'cust-vip-1',
      subtotal: 2000,
    });
    expect(valAssigned.valid).toBe(true);
    expect(valAssigned.giftCode?.remainingValue).toBe(1000);
  });
});

describe('5. Order Pricing Engine: Coupon & Gift Code Stacking Rules', () => {
  it('applies promotional coupon and gift code according to the stacking rule (max 1 coupon + 1 gift code)', () => {
    const subtotal = 2000;

    // Subtotal 2000 with a 10% coupon (max 300) and a 500 gift code
    const result = calculateOrderDiscounts({
      subtotal,
      coupon: {
        id: 'c-festive-10',
        code: 'FESTIVE10',
        title: 'Festive Discount',
        description: '10% off',
        discountType: 'percentage',
        discountValue: 10,
        maxDiscount: 300,
        minOrderAmount: 500,
        startDate: new Date().toISOString(),
        usedCount: 0,
        perCustomerLimit: 1,
        firstOrderOnly: false,
        isActive: true,
      } as unknown as Coupon,
      giftCode: {
        id: 'g-500',
        code: 'GIFT500',
        codeHash: 'hash',
        maskedCode: 'GIF***500',
        codeType: 'FIXED_VALUE',
        originalValue: 500,
        remainingValue: 500,
        status: 'ACTIVE',
        redemptionCount: 0,
        maxRedemptions: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'owner',
        createdByName: 'Store Owner',
      } as unknown as GiftCode,
    });

    expect(result.subtotal).toBe(2000);
    expect(result.couponDiscount).toBe(200); // 10% of 2000
    // Net after coupon is 1800, gift code covers 500
    expect(result.giftCodeDiscount).toBe(500);
    expect(result.totalDiscount).toBe(700);
    expect(result.netPayableAtCounter).toBe(1300);
  });

  it('ensures gift code discount does not exceed the remaining payable amount after coupon', () => {
    const subtotal = 400;

    // Subtotal 400 with a 100 fixed coupon and a 500 gift code
    const result = calculateOrderDiscounts({
      subtotal,
      coupon: {
        id: 'c-flat-100',
        code: 'FLAT100',
        title: 'Flat 100',
        description: 'Flat ₹100 off',
        discountType: 'fixed',
        discountValue: 100,
        minOrderAmount: 200,
        startDate: new Date().toISOString(),
        usedCount: 0,
        perCustomerLimit: 1,
        firstOrderOnly: false,
        isActive: true,
      } as unknown as Coupon,
      giftCode: {
        id: 'g-500',
        code: 'GIFT500',
        codeHash: 'hash',
        maskedCode: 'GIF***500',
        codeType: 'FIXED_VALUE',
        originalValue: 500,
        remainingValue: 500,
        status: 'ACTIVE',
        redemptionCount: 0,
        maxRedemptions: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'owner',
        createdByName: 'Store Owner',
      } as unknown as GiftCode,
    });

    expect(result.subtotal).toBe(400);
    expect(result.couponDiscount).toBe(100);
    // After coupon, payable is 300. Gift code covers 300, leaving 0 net payable at counter
    expect(result.giftCodeDiscount).toBe(300);
    expect(result.netPayableAtCounter).toBe(0);
  });

  it('rejects invalid or inactive promotional coupons', () => {
    const inactiveCoupon = {
      id: 'c-inactive',
      code: 'EXPIRED10',
      title: 'Expired Coupon',
      description: 'Expired',
      discountType: 'percentage' as const,
      discountValue: 10,
      minOrderAmount: 100,
      startDate: new Date().toISOString(),
      usedCount: 0,
      perCustomerLimit: 1,
      firstOrderOnly: false,
      isActive: false,
    } as unknown as Coupon;
    const check = validateCoupon(inactiveCoupon, 1000);
    expect(check.valid).toBe(false);
    expect(check.errorReason).toBeDefined();
  });
});

describe('6. Atomic Gift Code Redemption and Balance Deduction', () => {
  beforeEach(() => {
    storeDb.giftCodes = [];
    storeDb.giftCodeRedemptions = [];
    storeDb.orders = [];
  });

  it('deducts gift code balance atomically upon order creation and transitions to REDEEMED when exhausted', async () => {
    // 1. Create gift code of 300
    const codeRes = createGiftCode({
      code: 'EXACT300',
      originalValue: 300,
      createdBy: 'owner-1',
      createdByName: 'Store Owner',
      actorRole: 'owner',
    });
    expect(codeRes.success).toBe(true);

    const product = TEST_DEMO_PRODUCTS[0];

    // 2. Create order using gift code
    const order = await createPickupOrder({
      customerName: 'Gift User',
      customerPhone: '9888777666',
      customerEmail: 'gift@example.com',
      customerId: 'cust-gift-user-1',
      pickupSlotDate: '2026-10-05',
      pickupSlotTime: '10:00 AM - 12:00 PM',
      pickupMode: 'SLOT',
      items: [{ productId: product.id, quantity: 1 }],
      giftCode: 'EXACT300',
    });

    expect(order.giftCodeDiscount).toBeDefined();
    expect(order.giftCodeDiscount).toBeGreaterThan(0);
    expect(order.giftCodeId).toBe(codeRes.giftCode!.id);

    // 3. Verify gift code balance in DB
    const updatedCode = storeDb.giftCodes.find((g) => g.id === codeRes.giftCode!.id);
    expect(updatedCode).toBeDefined();
    expect(updatedCode?.remainingValue).toBe(300 - (order.giftCodeDiscount || 0));

    if (updatedCode?.remainingValue === 0) {
      expect(updatedCode.status).toBe('REDEEMED');
    }
  });
});

describe('7. Order Cancellation & Gift Code Balance Restoration', () => {
  beforeEach(() => {
    storeDb.giftCodes = [];
    storeDb.giftCodeRedemptions = [];
    storeDb.orders = [];
  });

  it('restores gift code balance and marks it ACTIVE when an order is cancelled', async () => {
    const codeRes = createGiftCode({
      code: 'RESTORE500',
      originalValue: 500,
      createdBy: 'owner-1',
      createdByName: 'Store Owner',
      actorRole: 'owner',
    });

    const product = TEST_DEMO_PRODUCTS[0];

    const order = await createPickupOrder({
      customerName: 'Restore Customer',
      customerPhone: '9555666777',
      customerEmail: 'restore@example.com',
      customerId: 'cust-restore-user-1',
      pickupSlotDate: '2026-10-05',
      pickupSlotTime: '10:00 AM - 12:00 PM',
      pickupMode: 'SLOT',
      items: [{ productId: product.id, quantity: 1 }],
      giftCode: 'RESTORE500',
    });

    const balanceAfterOrder = storeDb.giftCodes.find((g) => g.id === codeRes.giftCode!.id)!.remainingValue;
    expect(balanceAfterOrder).toBeLessThan(500);

    // Cancel order
    await transitionOrderStatus(order.id, 'CANCELLED', 'owner', 'staff-1', 'Cancelled by customer');

    const restoredCode = storeDb.giftCodes.find((g) => g.id === codeRes.giftCode!.id)!;
    expect(restoredCode.remainingValue).toBe(500);
    expect(restoredCode.status).toBe('ACTIVE');
  });
});

describe('8. Refund Policy (Part 29): Cash Payout Capped at Net Counter Paid & Remainder Restores to Gift Code', () => {
  beforeEach(() => {
    storeDb.giftCodes = [];
    storeDb.giftCodeRedemptions = [];
    storeDb.orders = [];
    storeDb.refundRecords = [];
  });

  it('caps physical cash refund at netPayableAtCounter and restores remaining refund to the gift code', async () => {
    const codeRes = createGiftCode({
      code: 'REFUND_GIFT_400',
      originalValue: 400,
      createdBy: 'owner-1',
      createdByName: 'Store Owner',
      actorRole: 'owner',
    });

    const product = TEST_DEMO_PRODUCTS[0];

    // Create order with gift code
    const order = await createPickupOrder({
      customerName: 'Refund Customer',
      customerPhone: '9777888999',
      customerEmail: 'refund@example.com',
      customerId: 'cust-refund-user-1',
      pickupSlotDate: '2026-10-05',
      pickupSlotTime: '10:00 AM - 12:00 PM',
      pickupMode: 'SLOT',
      items: [{ productId: product.id, quantity: 1 }],
      giftCode: 'REFUND_GIFT_400',
    });

    // Mark order COMPLETED
    await transitionOrderStatus(order.id, 'CONFIRMED', 'staff', 'staff-1', 'Order confirmed');
    await transitionOrderStatus(order.id, 'PREPARING', 'staff', 'staff-1', 'Order prepared');
    await transitionOrderStatus(order.id, 'READY_FOR_PICKUP', 'staff', 'staff-1', 'Ready for pickup');
    await transitionOrderStatus(order.id, 'PICKED_UP', 'staff', 'staff-1', 'Order picked up and paid');

    const netPaid = order.netPayableAtCounter ?? 0;

    // 1. Attempting cash refund greater than netPayableAtCounter must throw error
    await expect(
      recordPhysicalRefund(
        order.id,
        undefined,
        netPaid + 100, // Exceeds net paid cash (199 + 100 = 299)
        'cash',
        'REF-TEST-001',
        'Customer returned items with receipt',
        'staff-1',
        'Store Staff'
      )
    ).rejects.toThrow(/cannot exceed the customer's actual counter payment/i);

    // 2. Refunding valid netPaid in cash succeeds and restores gift code balance
    const refund = await recordPhysicalRefund(
      order.id,
      undefined,
      netPaid,
      'cash',
      'REF-TEST-001',
      'Customer returned items with receipt',
      'staff-1',
      'Store Staff'
    );

    expect(refund).toBeDefined();
    expect(refund.refundAmount).toBe(netPaid);

    // Gift code balance must be restored by the remaining amount
    const restoredCode = storeDb.giftCodes.find((g) => g.id === codeRes.giftCode!.id)!;
    expect(restoredCode.remainingValue).toBe(400);
  });
});

describe('9. Strict Role-Based Access Control (RBAC)', () => {
  it('allows Owner full permissions across all actions', () => {
    const ownerRole: StaffRole = 'owner';
    expect(canPerformAction(ownerRole, 'view_customers')).toBe(true);
    expect(canPerformAction(ownerRole, 'manage_customer_status')).toBe(true);
    expect(canPerformAction(ownerRole, 'add_customer_note')).toBe(true);
    expect(canPerformAction(ownerRole, 'export_customers')).toBe(true);
    expect(canPerformAction(ownerRole, 'view_gift_codes')).toBe(true);
    expect(canPerformAction(ownerRole, 'manage_gift_codes')).toBe(true);
    expect(canPerformAction(ownerRole, 'create_gift_code')).toBe(true);
  });

  it('allows Store Manager operational CRM and gift code actions, but blocks customer data export', () => {
    const managerRole: StaffRole = 'store_manager';
    expect(canPerformAction(managerRole, 'view_customers')).toBe(true);
    expect(canPerformAction(managerRole, 'manage_customer_status')).toBe(true);
    expect(canPerformAction(managerRole, 'add_customer_note')).toBe(true);
    expect(canPerformAction(managerRole, 'view_gift_codes')).toBe(true);
    expect(canPerformAction(managerRole, 'manage_gift_codes')).toBe(true);
    expect(canPerformAction(managerRole, 'create_gift_code')).toBe(true);
    // Export restricted to Owner only
    expect(canPerformAction(managerRole, 'export_customers')).toBe(false);
  });

  it('strictly blocks Counter Staff from viewing customer CRM, internal notes, export, and gift code creation', () => {
    const staffRole: StaffRole = 'staff';
    expect(canPerformAction(staffRole, 'view_customers')).toBe(false);
    expect(canPerformAction(staffRole, 'manage_customer_status')).toBe(false);
    expect(canPerformAction(staffRole, 'add_customer_note')).toBe(false);
    expect(canPerformAction(staffRole, 'export_customers')).toBe(false);
    expect(canPerformAction(staffRole, 'view_gift_codes')).toBe(false);
    expect(canPerformAction(staffRole, 'manage_gift_codes')).toBe(false);
    expect(canPerformAction(staffRole, 'create_gift_code')).toBe(false);
  });
});

describe('10. Gift Code Redemption Concurrency Safety', () => {
  beforeEach(() => {
    storeDb.giftCodes = [];
    storeDb.giftCodeRedemptions = [];
    storeDb.orders = [];
  });

  it('guarantees atomic redemption under concurrent checkouts without negative balance or double deduction', async () => {
    // Gift Code = ₹1000 with maxRedemptions = 2 to allow multi-use
    const codeRes = createGiftCode({
      code: 'CONCURRENT1000',
      originalValue: 1000,
      maxRedemptions: 2,
      createdBy: 'owner-1',
      createdByName: 'Store Owner',
      actorRole: 'owner',
    });
    expect(codeRes.success).toBe(true);

    const product = TEST_DEMO_PRODUCTS[0]; // Price ₹599

    // Two simultaneous checkout requests:
    // Request A: 1 item = ₹599 (will deduct ₹599, leaving ₹401)
    // Request B: 1 item = ₹599 (can only deduct remaining ₹401, leaving ₹0)
    const reqA = createPickupOrder({
      customerName: 'Customer A',
      customerPhone: '9111111111',
      customerEmail: 'custA@example.com',
      customerId: 'cust-a',
      pickupMode: 'FLEXIBLE',
      items: [{ productId: product.id, quantity: 1 }],
      giftCode: 'CONCURRENT1000',
    });

    const reqB = createPickupOrder({
      customerName: 'Customer B',
      customerPhone: '9222222222',
      customerEmail: 'custB@example.com',
      customerId: 'cust-b',
      pickupMode: 'FLEXIBLE',
      items: [{ productId: product.id, quantity: 1 }],
      giftCode: 'CONCURRENT1000',
    });

    const [orderA, orderB] = await Promise.all([reqA, reqB]);

    const updatedCode = storeDb.giftCodes.find((g) => g.id === codeRes.giftCode!.id)!;

    // Total deductions must equal exact gift code balance ₹1000 (599 + 401)
    const totalDeducted = (orderA.giftCodeDiscount || 0) + (orderB.giftCodeDiscount || 0);
    expect(totalDeducted).toBe(1000);

    // Remaining value must be 0, never negative
    expect(updatedCode.remainingValue).toBe(0);
    expect(updatedCode.status).toBe('REDEEMED');

    // Redemptions count matches
    const redemptions = storeDb.giftCodeRedemptions.filter((r) => r.giftCodeId === updatedCode.id);
    expect(redemptions.length).toBe(2);
  });
});

describe('11. Gift Code Cancellation Restoration & Zero-Balance Reactivation', () => {
  beforeEach(() => {
    storeDb.giftCodes = [];
    storeDb.giftCodeRedemptions = [];
    storeDb.orders = [];
  });

  it('restores exact balance upon cancellation and creates REDEEMED and RESTORED audit events', async () => {
    // Create ₹1000 gift code
    const codeRes = createGiftCode({
      code: 'AUDITRESTORE1000',
      originalValue: 1000,
      createdBy: 'owner-1',
      createdByName: 'Store Owner',
      actorRole: 'owner',
    });

    const product = TEST_DEMO_PRODUCTS[0]; // Price ₹599

    // Order uses ₹599
    const order = await createPickupOrder({
      customerName: 'Cancel Test Customer',
      customerPhone: '9333333333',
      customerEmail: 'canceltest@example.com',
      customerId: 'cust-cancel-1',
      pickupMode: 'FLEXIBLE',
      items: [{ productId: product.id, quantity: 1 }],
      giftCode: 'AUDITRESTORE1000',
    });

    const codeAfterOrder = storeDb.giftCodes.find((g) => g.id === codeRes.giftCode!.id)!;
    expect(codeAfterOrder.remainingValue).toBe(1000 - 599);

    // Cancel order
    await transitionOrderStatus(order.id, 'CANCELLED', 'owner', 'staff-1', 'Order cancelled');

    const codeAfterCancel = storeDb.giftCodes.find((g) => g.id === codeRes.giftCode!.id)!;
    expect(codeAfterCancel.remainingValue).toBe(1000);
    expect(codeAfterCancel.status).toBe('ACTIVE');

    // Audit must show REDEEMED and RESTORED
    const history = getGiftCodeRedemptionHistory(codeRes.giftCode!.id);
    expect(history.some((h) => h.action === 'REDEEMED' && h.amountApplied === 599)).toBe(true);
    expect(history.some((h) => h.action === 'RESTORED' && h.amountApplied === 599)).toBe(true);
  });

  it('re-activates code from REDEEMED to ACTIVE when order is cancelled', async () => {
    // Create ₹599 gift code so 1 unit of product exhausts it completely
    const codeRes = createGiftCode({
      code: 'EXHAUST599',
      originalValue: 599,
      createdBy: 'owner-1',
      createdByName: 'Store Owner',
      actorRole: 'owner',
    });

    const product = TEST_DEMO_PRODUCTS[0]; // Price ₹599

    const order = await createPickupOrder({
      customerName: 'Exhaust Customer',
      customerPhone: '9444444444',
      customerEmail: 'exhaust@example.com',
      customerId: 'cust-exhaust-1',
      pickupMode: 'FLEXIBLE',
      items: [{ productId: product.id, quantity: 1 }],
      giftCode: 'EXHAUST599',
    });

    const codeAfterOrder = storeDb.giftCodes.find((g) => g.id === codeRes.giftCode!.id)!;
    expect(codeAfterOrder.remainingValue).toBe(0);
    expect(codeAfterOrder.status).toBe('REDEEMED');

    // Cancel order
    await transitionOrderStatus(order.id, 'CANCELLED', 'owner', 'staff-1', 'Order cancelled');

    const codeAfterCancel = storeDb.giftCodes.find((g) => g.id === codeRes.giftCode!.id)!;
    expect(codeAfterCancel.status).toBe('ACTIVE');
    expect(codeAfterCancel.remainingValue).toBe(599);
  });
});

describe('12. Gift Code Return / Refund Policy Enforcement', () => {
  beforeEach(() => {
    storeDb.giftCodes = [];
    storeDb.giftCodeRedemptions = [];
    storeDb.orders = [];
    storeDb.refundRecords = [];
  });

  it('enforces maximum cash refund capped at counter payment and restores gift code balance on return', async () => {
    // Product price = ₹599 * 5 = ₹2995
    const codeRes = createGiftCode({
      code: 'REFUNDSPLIT400',
      originalValue: 400,
      createdBy: 'owner-1',
      createdByName: 'Store Owner',
      actorRole: 'owner',
    });

    const product = TEST_DEMO_PRODUCTS[0];

    const order = await createPickupOrder({
      customerName: 'Split Refund Customer',
      customerPhone: '9555555555',
      customerEmail: 'splitrefund@example.com',
      customerId: 'cust-split-1',
      pickupMode: 'FLEXIBLE',
      items: [{ productId: product.id, quantity: 5 }],
      giftCode: 'REFUNDSPLIT400',
    });

    // Subtotal = 2995, GiftCode = 400, NetPayableAtCounter = 2595
    expect(order.subtotal).toBe(2995);
    expect(order.giftCodeDiscount).toBe(400);
    expect(order.netPayableAtCounter).toBe(2595);

    // Complete pickup
    await transitionOrderStatus(order.id, 'CONFIRMED', 'staff', 'staff-1');
    await transitionOrderStatus(order.id, 'PREPARING', 'staff', 'staff-1');
    await transitionOrderStatus(order.id, 'READY_FOR_PICKUP', 'staff', 'staff-1');
    await transitionOrderStatus(order.id, 'PICKED_UP', 'staff', 'staff-1');

    // Customer returns order. Attempting to refund ₹2995 in cash MUST be rejected!
    await expect(
      recordPhysicalRefund(
        order.id,
        undefined,
        2995,
        'cash',
        'RET-001',
        'Customer requested full refund in cash',
        'staff-1',
        'Store Staff'
      )
    ).rejects.toThrow(/cannot exceed the customer's actual counter payment/i);

    // Valid physical refund of ₹2595 succeeds
    const refund = await recordPhysicalRefund(
      order.id,
      undefined,
      2595,
      'cash',
      'RET-001',
      'Full return accepted',
      'staff-1',
      'Store Staff'
    );

    expect(refund.refundAmount).toBe(2595);

    // Remaining ₹400 is restored to the gift code
    const restoredCode = storeDb.giftCodes.find((g) => g.id === codeRes.giftCode!.id)!;
    expect(restoredCode.remainingValue).toBe(400);
    expect(restoredCode.status).toBe('ACTIVE');
  });
});

describe('13. Customer Privacy & Cross-Customer Data Isolation', () => {
  beforeEach(() => {
    storeDb.giftCodes = [];
    storeDb.customerNotes = [];
  });

  it('prevents Customer A from accessing Customer B gift codes or assigned vouchers', () => {
    // Create gift code assigned to Customer B
    createGiftCode({
      code: 'PRIVATEFORB500',
      originalValue: 500,
      customerId: 'user-b-uuid',
      customerName: 'Customer B',
      createdBy: 'owner-1',
      createdByName: 'Store Owner',
      actorRole: 'owner',
    });

    // Customer A queries their own gift codes
    const codesForA = getCustomerGiftCodes('user-a-uuid');
    expect(codesForA.length).toBe(0);

    // Customer B queries their own gift codes
    const codesForB = getCustomerGiftCodes('user-b-uuid');
    expect(codesForB.length).toBe(1);
    expect(codesForB[0].maskedCode).toBe('PRI***500');
    // codeHash should never be exposed to customer
    expect((codesForB[0] as unknown as Record<string, unknown>).codeHash).toBeUndefined();
  });
});

describe('14. Historical Snapshot Immutability', () => {
  beforeEach(() => {
    storeDb.orders = [];
    storeDb.giftCodes = [];
    storeDb.products = JSON.parse(JSON.stringify(TEST_DEMO_PRODUCTS));
  });

  it('preserves historical order prices when product catalog price changes', async () => {
    const product = storeDb.products[0];
    const originalPrice = product.price;

    const order = await createPickupOrder({
      customerName: 'Snapshot Customer',
      customerPhone: '9666666666',
      customerEmail: 'snapshot@example.com',
      customerId: 'cust-snapshot-1',
      pickupMode: 'FLEXIBLE',
      items: [{ productId: product.id, quantity: 1 }],
    });

    expect(order.items[0].unitPrice).toBe(originalPrice);

    // Modify product price in catalog
    product.price = originalPrice + 500;

    // Order snapshot remains intact
    const fetchedOrder = storeDb.orders.find((o) => o.id === order.id)!;
    expect(fetchedOrder.items[0].unitPrice).toBe(originalPrice);
  });

  it('preserves historical customer information on order when profile is updated', async () => {
    customerStore.completeProfile('original@example.com', {
      userId: 'user-hist-1',
      fullName: 'Original Name',
      phone: '9000000001',
      address: 'Station Road',
    });

    const order = await createPickupOrder({
      customerName: 'Original Name',
      customerPhone: '9000000001',
      customerEmail: 'original@example.com',
      customerId: 'user-hist-1',
      pickupMode: 'FLEXIBLE',
      items: [{ productId: storeDb.products[0].id, quantity: 1 }],
    });

    // Customer updates profile later
    customerStore.completeProfile('original@example.com', {
      userId: 'user-hist-1',
      fullName: 'New Updated Name',
      phone: '9000000009',
      address: 'Main Market',
    });

    // Historical order continues to reflect the name at time of order
    const fetchedOrder = storeDb.orders.find((o) => o.id === order.id)!;
    expect(fetchedOrder.customerName).toBe('Original Name');
  });
});

describe('15. Idempotent Gift Code Redemption with Idempotency Key', () => {
  beforeEach(() => {
    storeDb.giftCodes = [];
    storeDb.giftCodeRedemptions = [];
  });

  it('guarantees identical return and no duplicate financial deduction when redemption is replayed with same key', () => {
    const codeRes = createGiftCode({
      code: 'IDEMP-1000',
      originalValue: 1000,
      createdBy: 'owner-1',
      createdByName: 'Owner',
      actorRole: 'owner',
    });
    expect(codeRes.success).toBe(true);
    const rawCode = codeRes.rawCode!;
    const codeHash = codeRes.giftCode!.codeHash;

    const idempotencyKey = 'order-req-unique-9988';

    // First redemption call: 600
    const res1 = redeemGiftCodeAtomic({
      code: rawCode,
      orderId: 'order-101',
      orderNumber: 'ORD-101',
      customerId: 'cust-idemp-1',
      customerName: 'Idemp Cust',
      requestedAmount: 600,
      actorId: 'owner-1',
      actorRole: 'owner',
      idempotencyKey,
    });
    expect(res1.success).toBe(true);
    expect(res1.amountApplied).toBe(600);

    const giftCodeAfterFirst = storeDb.giftCodes.find((g) => g.codeHash === codeHash)!;
    expect(giftCodeAfterFirst.remainingValue).toBe(400);
    expect(storeDb.giftCodeRedemptions).toHaveLength(1);

    // Second redemption call with EXACT SAME idempotencyKey
    const res2 = redeemGiftCodeAtomic({
      code: rawCode,
      orderId: 'order-101',
      orderNumber: 'ORD-101',
      customerId: 'cust-idemp-1',
      customerName: 'Idemp Cust',
      requestedAmount: 600,
      actorId: 'owner-1',
      actorRole: 'owner',
      idempotencyKey,
    });
    expect(res2.success).toBe(true);
    expect(res2.amountApplied).toBe(600);
    expect(res2.idempotent).toBe(true);

    // CRITICAL: Balance must NOT be deducted twice, remainingValue remains 400, no duplicate redemptions in ledger
    const giftCodeAfterSecond = storeDb.giftCodes.find((g) => g.codeHash === codeHash)!;
    expect(giftCodeAfterSecond.remainingValue).toBe(400);
    expect(storeDb.giftCodeRedemptions).toHaveLength(1);
  });
});

describe('16. Idempotent Cancellation Restoration', () => {
  beforeEach(() => {
    storeDb.giftCodes = [];
    storeDb.giftCodeRedemptions = [];
  });

  it('never restores balance more than once when cancellation hook is triggered multiple times', () => {
    const codeRes = createGiftCode({
      code: 'CANCEL-RESTORE-500',
      originalValue: 500,
      createdBy: 'owner-1',
      createdByName: 'Owner',
      actorRole: 'owner',
    });
    const rawCode = codeRes.rawCode!;
    const codeHash = codeRes.giftCode!.codeHash;

    // Redeem 300
    const redeemRes = redeemGiftCodeAtomic({
      code: rawCode,
      orderId: 'ord-cancel-1',
      orderNumber: 'ORD-CANCEL-1',
      customerId: 'cust-cancel-1',
      requestedAmount: 300,
      actorId: 'owner-1',
      actorRole: 'owner',
      idempotencyKey: 'idem-cancel-1',
    });
    expect(redeemRes.success).toBe(true);
    expect(storeDb.giftCodes.find((g) => g.codeHash === codeHash)!.remainingValue).toBe(200);

    // 1st Cancellation event: restores 300
    const cancelRes1 = restoreGiftCodeOnCancellation({
      orderId: 'ord-cancel-1',
      orderNumber: 'ORD-CANCEL-1',
      actorId: 'owner-1',
      actorRole: 'owner',
    });
    expect(cancelRes1.success).toBe(true);
    expect(cancelRes1.amountRestored).toBe(300);
    expect(storeDb.giftCodes.find((g) => g.codeHash === codeHash)!.remainingValue).toBe(500);

    // 2nd Cancellation event (replay / duplicate webhook / retry)
    const cancelRes2 = restoreGiftCodeOnCancellation({
      orderId: 'ord-cancel-1',
      orderNumber: 'ORD-CANCEL-1',
      actorId: 'owner-1',
      actorRole: 'owner',
    });
    expect(cancelRes2.success).toBe(true);
    expect(cancelRes2.amountRestored).toBe(0); // Idempotent: 0 restored
    expect(cancelRes2.idempotent).toBe(true);

    // Balance must STILL be 500, not 800!
    expect(storeDb.giftCodes.find((g) => g.codeHash === codeHash)!.remainingValue).toBe(500);
  });
});

describe('17. Idempotent Physical Refund Processing', () => {
  beforeEach(() => {
    storeDb.giftCodes = [];
    storeDb.giftCodeRedemptions = [];
    storeDb.refundRecords = [];
    storeDb.orders = [];
  });

  it('returns existing refund record without duplicate cash or gift restoration when called with same receipt number or key', async () => {
    // 1. Create product and order with 200 gift code + 800 cash
    const codeRes = createGiftCode({
      code: 'REFUND-GIFT-500',
      originalValue: 500,
      createdBy: 'owner-1',
      createdByName: 'Owner',
      actorRole: 'owner',
    });
    const rawCode = codeRes.rawCode!;
    const codeHash = codeRes.giftCode!.codeHash;

    const product = storeDb.products[0];
    product.stockQuantity = 50;
    product.reservedStock = 0;
    product.price = 1000;

    const order = await createPickupOrder({
      customerName: 'Refund Customer',
      customerPhone: '9888888888',
      customerEmail: 'refund@example.com',
      customerId: 'user-refund-1',
      pickupMode: 'FLEXIBLE',
      items: [{ productId: product.id, quantity: 1 }],
      giftCode: rawCode,
    });

    expect(order.giftCodeDiscount).toBe(500); // 500 gift code fully applied against 1000
    expect(storeDb.giftCodes.find((g) => g.codeHash === codeHash)!.remainingValue).toBe(0);

    // Complete order so it is picked up and refundable
    order.status = 'PICKED_UP';

    // 1st Refund call (order.netPayableAtCounter is 500)
    const refund1 = await recordPhysicalRefund(
      order.id,
      undefined,
      500,
      'cash',
      'REF-RECEIPT-2026-001',
      'Damaged packaging',
      'staff-owner',
      'Store Owner',
      'idemp-refund-tx-12345'
    );
    expect(refund1.refundAmount).toBe(500);
    expect(storeDb.refundRecords).toHaveLength(1);
    expect(storeDb.giftCodes.find((g) => g.codeHash === codeHash)!.remainingValue).toBe(500); // Restored back to 500

    // 2nd Refund call with same receiptNumber and idempotencyKey
    const refund2 = await recordPhysicalRefund(
      order.id,
      undefined,
      500,
      'cash',
      'REF-RECEIPT-2026-001',
      'Damaged packaging',
      'staff-owner',
      'Store Owner',
      'idemp-refund-tx-12345'
    );
    expect(refund2.id).toBe(refund1.id); // Returns same record
    expect(storeDb.refundRecords).toHaveLength(1); // No duplicate ledger entry

    // CRITICAL: Gift code must NOT be restored a second time (must remain 500, not 1000)
    expect(storeDb.giftCodes.find((g) => g.codeHash === codeHash)!.remainingValue).toBe(500);
  });
});

describe('18. Multi-Item Inventory Reservation Atomic Rollback', () => {
  beforeEach(() => {
    storeDb.orders = [];
    storeDb.inventoryMovements = [];
  });

  it('atomically rolls back all previously reserved items in an order if any subsequent item exceeds available stock', async () => {
    const prodA = storeDb.products[0];
    const prodB = storeDb.products[1];

    prodA.stockQuantity = 10;
    prodA.reservedStock = 0;
    prodB.stockQuantity = 1; // Only 1 available
    prodB.reservedStock = 0;

    // Attempt an order reserving 2 of prodA and 5 of prodB (prodB fails!)
    await expect(
      createPickupOrder({
        customerName: 'Fail Buyer',
        customerPhone: '9777777777',
        customerEmail: 'failbuyer@example.com',
        customerId: 'cust-fail-1',
        pickupMode: 'FLEXIBLE',
        items: [
          { productId: prodA.id, quantity: 2 },
          { productId: prodB.id, quantity: 5 }, // Will fail because stockQuantity (1) < 5
        ],
      })
    ).rejects.toThrow();

    // Verify Prod A was ROLLED BACK and not partially reserved!
    expect(prodA.stockQuantity).toBe(10);
    expect(prodA.reservedStock).toBe(0);

    // Verify Prod B remains untouched
    expect(prodB.stockQuantity).toBe(1);
    expect(prodB.reservedStock).toBe(0);
  });
});

describe('19. Multi-Instance Simulated Concurrency Test (Database-Safe CAS Invariant)', () => {
  beforeEach(() => {
    storeDb.giftCodes = [];
    storeDb.giftCodeRedemptions = [];
  });

  it('guarantees remaining_value >= 0 and never allows double deduction under simultaneous competing requests', async () => {
    // 1000 balance with maxRedemptions = 2
    const codeRes = createGiftCode({
      code: 'CONCURRENT-1000',
      originalValue: 1000,
      maxRedemptions: 2,
      createdBy: 'owner-1',
      createdByName: 'Owner',
      actorRole: 'owner',
    });
    const rawCode = codeRes.rawCode!;
    const codeHash = codeRes.giftCode!.codeHash;

    // Simulate two separate processes (Instance A and Instance B) attempting to redeem 700 simultaneously
    // Each request executes redeemGiftCodeAtomic concurrently
    const [resultA, resultB] = await Promise.all([
      new Promise<{ success: boolean; error?: string; remainingValue?: number }>((resolve) => {
        setTimeout(() => {
          const res = redeemGiftCodeAtomic({
            code: rawCode,
            orderId: 'ord-a',
            orderNumber: 'ORD-A',
            customerId: 'cust-a',
            requestedAmount: 700,
            actorId: 'owner-1',
            actorRole: 'owner',
            idempotencyKey: 'req-a-700',
          });
          resolve({ success: res.success, error: res.error, remainingValue: res.giftCode?.remainingValue });
        }, 5);
      }),
      new Promise<{ success: boolean; error?: string; remainingValue?: number }>((resolve) => {
        setTimeout(() => {
          const res = redeemGiftCodeAtomic({
            code: rawCode,
            orderId: 'ord-b',
            orderNumber: 'ORD-B',
            customerId: 'cust-b',
            requestedAmount: 700,
            actorId: 'owner-1',
            actorRole: 'owner',
            idempotencyKey: 'req-b-700',
          });
          resolve({ success: res.success, error: res.error, remainingValue: res.giftCode?.remainingValue });
        }, 5);
      }),
    ]);

    // Exactly one will deduct 700 (leaving 300).
    // The other request requests 700, but only 300 remains.
    // Since amountApplied = Math.min(requested, remainingValue), the second request can apply 300, leaving 0.
    // In ALL cases, total deduction must equal 1000 and remainingValue must NEVER be negative!
    const totalDeducted = storeDb.giftCodeRedemptions.reduce((acc, r) => acc + r.amountApplied, 0);
    expect(totalDeducted).toBe(1000);

    const finalCode = storeDb.giftCodes.find((g) => g.codeHash === codeHash)!;
    expect(finalCode.remainingValue).toBe(0);
    expect(finalCode.remainingValue).toBeGreaterThanOrEqual(0);
    expect(finalCode.status).toBe('REDEEMED');

    // Both instances succeeded in spending the available pool without double-counting
    expect(storeDb.giftCodeRedemptions).toHaveLength(2);
  });
});

