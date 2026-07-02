import { format } from 'date-fns';

/** Returns date as dd/MM/yyyy */
export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  try {
    return format(new Date(d), 'dd/MM/yyyy');
  } catch {
    return '—';
  }
}

/** Returns date + time as dd/MM/yyyy HH:mm */
export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  try {
    return format(new Date(d), 'dd/MM/yyyy HH:mm');
  } catch {
    return '—';
  }
}

/** Returns date + time + seconds as dd/MM/yyyy HH:mm:ss */
export function fmtDateTimeSec(d: string | Date | null | undefined): string {
  if (!d) return '—';
  try {
    return format(new Date(d), 'dd/MM/yyyy HH:mm:ss');
  } catch {
    return '—';
  }
}

/** For Excel report headers: "Generated on: dd/MM/yyyy HH:mm" */
export function fmtGenerated(): string {
  return `Generated on: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
}
