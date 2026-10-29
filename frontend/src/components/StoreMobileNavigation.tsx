import {Badge} from 'antd';
import {CompassOutlined,ShopOutlined,ShoppingCartOutlined,UserOutlined} from '@ant-design/icons';
import {Link,useLocation} from 'react-router-dom';
import {useI18n} from '../i18n';
import {scopedPath} from '../storeNavigation';

/** Mobile shortcuts are ordinary links; authentication and buying rules stay at their destinations. */
export default function StoreMobileNavigation({quantity}:{quantity:number}) {
  const {t}=useI18n(),location=useLocation();
  const entries=[['/recommendations','rec.title',ShopOutlined],['/products','store.catalog',CompassOutlined],
    ['/cart','store.cart',ShoppingCartOutlined],['/account','store.account',UserOutlined]] as const;
  return <nav className="browse-mobile-shortcuts" aria-label={t('browse.shortcuts')}>
    {entries.map(([path,key,Icon])=>{
      const active=path==='/products'?location.pathname==='/'||location.pathname==='/products'
        :path==='/cart'?location.pathname==='/cart'||location.pathname==='/checkout'
        :path==='/account'?location.pathname==='/account'||location.pathname==='/login'
        :location.pathname.startsWith('/recommendations');
      return <Link key={path} to={scopedPath(path,location.search)} className={active?'active':undefined} aria-current={active?'page':undefined}>
        <span className="browse-shortcut-icon">{path==='/cart'?<Badge count={quantity} size="small" overflowCount={99}><Icon aria-hidden="true"/></Badge>:<Icon aria-hidden="true"/>}</span>
        <span>{t(key)}</span>
      </Link>;
    })}
  </nav>;
}
