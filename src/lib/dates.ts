/**
 * Local-time date helpers. "Days" in this app are virtual, keyed by a local
 * `YYYY-MM-DD` string (the app's day convention); the wall-clock day boundary
 * is the user's, so every key here is computed in LOCAL time, never UTC.
 * Domain sorting/last-write-wins use the ISO timestamps in the payload instead.
 */

/** Local `YYYY-MM-DD` for the given instant (defaults to now). */
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Current instant as an ISO-8601 string (the payload timestamp format). */
export function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Human-readable local date+time for an ISO timestamp, used by detail pages to
 * show completion/cancellation times. Formatting follows the user's locale.
 */
export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString()
}

/** Local `YYYY-MM-DD` for the local day containing the given ISO timestamp. */
export function localDayKey(iso: string): string {
  return todayKey(new Date(iso))
}

/** Shift a `YYYY-MM-DD` key by whole days in LOCAL time (negative goes back). */
export function shiftDayKey(key: string, deltaDays: number): string {
  const parts = key.split('-')
  const y = Number(parts[0])
  const m = Number(parts[1])
  const d = Number(parts[2])
  return todayKey(new Date(y, m - 1, d + deltaDays))
}

/**
 * Descending list of local day keys from `today` back through `daysBack` days
 * (inclusive of both ends, so `daysBack + 1` entries).
 */
export function dayKeysBack(
  today: string = todayKey(),
  daysBack: number = 60
): string[] {
  const keys: string[] = []
  for (let offset = 0; offset <= daysBack; offset++) {
    keys.push(shiftDayKey(today, -offset))
  }
  return keys
}
