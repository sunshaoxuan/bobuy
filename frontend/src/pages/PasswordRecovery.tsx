import {Alert,Button,Form,Input} from 'antd';
import {CheckCircleOutlined,MailOutlined} from '@ant-design/icons';
import {useState,type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import LanguageSwitcher from '../components/LanguageSwitcher';
import {useI18n} from '../i18n';
import {PasswordResetError,passwordResetApi,passwordResetEnabled} from '../passwordReset';

type Surface='store'|'admin';
const loginPath=(surface:Surface)=>surface==='admin'?'/admin':'/login';

function Shell({surface,children}:{surface:Surface;children:ReactNode}){
 return <div className={'password-recovery '+surface}><header className="password-recovery-header"><Link to="/"><BrandLogo/></Link><LanguageSwitcher/></header><main className="password-recovery-card">{children}</main></div>;
}
function Failure({kind,retry}:{kind:'rate'|'network';retry:()=>void}){const {t}=useI18n();return <Alert type="error" showIcon message={t(`password_reset.${kind}`)} action={<Button onClick={retry}>{t('password_reset.retry')}</Button>}/>;}

export function ForgotPassword({surface='store'}:{surface?:Surface}){
 const {t}=useI18n();const[done,setDone]=useState(false),[busy,setBusy]=useState(false),[failure,setFailure]=useState<'rate'|'network'>();
 if(!passwordResetEnabled)return <NavigateHome surface={surface}/>;
 async function submit({email}:{email:string}){setBusy(true);setFailure(undefined);try{await passwordResetApi.request(email);setDone(true);}catch(e){setFailure(e instanceof PasswordResetError&&e.kind==='rate'?'rate':'network');}finally{setBusy(false);}}
 return <Shell surface={surface}>{done?<div className="password-recovery-state"><CheckCircleOutlined/><h1>{t('password_reset.request_done_title')}</h1><p>{t('password_reset.request_done')}</p><Link className="recovery-action" to={loginPath(surface)}>{t('password_reset.back_login')}</Link></div>:<><MailOutlined className="recovery-icon"/><h1>{t('password_reset.request_title')}</h1><p>{t('password_reset.request_help')}</p>{failure&&<Failure kind={failure} retry={()=>setFailure(undefined)}/>}<Form layout="vertical" requiredMark={false} onFinish={submit}><Form.Item name="email" label={t('password_reset.email')} rules={[{required:true,type:'email',message:t('password_reset.email_error')}]}><Input type="email" autoComplete="email"/></Form.Item><Button type="primary" htmlType="submit" block loading={busy}>{t('password_reset.send')}</Button></Form><Link className="recovery-secondary" to={loginPath(surface)}>{t('password_reset.back_login')}</Link></>}</Shell>;
}

function takeToken():string{
 const params=new URLSearchParams(window.location.hash.slice(1));const token=params.get('token')??'';
 if(window.location.hash)history.replaceState(history.state,'',window.location.pathname+window.location.search);
 return token;
}
export function ResetPassword({surface='store'}:{surface?:Surface}){
 const {t}=useI18n();const[token]=useState(takeToken);const[done,setDone]=useState(false),[busy,setBusy]=useState(false);const[failure,setFailure]=useState<'invalid'|'rate'|'network'>(token?'network':'invalid');const[attempted,setAttempted]=useState(false);
 if(!passwordResetEnabled)return <NavigateHome surface={surface}/>;
 async function submit({password}:{password:string}){setBusy(true);setAttempted(true);try{await passwordResetApi.reset(token,password);setDone(true);}catch(e){setFailure(e instanceof PasswordResetError?e.kind:'network');}finally{setBusy(false);}}
 const invalid=!token||(attempted&&failure==='invalid');
 return <Shell surface={surface}>{done?<div className="password-recovery-state"><CheckCircleOutlined/><h1>{t('password_reset.complete_title')}</h1><p>{t('password_reset.complete')}</p><Link className="recovery-action" to={loginPath(surface)}>{t('password_reset.sign_in')}</Link></div>:invalid?<div className="password-recovery-state invalid"><h1>{t('password_reset.invalid_title')}</h1><p>{t('password_reset.invalid')}</p><Link className="recovery-action" to={surface==='admin'?'/admin/forgot-password':'/forgot-password'}>{t('password_reset.new_link')}</Link></div>:<><h1>{t('password_reset.reset_title')}</h1><p>{t('password_reset.reset_help')}</p>{attempted&&failure!=='invalid'&&<Failure kind={failure as 'rate'|'network'} retry={()=>setAttempted(false)}/>}<Form layout="vertical" requiredMark={false} onFinish={submit}><Form.Item name="password" label={t('password_reset.new_password')} rules={[{required:true,min:8,max:72,message:t('password_reset.password_error')},{validator:(_,v)=>new TextEncoder().encode(v??'').length<=72?Promise.resolve():Promise.reject(new Error(t('password_reset.password_error')))}]}><Input.Password autoComplete="new-password"/></Form.Item><Form.Item name="confirm" label={t('password_reset.confirm_password')} dependencies={['password']} rules={[{required:true,message:t('password_reset.confirm_error')},({getFieldValue})=>({validator:(_,v)=>v===getFieldValue('password')?Promise.resolve():Promise.reject(new Error(t('password_reset.confirm_error')))})]}><Input.Password autoComplete="new-password"/></Form.Item><Button type="primary" htmlType="submit" block loading={busy}>{t('password_reset.reset_action')}</Button></Form></>}</Shell>;
}
function NavigateHome({surface}:{surface:Surface}){window.location.replace(surface==='admin'?'/admin':'/');return null;}
