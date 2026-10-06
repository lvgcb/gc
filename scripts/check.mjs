import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { encryptNote, unlockNotes } from '../src/crypto.js'
import { isGroupEvent } from '../src/groupEvents.js'
import { normalizeTelegramUsername } from '../src/telegram.js'

assert.equal(isGroupEvent({ id: 'C012' }), true)
assert.equal(isGroupEvent({ id: 'C152' }), true)
for (const id of ['C023', 'C038', 'C132']) assert.equal(isGroupEvent({ id }), true)
assert.equal(isGroupEvent({ id: 'C011' }), false) // solo entry is allowed
assert.equal(isGroupEvent({ id: 'C133' }), false) // solo entry is allowed
assert.equal(isGroupEvent({ id: 'C154' }), false) // one-person team is allowed
assert.equal(isGroupEvent({ id: 'C012', groupEvent: false }), false)
assert.equal(normalizeTelegramUsername(' @Alice_2026 '), 'alice_2026')
assert.equal(normalizeTelegramUsername('a!b'), null)
assert.equal(normalizeTelegramUsername('abcd'), null)

const password = 'test-password'
const salt = webcrypto.getRandomValues(new Uint8Array(16))
const base = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
const key = await webcrypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: 1000, hash: 'SHA-256' },
  base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
const iv = webcrypto.getRandomValues(new Uint8Array(12))
const check = new Uint8Array(12 + 23)
const ciphertext = new Uint8Array(await webcrypto.subtle.encrypt(
  { name: 'AES-GCM', iv }, key, new TextEncoder().encode('AGIS-OK')))
check.set(iv)
check.set(ciphertext, 12)
const note = { c: 'ok', cn: { ru: 'verified' }, f: {} }
const security = {
  salt: btoa(String.fromCharCode(...salt)),
  iter: 1000,
  check: btoa(String.fromCharCode(...check)),
  notes: { C001: await encryptNote(key, note) },
}
assert.deepEqual((await unlockNotes(password, security)).notes.C001, note)
await assert.rejects(unlockNotes('wrong', security))
console.log('Crypto round trip and wrong password check passed')
