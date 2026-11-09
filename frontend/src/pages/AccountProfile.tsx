import {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, Button, Form, Input, Spin} from 'antd';
import {api, storefrontApi, type SelfProfile, type SelfProfilePatch} from '../api';
import {getStoredAccessToken, getStoredAccessTokenExpiresAt, getStoredRefreshTokenExpiresAt, getStoredUser, storeAuthSession} from '../authStorage';
import {useI18n} from '../i18n';

export function AccountProfile({userId, verification}: {userId:number; verification:(refresh:()=>Promise<void>, profile:SelfProfile)=>React.ReactNode}) {
  const {t} = useI18n();
  const [form] = Form.useForm<SelfProfilePatch>();
  const [profile,setProfile] = useState<SelfProfile>();
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [saved,setSaved] = useState(false);
  const live = useRef(false);
  const refreshSequence = useRef(0);
  const current = useCallback(()=>live.current && !!getStoredAccessToken() && getStoredUser()?.id===userId,[userId]);
  const refresh = useCallback(async()=>{
    const sequence=++refreshSequence.current;
    const active=()=>current() && sequence===refreshSequence.current;
    try {
      // Independent reads can straddle an email change or verification. Accept
      // only an agreeing server pair; one fresh pair is the retry limit.
      for(let attempt=0;attempt<2;attempt++) {
        if(!active())return;
        const [next,session] = await Promise.all([storefrontApi.profile(),api.auth.me()]);
        if(!active())return;
        if(next.id!==userId || session.id!==userId)throw new Error(t('errors.request_failed'));
        if(next.email!==session.email || next.emailVerified!==session.emailVerified || next.username!==session.username || next.name!==session.name) {
          setProfile(undefined);setSaved(false);
          if(attempt===0)continue;
          throw new Error(t('errors.request_failed'));
        }
        setError('');setProfile(next);
        form.resetFields();
        form.setFieldsValue({...next,defaultAddress:next.defaultAddress??undefined,socialAccounts:next.socialAccounts.map(({platform,handle,displayName})=>({platform,handle,displayName}))});
        storeAuthSession({accessToken:getStoredAccessToken()!,accessTokenExpiresAt:getStoredAccessTokenExpiresAt(),refreshTokenExpiresAt:getStoredRefreshTokenExpiresAt(),user:session});
        return;
      }
    } catch(e) {
      if(!active())return;
      setProfile(undefined);setSaved(false);setError((e as Error).message);
      throw e;
    }
  },[current,form,t,userId]);
  useEffect(()=>{
    live.current=true;
    void refresh().catch(()=>{});
    return ()=>{live.current=false;};
  },[refresh,current]);
  async function submit(values:SelfProfilePatch) {
    if(!current())return;
    setBusy(true);setError('');setSaved(false);
    try {
      // Send only editable social fields, never the trusted verification flag.
      const socialAccounts=(values.socialAccounts??[]).map(({platform,handle,displayName})=>({platform,handle,displayName}));
      const defaultAddress=values.defaultAddress && Object.values(values.defaultAddress).some(value=>value!=null && String(value).trim()) ? values.defaultAddress : null;
      await storefrontApi.saveProfile({name:values.name,email:values.email,phone:values.phone??null,defaultAddress,socialAccounts});
      if(!current())return;
      const refreshed=refresh(), sequence=refreshSequence.current;
      await refreshed;
      if(current() && sequence===refreshSequence.current)setSaved(true);
    } catch(e) {if(current())setError((e as Error).message);}
    finally {if(current())setBusy(false);}
  }
  return <section aria-label={t('profile.title')}>
    <h2>{t('profile.title')}</h2>
    {error&&<Alert type="error" message={error}/>}
    {saved&&<Alert type="success" message={t('profile.saved')}/>}
    {!profile?error?<Button onClick={()=>void refresh().catch(()=>{})}>{t('maintenance.retry')}</Button>:<Spin/>:<>
      <p>{profile.username}</p>
      <Form form={form} layout="vertical" requiredMark={false} onFinish={submit} disabled={busy}>
        <Form.Item name="name" label={t('profile.name')} rules={[{required:true,whitespace:true,max:100,message:t('profile.required')}]}><Input autoComplete="name" maxLength={100}/></Form.Item>
        <Form.Item name="email" label={t('store.email')} rules={[{required:true,type:'email',max:254,message:t('store.email_required')}]}><Input type="email" autoComplete="email" maxLength={254}/></Form.Item>
        <p>{t('profile.email_hint')}</p>
        <Form.Item name="phone" label={t('profile.phone')}><Input autoComplete="tel" maxLength={50}/></Form.Item>
        <details><summary>{t('profile.address')}</summary><p>{t('profile.optional')}</p>
          {(['contactName','phone','countryRegion','city','addressLine','postalCode'] as const).map(field=><Form.Item key={field} name={['defaultAddress',field]} label={t('profile.'+field)}><Input maxLength={field==='addressLine'?1000:field==='postalCode'?30:field==='phone'?50:100}/></Form.Item>)}
          <Button onClick={()=>form.setFieldValue('defaultAddress',null)}>{t('profile.clear_address')}</Button>
        </details>
        <details><summary>{t('profile.social')}</summary><p>{t('profile.optional')}</p>
          <Form.List name="socialAccounts">{(fields,{add,remove})=><>
            {fields.map(field=><fieldset key={field.key}>
              <legend>{t('profile.social')} {field.name+1}</legend>
              {(['platform','handle','displayName'] as const).map(name=><Form.Item key={name} name={[field.name,name]} label={t('profile.'+name)} rules={name==='displayName'?[]:[{required:true,whitespace:true,message:t('profile.required')}]}><Input maxLength={name==='platform'?50:name==='handle'?200:100}/></Form.Item>)}
              <Button onClick={()=>remove(field.name)}>{t('profile.remove')}</Button>
            </fieldset>)}
            <Button disabled={fields.length>=10} onClick={()=>add({platform:'',handle:'',displayName:''})}>{t('profile.add_social')}</Button>
          </>}</Form.List>
        </details>
        <Button type="primary" htmlType="submit" loading={busy}>{t('profile.save')}</Button>
      </Form>
      {verification(refresh,profile)}
    </>}
  </section>;
}
