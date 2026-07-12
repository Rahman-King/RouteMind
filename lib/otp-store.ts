// Shared in-memory OTP storage used by both send-otp and verify-otp routes.
// NOTE: This resets whenever the server restarts, and won't work across
// multiple server instances (e.g. in production with multiple containers).
// For production, replace this with Redis or a database table.

type OtpEntry = { code: string; expiresAt: number }

const otpStore = new Map<string, OtpEntry>()

export function setOtp(email: string, code: string, ttlMs = 10 * 60 * 1000) {
  otpStore.set(email, { code, expiresAt: Date.now() + ttlMs })
}

export function getOtp(email: string): OtpEntry | undefined {
  return otpStore.get(email)
}

export function deleteOtp(email: string) {
  otpStore.delete(email)
}
