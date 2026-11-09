import{useEffect,useRef,useState}from'react';
import{Alert,Button,Form,Input,Spin}from'antd';
import{storefrontApi,type SelfAddress}from'../api';
import{getStoredAccessToken}from'../authStorage';
import{useI18n}from'../i18n';
const required=['contactName','countryRegion','city','addressLine']as const;
export function completeAddress(address:SelfAddress|null|undefined){return!!address&&required.every(field=>typeof address[field]==='string'&&!!address[field]?.trim());}
export default function CheckoutAddress({userId,identity,onReady}:{userId:number;identity:string;onReady:(identity:string,ready:boolean)=>void}){
 const{t}=useI18n(),[form]=Form.useForm<SelfAddress>();
 const[address,setAddress]=useState<SelfAddress>(),[loaded,setLoaded]=useState(false),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const alive=useRef(false),sequence=useRef(0),token=useRef(getStoredAccessToken()),notify=useRef(onReady);notify.current=onReady;
 const current=()=>alive.current&&getStoredAccessToken()===token.current;
 useEffect(()=>{alive.current=true;const generation=++sequence.current;token.current=getStoredAccessToken();setLoaded(false);setAddress(undefined);setError('');notify.current(identity,false);
  void storefrontApi.profile().then(profile=>{if(!current()||generation!==sequence.current)return;if(profile.id!==userId)throw Error(t('errors.request_failed'));const a=profile.defaultAddress??{};setAddress(a);form.setFieldsValue(a);setEditing(!completeAddress(a));setLoaded(true);notify.current(identity,completeAddress(a));}).catch(e=>{if(current()&&generation===sequence.current)setError((e as Error).message);});
  return()=>{alive.current=false;sequence.current++;};
 },[userId,identity,form,attempt]);
 async function save(values:SelfAddress){if(!current())return;setBusy(true);setError('');notify.current(identity,false);
  try{const{contactName,countryRegion,city,addressLine,phone,postalCode}=values;const profile=await storefrontApi.saveProfile({defaultAddress:{contactName,countryRegion,city,addressLine,phone:phone??null,postalCode:postalCode??null}});
   if(!current())return;if(profile.id!==userId||!completeAddress(profile.defaultAddress))throw Error(t('checkout.address_required'));
   setAddress(profile.defaultAddress!);setEditing(false);notify.current(identity,true);
  }catch(e){if(current())setError((e as Error).message);}finally{if(current())setBusy(false);}
 }
 return<section aria-label={t('checkout.delivery')}>
  <h3>{t('checkout.delivery')}</h3><p>{t('checkout.address_hint')}</p>
  {error&&<Alert type="error" message={error}/>}
  {!loaded?error?<Button onClick={()=>setAttempt(v=>v+1)}>{t('maintenance.retry')}</Button>:<Spin/>:editing?<Form form={form} layout="vertical" onFinish={save} disabled={busy}>
   {([...required,'phone','postalCode']as const).map(field=><Form.Item key={field} name={field} label={t('profile.'+field)} rules={required.includes(field as typeof required[number])?[{required:true,whitespace:true,message:t('profile.required')}]:[]}><Input maxLength={field==='addressLine'?1000:field==='phone'?50:field==='postalCode'?30:100} autoComplete={field==='contactName'?'name':field==='addressLine'?'street-address':undefined}/></Form.Item>)}
   <Button htmlType="submit" type="primary" loading={busy}>{t('checkout.save_address')}</Button>
  </Form>:<><p>{[address?.contactName,address?.countryRegion,address?.city,address?.addressLine,address?.postalCode,address?.phone].filter(Boolean).join(' · ')}</p><Button onClick={()=>{setEditing(true);notify.current(identity,false);}}>{t('profile.address')}</Button></>}
 </section>;
}
