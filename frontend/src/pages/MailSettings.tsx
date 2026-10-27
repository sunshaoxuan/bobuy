import { useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Select, Space, Switch, message } from 'antd';
import { api, type MailSettingsEdit, type MailSettingsView } from '../api';
import { useI18n } from '../i18n';

export default function MailSettings() {
 const { t }=useI18n();
 const [saved,setSaved]=useState<MailSettingsView|null>(null);
 const [failed,setFailed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [dirty,setDirty]=useState(false);
 const [recipient,setRecipient]=useState<string>();
 const [form]=Form.useForm<MailSettingsEdit>();
 const apply=(value:MailSettingsView|null)=>{
  if(!value) { setFailed(true); return; }
  setSaved(value); form.setFieldsValue({...value,password:''}); setDirty(false);
 };
 const load=async()=>{ setBusy(true); setFailed(false); try { apply(await api.mailSettings()); } catch {setFailed(true);} finally {setBusy(false);} };
 useEffect(()=>{void load();},[]);
 const save=async(values:MailSettingsEdit)=>{
  if(!saved) return;
  setBusy(true);
  try {
   apply(await api.saveMailSettings({version:saved.version,enabled:values.enabled,host:values.host,port:values.port,tlsMode:values.tlsMode,
    username:values.username,fromAddress:values.fromAddress,replyTo:values.replyTo,password:values.password || ''}));
   message.success(t('mail.saved'));
  } catch { /* Keep the draft for correction; never log submitted values. */ }
  finally {form.setFieldValue('password','');setBusy(false);}
 };
 const test=async()=>{
  if(!recipient) return; setBusy(true);
  try {await api.testMailSettings(recipient);message.success(t('mail.sent'));} catch { /* Sanitized API message. */ } finally {setBusy(false);}
 };
 return <section className="mail-settings-page" style={{maxWidth:720}}>
  <h1>{t('mail.title')}</h1>
  <Alert type="info" showIcon message={t('mail.scope')} style={{marginBottom:20}} />
  {failed && <Alert type="error" message={t('accounts.load_error')} action={<Button onClick={()=>void load()}>{t('accounts.retry')}</Button>} />}
  {saved && <>
   <Alert type={saved.keyReady?'success':'warning'} message={t(saved.keyReady?'mail.key_ready':'mail.key_missing')} style={{marginBottom:20}} />
   <Form form={form} layout="vertical" onFinish={save} onValuesChange={()=>setDirty(true)} disabled={busy} requiredMark={false}>
    <Form.Item name="enabled" label={t('mail.enabled')} valuePropName="checked"><Switch disabled={!saved.keyReady} /></Form.Item>
    <Form.Item name="host" label={t('mail.host')} rules={[{required:true}]}><Select options={saved.allowedHosts.map(value=>({value,label:value}))} /></Form.Item>
    <Form.Item name="tlsMode" label={t('mail.tls')} rules={[{required:true}]}><Select onChange={value=>form.setFieldValue('port',value==='TLS'?465:587)} options={[{value:'STARTTLS',label:'STARTTLS · 587'},{value:'TLS',label:'TLS · 465'}]} /></Form.Item>
    <Form.Item name="port" hidden><Input /></Form.Item>
    {(['username','fromAddress','replyTo'] as const).map(name=><Form.Item key={name} name={name} label={t(`mail.${name}`)} rules={[{required:true},{type:'email'}]}><Input autoComplete="off" maxLength={254} /></Form.Item>)}
    <Form.Item name="password" label={t('mail.password')} extra={t(saved.passwordStored?'mail.keep_password':'mail.no_password')}><Input.Password autoComplete="new-password" maxLength={1024} visibilityToggle={false} disabled={!saved.keyReady} /></Form.Item>
    <Space wrap><Button type="primary" htmlType="submit" loading={busy}>{t('mail.save')}</Button><Button onClick={()=>void load()} disabled={busy}>{t('mail.reload')}</Button><span>{t(saved.enabled?'mail.active':'mail.inactive')}</span></Space>
   </Form>
   <h2>{t('mail.test')}</h2><p>{t('mail.test_scope')}</p>
   <Space wrap style={{width:'100%'}}><Select aria-label={t('mail.recipient')} style={{minWidth:240,maxWidth:'100%'}} value={recipient} onChange={setRecipient} options={saved.testRecipients.map(value=>({value,label:value}))} disabled={busy || !saved.testRecipients.length} placeholder={t('mail.recipient')} />
    <Button onClick={()=>void test()} disabled={busy || dirty || !recipient || !saved.passwordStored || !saved.keyReady}>{t('mail.send_test')}</Button></Space>
   {!saved.testRecipients.length && <p>{t('mail.no_recipient')}</p>}
  </>}
 </section>;
}
