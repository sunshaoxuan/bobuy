import { Alert, Button, Card, Descriptions, Empty, Grid, Modal, Select, Space, Spin, Table, Tag, Typography, message } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type CustomerBalanceLedgerEntry, type Trip } from '../api';
import { useI18n } from '../i18n';

const { Title, Text } = Typography;

export default function ClientBilling({node}:{node?:number}) {
  const { t } = useI18n();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md !== true;
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<number>();
  const [entries, setEntries] = useState<CustomerBalanceLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingKey, setConfirmingKey] = useState<string>();
  const [error,setError]=useState('');
  const generation=useRef(0);

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: 'JPY' }).format(amount);

  const refreshEntries = async (tripId: number) => {
    const request=generation.current;
    const next=await api.customerViewLedger(tripId);if(request===generation.current)setEntries(next);
  };

  useEffect(() => {
    const request=++generation.current;
    let cancelled = false;
    setLoading(true);setEntries([]);setTrips([]);setSelectedTripId(undefined);setError('');
    (async () => {
      try {
        const tripList = (await api.customerTrips()).filter(trip=>node===undefined||trip.agentId===node);
        if (cancelled||request!==generation.current) return;
        setTrips(tripList);
        const firstTripId = tripList[0]?.id;
        if (firstTripId) {
          setSelectedTripId(firstTripId);
          const next=await api.customerViewLedger(firstTripId);if(!cancelled&&request===generation.current)setEntries(next);
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
    setLoading(true);setEntries([]);setError('');
    try {
      await refreshEntries(tripId);
    } catch(error) {if(request===generation.current)setError((error as Error).message);
    } finally {
      if(request===generation.current)setLoading(false);
    }
  };

  const selectedTrip = useMemo(() => trips.find((trip) => trip.id === selectedTripId), [selectedTripId, trips]);

  const confirmLedger = async (entry: CustomerBalanceLedgerEntry, action: 'RECEIPT' | 'BILLING') => {
    if (!selectedTripId || selectedTrip?.status === 'SETTLED' || entry.settlementFrozen) {
      return;
    }
    const key = `${entry.businessId}-${action}`;
    const request=generation.current;
    Modal.confirm({
      title: action === 'RECEIPT' ? t('billing.confirm_receipt_title') : t('billing.confirm_statement_title'),
      content: t('billing.confirm_irreversible'),
      okText: t('billing.confirm_action'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        if(request!==generation.current)return;
        try {
          setConfirmingKey(key);
          await api.confirmOwnLedger(selectedTripId, entry.businessId, action);
          if(request!==generation.current)return;
          await refreshEntries(selectedTripId);
          message.success(t('billing.confirm_success'));
        } catch {
          message.error(t('errors.request_failed'));
        } finally {
          setConfirmingKey(undefined);
        }
      }
    });
  };

  const lineColumns = [
    { title: t('orders.lines.item_name'), dataIndex: 'itemName', key: 'itemName' },
    { title: t('orders.lines.sku_id'), dataIndex: 'skuId', key: 'skuId' },
    { title: t('billing.line_ordered_qty'), dataIndex: 'orderedQuantity', key: 'orderedQuantity' },
    { title: t('billing.line_purchased_qty'), dataIndex: 'purchasedQuantity', key: 'purchasedQuantity' },
    {
      title: t('orders.lines.unit_price'),
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      render: (value: number) => formatAmount(value)
    },
    { title: t('billing.line_difference_note'), dataIndex: 'differenceNote', key: 'differenceNote' }
  ];

  return (
    <div className="page-card client-page client-billing-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div className="client-billing-header">
          <Title level={4} style={{ margin: 0 }} data-testid="client-billing-title">
            {t('nav.client_billing')}
          </Title>
          <Select
            value={selectedTripId}
            placeholder={t('orders.trip.select.placeholder')}
            onChange={onTripChange}
            style={{ width: isMobile ? '100%' : 320, minWidth: 0 }}
            options={trips.map((trip) => ({
              value: trip.id,
              label: `${trip.deliveryDate} · ${trip.deliveryArea}`
            }))}
          />
        </div>
        {selectedTrip ? (
          <Alert
            type={selectedTrip.settlementFrozen ? 'warning' : 'info'}
            showIcon
            message={`${t('billing.freeze_stage')}: ${t(`enum.trip_status.${selectedTrip.status}`)}`}
            description={t(selectedTrip.status === 'SETTLED' ? 'billing.frozen_settled' : selectedTrip.status === 'COMPLETED' ? 'billing.delivery_completed' : 'billing.freeze_stage_active')}
          />
        ) : null}
        {error?<Alert type="error" message={error}/>:loading ? (
          <Spin />
        ) : entries.length === 0 ? (
          <Empty description={t('procurement.no_ledger_data')} />
        ) : (
          <div className="client-card-list">
            {entries.map((entry) => {
              const receiptConfirmed = Boolean(entry.receiptConfirmedAt);
              const billingConfirmed = Boolean(entry.billingConfirmedAt);
              const settlementFrozen = Boolean(selectedTrip?.status === 'SETTLED' || entry.settlementFrozen);
              return (
                <Card key={entry.businessId} className="client-list-card" title={`${entry.businessId}${entry.customerName ? ` · ${entry.customerName}` : ''}`}>
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Descriptions
                      size="small"
                      bordered
                      column={isMobile ? 1 : 3}
                      items={[
                        {
                          key: 'receivable',
                          label: t('billing.amount_due_this_trip'),
                          children: formatAmount(entry.amountDueThisTrip ?? entry.totalReceivable)
                        },
                        {
                          key: 'received',
                          label: t('billing.amount_received_this_trip'),
                          children: formatAmount(entry.amountReceivedThisTrip ?? entry.paidDeposit)
                        },
                        {
                          key: 'outstanding',
                          label: t('billing.amount_pending_this_trip'),
                          children: formatAmount(entry.amountPendingThisTrip ?? entry.outstandingBalance)
                        },
                        {
                          key: 'carry-before',
                          label: t('billing.balance_before_carry_forward'),
                          children: formatAmount(entry.balanceBeforeCarryForward ?? 0)
                        },
                        {
                          key: 'carry-after',
                          label: t('billing.balance_after_carry_forward'),
                          children: formatAmount(entry.balanceAfterCarryForward ?? 0)
                        },
                        {
                          key: 'status',
                          label: t('billing.settlement_status'),
                          children: <Tag color={billingConfirmed ? 'green' : receiptConfirmed ? 'blue' : 'gold'}>{t(`billing.status.${entry.settlementStatus}`)}</Tag>
                        },
                        {
                          key: 'delivery-status',
                          label: t('billing.delivery_status'),
                          children: <Tag color={entry.deliveryStatus === 'READY_FOR_DELIVERY' ? 'green' : entry.deliveryStatus === 'DELIVERED' ? 'blue' : 'gold'}>{t(`delivery.status.${entry.deliveryStatus ?? 'PENDING_DELIVERY'}`)}</Tag>
                        },
                        {
                          key: 'delivery-address',
                          label: t('billing.delivery_address'),
                          children: entry.deliveryAddressSummary || t('billing.no_delivery_address')
                        },
                        {
                          key: 'receipt',
                          label: t('billing.receipt_confirmation'),
                          children: receiptConfirmed ? `${entry.receiptConfirmedBy ?? '-'} · ${entry.receiptConfirmedAt}` : t('billing.pending_confirmation')
                        },
                        {
                          key: 'statement',
                          label: t('billing.statement_confirmation'),
                          children: billingConfirmed ? `${entry.billingConfirmedBy ?? '-'} · ${entry.billingConfirmedAt}` : t('billing.pending_confirmation')
                        }
                      ]}
                    />
                    {(entry.paymentRecords ?? []).length > 0 ? (
                      <Space direction="vertical" size={4}>
                        {(entry.paymentRecords ?? []).map((record) => (
                          <Text key={record.id} type="secondary">
                            {record.paymentMethod} · {formatAmount(record.amount)} · {record.createdAt}
                          </Text>
                        ))}
                      </Space>
                    ) : null}
                    <Table
                      dataSource={entry.orderLines}
                      rowKey={(line) => `${entry.businessId}-${line.skuId}`}
                      columns={lineColumns}
                      pagination={false}
                      size="small"
                      scroll={{ x: 'max-content' }}
                    />
                    <Space wrap className="client-billing-actions">
                      <Button
                        type="default"
                        onClick={() => confirmLedger(entry, 'RECEIPT')}
                        disabled={settlementFrozen || receiptConfirmed}
                        loading={confirmingKey === `${entry.businessId}-RECEIPT`}
                      >
                        {t('billing.confirm_receipt_action')}
                      </Button>
                      <Button
                        type="primary"
                        onClick={() => confirmLedger(entry, 'BILLING')}
                        disabled={settlementFrozen || !receiptConfirmed || billingConfirmed}
                        loading={confirmingKey === `${entry.businessId}-BILLING`}
                      >
                        {t('billing.confirm_statement_action')}
                      </Button>
                    </Space>
                    {settlementFrozen ? (
                      <Text type="secondary">{t('billing.frozen_settled')}</Text>
                    ) : null}
                    <Text type="secondary">
                      {t('billing.balance_carry_forward_hint')} {t('billing.order_context_hint')}
                    </Text>
                  </Space>
                </Card>
              );
            })}
          </div>
        )}
      </Space>
    </div>
  );
}
