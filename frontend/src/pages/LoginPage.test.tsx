import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from './LoginPage';
import { UserRoleProvider } from '../context/UserRoleContext';
import { I18nProvider } from '../i18n';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  me: vi.fn()
}));

vi.mock('../api', () => ({
  api: {
    auth: {
      login: mocks.login,
      me: mocks.me
    }
  }
}));

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.login.mockReset();
    mocks.me.mockReset();
  });

  it('logs in and redirects agent users to dashboard', async () => {
    mocks.login.mockResolvedValue({
      accessToken: 'token-123',
      accessTokenExpiresAt: '2026-05-01T00:00:00Z',
      refreshToken: 'refresh-123',
      refreshTokenExpiresAt: '2026-05-08T00:00:00Z',
      user: { id: 1000, username: 'agent', name: 'Aiko Tan', role: 'AGENT' }
    });
    mocks.me.mockResolvedValue({ id: 1000, username: 'agent', name: 'Aiko Tan', role: 'AGENT' });

    render(
      <I18nProvider>
        <UserRoleProvider>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/dashboard" element={<div>dashboard-home</div>} />
            </Routes>
          </MemoryRouter>
        </UserRoleProvider>
      </I18nProvider>
    );

    await userEvent.type(screen.getByLabelText('用户名'), 'agent');
    await userEvent.type(screen.getByLabelText('密码'), 'agent-pass');
    await userEvent.click(screen.getByRole('button', { name: /登\s*录/ }));

    await waitFor(() => expect(screen.getByText('dashboard-home')).toBeInTheDocument());
    expect(mocks.login).toHaveBeenCalledWith({ username: 'agent', password: 'agent-pass' });
    expect(mocks.me).toHaveBeenCalled();
  });
});
