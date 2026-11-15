import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import './styles.css';
import { I18nProvider } from './i18n';
import { UserRoleProvider } from './context/UserRoleContext';
import {takePasswordResetToken} from './pages/PasswordRecovery';

// The data router can block POP/PUSH/REPLACE before an editor is unmounted.
// Capture and scrub the fragment before React starts. StrictMode may replay every
// component render and initializer, so token ownership must stay outside its tree.
const passwordResetToken = /\/(?:admin\/)?reset-password$/.test(window.location.pathname)
  ? takePasswordResetToken()
  : '';
const router = createBrowserRouter([{ path: '*', element: <App passwordResetToken={passwordResetToken} /> }]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <UserRoleProvider>
        <RouterProvider router={router} />
      </UserRoleProvider>
    </I18nProvider>
  </React.StrictMode>
);
