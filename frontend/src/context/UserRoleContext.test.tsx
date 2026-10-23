import { render, screen } from '@testing-library/react';
import { storeAuthSession } from '../authStorage';
import { UserRoleProvider, useUserRole } from './UserRoleContext';

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

function Probe() {
  const { roles, isAuthenticated } = useUserRole();
  return <div>{`${roles.join(',')}:${isAuthenticated}`}</div>;
}

describe('UserRoleContext', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.me.mockReset();
  });

  it('reads injected test role from localStorage', () => {
    localStorage.setItem('bobbuy_test_role', 'AGENT');
    render(
      <UserRoleProvider>
        <Probe />
      </UserRoleProvider>
    );
    expect(screen.getByText('AGENT:true')).toBeInTheDocument();
  });

  it('reads stored authenticated session from localStorage', () => {
    mocks.me.mockResolvedValue({
      id: 1001,
      username: 'customer',
      name: 'Chen Li',
      roles: ['CUSTOMER']
    });
    storeAuthSession({
      accessToken: 'token-123',
      refreshToken: 'refresh-123',
      accessTokenExpiresAt: '2026-05-01T00:00:00Z',
      refreshTokenExpiresAt: '2026-05-08T00:00:00Z',
      user: {
        id: 1001,
        username: 'customer',
        name: 'Chen Li',
        roles: ['CUSTOMER']
      }
    });
    render(
      <UserRoleProvider>
        <Probe />
      </UserRoleProvider>
    );
    expect(screen.getByText('CUSTOMER:true')).toBeInTheDocument();
  });
});
