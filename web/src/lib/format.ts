import { format as formatDate } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const INR_DECIMAL = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(paise: number | null | undefined, options: { showPaise?: boolean } = {}): string {
  if (paise == null) return '—';
  const rupees = paise / 100;
  return options.showPaise ? INR_DECIMAL.format(rupees) : INR.format(rupees);
}

export function formatIstDate(iso: string | Date | null, pattern = 'd MMM yyyy'): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return formatInTimeZone(d, 'Asia/Kolkata', pattern);
}

export function formatIstDateTime(iso: string | Date | null, pattern = 'd MMM yyyy, h:mm a'): string {
  return formatIstDate(iso, pattern);
}

export function formatRelative(iso: string | Date | null): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const now = Date.now();
  const diff = Math.round((d.getTime() - now) / 1000);
  const abs = Math.abs(diff);
  if (abs < 60) return diff < 0 ? 'just now' : 'shortly';
  if (abs < 3600) return `${Math.round(abs / 60)} min ${diff < 0 ? 'ago' : 'away'}`;
  if (abs < 86_400) return `${Math.round(abs / 3600)} h ${diff < 0 ? 'ago' : 'away'}`;
  return formatDate(d, 'd MMM');
}
