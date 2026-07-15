import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a QuickTane webhook signature.
 *
 * Compute the HMAC-SHA256 of the raw request body with your endpoint's signing
 * secret and compare it, in constant time, to the `X-QuickTane-Signature`
 * header (`sha256=<hex>`).
 *
 * @param payload the RAW request body (string or Buffer).
 * @param signatureHeader the `X-QuickTane-Signature` header value.
 * @param secret your endpoint's signing secret (`whsec_...`).
 */
export function verifySignature(
  payload: string | Buffer,
  signatureHeader: string,
  secret: string,
): boolean {
  if (!signatureHeader) {
    return false;
  }

  const body = typeof payload === "string" ? Buffer.from(payload) : payload;
  const expected = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);

  // timingSafeEqual requires equal-length buffers.
  return a.length === b.length && timingSafeEqual(a, b);
}
