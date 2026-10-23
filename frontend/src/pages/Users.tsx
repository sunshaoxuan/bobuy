import { useEffect, useState } from 'react';
import { Alert, Avatar, Button, Checkbox, Drawer, Empty, Form, Grid, Input, Select, Space, Switch, Table, Tag, Tooltip, message } from 'antd';
import { CheckOutlined, EditOutlined, PlusOutlined, SearchOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { api, type ManagedUser, type UserEdit } from '../api';
import { useUserRole } from '../context/UserRoleContext';
import { useI18n } from '../i18n';

export default function Users() {
  const { t } = useI18n();
  const { user } = useUserRole();
  const screens = Grid.useBreakpoint();
  const [accounts, setAccounts] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('ALL');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser>();
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<UserEdit>();
  const load = async () => {
    setLoading(true); setError(false);
    try { setAccounts(await api.adminUsers()); } catch { setError(true); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const edit = (account?: ManagedUser) => {
    setEditing(account); form.resetFields();
    form.setFieldsValue(account ? { ...account, password: '' } : { roles: ['CUSTOMER'], enabled: true });
    setOpen(true);
  };
  const save = async (values: UserEdit) => {
    setSaving(true);
    try {
      if (editing) await api.updateUser(editing.id, values); else await api.createUser(values);
      message.success(t('accounts.saved')); setOpen(false); await load();
    } catch { /* API displays localized errors and keeps the draft open. */ }
    finally { setSaving(false); }
  };
  const filtered = accounts.filter(account =>
    (type === 'ALL' || account.roles.includes(type as 'CUSTOMER' | 'AGENT')) &&
    `${account.name} ${account.username} ${account.email}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <section className="accounts-page">
    <div className="accounts-heading"><div><span className="accounts-eyebrow"><TeamOutlined /> {t('accounts.directory')}</span><h1>{t('accounts.title')}</h1></div>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => edit()}>{t('accounts.create')}</Button></div>
    <div className="accounts-summary">{['ALL', 'CUSTOMER', 'AGENT'].map(role => <div key={role}><strong>{role === 'ALL' ? accounts.length : accounts.filter(a => a.roles.includes(role as 'CUSTOMER' | 'AGENT')).length}</strong><span>{t(role === 'ALL' ? 'accounts.total' : `enum.role.${role}`)}</span></div>)}</div>
    <div className="accounts-toolbar"><Input prefix={<SearchOutlined />} aria-label={t('accounts.search')} placeholder={t('accounts.search')} value={query} onChange={e => setQuery(e.target.value)} allowClear />
      <Select aria-label={t('accounts.types')} value={type} onChange={setType} options={['ALL', 'CUSTOMER', 'AGENT'].map(role => ({ value: role, label: t(role === 'ALL' ? 'accounts.all_types' : `enum.role.${role}`) }))} /></div>
    {error && <Alert type="error" message={t('accounts.load_error')} action={<Button onClick={() => void load()}>{t('accounts.retry')}</Button>} />}
    <Table<ManagedUser> className="accounts-table" tableLayout="fixed" loading={loading} rowKey="id" dataSource={filtered} scroll={screens.md ? { x: 720 } : undefined} pagination={{ pageSize: 10, showSizeChanger: false }} locale={{ emptyText: <Empty description={t('accounts.empty')} /> }} columns={[
      { title: t('accounts.account'), key: 'account', width: screens.md ? 250 : undefined, render: (_, account) => <div className="accounts-person"><Avatar icon={<UserOutlined />} /><div><strong title={account.name}>{account.name}</strong><small title={account.username}>@{account.username}</small><div className="accounts-mobile-types">{account.roles.map(role => <Tag key={role}>{t(`enum.role.${role}`)}</Tag>)}<span className={`accounts-status ${account.enabled ? 'enabled' : ''}`} title={t(account.enabled ? 'accounts.enabled' : 'accounts.disabled')} /></div>{account.platformAdmin && <span className="accounts-admin">{t('accounts.platform_admin')}</span>}</div></div> },
      { title: t('accounts.types'), key: 'types', width: 175, responsive: ['md'], render: (_, account) => <Space wrap size={[4, 6]}>{account.roles.map(role => <Tag key={role}>{t(`enum.role.${role}`)}</Tag>)}</Space> },
      { title: t('accounts.email'), key: 'email', responsive: ['md'], render: (_, account) => <div className="accounts-email"><span>{account.email}</span><small>{account.emailVerified ? <><CheckOutlined /> {t('accounts.verified')}</> : t('accounts.unverified')}</small></div> },
      { title: t('accounts.status'), width: 110, key: 'status', responsive: ['md'], render: (_, account) => <span className={`accounts-status ${account.enabled ? 'enabled' : ''}`}>{t(account.enabled ? 'accounts.enabled' : 'accounts.disabled')}</span> },
      { title: t('accounts.actions'), key: 'actions', width: 76, fixed: 'right', align: 'center', render: (_, account) => <Tooltip title={t('accounts.edit')}><Button icon={<EditOutlined />} aria-label={`${t('accounts.edit')} ${account.username}`} onClick={() => edit(account)} /></Tooltip> }
    ]} />
    <Drawer className="account-editor" title={t(editing ? 'accounts.edit' : 'accounts.create')} width={480} open={open} onClose={() => !saving && setOpen(false)} destroyOnClose footer={<div className="accounts-footer"><Button disabled={saving} onClick={() => setOpen(false)}>{t('accounts.cancel')}</Button><Button type="primary" icon={<CheckOutlined />} loading={saving} onClick={() => form.submit()}>{t('accounts.save')}</Button></div>}>
      <Form form={form} layout="vertical" onFinish={save} requiredMark={false}>
        <Form.Item name="username" label={t('accounts.username')} rules={[{ required: true }, { pattern: /^[a-zA-Z0-9_]{3,40}$/, message: t('accounts.username_rule') }]}><Input autoComplete="off" maxLength={40} /></Form.Item>
        <Form.Item name="name" label={t('accounts.name')} rules={[{ required: true, whitespace: true }]}><Input maxLength={100} /></Form.Item>
        <Form.Item name="email" label={t('accounts.email')} rules={[{ required: true }, { type: 'email' }]}><Input type="email" autoComplete="off" maxLength={254} /></Form.Item>
        <Form.Item name="password" label={t('accounts.password')} extra={editing ? t('accounts.password_keep') : undefined} rules={[{ required: !editing }, { min: 8 }, { validator: (_, value) => !value || new TextEncoder().encode(value).length <= 72 ? Promise.resolve() : Promise.reject(new Error(t('accounts.password_rule'))) }]}><Input.Password autoComplete="new-password" maxLength={72} /></Form.Item>
        <Form.Item name="roles" label={t('accounts.types')} rules={[{ type: 'array', required: true, min: 1, message: t('accounts.type_required') }]}><Checkbox.Group className="accounts-types" options={['CUSTOMER', 'AGENT'].map(role => ({ value: role, label: t(`enum.role.${role}`) }))} /></Form.Item>
        <div className="accounts-enabled"><span>{t('accounts.enabled')}</span><Form.Item name="enabled" valuePropName="checked" noStyle><Switch disabled={editing?.id === user?.id} aria-label={t('accounts.enabled')} /></Form.Item></div>
      </Form>
    </Drawer>
  </section>;
}
