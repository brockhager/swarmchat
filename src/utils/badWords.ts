// Simple, client-side restricted language check used for UX feedback during registration.
// This is intentionally tiny — server-side restrictions are required to enforce this.

const BAD_WORDS = [
  'badword',
  'banned',
  'curse',
  'offensive'
]

export function containsBadWord(username: string) {
  const lower = username.toLowerCase()
  return BAD_WORDS.some(w => w && lower.includes(w))
}

export default BAD_WORDS
