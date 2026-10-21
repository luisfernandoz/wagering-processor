import * as crypto from 'crypto';

export function generateCanonicalPayloadHash(
  payload: Record<string, any>,
): string {
  const sortedPayload = sortObjectKeys(payload);
  const jsonString = JSON.stringify(sortedPayload);
  return crypto.createHash('sha256').update(jsonString).digest('hex');
}

function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  return Object.keys(obj)
    .sort()
    .reduce(
      (sorted, key) => {
        sorted[key] = sortObjectKeys(obj[key]);
        return sorted;
      },
      {} as Record<string, any>,
    );
}
