import { useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Popconfirm, Select, Skeleton, Switch, Tag } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, MailOutlined, ReloadOutlined, SaveOutlined, SendOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { api, type MailSettingsEdit, type MailSettingsView } from '../api';
import { useI18n } from '../i18n';
import './MailSettings.css';

export default function MailSettings() {
 const { t } = useI18n();
 const [saved, setSaved] = useState<MailSettingsView | null>(null);
 const [failed, setFailed] = useState(false);
 const [busy, setBusy] = useState<'load' | 'save' | 'test' | null>('load');
 const [dirty, setDirty] = useState(false);
 const [recipient, setRecipient] = useState<string>();
 const [notice, setNotice] = useState<{type:'success'|'error'|'info'; key:string}>();
 const [remaining, setRemaining] = useState(0);
 const [form] = Form.useForm<MailSettingsEdit>();
 const values = Form.useWatch([], form) as MailSettingsEdit | undefined;
 const identityChanged = !!saved && !!values && (['host','port','tlsMode','username','fromAddress','replyTo'] as const)
  .some(key => String(values[key] ?? '').trim() !== String(saved[key]));
 const needsPassword = !!saved?.passwordStored && identityChanged;
 const blockedIdentity = needsPassword && !saved?.keyReady;
 const apply = (value: MailSettingsView) => {
  setSaved(value); form.setFieldsValue({...value, password:''}); setDirty(false);
  setRecipient(current => current && value.testRecipients.includes(current) ? current : value.testRecipients.length === 1 ? value.testRecipients[0] : undefined);
 };
 const load = async () => {
  setBusy('load'); setFailed(false); setNotice(undefined);
  try { const value = await api.mailSettings(); if (!value) throw new Error(); apply(value); }
  catch { setFailed(true); } finally { setBusy(null); }
 };
 useEffect(() => { void load(); }, []);
 useEffect(() => {
  if (!remaining) return;
  const timer = window.setTimeout(() => setRemaining(n => Math.max(0,n-1)), 1000);
  return () => window.clearTimeout(timer);
 }, [remaining]);
 const save = async (input: MailSettingsEdit) => {
  if (!saved || busy || blockedIdentity) return;
  setBusy('save'); setNotice(undefined);
  try {
   const value = await api.saveMailSettings({version:saved.version, enabled:input.enabled, host:input.host, port:input.port,
    tlsMode:input.tlsMode, username:input.username.trim(), fromAddress:input.fromAddress.trim(), replyTo:input.replyTo.trim(), password:input.password || ''});
   if (!value) throw new Error();
   apply(value); setNotice({type:'success',key:'mail.saved'});
  } catch { setNotice({type:'error',key:'mail.save_failed'}); }
  finally { form.setFieldValue('password',''); setBusy(null); }
 };
 const testReason = !saved?.keyReady ? 'mail.block_key' : !saved.passwordStored ? 'mail.block_password'
  : !saved.testRecipients.length ? 'mail.no_recipient' : dirty ? 'mail.block_dirty' : !recipient ? 'mail.block_recipient'
  : remaining ? 'mail.cooldown' : '';
 const test = async () => {
  if (!recipient || busy || testReason) return;
  setBusy('test'); setNotice(undefined); setRemaining(60);
  try { await api.testMailSettings(recipient); setNotice({type:'success',key:'mail.sent'}); }
  catch { setNotice({type:'error',key:'mail.test_failed'}); } finally { setBusy(null); }
 };
 const check = async () => {
  try { await form.validateFields(); setNotice({type:'info',key:'mail.checked'}); }
  catch { setNotice({type:'error',key:'mail.check_failed'}); }
 };
 return <section className="mail-settings-page" aria-busy={!!busy}>
  <header className="mail-page-heading"><div><div className="mail-eyebrow"><MailOutlined />{t('mail.eyebrow')}</div><h1>{t('mail.title')}</h1><p>{t('mail.subtitle')}</p></div>
   {saved && <Tag color={dirty?'gold':saved.enabled?'green':'default'}>{t(dirty?'mail.unsaved':saved.enabled?'mail.active':'mail.inactive')}</Tag>}
  </header>
  {failed && <Alert type="error" showIcon message={t('accounts.load_error')} action={<Button disabled={!!busy} onClick={() => void load()}>{t('accounts.retry')}</Button>} />}
  <div role="status" aria-live="polite" className="mail-feedback">{notice && <Alert type={notice.type} showIcon message={t(notice.key)} />}</div>
  {!saved && busy && <div className="mail-panel"><Skeleton active paragraph={{rows:8}} /></div>}
  {saved && <div className="mail-layout">
   <Form form={form} layout="vertical" onFinish={save} onValuesChange={() => {setDirty(true);setNotice(undefined);}}
    disabled={!!busy} requiredMark={false} className="mail-panel mail-config">
    <div className="mail-section-heading"><span className="mail-section-icon"><SafetyCertificateOutlined /></span><div><h2>{t('mail.connection')}</h2><p>{t('mail.connection_help')}</p></div></div>
    {!saved.keyReady && <Alert type="warning" showIcon message={t('mail.key_missing')} description={t('mail.key_help')} />}
    {blockedIdentity && <Alert type="warning" showIcon message={t('mail.identity_blocked')} />}
    <div className="mail-fields">
     <Form.Item name="host" label={t('mail.host')} rules={[{required:true,message:t('mail.required')}]}><Select options={saved.allowedHosts.map(value => ({value,label:value}))} /></Form.Item>
     <Form.Item name="tlsMode" label={t('mail.tls')} rules={[{required:true,message:t('mail.required')}]}><Select onChange={value => form.setFieldValue('port',value==='TLS'?465:587)} options={[{value:'STARTTLS',label:'STARTTLS · 587'},{value:'TLS',label:'TLS · 465'}]} /></Form.Item>
     <Form.Item name="port" hidden><Input /></Form.Item>
     {(['username','fromAddress','replyTo'] as const).map(name => <Form.Item key={name} name={name} label={t(`mail.${name}`)} rules={[{required:true,message:t('mail.required')},{type:'email',message:t('mail.email_invalid')}]}><Input autoComplete="off" maxLength={254} /></Form.Item>)}
     <Form.Item name="password" label={t('mail.password')} extra={t(needsPassword?'mail.password_changed':saved.passwordStored?'mail.keep_password':'mail.no_password')}
      dependencies={['host','port','tlsMode','username','fromAddress','replyTo','enabled']} rules={[{validator:(_,value) => (needsPassword || (values?.enabled && !saved.passwordStored)) && !value ? Promise.reject(new Error(t(needsPassword?'mail.password_changed':'mail.block_password'))) : Promise.resolve()}]}>
      <Input.Password autoComplete="new-password" maxLength={1024} visibilityToggle={false} disabled={!!busy || !saved.keyReady} placeholder={t(saved.passwordStored?'mail.password_keep':'mail.password_enter')} />
     </Form.Item>
    </div>
    <div className="mail-delivery-row"><div><strong>{t('mail.enabled')}</strong><p>{t('mail.enabled_help')}</p></div><Form.Item name="enabled" valuePropName="checked"><Switch aria-label={t('mail.enabled')} disabled={!!busy || (!saved.keyReady && !values?.enabled)} /></Form.Item></div>
    <footer className="mail-form-actions"><Button aria-label={t('mail.save')} type="primary" htmlType="submit" icon={<SaveOutlined />} loading={busy==='save'} disabled={!!busy || blockedIdentity}>{t('mail.save')}</Button>
     {dirty ? <Popconfirm title={t('mail.discard')} onConfirm={() => void load()} okText={t('mail.reload')} cancelText={t('mail.cancel')}><Button aria-label={t('mail.reload')} icon={<ReloadOutlined />} disabled={!!busy}>{t('mail.reload')}</Button></Popconfirm>
      : <Button aria-label={t('mail.reload')} icon={<ReloadOutlined />} onClick={() => void load()} disabled={!!busy}>{t('mail.reload')}</Button>}
    </footer>
   </Form>
   <aside className="mail-side">
    <section className="mail-panel"><div className="mail-section-heading"><span className="mail-section-icon"><SendOutlined /></span><div><h2>{t('mail.test')}</h2><p>{t('mail.test_intro')}</p></div></div>
     <ul className="mail-readiness">{[['mail.ready_key',saved.keyReady],['mail.ready_password',saved.passwordStored],['mail.ready_recipient',!!saved.testRecipients.length],['mail.ready_saved',!dirty && !!saved.updatedAt]].map(([key,ready]) =>
      <li key={String(key)} data-ready={!!ready}>{ready?<CheckCircleOutlined />:<ClockCircleOutlined />}<span>{t(String(key))}</span><small>{t(ready?'mail.ready':'mail.pending')}</small></li>)}</ul>
     <label className="mail-recipient-label" htmlFor="mail-recipient">{t('mail.recipient')}</label>
     <Select id="mail-recipient" value={recipient} onChange={value => {setRecipient(value);setNotice(undefined);}} options={saved.testRecipients.map(value => ({value,label:value}))}
      disabled={!!busy || !saved.testRecipients.length} placeholder={t('mail.recipient')} />
     <Button aria-label={t('mail.send_test')} className="mail-test-button" icon={<SendOutlined />} loading={busy==='test'} onClick={() => void test()} disabled={!!busy || !!testReason}>{t('mail.send_test')}</Button>
     <p className="mail-test-reason" role="status">{testReason ? t(testReason,{seconds:remaining}) : t('mail.test_ready')}</p>
     <Button block onClick={() => void check()} disabled={!!busy}>{t('mail.check')}</Button><p className="mail-small">{t('mail.check_help')}</p>
    </section>
    <section className="mail-panel mail-notes"><h2>{t('mail.notes')}</h2><p>{t('mail.scope')}</p><p>{t('mail.test_scope')}</p>
     <details><summary>{t('mail.setup')}</summary><p>{t('mail.setup_help')}</p><code>bobuy.mail.keyring-file<br />bobuy.mail.active-key-id<br />bobuy.mail.test-recipients</code></details>
    </section>
   </aside>
  </div>}
 </section>;
}
