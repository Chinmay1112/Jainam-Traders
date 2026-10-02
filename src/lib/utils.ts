import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateString;
  }
}

export { getShopDirectionsUrl } from '@/lib/location/directions';
export { getStoreLiveStatus, formatTime12h, type ShopOpenStatus } from '@/lib/location/shop-status';
import { getStoreLiveStatus } from '@/lib/location/shop-status';

/**
 * Calculates whether the physical store is currently OPEN or CLOSED
 * based on live system time in Asia/Kolkata and configured shop hours.
 */
export function isStoreCurrentlyOpen(
  openingTime: string = '07:30',
  closingTime: string = '21:30',
  weeklyClosedDays: string[] = ['Sunday']
): { isOpen: boolean; message: string } {
  const status = getStoreLiveStatus({
    openingTime,
    closingTime,
    weeklyClosedDays,
  });
  return {
    isOpen: status.isOpen,
    message: status.fullStatus,
  };
}
