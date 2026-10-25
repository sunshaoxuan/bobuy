import { Alert, Grid, Select, Space, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { api, type Order, type Trip } from '../api';
import ChatWidget from '../components/ChatWidget';
import { useI18n } from '../i18n';

const { Title } = Typography;

export default function ClientChat() {
  const { t } = useI18n();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md !== true;
  const [trips, setTrips] = useState<Trip[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<number>();
  const [selectedOrderId, setSelectedOrderId] = useState<number>();
  const senderId =
    typeof window !== 'undefined' ? window.localStorage.getItem('bobbuy_chat_sender_id') ?? 'DEMO-CUST' : 'DEMO-CUST';

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.trips(), api.orders()]).then(([tripList, orderList]) => {
      if (cancelled) {
        return;
      }
      setTrips(tripList);
      setOrders(orderList);
      const firstTripId = resolveInitialTripId(tripList, orderList);
      setSelectedTripId(firstTripId ?? undefined);
      setSelectedOrderId(resolveInitialOrderId(orderList, firstTripId));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredOrders = useMemo(
    () => orders.filter((order) => !selectedTripId || order.tripId === selectedTripId),
    [orders, selectedTripId]
  );

  useEffect(() => {
    if (filteredOrders.length === 0) {
      setSelectedOrderId(undefined);
      return;
    }
    if (!filteredOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(filteredOrders[0].id);
    }
  }, [filteredOrders, selectedOrderId]);

  return (
    <div className="page-card client-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: '100%', justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0 }} data-testid="client-chat-title">
            {t('nav.client_chat')}
          </Title>
          <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : undefined }}>
            <Select
              value={selectedOrderId}
              placeholder={t('chat.order_context_placeholder')}
              onChange={(value) => setSelectedOrderId(value)}
              style={{ minWidth: isMobile ? '100%' : 320 }}
              options={filteredOrders.map((order) => ({
                value: order.id,
                label: `${order.businessId} · ${order.lines?.[0]?.itemName ?? t('chat.order_context_fallback')}`
              }))}
            />
            <Select
              value={selectedTripId}
              placeholder={t('orders.trip.select.placeholder')}
              onChange={(value) => setSelectedTripId(value)}
              style={{ minWidth: isMobile ? '100%' : 240 }}
              options={trips.map((trip) => ({
                value: trip.id,
                label: `${trip.deliveryArea} · ${trip.deliveryDate}`
              }))}
            />
          </Space>
        </Space>
        <Alert type="info" showIcon message={t('chat.order_context_title')} description={t('chat.order_context_hint')} />
        <ChatWidget orderId={selectedOrderId} senderId={senderId} recipientId="PURCHASER" />
      </Space>
    </div>
  );
}

function resolveInitialTripId(trips: Trip[], orders: Order[]) {
  return orders[0]?.tripId ?? trips[0]?.id;
}

function resolveInitialOrderId(orders: Order[], tripId?: number) {
  if (orders.length === 0) {
    return undefined;
  }
  return orders.find((order) => order.tripId === tripId)?.id ?? orders[0]?.id;
}
