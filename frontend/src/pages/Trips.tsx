import { Button, DatePicker, Form, Input, InputNumber, Select, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { api, Trip } from '../api';
import { getStoredLocale, useI18n } from '../i18n';

const { Text } = Typography;

const statusOptions = ['DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED'] as const;

export default function Trips() {
  const { t } = useI18n();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<Omit<Trip, 'id' | 'statusUpdatedAt' | 'remainingCapacity'>>();

  const refreshTrips = async () => {
    const refreshed = await api.trips();
    setTrips(refreshed);
  };

  const handleStatusChange = async (tripId: number, newStatus: string, currentStatus: string) => {
    if (newStatus === currentStatus) {
      return;
    }
    try {
      const response = await fetch(`/api/trips/${tripId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': getStoredLocale()
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) {
        throw new Error('request_failed');
      }
      message.success(t('trips.status.updated'));
      await refreshTrips();
    } catch {
      message.error(t('errors.request_failed'));
    }
  };

  const columns: ColumnsType<Trip> = [
    { title: t('trips.table.origin'), dataIndex: 'origin' },
    { title: t('trips.table.destination'), dataIndex: 'destination' },
    { title: t('trips.table.depart_date'), dataIndex: 'departDate' },
    { title: t('trips.table.capacity'), dataIndex: 'capacity' },
    { title: t('trips.table.remaining_capacity'), dataIndex: 'remainingCapacity' },
    {
      title: t('trips.table.status'),
      dataIndex: 'status',
      render: (status: Trip['status']) => <Tag color="blue">{t(`enum.trip_status.${status}`)}</Tag>
    },
    {
      title: t('trips.table.actions'),
      render: (_value: unknown, record) => (
        <Select
          value={record.status}
          onChange={(newStatus) => handleStatusChange(record.id, newStatus, record.status)}
          options={statusOptions.map((status) => ({ value: status, label: t(`enum.trip_status.${status}`) }))}
          disabled={record.status === 'COMPLETED'}
          style={{ width: 160 }}
        />
      )
    }
  ];

  useEffect(() => {
    refreshTrips();
  }, []);

  const handleSubmit = async (values: Omit<Trip, 'id' | 'statusUpdatedAt' | 'remainingCapacity'>) => {
    if (submitting) {
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        ...values,
        departDate: (values.departDate as any)?.format?.('YYYY-MM-DD') || values.departDate
      };
      await api.createTrip(payload);
      message.success(t('trips.form.success'));
      form.resetFields();
      await refreshTrips();
    } catch {
      // Errors are surfaced in the API layer.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-card">
      <div className="section-title" data-testid="trips-title">{t('trips.title')}</div>
      <Text className="helper-text">{t('trips.helper')}</Text>

      <section className="trip-editor">
        <Form
          className="trip-form-grid"
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ status: 'DRAFT', capacity: 1, reservedCapacity: 0 }}
        >
          <Form.Item
            label={t('trips.form.agent_id.label')}
            name="agentId"
            rules={[{ required: true, message: t('trips.form.agent_id.required') }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder={t('trips.form.agent_id.placeholder')} />
          </Form.Item>
          <Form.Item
            label={t('trips.form.origin.label')}
            name="origin"
            rules={[{ required: true, message: t('trips.form.origin.required') }]}
          >
            <Input placeholder={t('trips.form.origin.placeholder')} />
          </Form.Item>
          <Form.Item
            label={t('trips.form.destination.label')}
            name="destination"
            rules={[{ required: true, message: t('trips.form.destination.required') }]}
          >
            <Input placeholder={t('trips.form.destination.placeholder')} />
          </Form.Item>
          <Form.Item
            label={t('trips.form.depart_date.label')}
            name="departDate"
            rules={[{ required: true, message: t('trips.form.depart_date.required') }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder={t('trips.form.depart_date.placeholder')} />
          </Form.Item>
          <Form.Item
            label={t('trips.form.capacity.label')}
            name="capacity"
            rules={[{ required: true, message: t('trips.form.capacity.required') }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder={t('trips.form.capacity.placeholder')} />
          </Form.Item>
          <Form.Item
            label={t('trips.form.status.label')}
            name="status"
            rules={[{ required: true, message: t('trips.form.status.required') }]}
          >
            <Select
              options={statusOptions.map((status) => ({ value: status, label: t(`enum.trip_status.${status}`) }))}
              placeholder={t('trips.form.status.placeholder')}
            />
          </Form.Item>
          <div className="trip-form-actions"><Button type="primary" htmlType="submit" loading={submitting} disabled={submitting} data-testid="trips-submit">
            {t('trips.form.submit')}
          </Button></div>
        </Form>
      </section>

      <section className="trip-list-section"><div className="trip-list-heading"><h2>{t('trips.list.title')}</h2><span>{t('admin.trip_count', { count: trips.length })}</span></div>
        <Table<Trip>
          dataSource={trips}
          rowKey="id"
          columns={columns}
          locale={{ emptyText: t('table.empty') }}
          scroll={{ x: 'max-content' }}
        />
      </section>
    </div>
  );
}
