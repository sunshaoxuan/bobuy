import { Card, Col, Divider, Row, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { api, Metrics, Order, Trip } from '../api';
import StatCard from '../components/StatCard';
import { useI18n } from '../i18n';

const { Text } = Typography;

export default function Dashboard() {
  const { t } = useI18n();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const tripColumns: ColumnsType<Trip> = [
    { title: t('dashboard.trips.delivery_area'), dataIndex: 'deliveryArea' },
    { title: t('dashboard.trips.delivery_date'), dataIndex: 'deliveryDate' },
    {
      title: t('dashboard.trips.status'),
      dataIndex: 'status',
      render: (status: Trip['status']) => <Tag color="blue">{t(`enum.trip_status.${status}`)}</Tag>
    }
  ];

  const orderColumns: ColumnsType<Order> = [
    {
      title: t('dashboard.orders.item_name'),
      render: (_, record) => record.lines?.[0]?.itemName || '-'
    },
    {
      title: t('dashboard.orders.quantity'),
      render: (_, record) => record.lines?.[0]?.quantity || 0
    },
    {
      title: t('dashboard.orders.amount'),
      dataIndex: 'totalAmount',
      render: (val) => `¥ ${val?.toFixed(2) || '0.00'}`
    },
    {
      title: t('dashboard.orders.status'),
      dataIndex: 'status',
      render: (status: Order['status']) => <Tag color="gold">{t(`enum.order_status.${status}`)}</Tag>
    }
  ];

  useEffect(() => {
    api.metrics().then(setMetrics);
    api.trips().then(setTrips);
    api.orders().then(setOrders);
  }, []);

  return (
    <div className="page-card">
      <div className="section-title" data-testid="dashboard-title">{t('dashboard.title')}</div>
      <div className="dashboard-grid">
        <StatCard
          label={t('dashboard.stats.active_users')}
          value={metrics ? String(metrics.users) : '--'}
          helper={t('dashboard.stats.active_users.helper')}
        />
        <StatCard
          label={t('dashboard.stats.active_trips')}
          value={metrics ? String(metrics.trips) : '--'}
          helper={t('dashboard.stats.active_trips.helper')}
        />
        <StatCard
          label={t('dashboard.stats.pending_orders')}
          value={metrics ? String(metrics.orders) : '--'}
          helper={t('dashboard.stats.pending_orders.helper')}
        />
        <StatCard
          label={t('dashboard.stats.gmv')}
          value={metrics ? `¥ ${metrics.gmV.toFixed(2)}` : '--'}
          helper={t('dashboard.stats.gmv.helper')}
        />
      </div>

      <Divider />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card bordered={false} title={t('dashboard.trips.title')}>
            <Table<Trip>
              size="small"
              pagination={false}
              dataSource={trips}
              rowKey="id"
              columns={tripColumns}
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card bordered={false} title={t('dashboard.orders.title')}>
            <Table<Order>
              size="small"
              pagination={false}
              dataSource={orders}
              rowKey="id"
              columns={orderColumns}
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </Col>
      </Row>

      <Divider />

      <Card bordered={false}>
        <div className="section-title">{t('dashboard.status_distribution.title')}</div>
        <Text className="helper-text">
          {metrics?.orderStatusCounts
              ? Object.entries(metrics.orderStatusCounts)
              .map(([status, count]) => `${t(`enum.order_status.${status}`)}: ${count}`)
              .join(' · ')
            : '--'}
        </Text>
        <Divider />
        <Text className="helper-text">{t('dashboard.ai_insight')}</Text>
      </Card>
    </div>
  );
}
