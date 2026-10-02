import { OrderStatus, UserRole } from '@/lib/types';

export interface TransitionRule {
  allowedTo: OrderStatus[];
  allowedRoles: UserRole[];
  description: string;
}

export const ORDER_TRANSITIONS: Record<OrderStatus, TransitionRule> = {
  PENDING: {
    allowedTo: ['CONFIRMED', 'CANCELLED', 'EXPIRED'],
    allowedRoles: ['owner', 'admin', 'store_manager', 'staff', 'customer'],
    description: 'Order placed by customer, awaiting store confirmation.',
  },
  CONFIRMED: {
    allowedTo: ['PREPARING', 'CANCELLED', 'EXPIRED'],
    allowedRoles: ['owner', 'admin', 'store_manager', 'staff'],
    description: 'Store confirmed order. Staff begins packing and preparing items.',
  },
  PREPARING: {
    allowedTo: ['READY_FOR_PICKUP', 'CANCELLED', 'EXPIRED'],
    allowedRoles: ['owner', 'admin', 'store_manager', 'staff'],
    description: 'Items are packaged and labeled at the pickup counter.',
  },
  READY_FOR_PICKUP: {
    allowedTo: ['PICKED_UP', 'CANCELLED', 'EXPIRED'],
    allowedRoles: ['owner', 'admin', 'store_manager', 'staff'],
    description: 'Customer notified to collect order from shop. Ready at counter.',
  },
  PICKED_UP: {
    allowedTo: ['RETURN_REQUESTED'],
    allowedRoles: ['customer', 'owner', 'admin', 'store_manager'],
    description: 'Customer visited shop, inspected items, paid at counter, and collected order.',
  },
  CANCELLED: {
    allowedTo: [],
    allowedRoles: [],
    description: 'Order cancelled and reserved inventory released back to shelf.',
  },
  EXPIRED: {
    allowedTo: [],
    allowedRoles: [],
    description: 'Order reservation expired because pickup deadline elapsed. Reserved inventory released back to shelf.',
  },
  RETURN_REQUESTED: {
    allowedTo: ['RETURN_APPROVED', 'RETURN_REJECTED'],
    allowedRoles: ['owner', 'admin', 'store_manager'],
    description: 'Customer submitted a return request for inspected pickup items.',
  },
  RETURN_APPROVED: {
    allowedTo: ['RETURNED', 'RETURN_REJECTED'],
    allowedRoles: ['owner', 'admin', 'store_manager'],
    description: 'Store approved return. Customer invited to bring item to shop.',
  },
  RETURN_REJECTED: {
    allowedTo: [],
    allowedRoles: [],
    description: 'Return request rejected based on store policy inspection.',
  },
  RETURNED: {
    allowedTo: ['REFUND_RECORDED'],
    allowedRoles: ['owner', 'admin', 'store_manager'],
    description: 'Item physically received and inspected at Jainam Traders shop counter.',
  },
  REFUND_RECORDED: {
    allowedTo: [],
    allowedRoles: [],
    description: 'Physical refund (Cash/UPI) disbursed and receipt recorded in system ledger.',
  },
};

/**
 * Validates if an order transition from currentStatus to nextStatus is allowed for the user's role.
 */
export function canTransitionOrder(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
  userRole: UserRole
): { allowed: boolean; reason?: string } {
  const rule = ORDER_TRANSITIONS[currentStatus];
  if (!rule) {
    return { allowed: false, reason: `Unknown order status: ${currentStatus}` };
  }

  if (!rule.allowedTo.includes(nextStatus)) {
    return {
      allowed: false,
      reason: `Illegal state transition from ${currentStatus} to ${nextStatus}. Allowed destinations: [${rule.allowedTo.join(', ')}]`,
    };
  }

  // Customer cancellation rule: only allowed while in PENDING or CONFIRMED before preparation
  if (userRole === 'customer' && nextStatus === 'CANCELLED') {
    if (currentStatus !== 'PENDING' && currentStatus !== 'CONFIRMED') {
      return {
        allowed: false,
        reason: 'Orders that are already preparing or ready cannot be self-cancelled. Please contact store.',
      };
    }
    return { allowed: true };
  }

  if (!rule.allowedRoles.includes(userRole) && userRole !== 'owner' && userRole !== 'admin') {
    return {
      allowed: false,
      reason: `User with role ${userRole} is not authorized to transition order to ${nextStatus}`,
    };
  }

  return { allowed: true };
}

/**
 * Human-friendly status labels and colors
 */
export function getStatusBadgeInfo(status: OrderStatus): {
  label: string;
  bgClass: string;
  textClass: string;
  stepIndex: number;
} {
  switch (status) {
    case 'PENDING':
      return { label: 'Order Received', bgClass: 'bg-amber-50 border-amber-200', textClass: 'text-amber-800', stepIndex: 0 };
    case 'CONFIRMED':
      return { label: 'Confirmed by Shop', bgClass: 'bg-blue-50 border-blue-200', textClass: 'text-blue-800', stepIndex: 1 };
    case 'PREPARING':
      return { label: 'Preparing Items', bgClass: 'bg-indigo-50 border-indigo-200', textClass: 'text-indigo-800', stepIndex: 2 };
    case 'READY_FOR_PICKUP':
      return { label: 'Ready for Pickup', bgClass: 'bg-emerald-50 border-emerald-300', textClass: 'text-emerald-800 font-semibold', stepIndex: 3 };
    case 'PICKED_UP':
      return { label: 'Picked Up & Paid', bgClass: 'bg-emerald-100 border-emerald-400', textClass: 'text-emerald-900 font-semibold', stepIndex: 4 };
    case 'CANCELLED':
      return { label: 'Cancelled', bgClass: 'bg-rose-50 border-rose-200', textClass: 'text-rose-800', stepIndex: -1 };
    case 'RETURN_REQUESTED':
      return { label: 'Return Requested', bgClass: 'bg-purple-50 border-purple-200', textClass: 'text-purple-800', stepIndex: 5 };
    case 'RETURN_APPROVED':
      return { label: 'Return Approved', bgClass: 'bg-teal-50 border-teal-200', textClass: 'text-teal-800', stepIndex: 6 };
    case 'RETURN_REJECTED':
      return { label: 'Return Rejected', bgClass: 'bg-gray-100 border-gray-300', textClass: 'text-gray-700', stepIndex: -1 };
    case 'RETURNED':
      return { label: 'Item Returned at Shop', bgClass: 'bg-blue-50 border-blue-300', textClass: 'text-blue-800', stepIndex: 7 };
    case 'REFUND_RECORDED':
      return { label: 'Refund Recorded', bgClass: 'bg-emerald-50 border-emerald-300', textClass: 'text-emerald-800', stepIndex: 8 };
    default:
      return { label: status, bgClass: 'bg-gray-100', textClass: 'text-gray-800', stepIndex: 0 };
  }
}
