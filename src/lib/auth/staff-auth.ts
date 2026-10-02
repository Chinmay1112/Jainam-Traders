import 'server-only';
import crypto from 'crypto';
import { UserRole } from '@/lib/types';
import { StaffRole, StaffSession, StaffAction, canPerformAction } from './staff-roles';

export { type StaffRole, type StaffSession, type StaffAction, canPerformAction };

// ==============================================================================
// JAINAM TRADERS - PRODUCTION STAFF AUTHENTICATION & RBAC ENGINE (SERVER-ONLY)
// Provides secure PBKDF2 password hashing, cryptographically signed HTTP-only
// session tokens, and strict server-side role validation.
// ==============================================================================

export interface StaffAccount {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: StaffRole;
  phone?: string;
  avatarUrl?: string;
  passwordHash: string;
  salt: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

// Secret used for HMAC-SHA256 session signature
function getSessionSecret(): string {
  const secret = process.env.ADMIN_BOOTSTRAP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    return 'jt_admin_bootstrap_secret_vault_2026';
  }
  return secret;
}

const SESSION_DURATION_HOURS = 12;

// Password hashing using PBKDF2 (SHA-512, 100,000 iterations)
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const chosenSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, chosenSalt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt: chosenSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const calculated = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(calculated, 'hex'), Buffer.from(hash, 'hex'));
}

function getInitialStaffPassword(role: 'admin' | 'manager' | 'staff', envVal?: string): string {
  const val = envVal || process.env[`${role.toUpperCase()}_INITIAL_PASSWORD`];
  if (val && val.trim().length > 0) {
    return val.trim();
  }
  if (role === 'admin') return 'Admin@2005';
  if (role === 'manager') return 'Manager@2005';
  if (role === 'staff') return 'Staff@2005';
  return 'JainamStore#2026';
}

// In-memory staff repository initialized with secure hashed credentials
class StaffStore {
  private accounts: Map<string, StaffAccount> = new Map();

  constructor() {
    this.seedAccounts();
  }

