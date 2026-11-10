import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import './styles.css';
import { I18nProvider } from './i18n';
import { UserRoleProvider } from './context/UserRoleContext';

// The data router can block POP/PUSH/REPLACE before an editor is unmounted.
const router = createBrowserRouter([{ path: '*', element: <App /> }]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <UserRoleProvider>
        <RouterProvider router={router} />
      </UserRoleProvider>
    </I18nProvider>
  </React.StrictMode>
);
