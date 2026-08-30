export function getAuthErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  const message = error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : ''

  if (message.toLowerCase().includes('invalid login credentials')) {
    return 'The email or password is incorrect.'
  }
  if (message.toLowerCase().includes('user already registered')) {
    return 'An account with this email already exists. Try signing in instead.'
  }
  if (message.toLowerCase().includes('password should be at least')) {
    return 'Choose a password with at least 8 characters.'
  }
  return message || fallback
}
