export function resolveIdempotencyStatus(existingStatus?: string | null) {
  if (existingStatus === 'SUCCESS') {
    return 'NOOP';
  }
  if (existingStatus === 'FAILED') {
    return 'CONFLICT';
  }
  return 'RUN';
}
