import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Breadcrumb, Card, Checkbox, Empty, Grid, Radio, Select, Space, Spin, Table, Tag, Typography, message } from 'antd';
import { api, type PickingChecklist, type Trip } from '../api';
import { useI18n } from '../i18n';

const { Title, Text } = Typography;

export default function PickingMaster() {
  const { t } = useI18n();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md !== true;
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState<string>();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTripId, setActiveTripId] = useState<number>();
  const [entries, setEntries] = useState<PickingChecklist[]>([]);

  const loadTripData = useCallback(async (tripId: number) => {
    setLoading(true);
    try {
      setEntries(await api.procurementPickingChecklist(tripId));
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      setLoading(true);
      try {
        const tripList = await api.trips();
        if (cancelled) {
          return;
        }
        setTrips(tripList);
        const firstTripId = tripList[0]?.id;
        setActiveTripId(firstTripId);
        if (firstTripId) {
          await loadTripData(firstTripId);
        } else {
          setEntries([]);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setTrips([]);
          setEntries([]);
          setLoading(false);
        }
      }
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [loadTripData]);

  const selectedTrip = useMemo(() => trips.find((trip) => trip.id === activeTripId), [activeTripId, trips]);
  const settlementFrozen = Boolean(selectedTrip?.settlementFrozen);

  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const ready = entry.readyForDelivery || entry.deliveryStatus === 'READY_FOR_DELIVERY';
        if (filter === 'todo') {
          return !ready;
        }
        if (filter === 'done') {
          return ready;
        }
        return true;
      }),
    [entries, filter]
  );
  const pickingCounts = useMemo(
    () => ({
      todo: entries.filter((entry) => !entry.readyForDelivery && entry.deliveryStatus !== 'READY_FOR_DELIVERY').length,
      done: entries.filter((entry) => entry.readyForDelivery || entry.deliveryStatus === 'READY_FOR_DELIVERY').length
    }),
    [entries]
  );

  const updatePickingItem = async (businessId: string, skuId: string, checked: boolean) => {
    if (!activeTripId || settlementFrozen) {
      return;
    }
    const key = `${businessId}-${skuId}`;
    try {
      setUpdatingKey(key);
      const updated = await api.updateProcurementPickingChecklist(activeTripId, businessId, { skuId, checked });
      setEntries((current) => current.map((entry) => (entry.businessId === businessId ? updated : entry)));
    } catch {
      message.error(t('errors.request_failed'));
    } finally {
      setUpdatingKey(undefined);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 40px 0' }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Breadcrumb style={{ marginBottom: 8 }} items={[{ title: t('nav.dashboard') }, { title: t('nav.picking') }]} />
        <Space
          direction={isMobile ? 'vertical' : 'horizontal'}
          style={{ width: '100%', justifyContent: 'space-between' }}
        >
          <div>
            <Title level={4} style={{ margin: 0, fontFamily: "'Noto Serif JP', serif" }}>
              {t('picking.title')}
            </Title>
            <Text type="secondary">
              {t('picking.subtitle')}
              {activeTripId ? ` (Trip #${activeTripId})` : ''}
            </Text>
          </div>
          <Space wrap style={{ width: isMobile ? '100%' : undefined }}>
            <Select
              data-testid="picking-trip-select"
              value={activeTripId}
              placeholder={t('procurement.trip_selector')}
              options={trips.map((trip) => ({
                value: trip.id,
                label: `${trip.id} · ${trip.deliveryArea} · ${trip.deliveryDate}`
              }))}
              style={{ minWidth: isMobile ? '100%' : 220, width: isMobile ? '100%' : undefined }}
              onChange={(tripId) => {
                setActiveTripId(tripId);
                void loadTripData(tripId);
              }}
            />
            <Radio.Group value={filter} onChange={(event) => setFilter(event.target.value)} buttonStyle="solid">
              <Radio.Button value="all">{t('picking.filter.all')}</Radio.Button>
              <Radio.Button value="todo">
                {t('picking.filter.todo')} ({pickingCounts.todo})
              </Radio.Button>
              <Radio.Button value="done">
                {t('picking.filter.done')} ({pickingCounts.done})
              </Radio.Button>
            </Radio.Group>
          </Space>
        </Space>
        {selectedTrip ? (
          <Alert
            type={settlementFrozen ? 'warning' : 'info'}
            showIcon
            message={`${t('procurement.freeze_banner_title')}: ${selectedTrip.settlementFreezeStage ?? 'ACTIVE'}`}
            description={selectedTrip.settlementFreezeReason || t('procurement.freeze_banner_active')}
          />
        ) : null}
        {filteredEntries.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: '60px 0', border: 'var(--zen-line)' }}>
            <div style={{ color: 'var(--zen-muted)' }}>{t('picking.empty')}</div>
          </Card>
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {filteredEntries.map((entry) => (
              <Card
                key={entry.businessId}
                className="procurement-glass-card"
                title={`${entry.businessId}${entry.customerName ? ` · ${entry.customerName}` : ''}`}
                extra={<Tag color={entry.readyForDelivery ? 'green' : 'gold'}>{t(`delivery.status.${entry.deliveryStatus}`)}</Tag>}
              >
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Text type="secondary">{entry.addressSummary || t('procurement.no_address')}</Text>
                  {settlementFrozen ? <Text type="secondary">{selectedTrip?.settlementFreezeReason}</Text> : null}
                  <Table
                    rowKey={(row) => `${entry.businessId}-${row.skuId}`}
                    size="small"
                    pagination={false}
                    dataSource={entry.items}
                    scroll={{ x: 'max-content' }}
                    columns={[
                      {
                        title: t('procurement.picking_checked'),
                        key: 'checked',
                        render: (_, row) => (
                          <Checkbox
                            checked={row.checked}
                            disabled={settlementFrozen}
                            onChange={(event) => void updatePickingItem(entry.businessId, row.skuId, event.target.checked)}
                            aria-label={`${entry.businessId}-${row.skuId}`}
                          />
                        )
                      },
                      { title: t('orders.lines.item_name'), dataIndex: 'itemName', key: 'itemName' },
                      { title: t('orders.lines.sku_id'), dataIndex: 'skuId', key: 'skuId' },
                      {
                        title: t('procurement.picking_quantity'),
                        key: 'quantity',
                        render: (_, row) => `${row.pickedQuantity}/${row.orderedQuantity}`
                      },
                      {
                        title: t('procurement.picking_labels'),
                        key: 'labels',
                        render: (_, row) => (
                          <Space wrap>
                            {row.labels.length === 0 ? <Text type="secondary">-</Text> : row.labels.map((label) => (
                              <Tag key={label}>{t(`picking.label.${label}`)}</Tag>
                            ))}
                          </Space>
                        )
                      }
                    ]}
                    loading={entry.items.some((row) => updatingKey === `${entry.businessId}-${row.skuId}`)}
                  />
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </Space>
    </div>
  );
}
