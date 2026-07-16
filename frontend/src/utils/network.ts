/**
 * Checks if the given error is a network/fetch exception (offline or network changed).
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  // If the browser reports offline, it's definitely a network issue
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }

  // Check the error type and message
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('fetch') ||
      msg.includes('load failed') ||
      msg.includes('network') ||
      msg.includes('connection')
    );
  }

  const errStr = String(error).toLowerCase();
  return (
    errStr.includes('network') ||
    errStr.includes('offline') ||
    errStr.includes('failed to fetch') ||
    errStr.includes('load failed')
  );
}

/**
 * Logs a network-related warning or a standard error depending on the error type.
 */
export function logFetchError(context: string, error: any): void {
  if (isNetworkError(error)) {
    console.warn(`${context} (network offline or changed):`, error.message || error);
  } else {
    console.error(context, error);
  }
}
