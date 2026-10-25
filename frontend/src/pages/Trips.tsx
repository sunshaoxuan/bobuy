import { Button, DatePicker, Form, Input, Space, Table, Tag, Tooltip, message } from 'antd';
import { CloseOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import { api, Trip } from '../api';
import { useI18n } from '../i18n';

type TripForm = { deliveryArea: string; deliveryDate: Dayjs };

export default function Trips() {
  const { t } = useI18n();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm<TripForm>();

  const refreshTrips = async () => {
    try { setTrips(await api.trips()); } finally { setLoading(false); }
  };
  useEffect(() => { void refreshTrips().catch(() => {}); }, []);

  const cancelEdit = () => { setEditingId(null); form.resetFields(); };
  const handleSubmit = async (values: TripForm) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = { deliveryArea: values.deliveryArea.trim(), deliveryDate: values.deliveryDate.format('YYYY-MM-DD') };
      if (editingId !== null) await api.updateTrip(editingId, payload);
      else await api.createTrip(payload);
      message.success(t(editingId !== null ? 'trips.form.updated' : 'trips.form.success'));
      cancelEdit();
      await refreshTrips();
    } catch { /* The API layer reports request failures. */ }
    finally { setSubmitting(false); }
  };

  const columns: ColumnsType<Trip> = [
    { title: t('trips.table.delivery_area'), dataIndex: 'deliveryArea', render: (area: string) => <Tooltip title={area} trigger={['hover', 'focus']}><span tabIndex={0} className="trip-area">{area}</span></Tooltip> },
    { title: t('trips.table.delivery_date'), dataIndex: 'deliveryDate', width: 150 },
    { title: t('trips.table.status'), dataIndex: 'status', width: 150,
      render: (status: string) => <Tag color={status === 'SETTLED' ? 'green' : 'blue'}>{t(`enum.trip_status.${status}`)}</Tag> },
    { title: t('trips.table.actions'), width: 72,
      render: (_: unknown, trip) => <Tooltip title={t('trips.form.edit')}><Button icon={<EditOutlined />} aria-label={t('trips.form.edit')}
        disabled={submitting || trip.settlementFrozen} onClick={() => {
          setEditingId(trip.id);
          form.setFieldsValue({ deliveryArea: trip.deliveryArea, deliveryDate: dayjs(trip.deliveryDate) });
          form.getFieldInstance('deliveryArea')?.focus();
          document.querySelector('.trip-editor')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }} /></Tooltip> }
  ];

  return <div className="page-card">
    <div className="section-title" data-testid="trips-title">{t('trips.title')}</div>
    <section className="trip-editor">
      <h2 className="trip-editor-heading">{t(editingId !== null ? 'trips.form.edit' : 'trips.form.create')}</h2>
      <Form className="trip-form-grid" form={form} layout="vertical" onFinish={handleSubmit} disabled={submitting}>
        <Form.Item label={t('trips.form.delivery_area.label')} name="deliveryArea"
          rules={[{ required: true, whitespace: true, message: t('trips.form.delivery_area.required') }, { max: 255 }]}>
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 12 }} maxLength={255} placeholder={t('trips.form.delivery_area.placeholder')} />
        </Form.Item>
        <Form.Item label={t('trips.form.delivery_date.label')} name="deliveryDate"
          rules={[{ required: true, message: t('trips.form.delivery_date.required') }]}>
          <DatePicker style={{ width: '100%' }} placeholder={t('trips.form.delivery_date.placeholder')} />
        </Form.Item>
        <div className="trip-form-actions"><Space>
          {editingId !== null && <Button icon={<CloseOutlined />} onClick={cancelEdit}>{t('trips.form.cancel')}</Button>}
          <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={submitting} data-testid="trips-submit">
            {t(editingId !== null ? 'trips.form.save' : 'trips.form.submit')}
          </Button>
        </Space></div>
      </Form>
    </section>
    <section className="trip-list-section">
      <div className="trip-list-heading"><h2>{t('trips.list.title')}</h2><span>{t('admin.trip_count', { count: trips.length })}</span></div>
      <Table<Trip> className="regional-trips-table" loading={loading} dataSource={trips} rowKey="id" columns={columns}
        locale={{ emptyText: t('table.empty') }} scroll={{ x: 560 }} />
    </section>
  </div>;
}
