export function checkoutVerificationEnabled() {
  return String(import.meta.env.VITE_CHECKOUT_EMAIL_VERIFICATION_ENABLED ?? '').trim().toLowerCase() === 'true';
}

export function maskEmail(email = '') {
  const at = email.lastIndexOf('@');
  if (at < 1) return email;
  const local = email.slice(0, at);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}${email.slice(at)}`;
}
