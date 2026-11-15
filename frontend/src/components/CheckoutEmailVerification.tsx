import {Alert, Button, Form, Input} from 'antd';
import {MailOutlined} from '@ant-design/icons';
import {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {api, storefrontApi} from '../api';
import {getStoredAccessToken,getStoredAccessTokenExpiresAt,getStoredRefreshTokenExpiresAt,getStoredUser,storeAuthSession} from '../authStorage';
import {maskEmail} from '../checkoutVerification';
import {useI18n} from '../i18n';

const failureKey=(error:unknown,online=navigator.onLine)=>{
  if(!online)return 'checkout_verification.offline';
  const message=error instanceof Error?error.message:'';
  if(/too many|rate|quota|limit|429/i.test(message))return 'checkout_verification.limited';
  if(/expir/i.test(message))return 'checkout_verification.expired';
  if(/invalid|incorrect|wrong|code/i.test(message))return 'checkout_verification.invalid';
  return 'checkout_verification.failed';
};

export default function CheckoutEmailVerification({email,onVerified}:{email?:string;onVerified:()=>void}) {
  const {t}=useI18n();
  const [form]=Form.useForm<{code:string}>();
  const [busy,setBusy]=useState<'send'|'verify'|null>(null),[cooldown,setCooldown]=useState(0);
  const [notice,setNotice]=useState(''),[failure,setFailure]=useState('');
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{if(!cooldown)return;const timer=window.setTimeout(()=>setCooldown(value=>Math.max(0,value-1)),1000);return()=>window.clearTimeout(timer);},[cooldown]);
  async function send(){if(busy||cooldown)return;setBusy('send');setFailure('');setNotice('');try{await storefrontApi.resend();if(mounted.current){setCooldown(60);setNotice('checkout_verification.sent');}}catch(error){if(mounted.current)setFailure(failureKey(error));}finally{if(mounted.current)setBusy(null);}}
  async function verify({code}:{code:string}){if(busy)return;const initiatingUserId=getStoredUser()?.id;setBusy('verify');setFailure('');setNotice('');try{
    await storefrontApi.verify(code);
    if(!mounted.current||initiatingUserId===undefined||getStoredUser()?.id!==initiatingUserId)return;
    const current=await api.auth.me();
    const token=getStoredAccessToken();
    if(!mounted.current||!token||getStoredUser()?.id!==initiatingUserId||current.id!==initiatingUserId)return;
    if(!current.emailVerified)throw new Error('verification incomplete');
    storeAuthSession({accessToken:token,accessTokenExpiresAt:getStoredAccessTokenExpiresAt(),refreshTokenExpiresAt:getStoredRefreshTokenExpiresAt(),user:current});
    if(mounted.current){setNotice('checkout_verification.verified');onVerified();}
  }catch(error){if(mounted.current)setFailure(failureKey(error));}finally{if(mounted.current)setBusy(null);}}
  return <section className="checkout-verification" aria-labelledby="checkout-verification-title">
    <div className="checkout-verification-heading"><MailOutlined/><div><h3 id="checkout-verification-title">{t('checkout_verification.title')}</h3><p>{t('checkout_verification.reason')}</p></div></div>
    <p className="checkout-verification-email">{t('checkout_verification.sent_to',{email:maskEmail(email)})}</p>
    {notice&&<Alert type="success" showIcon message={t(notice)}/>} {failure&&<Alert type="error" showIcon message={t(failure)} description={t('checkout_verification.recovery')}/>}
    <Form form={form} layout="vertical" requiredMark={false} onFinish={verify}>
      <Form.Item name="code" label={t('store.code')} rules={[{required:true,pattern:/^[0-9]{6}$/,message:t('store.code_required')}]}>
        <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6}/>
      </Form.Item>
      <div className="checkout-verification-actions">
        <Button type="primary" htmlType="submit" loading={busy==='verify'} disabled={busy==='send'}>{t('store.verify')}</Button>
        <Button onClick={()=>void send()} loading={busy==='send'} disabled={busy==='verify'||cooldown>0}>{cooldown?t('store.resend_wait',{count:cooldown}):t('checkout_verification.send')}</Button>
        <Link className="checkout-verification-change" to="/account">{t('checkout_verification.change_email')}</Link>
      </div>
      {cooldown>0&&<p className="checkout-verification-cooldown" role="status">{t('checkout_verification.cooldown',{count:cooldown})}</p>}
    </Form>
  </section>;
}
