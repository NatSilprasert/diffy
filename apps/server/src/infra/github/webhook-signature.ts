import { createHmac, timingSafeEqual } from 'node:crypto';

// GitHub signs every webhook with the secret of the App: the header is "sha256=" and the HMAC-SHA256 of the raw
// body as hex. Anything else could come from anyone, so it is checked before the body is read as data.
export function verifyWebhookSignature(rawBody: Buffer | undefined, header: string | undefined, secret: string): boolean {
  if (!rawBody || !header) return false;
  const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`);
  const given = Buffer.from(header);
  // timingSafeEqual needs equal lengths, and a length mismatch alone already says it is not ours.
  return given.length === expected.length && timingSafeEqual(given, expected);
}
