/**
 * Extracts an HTTP status from a raw ky/ezcap/WasClient error. `was.request()`
 * rejects on any non-2xx with `err.status` set (see `@interop/http-client`'s
 * error normaliser); this reads it defensively from either location.
 *
 * @param err {unknown}
 * @returns {number | undefined}
 */
export function httpStatusOf(err: unknown): number | undefined {
  return (
    (err as { status?: number }).status ??
    (err as { response?: { status?: number } }).response?.status
  )
}
