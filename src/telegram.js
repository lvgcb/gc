export const normalizeTelegramUsername = input => {
  const handle = input.trim().replace(/^@/, '').toLowerCase()
  return /^[a-z0-9_]{5,32}$/.test(handle) ? handle : null
}
