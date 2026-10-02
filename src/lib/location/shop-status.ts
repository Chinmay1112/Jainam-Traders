import { CANONICAL_SHOP_CONFIG } from '@/lib/config/shop-config';
import { ShopSettings } from '@/lib/types';

export interface ShopOpenStatus {
  isOpen: boolean;
  statusBadge: string; // "Open now" | "Closed" | "Closed today"
  detailText: string;  // "Closes at 9:30 PM" | "Opens tomorrow at 7:30 AM" | "Opens Monday at 7:30 AM"
  fullStatus: string;  // "Open now • Closes at 9:30 PM"
}

export function formatTime12h(timeStr: string): string {
  if (!timeStr || !timeStr.includes(':')) return timeStr;
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minuteStr = m < 10 ? `0${m}` : `${m}`;
  return `${hour12}:${minuteStr} ${period}`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Calculates whether the store is currently OPEN or CLOSED
 * respecting store opening/closing times and Asia/Kolkata timezone.
 */
export function getStoreLiveStatus(
  settings?: Partial<ShopSettings> | null,
  referenceDate: Date = new Date()
): ShopOpenStatus {
  const openingTime = settings?.openingTime || CANONICAL_SHOP_CONFIG.openingTime || '07:30';
  const closingTime = settings?.closingTime || CANONICAL_SHOP_CONFIG.closingTime || '21:30';
  const weeklyClosedDays = settings?.weeklyClosedDays || CANONICAL_SHOP_CONFIG.weeklyClosedDays || ['Sunday'];

  // Calculate live date components in Asia/Kolkata timezone
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(referenceDate);

  let weekday = '';
  let hour = 0;
  let minute = 0;

  for (const part of parts) {
    if (part.type === 'weekday') weekday = part.value;
    if (part.type === 'hour') hour = parseInt(part.value, 10);
    if (part.type === 'minute') minute = parseInt(part.value, 10);
  }

  const [openHour, openMin] = openingTime.split(':').map((v) => parseInt(v, 10));
  const [closeHour, closeMin] = closingTime.split(':').map((v) => parseInt(v, 10));

  const currentMinutes = hour * 60 + minute;
  const openMinutes = openHour * 60 + (openMin || 0);
  const closeMinutes = closeHour * 60 + (closeMin || 0);

  const isClosedToday = weeklyClosedDays.includes(weekday);

  // Helper to find next open day
  const findNextOpenDay = (fromDayIndex: number): string => {
    for (let offset = 1; offset <= 7; offset++) {
      const nextIndex = (fromDayIndex + offset) % 7;
      const nextDayName = DAY_NAMES[nextIndex];
      if (!weeklyClosedDays.includes(nextDayName)) {
        return offset === 1 ? 'tomorrow' : nextDayName;
      }
    }
    return 'tomorrow';
  };

  const currentDayIndex = DAY_NAMES.indexOf(weekday);
  const formattedOpen = formatTime12h(openingTime);
  const formattedClose = formatTime12h(closingTime);

  if (isClosedToday) {
    const nextDay = findNextOpenDay(currentDayIndex);
    const detail = nextDay === 'tomorrow'
      ? `Opens tomorrow at ${formattedOpen}`
      : `Opens ${nextDay} at ${formattedOpen}`;
    return {
      isOpen: false,
      statusBadge: 'Closed today',
      detailText: detail,
      fullStatus: `Closed today • ${detail}`,
    };
  }

  // Before store opens today
  if (currentMinutes < openMinutes) {
    return {
      isOpen: false,
      statusBadge: 'Closed',
      detailText: `Opens today at ${formattedOpen}`,
      fullStatus: `Closed • Opens today at ${formattedOpen}`,
    };
  }

  // During store open hours
  if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
    return {
      isOpen: true,
      statusBadge: 'Open now',
      detailText: `Closes at ${formattedClose}`,
      fullStatus: `Open now • Closes at ${formattedClose}`,
    };
  }

  // After store closes today
  const nextDay = findNextOpenDay(currentDayIndex);
  const detail = nextDay === 'tomorrow'
    ? `Opens tomorrow at ${formattedOpen}`
    : `Opens ${nextDay} at ${formattedOpen}`;

  return {
    isOpen: false,
    statusBadge: 'Closed',
    detailText: detail,
    fullStatus: `Closed • ${detail}`,
  };
}
