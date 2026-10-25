import { Button, Card, Collapse, Form, Input, InputNumber, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { api, Order, OrderLine, Trip } from '../api';
import { useI18n } from '../i18n';

const { Text } = Typography;

const statusOptions = ['NEW', 'CONFIRMED', 'PURCHASED', 'DELIVERED', 'SETTLED', 'CANCELLED'] as const;
const currencyOptions = ['CNY', 'JPY', 'USD', 'EUR'] as const;
const paymentMethodOptions = ['ALIPAY', 'WECHAT', 'CASH'] as const;

export default function Orders() {
  const { t } = useI18n();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState<string | null>(null);
  const [form] = Form.useForm<Omit<Order, 'id' | 'statusUpdatedAt'>>();

  const refreshOrders = async (tripId?: number | null) => {
    const refreshed = await api.orders(typeof tripId === 'number' ? tripId : undefined);
    setOrders(refreshed);
  };

  const refreshTrips = async () => {
    const refreshed = await api.trips();
    setTrips(refreshed);
    if (refreshed.length === 0) {
      setSelectedTripId(null);
      return;
    }
    if (!refreshed.some((trip) => trip.id === selectedTripId)) {
      setSelectedTripId(refreshed[0].id);
    }
  };

  const handleStatusChange = async (orderId: number, newStatus: string, currentStatus: string) => {
    if (newStatus === currentStatus) {
      return;
    }
    try {
      await api.updateOrderStatus(orderId, newStatus);
      message.success(t('orders.status.updated'));
      await refreshOrders(selectedTripId);
      await refreshTrips();
    } catch {
      // Errors are surfaced in the API layer.
    }
  };

  const handleBulkStatusUpdate = async (targetStatus: string) => {
    if (typeof selectedTripId !== 'number' || bulkUpdating) {
      return;
    }
    try {
      setBulkUpdating(targetStatus);
      await api.bulkUpdateTripOrderStatus(selectedTripId, targetStatus);
      message.success(t('orders.bulk_status.updated'));
      await refreshOrders(selectedTripId);
      await refreshTrips();
    } catch {
      // Errors are surfaced in the API layer.
    } finally {
      setBulkUpdating(null);
    }
  };

  const lineColumns: ColumnsType<OrderLine> = [
    {
      title: t('orders.lines.item_name'),
      dataIndex: 'itemName'
    },
    {
      title: t('orders.lines.sku_id'),
      dataIndex: 'skuId'
    },
    {
      title: t('orders.lines.spec'),
      dataIndex: 'spec',
      render: (value) => value || '-'
    },
    {
      title: t('orders.lines.quantity'),
      dataIndex: 'quantity'
    },
    {
      title: t('orders.lines.unit_price'),
      dataIndex: 'unitPrice',
      render: (value) => (typeof value === 'number' ? value.toFixed(2) : '0.00')
    },
    {
      title: t('orders.lines.total'),
      render: (_value, record) => {
        const total = (record.unitPrice ?? 0) * (record.quantity ?? 0);
        return total.toFixed(2);
      }
    }
  ];

  useEffect(() => {
    refreshTrips();
  }, []);

  useEffect(() => {
    if (selectedTripId === null && trips.length === 0) {
      return;
    }
    refreshOrders(selectedTripId);
    if (typeof selectedTripId === 'number') {
      form.setFieldsValue({ tripId: selectedTripId });
    }
  }, [selectedTripId, trips, form]);

  const handleSubmit = async (values: any) => {
    if (submitting || selectedTrip?.settlementFrozen) {
      return;
    }
    try {
      setSubmitting(true);

      // 生成符合 PROD-03 规范的 Business ID (日期+序列号)
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timePart = now.toTimeString().slice(0, 8).replace(/:/g, '');
      const businessId = `${datePart}${timePart}${Math.floor(Math.random() * 100)}`;

      // 转换为头行结构
      const payload = {
        businessId,
        customerId: values.customerId,
        tripId: typeof values.tripId === 'number' ? values.tripId : undefined,
        desiredDeliveryWindow: values.desiredDeliveryWindow?.trim() || undefined,
        status: values.status,
        paymentMethod: values.paymentMethod,
        paymentStatus: 'UNPAID',
        lines: [
          {
            skuId: `SKU-${values.itemName.toUpperCase().replace(/\s+/g, '-')}`,
            itemName: values.itemName,
            quantity: values.quantity,
            unitPrice: values.unitPrice
          }
        ]
      };

      await api.createOrder(payload as any);
      message.success(t('orders.form.success'));
      form.resetFields();
      if (typeof values.tripId === 'number') {
        setSelectedTripId(values.tripId);
      }
      await refreshOrders(values.tripId);
    } catch {
      // Errors are surfaced in the API layer.
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTrip = trips.find((trip) => trip.id === selectedTripId);
  const settlementFrozen = Boolean(selectedTrip?.settlementFrozen);
  const bulkDisabled = typeof selectedTripId !== 'number' || orders.length === 0 || settlementFrozen;

  const orderPanels = orders.map((order) => ({
    key: order.businessId,
    label: (
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', rowGap: 8, columnGap: 12 }}>
        <div>
          <Text strong>{order.businessId}</Text>
          <Text type="secondary" style={{ marginLeft: 12 }}>
            {t('orders.header.customer_id')}: {order.customerId}
          </Text>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Text>
            {t('orders.header.total')}: {order.totalAmount?.toFixed(2)}
          </Text>
          <Tag color="gold">{t(`enum.order_status.${order.status}`)}</Tag>
        </div>
      </div>
    ),
    children: (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', rowGap: 8, columnGap: 12 }}>
          <Text type="secondary">{t('orders.header.status')}</Text>
              <Select
                value={order.status}
                onChange={(newStatus) => handleStatusChange(order.id, newStatus, order.status)}
                options={statusOptions.map((status) => ({ value: status, label: t(`enum.order_status.${status}`) }))}
                disabled={order.status === 'SETTLED' || order.status === 'CANCELLED' || settlementFrozen}
                style={{ width: 160 }}
              />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', rowGap: 8, columnGap: 12 }}>
            <Text type="secondary">{t('orders.header.payment_status')}</Text>
            <Tag color="blue">{t(`enum.payment_status.${order.paymentStatus ?? 'UNPAID'}`)}</Tag>
          </div>
        <Table<OrderLine>
          dataSource={order.lines}
          rowKey={(record) => record.id ?? `${record.skuId}-${record.spec ?? 'default'}`}
          columns={lineColumns}
          pagination={false}
          locale={{ emptyText: t('table.empty') }}
          scroll={{ x: 'max-content' }}
        />
      </div>
    )
  }));

  return (
    <div className="page-card">
      <div className="section-title" data-testid="orders-title">{t('orders.title')}</div>
      <Text className="helper-text">{t('orders.helper')}</Text>

      <Card style={{ marginTop: 16, marginBottom: 24 }} bordered={false} title={t('orders.trip.title')}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
          <div style={{ minWidth: 200 }}>
            <Text type="secondary">{t('orders.trip.select.label')}</Text>
            <div>
              <Select
                value={selectedTripId ?? undefined}
                onChange={(value) => setSelectedTripId(value)}
                placeholder={t('orders.trip.select.placeholder')}
                options={trips.map((trip) => ({
                  value: trip.id,
                  label: `${trip.deliveryArea} · ${trip.deliveryDate}`
                }))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          {selectedTrip ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', minWidth: 0 }}>
              <div>
                <Text type="secondary">{t('orders.trip.delivery_area')}</Text>
                <div>{selectedTrip.deliveryArea}</div>
              </div>
              <div>
                <Text type="secondary">{t('orders.trip.delivery_date')}</Text>
                <div>{selectedTrip.deliveryDate}</div>
              </div>
              <div>
                <Text type="secondary">{t('orders.trip.status')}</Text>
                <div><Tag color="blue">{t(`enum.trip_status.${selectedTrip.status}`)}</Tag></div>
              </div>
              <div>
                <Text type="secondary">{t('orders.trip.freeze_status')}</Text>
                <div>
                  {settlementFrozen ? <Tag color="red">{selectedTrip.settlementFreezeStage}</Tag> : <Tag color="green">{t('orders.trip.freeze_active')}</Tag>}
                </div>
              </div>
              <div>
                <Text type="secondary">{t('orders.trip.actions.title')}</Text>
                <div>
                  <Space wrap>
                    <Button
                      onClick={() => handleBulkStatusUpdate('CONFIRMED')}
                      disabled={bulkDisabled || bulkUpdating !== null}
                      loading={bulkUpdating === 'CONFIRMED'}
                    >
                      {t('orders.trip.actions.confirm_all')}
                    </Button>
                    <Button
                      onClick={() => handleBulkStatusUpdate('PURCHASED')}
                      disabled={bulkDisabled || bulkUpdating !== null}
                      loading={bulkUpdating === 'PURCHASED'}
                    >
                      {t('orders.trip.actions.mark_purchased')}
                    </Button>
                    <Button
                      onClick={() => handleBulkStatusUpdate('DELIVERED')}
                      disabled={bulkDisabled || bulkUpdating !== null}
                      loading={bulkUpdating === 'DELIVERED'}
                    >
                      {t('orders.trip.actions.mark_delivered')}
                    </Button>
                  </Space>
                </div>
              </div>
            </div>
          ) : (
            <Text type="secondary">{t('table.empty')}</Text>
          )}
        </div>
      </Card>

      <Card style={{ marginTop: 16, marginBottom: 24 }} bordered={false}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            currency: 'CNY',
            status: 'NEW',
            quantity: 1,
            unitPrice: 0,
            serviceFee: 0,
            estimatedTax: 0,
            paymentMethod: 'ALIPAY'
          }}
        >
          {settlementFrozen ? <Text type="danger">{selectedTrip?.settlementFreezeReason || t('orders.trip.freeze_warning')}</Text> : null}
          <Form.Item
            label={t('orders.form.customer_id.label')}
            name="customerId"
            rules={[{ required: true, message: t('orders.form.customer_id.required') }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder={t('orders.form.customer_id.placeholder')} />
          </Form.Item>
          <Form.Item
            label={t('orders.form.trip_id.label')}
            name="tripId"
            dependencies={['desiredDeliveryWindow']}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const hasWindow = Boolean(getFieldValue('desiredDeliveryWindow'));
                  if (value || hasWindow) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('orders.form.trip_or_window.required')));
                }
              })
            ]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder={t('orders.form.trip_id.placeholder')} />
          </Form.Item>
          <Form.Item
            label={t('orders.form.desired_delivery_window.label')}
            name="desiredDeliveryWindow"
            dependencies={['tripId']}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const hasTrip = Boolean(getFieldValue('tripId'));
                  if (hasTrip || (typeof value === 'string' && value.trim().length > 0)) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('orders.form.trip_or_window.required')));
                }
              })
            ]}
          >
            <Input placeholder={t('orders.form.desired_delivery_window.placeholder')} />
          </Form.Item>
          <Form.Item
            label={t('orders.form.item_name.label')}
            name="itemName"
            rules={[{ required: true, message: t('orders.form.item_name.required') }]}
          >
            <Input placeholder={t('orders.form.item_name.placeholder')} />
          </Form.Item>
          <Form.Item
            label={t('orders.form.quantity.label')}
            name="quantity"
            rules={[{ required: true, message: t('orders.form.quantity.required') }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder={t('orders.form.quantity.placeholder')} />
          </Form.Item>
          <Form.Item
            label={t('orders.form.unit_price.label')}
            name="unitPrice"
            rules={[{ required: true, message: t('orders.form.unit_price.required') }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder={t('orders.form.unit_price.placeholder')} />
          </Form.Item>
          <Form.Item
            label={t('orders.form.service_fee.label')}
            name="serviceFee"
            rules={[{ required: true, message: t('orders.form.service_fee.required') }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder={t('orders.form.service_fee.placeholder')} />
          </Form.Item>
          <Form.Item
            label={t('orders.form.estimated_tax.label')}
            name="estimatedTax"
            rules={[{ required: true, message: t('orders.form.estimated_tax.required') }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder={t('orders.form.estimated_tax.placeholder')} />
          </Form.Item>
          <Form.Item
            label={t('orders.form.currency.label')}
            name="currency"
            rules={[{ required: true, message: t('orders.form.currency.required') }]}
          >
            <Select
              options={currencyOptions.map((currency) => ({ value: currency, label: t(`enum.currency.${currency}`) }))}
              placeholder={t('orders.form.currency.placeholder')}
            />
          </Form.Item>
          <Form.Item
            label={t('orders.form.payment_method.label')}
            name="paymentMethod"
            rules={[{ required: true, message: t('orders.form.payment_method.required') }]}
          >
            <Select
              options={paymentMethodOptions.map((method) => ({ value: method, label: t(`enum.payment_method.${method}`) }))}
              placeholder={t('orders.form.payment_method.placeholder')}
            />
          </Form.Item>
          <Form.Item
            label={t('orders.form.status.label')}
            name="status"
            rules={[{ required: true, message: t('orders.form.status.required') }]}
          >
            <Select
              options={statusOptions.map((status) => ({ value: status, label: t(`enum.order_status.${status}`) }))}
              placeholder={t('orders.form.status.placeholder')}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} disabled={submitting || settlementFrozen} data-testid="orders-submit">
            {t('orders.form.submit')}
          </Button>
        </Form>
      </Card>

      <Card bordered={false} title={t('orders.list.title')}>
        {orders.length === 0 ? (
          <Text type="secondary">{t('table.empty')}</Text>
        ) : (
          <Collapse items={orderPanels} defaultActiveKey={orders[0]?.businessId} />
        )}
      </Card>
    </div>
  );
}
