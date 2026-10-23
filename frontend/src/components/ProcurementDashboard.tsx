import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Timeline,
  Typography,
  message
} from 'antd';
import {
  api,
  type CustomerBalanceLedgerEntry,
  type DeliveryPreparation,
  type FinancialAuditLog,
  type LogisticsTracking,
  type Order,
  type PickingChecklist,
  type ProcurementReceipt,
  type ProfitSharingConfig,
  type ProcurementDeficitItemResponse,
  type ProcurementHudStats,
  type Trip,
  type TripExpense
} from '../api';
import { useI18n } from '../i18n';
import ChatWidget from './ChatWidget';
import { usePollingTask } from '../hooks/usePollingTask';

const { Text } = Typography;

type ReconcileDetailRow = {
  key: string;
  skuId: string;
  itemName: string;
  businessId: string;
  purchasedQuantity: number;
};

export default function ProcurementDashboard() {
  const { t } = useI18n();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md !== true;
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<number>();
  const [hudStats, setHudStats] = useState<ProcurementHudStats>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [expenseReceiptBase64, setExpenseReceiptBase64] = useState<string>();
  const [auditLogs, setAuditLogs] = useState<FinancialAuditLog[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<CustomerBalanceLedgerEntry[]>([]);
  const [profitSharing, setProfitSharing] = useState<ProfitSharingConfig>();
  const [purchaserRatio, setPurchaserRatio] = useState<number>(70);
  const [promoterRatio, setPromoterRatio] = useState<number>(30);
  const [logisticsTrackings, setLogisticsTrackings] = useState<LogisticsTracking[]>([]);
  const [deliveryPreparations, setDeliveryPreparations] = useState<DeliveryPreparation[]>([]);
  const [pickingChecklist, setPickingChecklist] = useState<PickingChecklist[]>([]);
  const [logisticsTrackingNumber, setLogisticsTrackingNumber] = useState<string>('');
  const [logisticsChannel, setLogisticsChannel] = useState<string>('DOMESTIC');
  const [logisticsProvider, setLogisticsProvider] = useState<string>('MOCK');
  const [reconcileRows, setReconcileRows] = useState<ReconcileDetailRow[]>([]);
  const [deficitItems, setDeficitItems] = useState<ProcurementDeficitItemResponse[]>([]);
  const [procurementReceipts, setProcurementReceipts] = useState<ProcurementReceipt[]>([]);
  const [selectedReceiptId, setSelectedReceiptId] = useState<number>();
  const [receiptFilesBase64, setReceiptFilesBase64] = useState<Array<{ imageBase64: string; fileName?: string }>>([]);
  const [paymentBusinessId, setPaymentBusinessId] = useState<string>();
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ReconcileDetailRow>();
  const [targetBusinessId, setTargetBusinessId] = useState<string>();
  const [transferQuantity, setTransferQuantity] = useState<number>(1);
  const [expenseForm] = Form.useForm<{ category: string; cost: number }>();
  const refreshRequestRef = useRef(0);

  const refreshTripData = useCallback(async (tripId: number) => {
    const requestId = refreshRequestRef.current + 1;
    refreshRequestRef.current = requestId;
    setLoading(true);
    try {
      const [hud, orderList, expenseList, tripAuditLogs, customerLedger, profitShareConfig, logistics, deficits, receiptList, deliveryList, pickingList] = await Promise.all([
        api.procurementHud(tripId),
        api.orders(tripId),
        api.procurementExpenses(tripId),
        api.procurementAuditLogs(tripId),
        api.customerBalanceLedger(tripId),
        api.procurementProfitSharing(tripId),
        api.procurementLogistics(tripId),
        api.procurementDeficitItems(tripId),
        api.procurementReceipts(tripId),
        api.procurementDeliveryPreparations(tripId),
        api.procurementPickingChecklist(tripId)
      ]);
      if (refreshRequestRef.current !== requestId) {
        return;
      }
      setHudStats(hud);
      setOrders(orderList);
      setExpenses(expenseList);
      setAuditLogs(tripAuditLogs);
      setLedgerEntries(customerLedger);
      setPaymentBusinessId((current) => customerLedger.some((item) => item.businessId === current) ? current : customerLedger[0]?.businessId);
      setProfitSharing(profitShareConfig);
      setPurchaserRatio(profitShareConfig.purchaserRatioPercent);
      setPromoterRatio(profitShareConfig.promoterRatioPercent);
      setLogisticsTrackings(logistics);
      setDeficitItems(deficits);
      setProcurementReceipts(receiptList);
      setDeliveryPreparations(deliveryList);
      setPickingChecklist(pickingList);
      setSelectedReceiptId((current) => receiptList.some((item) => item.id === current) ? current : receiptList[0]?.id);
      setReconcileRows(buildReconcileRows(orderList));
    } catch {
      // Keep the last successful snapshot on transient polling failures.
    } finally {
      if (refreshRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.trips().then((result) => {
      if (cancelled) {
        return;
      }
      setTrips(result);
      if (result.length > 0) {
        const nextTripId = result[0].id;
        setSelectedTripId(nextTripId);
        refreshTripData(nextTripId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refreshTripData]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ tripId?: number }>).detail;
      if (!selectedTripId || (detail?.tripId && detail.tripId !== selectedTripId)) {
        return;
      }
      refreshTripData(selectedTripId);
    };
    window.addEventListener('procurement:reconciled', handler);
    return () => window.removeEventListener('procurement:reconciled', handler);
  }, [refreshTripData, selectedTripId]);

  usePollingTask(
    async () => {
      if (!selectedTripId) {
        return;
      }
      await refreshTripData(selectedTripId);
    },
    {
      enabled: Boolean(selectedTripId),
      intervalMs: 15000
    }
  );

  const selectedTrip = useMemo(() => trips.find((trip) => trip.id === selectedTripId), [selectedTripId, trips]);
  const selectedReceipt = useMemo(
    () => procurementReceipts.find((receipt) => receipt.id === selectedReceiptId),
    [procurementReceipts, selectedReceiptId]
  );
  const settlementFrozen = Boolean(selectedTrip?.settlementFrozen);

  const grossMarginRate = useMemo(() => {
    if (!hudStats) {
      return 0;
    }
    const expectedRevenue = hudStats.totalEstimatedProfit + hudStats.currentPurchasedAmount + hudStats.totalTripExpenses;
    if (expectedRevenue <= 0) {
      return 0;
    }
    return Number(((hudStats.totalEstimatedProfit * 100) / expectedRevenue).toFixed(2));
  }, [hudStats]);

  const trendArrow = grossMarginRate >= 0 ? '▲' : '▼';
  const trendColor = grossMarginRate >= 0 ? 'green' : 'red';
  const maxWeight = selectedTrip?.capacity ?? 0;
  const currentWeight = hudStats?.currentWeight ?? 0;
  const loadPercent = maxWeight <= 0 ? 0 : Math.min((currentWeight / maxWeight) * 100, 100);

  const targetBusinessOptions = useMemo(() => {
    if (!editingRow) {
      return [];
    }
    return orders
      .filter((order) => order.businessId !== editingRow.businessId)
      .filter((order) => (order.lines ?? []).some((line) => line.skuId === editingRow.skuId))
      .map((order) => ({ label: order.businessId, value: order.businessId }));
  }, [editingRow, orders]);

  const openReconcileModal = (row: ReconcileDetailRow) => {
    setEditingRow(row);
    setTransferQuantity(1);
    setTargetBusinessId(undefined);
    setIsModalOpen(true);
  };

  const submitManualReconcile = async () => {
    if (!selectedTripId || !editingRow || !targetBusinessId || transferQuantity <= 0) {
      return;
    }
    const result = await api.manualReconcile(selectedTripId, {
      skuId: editingRow.skuId,
      fromBusinessId: editingRow.businessId,
      toBusinessId: targetBusinessId,
      quantity: transferQuantity
    });
    if (result.transferredQuantity <= 0) {
      message.warning(t('procurement.reconcile_no_change'));
    } else {
      message.success(`${t('procurement.reconcile_success_prefix')} ${result.transferredQuantity}`);
    }
    await refreshTripData(selectedTripId);
    setIsModalOpen(false);
  };

  const submitExpense = async () => {
    if (!selectedTripId) {
      return;
    }
    const values = await expenseForm.validateFields();
    await api.createProcurementExpense(selectedTripId, {
      category: values.category,
      cost: values.cost,
      receiptImageBase64: expenseReceiptBase64
    });
    expenseForm.resetFields();
    setExpenseReceiptBase64(undefined);
    await refreshTripData(selectedTripId);
  };

  const updateProfitSharing = async () => {
    if (!selectedTripId) {
      return;
    }
    const config = await api.updateProcurementProfitSharing(selectedTripId, {
      purchaserRatioPercent: purchaserRatio,
      promoterRatioPercent: promoterRatio
    });
    setProfitSharing(config);
    message.success(t('procurement.profit_share_updated'));
    await refreshTripData(selectedTripId);
  };

  const createLogisticsTracking = async () => {
    if (!selectedTripId || !logisticsTrackingNumber.trim()) {
      return;
    }
    await api.createProcurementLogistics(selectedTripId, {
      trackingNumber: logisticsTrackingNumber.trim(),
      channel: logisticsChannel,
      provider: logisticsProvider
    });
    setLogisticsTrackingNumber('');
    await refreshTripData(selectedTripId);
  };

  const refreshLogisticsTracking = async (trackingId: number) => {
    if (!selectedTripId) {
      return;
    }
    await api.refreshProcurementLogistics(selectedTripId, trackingId);
    await refreshTripData(selectedTripId);
  };

  const finalizeSettlement = async () => {
    if (!selectedTripId) {
      return;
    }
    Modal.confirm({
      title: t('procurement.finalize_confirm_title'),
      content: t('procurement.finalize_confirm_content'),
      onOk: async () => {
        try {
          await api.finalizeProcurementSettlement(selectedTripId);
          message.success(t('procurement.finalize_success'));
          await refreshTripData(selectedTripId);
        } catch {
          message.error(t('errors.request_failed'));
        }
      }
    });
  };

  const previewReceipt = async (expense: TripExpense) => {
    if (!selectedTripId || !expense.id) {
      return;
    }
    const preview = await api.expenseReceiptPreview(selectedTripId, expense.id);
    if (preview.previewUrl) {
      window.open(preview.previewUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const onSelectExpenseReceipt = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setExpenseReceiptBase64(undefined);
      return;
    }
    const base64 = await toBase64(file);
    setExpenseReceiptBase64(base64);
  };

  const onSelectProcurementReceipts = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const next = await Promise.all(files.map(async (file) => ({ imageBase64: await toBase64(file), fileName: file.name })));
    setReceiptFilesBase64(next);
  };

  const uploadProcurementReceipts = async () => {
    if (!selectedTripId || receiptFilesBase64.length === 0) {
      return;
    }
    await api.uploadProcurementReceipts(selectedTripId, { receipts: receiptFilesBase64 });
    setReceiptFilesBase64([]);
    await refreshTripData(selectedTripId);
  };

  const updateSelectedReceipt = (updater: (receipt: ProcurementReceipt) => ProcurementReceipt) => {
    setProcurementReceipts((current) =>
      current.map((receipt) => (receipt.id === selectedReceiptId ? updater(receipt) : receipt))
    );
  };

  const setReceiptDisposition = (
    collectionKey: 'unmatchedReceiptItems' | 'missingOrderedItems',
    index: number,
    disposition: string
  ) => {
    updateSelectedReceipt((receipt) => {
      const nextCollection = [...(receipt.reconciliationResult?.[collectionKey] ?? [])];
      if (index < 0 || index >= nextCollection.length) {
        return receipt;
      }
      const currentItem = { ...nextCollection[index] };
      currentItem.disposition = disposition;
      nextCollection[index] = currentItem;
      return {
        ...receipt,
        reconciliationResult: {
          ...receipt.reconciliationResult,
          [collectionKey]: nextCollection,
          selfUseItems:
            disposition === 'SELF_USE'
              ? [...(receipt.reconciliationResult?.selfUseItems ?? []), currentItem]
              : (receipt.reconciliationResult?.selfUseItems ?? []).filter((item) => item.name !== currentItem.name)
        }
      };
    });
  };

  const saveReceiptWorkbench = async () => {
    if (!selectedTripId || !selectedReceipt) {
      return;
    }
    await api.saveProcurementReceipt(selectedTripId, selectedReceipt.id, {
      processingStatus: 'RECONCILED',
      reconciliationResult: selectedReceipt.reconciliationResult
    });
    message.success(t('procurement.receipt_reconcile_saved'));
    await refreshTripData(selectedTripId);
  };

  const rerecognizeReceiptWorkbench = async () => {
    if (!selectedTripId || !selectedReceipt) {
      return;
    }
    await api.rerecognizeProcurementReceipt(selectedTripId, selectedReceipt.id);
    message.success(t('procurement.receipt_rerecognized'));
    await refreshTripData(selectedTripId);
  };

  const submitOfflinePayment = async () => {
    if (!selectedTripId || !paymentBusinessId || paymentAmount <= 0) {
      return;
    }
    await api.recordOfflinePayment(selectedTripId, {
      businessId: paymentBusinessId,
      amount: paymentAmount,
      paymentMethod,
      note: paymentNote || undefined
    });
    setPaymentAmount(0);
    setPaymentNote('');
    message.success(t('procurement.payment_recorded'));
    await refreshTripData(selectedTripId);
  };

  const exportSettlement = async (format: 'csv' | 'pdf') => {
    if (!selectedTripId) {
      return;
    }
    const blob = await api.exportProcurementSettlement(selectedTripId, format);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `trip-${selectedTripId}-settlement.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const publishToMall = async (skuId: string) => {
    try {
      await api.patchProduct(skuId, { visibilityStatus: 'PUBLIC' as any });
      message.success(t('procurement.publish_success') || 'Published to Mall');
      if (selectedTripId) {
        await refreshTripData(selectedTripId);
      }
    } catch {
      message.error(t('errors.request_failed'));
    }
  };

  const exportCustomerStatement = async (businessId: string) => {
    if (!selectedTripId) {
      return;
    }
    const blob = await api.exportCustomerStatement(selectedTripId, businessId);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `trip-${selectedTripId}-customer-${businessId}-statement.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const exportDeliveryPreparations = async () => {
    if (!selectedTripId) {
      return;
    }
    const blob = await api.exportDeliveryPreparations(selectedTripId);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `trip-${selectedTripId}-delivery-preparations.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const updatePickingItem = async (businessId: string, skuId: string, checked: boolean) => {
    if (!selectedTripId) {
      return;
    }
    await api.updateProcurementPickingChecklist(selectedTripId, businessId, { skuId, checked });
    await refreshTripData(selectedTripId);
  };

  const tableScroll = { x: 'max-content' as const };
  const formatConfidencePercent = (confidence?: number) => `${Math.round((confidence ?? 0) * 100)}%`;
  const receiptTraceSummary = (receipt?: ProcurementReceipt) => {
    const trace = receipt?.reconciliationResult?.trace;
    if (!trace) {
      return '';
    }
    const fragments = [
      trace.activeProvider || trace.provider,
      trace.model,
      trace.stage,
      trace.errorCode,
      trace.fallbackReason ? `fallback:${trace.fallbackReason}` : undefined,
      typeof trace.attemptNo === 'number' ? `attempt:${trace.attemptNo}` : undefined
    ].filter(Boolean);
    return fragments.join(' · ');
  };
  const receiptStatusColor = (status?: string) => {
    if (status === 'REVIEWED' || status === 'CONFIRMED' || status === 'PUBLISHABLE') {
      return 'green';
    }
    if (status === 'FAILED_RECOGNITION' || status === 'FAILED_SOURCE_GOVERNANCE') {
      return 'red';
    }
    return 'gold';
  };

  return (
    <>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Breadcrumb items={[{ title: t('nav.dashboard') }, { title: t('nav.procurement') }]} />
      <Card className="procurement-glass-card">
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Text strong>{t('procurement.trip_selector')}</Text>
          <Select
            data-testid="procurement-trip-select"
            value={selectedTripId}
            placeholder={t('orders.trip.select.placeholder')}
            options={trips.map((trip) => ({
              value: trip.id,
              label: `${trip.id} · ${trip.origin} → ${trip.destination}`
            }))}
            style={{ width: isMobile ? '100%' : undefined }}
            onChange={(tripId) => {
              setSelectedTripId(tripId);
              refreshTripData(tripId);
            }}
          />
          <Space wrap>
            <Button onClick={() => exportSettlement('csv')}>{t('procurement.export_csv')}</Button>
            <Button onClick={() => exportSettlement('pdf')}>{t('procurement.export_pdf')}</Button>
            {selectedTrip?.status !== 'SETTLED' ? (
              <Button type="primary" danger onClick={finalizeSettlement}>{t('procurement.finalize_settlement')}</Button>
            ) : (
              <Tag color="gold" style={{ padding: '4px 12px', fontSize: '14px' }}>{t('procurement.status_settled')}</Tag>
            )}
            {settlementFrozen ? <Tag color="red">{selectedTrip?.settlementFreezeStage}</Tag> : null}
          </Space>
          {selectedTrip ? (
            <Alert
              type={settlementFrozen ? 'warning' : 'info'}
              showIcon
              message={`${t('procurement.freeze_banner_title')}: ${selectedTrip.settlementFreezeStage ?? 'ACTIVE'}`}
              description={selectedTrip.settlementFreezeReason || t('procurement.freeze_banner_active')}
            />
          ) : null}
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title={t('procurement.profit_insight')} loading={loading} className="procurement-glass-card">
            <Row gutter={16}>
              <Col span={12}>
                <Statistic title={t('procurement.estimated_profit')} value={hudStats?.totalEstimatedProfit ?? 0} precision={2} />
              </Col>
              <Col span={12}>
                <Statistic title={t('procurement.gross_margin_rate')} value={grossMarginRate} suffix="%" precision={2} />
                <Tag color={trendColor}>{trendArrow}</Tag>
              </Col>
            </Row>
            <Text type="secondary">
              {t('procurement.fx_rate_label')} {hudStats?.currentFxRate ?? 1} / {hudStats?.referenceFxRate ?? 1}
            </Text>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={t('procurement.capacity_redline')} loading={loading} className="procurement-glass-card">
            <Progress percent={Number(loadPercent.toFixed(2))} status={loadPercent >= 100 ? 'exception' : 'active'} />
            <Text type="secondary">
              {t('procurement.current_weight_label')} {currentWeight.toFixed(2)} / {maxWeight.toFixed(2)}
            </Text>
          </Card>
        </Col>
      </Row>

      <Card title={t('procurement.profit_share')} loading={loading} className="procurement-glass-card">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space wrap>
            <InputNumber
              min={0}
              max={100}
              precision={2}
              value={purchaserRatio}
              onChange={(value) => setPurchaserRatio(value ?? 0)}
              placeholder={t('procurement.purchaser_ratio')}
            />
            <InputNumber
              min={0}
              max={100}
              precision={2}
              value={promoterRatio}
              onChange={(value) => setPromoterRatio(value ?? 0)}
              placeholder={t('procurement.promoter_ratio')}
            />
            <Button type="primary" onClick={updateProfitSharing} disabled={settlementFrozen}>{t('procurement.update_ratio')}</Button>
          </Space>
          <Table
            rowKey="partnerRole"
            size="small"
            pagination={false}
            dataSource={profitSharing?.shares ?? hudStats?.partnerShares ?? []}
            scroll={tableScroll}
            columns={[
              { title: t('procurement.partner_role'), dataIndex: 'partnerRole', key: 'partnerRole' },
              { title: t('procurement.ratio_percent'), dataIndex: 'ratioPercent', key: 'ratioPercent' },
              { title: t('procurement.share_amount'), dataIndex: 'amount', key: 'amount' }
            ]}
          />
        </Space>
      </Card>

      <Card title={t('procurement.extra_expenses')} loading={loading} className="procurement-glass-card">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Form form={expenseForm} layout={isMobile ? 'vertical' : 'inline'}>
            <Form.Item
              name="category"
              rules={[{ required: true, message: t('procurement.expense_category_required') }]}
              style={{ minWidth: 180 }}
            >
              <Input placeholder={t('procurement.expense_category_placeholder')} />
            </Form.Item>
            <Form.Item
              name="cost"
              rules={[{ required: true, message: t('procurement.expense_cost_required') }]}
              style={{ minWidth: 140 }}
            >
              <InputNumber min={0.01} precision={2} placeholder={t('procurement.expense_cost_placeholder')} />
            </Form.Item>
            <Button type="primary" onClick={submitExpense} disabled={settlementFrozen}>
              {t('procurement.add_expense')}
            </Button>
          </Form>
          <Text>{t('procurement.upload_receipt')}</Text>
            <Input
              type="file"
              accept="image/*"
              aria-label={t('procurement.upload_receipt')}
              onChange={onSelectExpenseReceipt}
              disabled={settlementFrozen}
            />
          {expenseReceiptBase64 ? <Text type="secondary">{t('procurement.receipt_selected')}</Text> : null}
          <Text strong>
            {t('procurement.total_expenses')}: {(hudStats?.totalTripExpenses ?? 0).toFixed(2)}
          </Text>
          {expenses.length === 0 ? (
            <Empty description={t('procurement.no_expenses')} />
          ) : (
            <Table<TripExpense>
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={expenses}
              scroll={tableScroll}
              columns={[
                { title: t('procurement.expense_category'), dataIndex: 'category', key: 'category' },
                { title: t('procurement.expense_cost'), dataIndex: 'cost', key: 'cost' },
                { title: t('procurement.expense_created_at'), dataIndex: 'createdAt', key: 'createdAt' },
                {
                  title: t('procurement.receipt'),
                  key: 'receipt',
                  render: (_, row) => row.receiptThumbnailUrl ? (
                    <Button type="link" onClick={() => previewReceipt(row)}>{t('procurement.preview_receipt')}</Button>
                  ) : '-'
                },
                { title: t('procurement.ocr_status'), dataIndex: 'ocrStatus', key: 'ocrStatus' }
              ]}
            />
          )}
        </Space>
      </Card>

      <Card title={t('procurement.receipt_workbench_title')} loading={loading} className="procurement-glass-card">
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Space wrap>
            <Input
              type="file"
              multiple
              accept="image/*"
              aria-label={t('procurement.receipt_workbench_upload')}
              onChange={onSelectProcurementReceipts}
              disabled={settlementFrozen}
            />
            <Button type="primary" onClick={uploadProcurementReceipts} disabled={settlementFrozen || receiptFilesBase64.length === 0}>
              {t('procurement.receipt_workbench_upload')}
            </Button>
            <Button onClick={rerecognizeReceiptWorkbench} disabled={!selectedReceipt || settlementFrozen}>
              {t('procurement.receipt_workbench_rerecognize')}
            </Button>
            <Button onClick={saveReceiptWorkbench} disabled={!selectedReceipt || settlementFrozen}>
              {t('procurement.receipt_workbench_save')}
            </Button>
          </Space>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={10}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {procurementReceipts.length === 0 ? (
                  <Empty description={t('procurement.receipt_workbench_empty')} />
                ) : (
                  procurementReceipts.map((receipt) => (
                    <Card
                      key={receipt.id}
                      size="small"
                      hoverable
                      onClick={() => setSelectedReceiptId(receipt.id)}
                      style={{ borderColor: selectedReceiptId === receipt.id ? '#1677ff' : undefined }}
                    >
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <Space wrap>
                          <Text strong>{receipt.fileName || `${t('procurement.receipt')} #${receipt.id}`}</Text>
                          <Tag color={receipt.processingStatus === 'RECONCILED' ? 'green' : 'gold'}>{receipt.processingStatus}</Tag>
                          <Tag color={receipt.reconciliationResult?.recognitionMode === 'AI' ? 'blue' : 'default'}>
                            {receipt.reconciliationResult?.recognitionMode ?? 'UNKNOWN'}
                          </Tag>
                          <Tag color={receiptStatusColor(receipt.reconciliationResult?.recognitionStatus)}>
                            {receipt.reconciliationResult?.recognitionStatus ?? 'PENDING'}
                          </Tag>
                          <Tag color={receipt.reconciliationResult?.reviewStatus === 'REVIEWED' ? 'green' : 'gold'}>
                            {receipt.reconciliationResult?.reviewStatus ?? 'PENDING_REVIEW'}
                          </Tag>
                        </Space>
                        {receipt.thumbnailUrl ? (
                          <img
                            src={receipt.thumbnailUrl}
                            alt={receipt.fileName || String(receipt.id)}
                            style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8 }}
                          />
                        ) : null}
                        <Text type="secondary">{receipt.uploadedAt}</Text>
                        <Text type="secondary">
                          {t('procurement.receipt_confidence')}: {formatConfidencePercent(receipt.reconciliationResult?.confidence as number | undefined)}
                        </Text>
                        {receiptTraceSummary(receipt) ? <Text type="secondary">{receiptTraceSummary(receipt)}</Text> : null}
                        <Text>{receipt.reconciliationResult?.summary || t('procurement.receipt_workbench_ai_notice')}</Text>
                      </Space>
                    </Card>
                  ))
                )}
              </Space>
            </Col>
            <Col xs={24} lg={14}>
              {selectedReceipt ? (
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  <Alert
                    type={selectedReceipt.reconciliationResult?.recognitionMode === 'RULE_FALLBACK' ? 'warning' : 'info'}
                    showIcon
                    message={t('procurement.receipt_workbench_left')}
                    description={[
                      selectedReceipt.reconciliationResult?.summary || t('procurement.receipt_workbench_ai_notice'),
                      selectedReceipt.reconciliationResult?.recognitionStatus
                        ? `status: ${selectedReceipt.reconciliationResult.recognitionStatus}`
                        : '',
                      receiptTraceSummary(selectedReceipt),
                      selectedReceipt.reconciliationResult?.reviewedBy
                        ? `${t('procurement.receipt_reviewed_by')}: ${selectedReceipt.reconciliationResult.reviewedBy} · ${selectedReceipt.reconciliationResult.reviewedAt ?? '-'}`
                        : t('procurement.receipt_pending_review_hint')
                    ].filter(Boolean).join(' / ')}
                  />
                  <Table
                    size="small"
                    pagination={false}
                    rowKey={(_, index) => `receipt-item-${index}`}
                    dataSource={selectedReceipt.reconciliationResult?.receiptItems ?? []}
                    columns={[
                      { title: t('zen.receipt_item'), dataIndex: 'name', key: 'name' },
                      { title: t('zen.receipt_qty'), dataIndex: 'quantity', key: 'quantity' },
                      { title: t('zen.receipt_amount'), dataIndex: 'unitPrice', key: 'unitPrice' }
                    ]}
                  />
                  <Alert type="success" showIcon message={t('procurement.receipt_workbench_right')} />
                  <Table<Order>
                    size="small"
                    pagination={false}
                    rowKey="id"
                    dataSource={orders}
                    columns={[
                      { title: t('procurement.business_id'), dataIndex: 'businessId', key: 'businessId' },
                      { title: t('orders.header.customer_id'), dataIndex: 'customerId', key: 'customerId' },
                      { title: t('orders.header.status'), dataIndex: 'status', key: 'status' },
                      {
                        title: t('procurement.freeze_banner_title'),
                        key: 'freeze',
                        render: (_, row) =>
                          row.tripId === selectedTripId && settlementFrozen ? <Tag color="red">{selectedTrip?.settlementFreezeStage}</Tag> : '-'
                      }
                    ]}
                  />
                  <Table
                    size="small"
                    pagination={false}
                    rowKey={(_, index) => `unmatched-${index}`}
                    dataSource={selectedReceipt.reconciliationResult?.unmatchedReceiptItems ?? []}
                    columns={[
                      { title: t('procurement.receipt_unmatched_items'), dataIndex: 'name', key: 'name' },
                      { title: t('zen.receipt_qty'), dataIndex: 'quantity', key: 'quantity' },
                      {
                        title: t('procurement.receipt_manual_disposition'),
                        key: 'disposition',
                        render: (_, row, index) => (
                          <Select
                            value={row.disposition}
                            style={{ minWidth: 180 }}
                            disabled={settlementFrozen}
                            onChange={(value) => setReceiptDisposition('unmatchedReceiptItems', index, value)}
                            options={[
                              { label: t('procurement.receipt_disposition_unreviewed'), value: 'UNREVIEWED' },
                              { label: t('procurement.receipt_disposition_out_of_stock'), value: 'OUT_OF_STOCK' },
                              { label: t('procurement.receipt_disposition_on_site'), value: 'ON_SITE_REPLENISHED' },
                              { label: t('procurement.receipt_disposition_self_use'), value: 'SELF_USE' }
                            ]}
                          />
                        )
                      }
                    ]}
                  />
                  <Table
                    size="small"
                    pagination={false}
                    rowKey={(_, index) => `missing-${index}`}
                    dataSource={selectedReceipt.reconciliationResult?.missingOrderedItems ?? []}
                    columns={[
                      { title: t('procurement.receipt_missing_items'), dataIndex: 'itemName', key: 'itemName' },
                      { title: t('procurement.deficit_quantity') || 'Deficit Qty', dataIndex: 'missingQuantity', key: 'missingQuantity' },
                      {
                        title: t('procurement.receipt_manual_disposition'),
                        key: 'disposition',
                        render: (_, row, index) => (
                          <Select
                            value={row.disposition}
                            style={{ minWidth: 180 }}
                            disabled={settlementFrozen}
                            onChange={(value) => setReceiptDisposition('missingOrderedItems', index, value)}
                            options={[
                              { label: t('procurement.receipt_disposition_out_of_stock'), value: 'OUT_OF_STOCK' },
                              { label: t('procurement.receipt_disposition_on_site'), value: 'ON_SITE_REPLENISHED' },
                              { label: t('procurement.receipt_disposition_self_use'), value: 'SELF_USE' }
                            ]}
                          />
                        )
                      }
                    ]}
                  />
                  <Text type="secondary">
                    {t('procurement.receipt_self_use_count')}: {(selectedReceipt.reconciliationResult?.selfUseItems ?? []).length}
                  </Text>
                </Space>
              ) : (
                <Empty description={t('procurement.receipt_workbench_empty')} />
              )}
            </Col>
          </Row>
        </Space>
      </Card>

      <Card title={t('procurement.logistics_tracking')} loading={loading} className="procurement-glass-card">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space wrap>
            <Input
              value={logisticsTrackingNumber}
              onChange={(event) => setLogisticsTrackingNumber(event.target.value)}
              placeholder={t('procurement.logistics_number_placeholder')}
              disabled={settlementFrozen}
            />
            <Select
              value={logisticsChannel}
              disabled={settlementFrozen}
              options={[
                { label: t('procurement.channel_domestic'), value: 'DOMESTIC' },
                { label: t('procurement.channel_international'), value: 'INTERNATIONAL' }
              ]}
              onChange={setLogisticsChannel}
              style={{ minWidth: 140 }}
            />
            <Select
              value={logisticsProvider}
              disabled={settlementFrozen}
              options={[
                { label: 'MOCK', value: 'MOCK' },
                { label: '17TRACK', value: 'TRACK17' }
              ]}
              onChange={setLogisticsProvider}
              style={{ minWidth: 120 }}
            />
            <Button type="primary" onClick={createLogisticsTracking} disabled={settlementFrozen}>{t('procurement.add_logistics')}</Button>
          </Space>
          <Table<LogisticsTracking>
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={logisticsTrackings}
            scroll={tableScroll}
            columns={[
              { title: t('procurement.logistics_number'), dataIndex: 'trackingNumber', key: 'trackingNumber' },
              { title: t('procurement.logistics_channel'), dataIndex: 'channel', key: 'channel' },
              { title: t('procurement.logistics_provider'), dataIndex: 'provider', key: 'provider' },
              { title: t('procurement.logistics_status'), dataIndex: 'status', key: 'status' },
              { title: t('procurement.logistics_message'), dataIndex: 'lastMessage', key: 'lastMessage' },
              {
                title: t('procurement.settlement_reminder'),
                key: 'settlementReminderTriggered',
                render: (_, row) => row.settlementReminderTriggered ? <Tag color="success">{t('procurement.triggered')}</Tag> : '-'
              },
              {
                title: t('procurement.reconcile_action'),
                key: 'action',
                render: (_, row) => (
                  <Button size="small" onClick={() => refreshLogisticsTracking(row.id)} disabled={settlementFrozen}>
                    {t('procurement.refresh_logistics')}
                  </Button>
                )
              }
            ]}
          />
        </Space>
      </Card>

      <Card title={t('procurement.customer_ledger')} loading={loading} className="procurement-glass-card">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space wrap>
            <Select
              value={paymentBusinessId}
              style={{ minWidth: 180 }}
              placeholder={t('procurement.business_id')}
              options={ledgerEntries.map((entry) => ({ value: entry.businessId, label: entry.businessId }))}
              onChange={setPaymentBusinessId}
              disabled={settlementFrozen}
            />
            <InputNumber
              min={0.01}
              precision={2}
              value={paymentAmount}
              placeholder={t('procurement.payment_amount')}
              onChange={(value) => setPaymentAmount(value ?? 0)}
              disabled={settlementFrozen}
            />
            <Select
              value={paymentMethod}
              style={{ minWidth: 140 }}
              disabled={settlementFrozen}
              onChange={setPaymentMethod}
              options={[
                { value: 'CASH', label: t('procurement.payment_method_cash') },
                { value: 'BANK_TRANSFER', label: t('procurement.payment_method_transfer') },
                { value: 'OTHER', label: t('procurement.payment_method_other') }
              ]}
            />
            <Input
              value={paymentNote}
              style={{ minWidth: 220 }}
              placeholder={t('procurement.payment_note')}
              onChange={(event) => setPaymentNote(event.target.value)}
              disabled={settlementFrozen}
            />
            <Button type="primary" onClick={submitOfflinePayment} disabled={settlementFrozen}>
              {t('procurement.record_offline_payment')}
            </Button>
          </Space>
          {settlementFrozen ? <Text type="secondary">{selectedTrip?.settlementFreezeReason || t('procurement.payment_readonly_hint')}</Text> : null}
        {ledgerEntries.length === 0 ? (
          <Empty description={t('procurement.no_ledger_data')} />
        ) : (
          <Table<CustomerBalanceLedgerEntry>
            rowKey="businessId"
            size="small"
            pagination={false}
            dataSource={ledgerEntries}
            scroll={tableScroll}
            columns={[
              { title: t('procurement.business_id'), dataIndex: 'businessId', key: 'businessId' },
              { title: t('orders.header.customer_id'), dataIndex: 'customerId', key: 'customerId' },
              { title: t('procurement.amount_due_this_trip'), dataIndex: 'amountDueThisTrip', key: 'amountDueThisTrip' },
              { title: t('procurement.amount_received_this_trip'), dataIndex: 'amountReceivedThisTrip', key: 'amountReceivedThisTrip' },
              { title: t('procurement.amount_pending_this_trip'), dataIndex: 'amountPendingThisTrip', key: 'amountPendingThisTrip' },
              { title: t('procurement.balance_before_carry_forward'), dataIndex: 'balanceBeforeCarryForward', key: 'balanceBeforeCarryForward' },
              { title: t('procurement.balance_after_carry_forward'), dataIndex: 'balanceAfterCarryForward', key: 'balanceAfterCarryForward' },
              {
                title: t('procurement.settlement_status'),
                dataIndex: 'settlementStatus',
                key: 'settlementStatus',
                render: (value: string, row) => (
                  <Space wrap>
                    <Tag color={row.settlementFrozen ? 'red' : 'blue'}>{value}</Tag>
                    {row.settlementFrozen ? <Tag color="warning">{row.settlementFreezeStage}</Tag> : null}
                  </Space>
                )
              },
              {
                title: t('procurement.payment_history'),
                key: 'payments',
                render: (_, row) => (
                  <Space direction="vertical" size={0}>
                    {(row.paymentRecords ?? []).length === 0 ? (
                      <Text type="secondary">-</Text>
                    ) : (
                      (row.paymentRecords ?? []).map((record) => (
                        <Text key={record.id} type="secondary">
                          {record.paymentMethod} · {record.amount}
                        </Text>
                      ))
                    )}
                  </Space>
                )
              },
              {
                title: t('procurement.customer_statement'),
                key: 'statement',
                render: (_, row) => (
                  <Button size="small" onClick={() => exportCustomerStatement(row.businessId)}>
                    {t('procurement.export_pdf')}
                  </Button>
                )
              }
            ]}
          />
        )}
        </Space>
      </Card>

      <Card title={t('procurement.delivery_preparation')} loading={loading} className="procurement-glass-card">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space wrap>
            <Button onClick={exportDeliveryPreparations}>{t('procurement.export_delivery_addresses')}</Button>
          </Space>
          {deliveryPreparations.length === 0 ? (
            <Empty description={t('procurement.no_delivery_preparation')} />
          ) : (
            <Table<DeliveryPreparation>
              rowKey="businessId"
              size="small"
              pagination={false}
              dataSource={deliveryPreparations}
              scroll={tableScroll}
              columns={[
                { title: t('procurement.business_id'), dataIndex: 'businessId', key: 'businessId' },
                { title: t('procurement.customer_name'), dataIndex: 'customerName', key: 'customerName' },
                {
                  title: t('procurement.delivery_status'),
                  dataIndex: 'deliveryStatus',
                  key: 'deliveryStatus',
                  render: (value: string) => <Tag color={value === 'READY_FOR_DELIVERY' ? 'green' : 'blue'}>{t(`delivery.status.${value}`)}</Tag>
                },
                { title: t('procurement.address_summary'), dataIndex: 'addressSummary', key: 'addressSummary' },
                { title: t('procurement.route_coordinates'), key: 'coordinates', render: (_, row) => `${row.latitude ?? '-'}, ${row.longitude ?? '-'}` },
                {
                  title: t('procurement.picking_progress'),
                  key: 'progress',
                  render: (_, row) => `${row.pickedItems}/${row.totalPickItems}`
                }
              ]}
            />
          )}
        </Space>
      </Card>

      <Card title={t('procurement.picking_checklist')} loading={loading} className="procurement-glass-card">
        {pickingChecklist.length === 0 ? (
          <Empty description={t('procurement.no_picking_data')} />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {pickingChecklist.map((entry) => (
              <Card
                key={entry.businessId}
                type="inner"
                title={`${entry.businessId}${entry.customerName ? ` · ${entry.customerName}` : ''}`}
                extra={<Tag color={entry.readyForDelivery ? 'green' : 'gold'}>{t(`delivery.status.${entry.deliveryStatus}`)}</Tag>}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text type="secondary">{entry.addressSummary || t('procurement.no_address')}</Text>
                  <Table
                    rowKey={(row) => `${entry.businessId}-${row.skuId}`}
                    size="small"
                    pagination={false}
                    dataSource={entry.items}
                    scroll={tableScroll}
                    columns={[
                      {
                        title: t('procurement.picking_checked'),
                        key: 'checked',
                        render: (_, row) => (
                          <Checkbox
                            checked={row.checked}
                            disabled={settlementFrozen}
                            onChange={(event) => void updatePickingItem(entry.businessId, row.skuId, event.target.checked)}
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
                  />
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </Card>

      <Card title={t('procurement.procurement_deficit') || 'Procurement Deficit'} loading={loading} className="procurement-glass-card">
        <Table<ProcurementDeficitItemResponse>
          rowKey="skuId"
          size="small"
          pagination={false}
          dataSource={deficitItems}
          scroll={tableScroll}
          columns={[
            { title: t('orders.lines.sku_id'), dataIndex: 'skuId', key: 'skuId' },
            { title: t('orders.lines.item_name'), dataIndex: 'itemName', key: 'itemName' },
            { title: t('procurement.deficit_quantity') || 'Deficit Qty', dataIndex: 'deficitQuantity', key: 'deficitQuantity' },
             {
               title: t('procurement.priority') || 'Priority',
               dataIndex: 'priority',
               key: 'priority',
               render: (value: string) => <Tag color={value === 'CRITICAL' ? 'red' : 'orange'}>{value}</Tag>
             },
             { 
               title: t('common.actions') || 'Actions', 
               key: 'actions', 
               render: (_, row) => (
                 <Space>
                   {row.isTemporary && row.visibilityStatus === 'DRAFTER_ONLY' && (
                     <Button size="small" type="primary" ghost onClick={() => void publishToMall(row.skuId)}>
                       {t('procurement.publish_to_mall') || 'Publish to Mall'}
                     </Button>
                   )}
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Card title={t('procurement.operation_history')} loading={loading} className="procurement-glass-card">
        {auditLogs.length === 0 ? (
          <Empty description={t('procurement.no_audit_logs')} />
        ) : (
          <Timeline
            items={auditLogs.map((log) => ({
              children: `${log.createdAt} · ${log.actionType} · ${log.operatorName} · ${formatAuditPayload(log.originalValue)} -> ${formatAuditPayload(log.modifiedValue)}`
            }))}
          />
        )}
      </Card>

      <Card title={t('procurement.reconcile_detail')} loading={loading} className="procurement-glass-card">
        {reconcileRows.length === 0 ? (
          <Empty description={t('procurement.no_reconcile_data')} />
        ) : (
          <Table<ReconcileDetailRow>
            rowKey="key"
            size="small"
            pagination={false}
            dataSource={reconcileRows}
            scroll={tableScroll}
            columns={[
              { title: t('orders.lines.sku_id'), dataIndex: 'skuId', key: 'skuId' },
              { title: t('orders.lines.item_name'), dataIndex: 'itemName', key: 'itemName' },
              { title: t('procurement.reconcile_quantity'), dataIndex: 'purchasedQuantity', key: 'purchasedQuantity' },
              { title: t('procurement.business_id'), dataIndex: 'businessId', key: 'businessId' },
              {
                title: t('procurement.reconcile_action'),
                key: 'action',
                render: (_, row) => (
                  <Button size="small" onClick={() => openReconcileModal(row)} disabled={settlementFrozen}>
                    {t('procurement.correct')}
                  </Button>
                )
              }
            ]}
          />
        )}
      </Card>

      <Modal
        open={isModalOpen}
        title={t('procurement.manual_reconcile')}
        okText={t('procurement.apply_fix')}
        cancelText={t('common.cancel')}
        onCancel={() => setIsModalOpen(false)}
        onOk={submitManualReconcile}
        okButtonProps={{ disabled: settlementFrozen }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>{editingRow ? `${editingRow.itemName} (${editingRow.skuId})` : ''}</Text>
          <Select
            placeholder={t('procurement.target_order_placeholder')}
            options={targetBusinessOptions}
            value={targetBusinessId}
            onChange={setTargetBusinessId}
          />
          <InputNumber
            min={1}
            max={editingRow?.purchasedQuantity ?? 1}
            value={transferQuantity}
            onChange={(value) => setTransferQuantity(value ?? 1)}
          />
        </Space>
      </Modal>
    </Space>
      {selectedTripId ? <ChatWidget tripId={selectedTripId} senderId="PURCHASER" recipientId="DEMO-CUST" /> : null}
    </>
  );
}

function buildReconcileRows(orders: Order[]): ReconcileDetailRow[] {
  return orders.flatMap((order) =>
    (order.lines ?? [])
      .filter((line) => (line.purchasedQuantity ?? 0) > 0)
      .map((line) => ({
        key: `${order.id}-${line.skuId}-${line.itemName}`,
        skuId: line.skuId,
        itemName: line.itemName,
        businessId: order.businessId,
        purchasedQuantity: line.purchasedQuantity ?? 0
      }))
  );
}

function formatAuditPayload(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(parsed)
      .map(([key, value]) => `${key}:${String(value)}`)
      .join(', ');
  } catch {
    return raw;
  }
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
