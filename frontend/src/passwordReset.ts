export const passwordResetEnabled = () => /^(1|true|yes|on)$/i.test(import.meta.env.VITE_ACCOUNT_PASSWORD_RESET_ENABLED ?? '');

type ResetFailure = 'invalid' | 'rate' | 'network';
export class PasswordResetError extends Error {
  constructor(readonly kind: ResetFailure) { super(kind); }
}

async function send(path: string, body: object): Promise<void> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST', credentials: 'same-origin', referrerPolicy: 'no-referrer',
      headers: {'Content-Type':'application/json','Accept-Language':document.documentElement.lang},
      body: JSON.stringify(body)
    });
  } catch { throw new PasswordResetError('network'); }
  if (response.ok) return;
  if (response.status === 429) throw new PasswordResetError('rate');
  if (path.endsWith('/reset-password') && response.status === 400) throw new PasswordResetError('invalid');
  throw new PasswordResetError('network');
}

export const passwordResetApi = {
  request: (email: string) => send('/api/auth/forgot-password', {email}),
  reset: (token: string, newPassword: string) => send('/api/auth/reset-password', {token,newPassword})
};
