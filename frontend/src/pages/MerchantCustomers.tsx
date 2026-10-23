import { useEffect, useState } from 'react';
import { Alert, Button, Empty, Spin, Tag } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { storefrontApi, type MerchantCustomer } from '../api';
import { useI18n } from '../i18n';

export default function MerchantCustomers() {
  const { t } = useI18n();
  const [customers, setCustomers] = useState<MerchantCustomer[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number>();
  const load = () => storefrontApi.customers().then(setCustomers).catch(e => setError(e.message));
  useEffect(() => { void load(); }, []);
  async function approve(id: number) {
    setBusy(id); setError('');
    try { await storefrontApi.approve(id); await load(); } catch (e) { setError((e as Error).message); }
    finally { setBusy(undefined); }
  }
  return <section><h1>{t('nav.customers')}</h1>{error && <Alert type="error" message={error} />}
    {!customers ? <Spin /> : customers.length === 0 ? <Empty description={t('customers.empty')} /> :
      <div className="customer-relations">{customers.map(c => <article key={c.customerId}>
        <div><h2>{c.name}</h2><small>{t('customers.number',{id:c.customerId})}</small></div>
        <Tag color={c.emailVerified ? 'green' : 'default'}>{c.emailVerified ? t('store.verified') : t('customers.unverified')}</Tag>
        {c.merchantApproved ? <Tag color="green">{t('customers.approved')}</Tag> :
          <Button icon={<CheckOutlined />} loading={busy === c.customerId} onClick={() => void approve(c.customerId)}>{t('customers.approve')}</Button>}
      </article>)}</div>}
  </section>;
}
