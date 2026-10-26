import { Alert, Card, Empty, Grid, Select, Space, Spin, Tag, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type Order, type Trip } from '../api';
import { useI18n } from '../i18n';

const { Title, Text } = Typography;

export default function ClientOrders({node}:{node?:number}) {
  const { t } = useI18n();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md !== true;
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<number>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,setError]=useState('');
  const generation=useRef(0);
  const formatAmount = (amount: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: 'JPY' }).format(amount);

  useEffect(() => {
    const request=++generation.current;
    let cancelled = false;
    setLoading(true);setOrders([]);setTrips([]);setSelectedTripId(undefined);setError('');
    (async () => {
      try {
        const tripList = (await api.customerTrips()).filter(trip=>node===undefined||trip.agentId===node);
        if (cancelled||request!==generation.current) return;
        setTrips(tripList);
        const firstTripId = tripList[0]?.id;
        if (firstTripId) {
          setSelectedTripId(firstTripId);
          const next=await api.customerOrders(firstTripId);if(!cancelled&&request===generation.current)setOrders(next);
        }
      } catch(error) {if(!cancelled&&request===generation.current)setError((error as Error).message);
      } finally {
        if (!cancelled&&request===generation.current) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      generation.current++;
    };
  }, [node]);

  const onTripChange = async (tripId: number) => {
    const request=++generation.current;
    setSelectedTripId(tripId);
    setLoading(true);setOrders([]);setError('');
    try {
      const next=await api.customerOrders(tripId);if(request===generation.current)setOrders(next);
    } catch(error) {if(request===generation.current)setError((error as Error).message);
    } finally {
      if(request===generation.current)setLoading(false);
    }
  };

  const summary = useMemo(
    () => ({
      totalOrders: orders.length,
      totalAmount: orders.reduce((sum, order) => sum + (order.totalAmount ?? 0), 0)
    }),
    [orders]
  );

  return (
    <div className="page-card client-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: '100%', justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0 }} data-testid="client-orders-title">
            {t('nav.client_orders')}
          </Title>
          <Select
            value={selectedTripId}
            placeholder={t('orders.trip.select.placeholder')}
            onChange={onTripChange}
            style={{ minWidth: isMobile ? '100%' : 280 }}
            options={trips.map((trip) => ({
              value: trip.id,
              label: `${trip.deliveryArea} · ${trip.deliveryDate}`
            }))}
          />
        </Space>
        <Text type="secondary" data-testid="orders-summary">
          Orders: {summary.totalOrders} | Total: {formatAmount(summary.totalAmount)}
        </Text>
        {error?<Alert type="error" message={error}/>:loading ? (
          <Spin />
        ) : orders.length === 0 ? (
          <Empty description={t('orders.empty')} />
        ) : (
          <div className="client-card-list">
            {orders.map((order) => (
              <Card key={order.id} className="client-list-card">
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Text strong>#{order.id}</Text>
                    <Tag>{order.status}</Tag>
                  </Space>
                  <Text>{order.businessId}</Text>
                  <Text type="secondary">
                    {t('orders.table.items')}: {order.lines?.length ?? 0}
                  </Text>
                  <Text strong>
                    {t('orders.table.total')}: {formatAmount(order.totalAmount)}
                  </Text>
                </Space>
              </Card>
            ))}
          </div>
        )}
      </Space>
    </div>
  );
}
