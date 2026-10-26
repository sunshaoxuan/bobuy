import {useEffect,useState} from 'react';
import {Alert,Button,Empty,Spin,Tag} from 'antd';
import {CalendarOutlined,ArrowRightOutlined} from '@ant-design/icons';
import {Link,useLocation} from 'react-router-dom';
import {api,type Trip} from '../api';
import {useUserRole} from '../context/UserRoleContext';
import {useI18n} from '../i18n';
import {scopedPath} from '../storeNavigation';

export default function ClientTrips({node}:{node?:number}) {
  const {isAuthenticated,isCustomer,user}=useUserRole(),{t}=useI18n(),location=useLocation();
  const [state,setState]=useState<{user?:number;items:Trip[];busy:boolean;error:string}>({items:[],busy:true,error:''});
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;setState({items:[],busy:true,error:''});
    if(!isCustomer)return()=>{active=false;};
    void api.customerTrips().then(items=>{if(active)setState({user:user?.id,items,busy:false,error:''});})
      .catch(error=>{if(active)setState({items:[],busy:false,error:error.message});});
    return()=>{active=false;};
  },[isCustomer,user?.id,retry]);
  const items=state.user===user?.id?state.items.filter(trip=>['IN_PROGRESS','COMPLETED','SETTLED'].includes(trip.status)&&(node===undefined||trip.agentId===node)):[];
  return <section className="browse-trip-page"><header className="browse-page-heading"><span>{t('browse.your_journeys')}</span><h1>{t('browse.executed')}</h1><p>{t('browse.executed_hint')}</p></header>
    {!isAuthenticated?<Empty description={t('browse.signin_trips')}><Link to={scopedPath('/account',location.search)}><Button type="primary">{t('store.signin')}</Button></Link></Empty>
    :!isCustomer?<Alert type="info" message={t('store.customer_only')}/>
    :state.busy?<div className="store-loading"><Spin/></div>
    :state.error?<Alert type="error" message={state.error} action={<Button onClick={()=>setRetry(value=>value+1)}>{t('store.retry')}</Button>}/>
    :!items.length?<Empty description={t('browse.no_executed')}/>
    :<div className="browse-trip-grid">{items.map(trip=><article className="browse-trip-card" key={trip.id}><CalendarOutlined/><time dateTime={trip.deliveryDate}>{trip.deliveryDate}</time><h2>{trip.deliveryArea}</h2><Tag>{t('enum.trip_status.'+trip.status)}</Tag><Link to={scopedPath('/client/orders',location.search)}>{t('store.orders')}<ArrowRightOutlined/></Link></article>)}</div>}
  </section>;
}