  private seedAccounts() {
    // Initial Owner Account
    const ownerInitialPassword = getInitialStaffPassword('admin', process.env.ADMIN_INITIAL_PASSWORD);
    const ownerEmail = process.env.ADMIN_INITIAL_EMAIL || 'admin@jainamtraders.com';
    const ownerHash = hashPassword(ownerInitialPassword);
    this.accounts.set(ownerEmail.toLowerCase(), {
      id: 'staff-owner-001',
      email: ownerEmail.toLowerCase(),
      username: 'admin',
      fullName: 'Jainam Store Owner',
      role: 'owner',
      passwordHash: ownerHash.hash,
      salt: ownerHash.salt,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    // Initial Store Manager Account
    const managerInitialPassword = getInitialStaffPassword('manager', process.env.MANAGER_INITIAL_PASSWORD);
    const managerEmail = process.env.MANAGER_INITIAL_EMAIL || 'manager@jainamtraders.com';
    const managerHash = hashPassword(managerInitialPassword);
    this.accounts.set(managerEmail.toLowerCase(), {
      id: 'staff-manager-001',
      email: managerEmail.toLowerCase(),
      username: 'manager',
      fullName: 'Suresh Mehta (Store Manager)',
      role: 'store_manager',
      passwordHash: managerHash.hash,
      salt: managerHash.salt,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    // Initial Counter Staff Account
    const counterInitialPassword = getInitialStaffPassword(
      'staff',
      process.env.STAFF_INITIAL_PASSWORD || process.env.COUNTER_INITIAL_PASSWORD
    );
    const counterEmail = process.env.STAFF_INITIAL_EMAIL || 'staff@jainamtraders.com';
    const counterHash = hashPassword(counterInitialPassword);
    this.accounts.set(counterEmail.toLowerCase(), {
      id: 'staff-counter-001',
      email: counterEmail.toLowerCase(),
      username: 'staff',
      fullName: 'Kavita Patel (Counter Staff)',
      role: 'staff',
      passwordHash: counterHash.hash,
      salt: counterHash.salt,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  }

  public findByEmailOrUsername(identifier: string): StaffAccount | null {
    const term = identifier.toLowerCase().trim();
    for (const acc of this.accounts.values()) {
      if (acc.email.toLowerCase() === term || acc.username.toLowerCase() === term) {
        return acc;
      }
    }
    return null;
  }

  public findById(id: string): StaffAccount | null {
    for (const acc of this.accounts.values()) {
      if (acc.id === id) return acc;
    }
    return null;
  }

  public updateLastLogin(id: string) {
    const acc = this.findById(id);
    if (acc) {
      acc.lastLoginAt = new Date().toISOString();
    }
  }

  public getAllStaffSafe(): Array<Omit<StaffAccount, 'passwordHash' | 'salt'>> {
    return Array.from(this.accounts.values()).map(
      ({ passwordHash, salt, ...safe }) => safe
    );
  }

  public createStaffAccount(account: {
    email: string;
    username: string;
    fullName: string;
    role: StaffRole;
    passwordPlain: string;
  }): Omit<StaffAccount, 'passwordHash' | 'salt'> {
    const existing = this.findByEmailOrUsername(account.email);
    if (existing) throw new Error('Staff email or username already in use');

    const { hash, salt } = hashPassword(account.passwordPlain);
    const newStaff: StaffAccount = {
      id: `staff-${account.role}-${Date.now().toString(36)}`,
      email: account.email.toLowerCase().trim(),
      username: account.username.toLowerCase().trim(),
      fullName: account.fullName.trim(),
      role: account.role,
      passwordHash: hash,
      salt,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    this.accounts.set(newStaff.email, newStaff);
    const { passwordHash: _, salt: __, ...safe } = newStaff;
    return safe;
  }

  public updateProfile(
    id: string,
    updates: {
      fullName?: string;
      phone?: string;
      avatarUrl?: string;
    }
  ): StaffAccount | null {
    const acc = this.findById(id);
    if (!acc) return null;
    if (updates.fullName !== undefined && updates.fullName.trim()) {
      acc.fullName = updates.fullName.trim();
    }
    if (updates.phone !== undefined) {
      acc.phone = updates.phone.trim();
    }
    if (updates.avatarUrl !== undefined) {
      acc.avatarUrl = updates.avatarUrl;
    }
    return acc;
  }
}

// Global singleton to preserve state across warm server requests in memory
const globalStaff = global as unknown as { __jtStaffStore?: StaffStore };
export const staffStore = globalStaff.__jtStaffStore || new StaffStore();
if (process.env.NODE_ENV !== 'production') {
  globalStaff.__jtStaffStore = staffStore;
}

// Session Token Generation & Verification using signed Base64 JSON
export function createStaffToken(account: StaffAccount): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: StaffSession = {
    staffId: account.id,
    email: account.email,
    fullName: account.fullName,
    role: account.role,
    phone: account.phone,
    avatarUrl: account.avatarUrl,
    iat: now,
    exp: now + SESSION_DURATION_HOURS * 3600,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

export function verifyStaffToken(token: string | null | undefined): StaffSession | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadBase64, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadBase64)
    .digest('base64url');

  try {
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSig, 'utf8')
    );
    if (!isMatch) return null;

    const payload: StaffSession = JSON.parse(
      Buffer.from(payloadBase64, 'base64url').toString('utf8')
    );

    // Verify expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    // Verify active account
    const acc = staffStore.findById(payload.staffId);
    if (!acc || !acc.isActive) return null;

    return payload;
  } catch {
    return null;
  }
}

export const signStaffToken = (account: {
  id: string;
  email: string;
  name?: string;
  role: StaffRole;
  phone?: string;
  avatarUrl?: string;
}): string => {
  return createStaffToken({
    id: account.id,
    email: account.email,
    username: account.email.split('@')[0],
    fullName: account.name || 'Staff User',
    role: account.role,
    phone: account.phone,
    avatarUrl: account.avatarUrl,
    passwordHash: '',
    salt: '',
    isActive: true,
    createdAt: new Date().toISOString(),
  });
};

export function isStaffEmail(identifier: string): boolean {
  if (!identifier || typeof identifier !== 'string') return false;
  return staffStore.findByEmailOrUsername(identifier.toLowerCase().trim()) !== null;
}

export async function authenticateStaff(identifier: string, passwordPlain: string): Promise<StaffSession | null> {
  const acc = staffStore.findByEmailOrUsername(identifier);
  if (!acc || !acc.isActive) return null;
  const isMatch = verifyPassword(passwordPlain, acc.passwordHash, acc.salt);
  if (!isMatch) return null;

  staffStore.updateLastLogin(acc.id);
  const token = createStaffToken(acc);
  return verifyStaffToken(token);
}
