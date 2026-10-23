import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '../i18n';
import Users from './Users';

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn() }));
// jsdom cannot parse the table's generated :has selector; browser checks cover the real table.
vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return { ...actual,
    Select: ({options, onChange, value}: any) => <select value={value} onChange={e=>onChange(e.target.value)}>{options.map((o: any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>,
    Table: ({ dataSource, columns, locale }: any) => <div>{dataSource.length ? dataSource.map((row: any) => <div key={row.id}>{columns.map((column: any) => <div key={column.key}>{column.render?.(undefined, row)}</div>)}</div>) : locale.emptyText}</div> };
});
vi.mock('../api', () => ({ api: { adminUsers: mocks.list, createUser: mocks.create, updateUser: mocks.update } }));
vi.mock('../context/UserRoleContext', () => ({ useUserRole: () => ({ user: { id: 1000 } }) }));
const account = { id: 2, username: 'dual', name: 'Dual User', email: 'dual@example.com', roles: ['CUSTOMER', 'AGENT'], enabled: true, platformAdmin: false, emailVerified: false };

describe('User management', () => {
  beforeEach(() => { localStorage.clear(); mocks.list.mockResolvedValue([account]); mocks.create.mockResolvedValue(account); mocks.update.mockResolvedValue(account); });
  it('lists dual roles and searches accounts', async () => {
    render(<I18nProvider><Users /></I18nProvider>);
    expect(await screen.findByText('Dual User')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('搜索姓名、用户名或邮箱'), { target: { value: 'missing' } });
    expect(await screen.findByText('没有匹配的用户')).toBeInTheDocument();
    expect(screen.queryByText('Dual User')).not.toBeInTheDocument();
  });
  it('edits both role checkboxes and keeps blank password', async () => {
    render(<I18nProvider><Users /></I18nProvider>);
    fireEvent.click(await screen.findByRole('button', { name: '编辑用户 dual' }));
    const customer = await screen.findByRole('checkbox', { name: '客户' });
    const merchant = screen.getByRole('checkbox', { name: '商家' });
    expect(customer).toBeChecked(); expect(merchant).toBeChecked();
    fireEvent.click(merchant);
    fireEvent.click(screen.getByRole('button', { name: 'check 保存用户' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(2, expect.objectContaining({ roles: ['CUSTOMER'], password: '' })));
  });
});
