/**
 * Ed25519 signing and verification through WebCrypto.
 *
 * There is no default key in this file, and there never will be: a missing key
 * is a loud failure, not a silent fallback. Callers either pass a key explicitly
 * or set `AVC_PRIVATE_KEY` / `AVC_PUBLIC_KEY` in the environment.
 *
 * Key material is never logged, returned from a verify call, or written to disk
 * by this module.
 */

import { contentHash } from './canonical.ts'

const encoder = new TextEncoder()

/** A JWK, without depending on a lib type that is not always present. */
type JsonWebKeyLike = Record<string, unknown>

interface Jwk {
  kty: string
  crv?: string
  d?: string
  x?: string
  [key: string]: unknown
}

/** Read a variable from the environment. Never from a file, never a default. */
export function readEnv(name: string): string | undefined {
  const bun = (globalThis as { Bun?: { env?: Record<string, string | undefined> } }).Bun
  const value = bun?.env?.[name] ?? process.env[name]
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/** Decode base64url to bytes. */
export const fromBase64Url = (value: string): Uint8Array<ArrayBuffer> => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const buffer = Buffer.from(padded, 'base64')
  const out = new Uint8Array(new ArrayBuffer(buffer.byteLength))
  out.set(buffer)
  return out
}

/** Encode bytes as unpadded base64url. */
export const toBase64Url = (bytes: Uint8Array): string =>
  Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

/**
 * Import an Ed25519 private key from the shapes we accept:
 * a JWK JSON object, a raw 32-byte seed, or PKCS#8.
 */
export async function importPrivateKey(raw: string): Promise<CryptoKey> {
  if (raw.trimStart().startsWith('{')) {
    return crypto.subtle.importKey(
      'jwk',
      JSON.parse(raw) as Jwk as unknown as JsonWebKeyLike,
      { name: 'Ed25519' },
      false,
      ['sign'],
    )
  }
  const bytes = fromBase64Url(raw)
  if (bytes.byteLength === 32) {
    return crypto.subtle.importKey('raw', bytes, { name: 'Ed25519' }, false, ['sign'])
  }
  return crypto.subtle.importKey('pkcs8', bytes, { name: 'Ed25519' }, false, ['sign'])
}

/**
 * Import an Ed25519 public key from the shapes we accept:
 * a JWK JSON object, a raw 32-byte key, or SPKI.
 */
export async function importPublicKey(raw: string): Promise<CryptoKey> {
  if (raw.trimStart().startsWith('{')) {
    return crypto.subtle.importKey(
      'jwk',
      JSON.parse(raw) as Jwk as unknown as JsonWebKeyLike,
      { name: 'Ed25519' },
      true,
      ['verify'],
    )
  }
  const bytes = fromBase64Url(raw)
  if (bytes.byteLength === 32) {
    return crypto.subtle.importKey('raw', bytes, { name: 'Ed25519' }, true, ['verify'])
  }
  return crypto.subtle.importKey('spki', bytes, { name: 'Ed25519' }, true, ['verify'])
}

/** The key id — derived from the public key, so it is stable and public. */
export function keyId(publicKey: string): string {
  return `cdut-${contentHash(publicKey).slice(0, 12)}`
}

/** Sign a canonical byte string. Returns a detached base64url signature. */
export async function signCanonical(canonical: string, privateKey: string): Promise<string> {
  const key = await importPrivateKey(privateKey)
  const signature = await crypto.subtle.sign('Ed25519', key, encoder.encode(canonical))
  return toBase64Url(new Uint8Array(signature))
}

/** Verify a detached signature over a canonical byte string. */
export async function verifyCanonical(
  canonical: string,
  signature: string,
  publicKey: string,
): Promise<boolean> {
  try {
    const key = await importPublicKey(publicKey)
    return await crypto.subtle.verify(
      'Ed25519',
      key,
      fromBase64Url(signature) as BufferSource,
      encoder.encode(canonical),
    )
  } catch {
    return false
  }
}

/**
 * Generate an ephemeral Ed25519 key pair, exported as base64url PKCS#8 and raw
 * public key. For tests and fixtures. Never use a generated key in production.
 */
export async function generateKeyPair(): Promise<{ privateKey: string; publicKey: string }> {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  return { privateKey: toBase64Url(pkcs8), publicKey: toBase64Url(raw) }
}
