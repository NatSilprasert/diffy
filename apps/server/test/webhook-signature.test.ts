import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from '../src/infra/github/webhook-signature';

const secret = 'a-long-enough-webhook-secret';
const body = Buffer.from('{"zen":"Keep it logically awesome."}');
const sign = (data: Buffer, key = secret) => `sha256=${createHmac('sha256', key).update(data).digest('hex')}`;

describe('verifyWebhookSignature', () => {
  it('accepts the signature GitHub makes from the raw body and the secret', () => {
    expect(verifyWebhookSignature(body, sign(body), secret)).toBe(true);
  });

  it('rejects a body that was changed, or a signature made with another secret', () => {
    expect(verifyWebhookSignature(Buffer.from('{"zen":"changed"}'), sign(body), secret)).toBe(false);
    expect(verifyWebhookSignature(body, sign(body, 'another-secret-entirely'), secret)).toBe(false);
  });

  it('rejects a missing or malformed header and a missing body without throwing', () => {
    expect(verifyWebhookSignature(body, undefined, secret)).toBe(false);
    expect(verifyWebhookSignature(body, '', secret)).toBe(false);
    expect(verifyWebhookSignature(body, 'sha256=abc', secret)).toBe(false);
    expect(verifyWebhookSignature(body, sign(body).replace('sha256=', 'sha1='), secret)).toBe(false);
    expect(verifyWebhookSignature(undefined, sign(body), secret)).toBe(false);
  });
});
