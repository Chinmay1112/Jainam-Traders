// ==============================================================================
// JAINAM TRADERS - CLIENT-SAFE STAFF ROLES & PERMISSIONS
// Contains ONLY client-safe types and pure permission evaluation logic.
// ZERO secrets, ZERO crypto, ZERO process.env, ZERO database access, ZERO passwords.
// Safe for import by both Client Components and Server Components.
// ==============================================================================

export type StaffRole = 'owner' | 'store_manager' | 'staff';

export interface StaffSession {
  staffId: string;
  email: string;
  fullName: string;
  role: StaffRole;
  iat: number;
  exp: number;
}

export type StaffAction =
  | 'manage_settings'
  | 'manage_staff'
  | 'manage_products'
  | 'edit_products'
  | 'change_prices'
  | 'edit_price'
  | 'adjust_inventory'
  | 'view_orders'
  | 'process_order_pickup'
  | 'update_order_status'
  | 'verify_pickup'
  | 'approve_return'
  | 'manage_returns'
  | 'record_refund'
  | 'view_full_analytics'
  | 'view_audit_logs'
  | 'view_customers'
  | 'manage_customer_status'
  | 'add_customer_note'
  | 'export_customers'
  | 'view_gift_codes'
  | 'manage_gift_codes'
  | 'create_gift_code';

/**
 * Pure client-safe role permissions matrix
 */
export function canPerformAction(role: StaffRole, action: StaffAction): boolean {
  switch (role) {
    case 'owner':
      return true; // Owner has unrestricted access

    case 'store_manager':
      return (
        action !== 'manage_settings' &&
        action !== 'manage_staff' &&
        action !== 'change_prices' &&
        action !== 'edit_price' &&
        action !== 'view_audit_logs' &&
        action !== 'export_customers'
      );

    case 'staff': // Counter Staff
      return (
        action === 'view_orders' ||
        action === 'process_order_pickup' ||
        action === 'update_order_status' ||
        action === 'verify_pickup'
      );

    default:
      return false;
  }
}
