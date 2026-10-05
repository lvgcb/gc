const bytes = value => Uint8Array.from(atob(value), char => char.charCodeAt(0))
const base64 = value => btoa(String.fromCharCode(...value))

export async function unlockNotes(password, security) {
  const encoder = new TextEncoder()
  const base = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bytes(security.salt), iterations: security.iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  const decrypt = async value => {
    const blob = bytes(value)
    return new TextDecoder().decode(await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: blob.slice(0, 12) }, key, blob.slice(12)))
  }
  if (await decrypt(security.check) !== 'AGIS-OK') throw new Error('Wrong counselor password')
  const notes = Object.fromEntries(await Promise.all(
    Object.entries(security.notes).map(async ([id, value]) => [id, JSON.parse(await decrypt(value))])))
  return { key, notes }
}

export async function encryptNote(key, note) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(note))))
  const blob = new Uint8Array(iv.length + cipher.length)
  blob.set(iv)
  blob.set(cipher, iv.length)
  return base64(blob)
}
