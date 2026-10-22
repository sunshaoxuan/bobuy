import { useEffect, useState } from 'react';
import { Alert, Button, Empty, Spin, Tag } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { storefrontApi, type MerchantCustomer } from '../api';

export default function MerchantCustomers() {
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
  return <section><h1>客户认可</h1>{error && <Alert type="error" message={error} />}
    {!customers ? <Spin /> : customers.length === 0 ? <Empty description="暂无客户订单" /> :
      <div className="customer-relations">{customers.map(c => <article key={c.customerId}>
        <div><h2>{c.name}</h2><small>客户 #{c.customerId}</small></div>
        <Tag color={c.emailVerified ? 'green' : 'default'}>{c.emailVerified ? '邮箱已验证' : '邮箱未验证'}</Tag>
        {c.merchantApproved ? <Tag color="green">本商家已认可</Tag> :
          <Button icon={<CheckOutlined />} loading={busy === c.customerId} onClick={() => void approve(c.customerId)}>认可此客户</Button>}
      </article>)}</div>}
  </section>;
}
