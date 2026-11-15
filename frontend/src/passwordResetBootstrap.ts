import {takePasswordResetToken} from './pages/PasswordRecovery';

// React Router paths are case-insensitive by default and accept a trailing slash.
// Keep bootstrap token ownership aligned so every URL that renders the reset page
// is scrubbed before React receives control.
const passwordResetPath=/^\/(?:admin\/)?reset-password\/?$/i;

export function capturePasswordResetToken(pathname=window.location.pathname):string{
 return passwordResetPath.test(pathname)?takePasswordResetToken():'';
}
