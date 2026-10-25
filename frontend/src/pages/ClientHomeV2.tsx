import { Button, Empty, Grid, Select, Space, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  type CustomerBalanceLedgerEntry,
  type MobileProductResponse,
  type Order,
  type Trip,
  type WalletSummary
} from '../api';
import { useI18n } from '../i18n';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '../context/UserRoleContext';
import ChatWidget from '../components/ChatWidget';
import { usePollingTask } from '../hooks/usePollingTask';

const { Title, Text } = Typography;

type LiveFeedItem = {
  id: string;
  story: string;
};

type StatementLine = {
  key: string;
  itemName: string;
  quantity: number;
  amount: number;
};

const ZEN_PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="100%" height="100%" fill="%23f1efe8"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23807b72" font-size="48" font-family="Inter,Arial">BOBBuy</text></svg>';

export default function ClientHomeV2() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const [scrolled, setScrolled] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<number>();
  const [products, setProducts] = useState<MobileProductResponse[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<CustomerBalanceLedgerEntry[]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState<string>();
  const [liveFeed, setLiveFeed] = useState<LiveFeedItem[]>([]);
  const [partnerWallet, setPartnerWallet] = useState<WalletSummary>();
  const { isCustomer } = useUserRole();
  const previousPurchasedRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const buildPurchasedSnapshot = (orderList: Order[]) => {
    const snapshot: Record<string, number> = {};
    for (const order of orderList) {
      for (const line of order.lines ?? []) {
        snapshot[`${order.businessId}-${line.skuId}`] = line.purchasedQuantity ?? line.quantity ?? 0;
      }
    }
    return snapshot;
  };

  const pushLiveStory = useCallback((story: string) => {
    setLiveFeed((prev) => [{ id: `${Date.now()}-${Math.random()}`, story }, ...prev].slice(0, 8));
  }, []);

  const buildLiveStory = useCallback(
    (businessId: string, itemName: string) =>
      `${businessId} ${t('zen.live_story_connector')} ${itemName}`,
    [t]
  );

  const hydrateLiveFeed = useCallback((orderList: Order[]) => {
    const initial = orderList
      .flatMap((order) =>
        (order.lines ?? [])
          .filter((line) => (line.purchasedQuantity ?? line.quantity ?? 0) > 0)
          .map((line) => ({
            id: `${order.id}-${line.skuId}`,
            story: buildLiveStory(order.businessId, line.itemName)
          }))
      )
      .slice(0, 6);
    setLiveFeed(initial);
  }, [buildLiveStory]);

  const refreshTripData = useCallback(
    async (tripId: number, appendStories = false) => {
      try {
        const [orderList, ledger] = await Promise.all([api.orders(tripId), api.customerBalanceLedger(tripId)]);
        const nextSnapshot = buildPurchasedSnapshot(orderList);

        if (appendStories) {
          for (const order of orderList) {
            for (const line of order.lines ?? []) {
              const key = `${order.businessId}-${line.skuId}`;
              const previous = previousPurchasedRef.current[key] ?? 0;
              const current = line.purchasedQuantity ?? line.quantity ?? 0;
              if (current > previous) {
                pushLiveStory(buildLiveStory(order.businessId, line.itemName));
              }
            }
          }
        } else {
          hydrateLiveFeed(orderList);
        }

        previousPurchasedRef.current = nextSnapshot;
        setOrders(orderList);
        setLedgerEntries(ledger);

        const nextBusinessId = ledger[0]?.businessId ?? orderList[0]?.businessId;
        setActiveBusinessId((prev) => prev ?? nextBusinessId);
      } catch {
        // Keep the last successful snapshot on transient polling failures.
      }
    },
    [buildLiveStory, hydrateLiveFeed, pushLiveStory]
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.trips(), api.products()])
      .then(async ([tripList, productList]) => {
        if (cancelled) {
          return;
        }
        setTrips(tripList);
        setProducts(productList.slice(0, 6));
        if (!isCustomer) {
          api.getWallet('PURCHASER').then(setPartnerWallet).catch(() => undefined);
        }
        if (tripList.length > 0) {
          setSelectedTripId(tripList[0].id);
          await refreshTripData(tripList[0].id, false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTrips([]);
          setProducts([]);
          setOrders([]);
          setLedgerEntries([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isCustomer, refreshTripData]);

  useEffect(() => {
    if (!selectedTripId) {
      return;
    }
    const onReconciled = (event: Event) => {
      const detail = (event as CustomEvent<{ tripId?: number }>).detail;
      if (detail?.tripId && detail.tripId !== selectedTripId) {
        return;
      }
      refreshTripData(selectedTripId, true);
    };
    window.addEventListener('procurement:reconciled', onReconciled);
    if (!isCustomer) {
      api.getWallet('PURCHASER').then(setPartnerWallet).catch(() => undefined);
    }
    return () => {
      window.removeEventListener('procurement:reconciled', onReconciled);
    };
  }, [isCustomer, refreshTripData, selectedTripId]);

  usePollingTask(
    async () => {
      if (!selectedTripId) {
        return;
      }
      await refreshTripData(selectedTripId, true);
    },
    {
      enabled: Boolean(selectedTripId),
      intervalMs: 30000
    }
  );

  const statementBusinessIds = useMemo(
    () => Array.from(new Set([...ledgerEntries.map((entry) => entry.businessId), ...orders.map((order) => order.businessId)])),
    [ledgerEntries, orders]
  );

  const statementLines = useMemo<StatementLine[]>(() => {
    if (!activeBusinessId) {
      return [];
    }
    return orders
      .filter((order) => order.businessId === activeBusinessId)
      .flatMap((order) =>
        (order.lines ?? []).map((line) => ({
          key: `${order.id}-${line.skuId}`,
          itemName: line.itemName,
          quantity: line.quantity ?? 0,
          amount: Number(((line.quantity ?? 0) * (line.unitPrice ?? 0)).toFixed(2))
        }))
      );
  }, [activeBusinessId, orders]);

  const statementSummary = useMemo(() => {
    const ledger = ledgerEntries.find((entry) => entry.businessId === activeBusinessId);
    const total = statementLines.reduce((sum, line) => sum + line.amount, 0);
    return {
      totalReceivable: ledger?.totalReceivable ?? Number(total.toFixed(2)),
      paidDeposit: ledger?.paidDeposit ?? 0,
      outstandingBalance: ledger?.outstandingBalance ?? Number(total.toFixed(2))
    };
  }, [activeBusinessId, ledgerEntries, statementLines]);

  const downloadStatementPdf = async () => {
    if (!selectedTripId || !activeBusinessId) {
      return;
    }
    try {
      const blob = await api.exportCustomerStatement(selectedTripId, activeBusinessId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `trip-${selectedTripId}-customer-${activeBusinessId}-statement.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      message.error(t('errors.request_failed'));
    }
  };

  const onTripChange = async (tripId: number) => {
    setSelectedTripId(tripId);
    setActiveBusinessId(undefined);
    await refreshTripData(tripId, false);
  };

  const onQuickBuy = async (skuId: string) => {
    if (!selectedTripId) return;
    try {
      // For Zen 1-click buy, we use a generic or customer-mapped businessId
      await api.quickOrder(selectedTripId, { skuId, quantity: 1, businessId: 'ZEN-1-CLICK' });
      message.success(t('zen.buy_success'), 1.5);
      await refreshTripData(selectedTripId, true);
      if (!isCustomer) {
        await api.getWallet('PURCHASER').then(setPartnerWallet);
      }
    } catch {
      message.error(t('errors.request_failed'));
    }
  };

  return (
    <div className="zen-page">
      <header className={`zen-home-nav${scrolled ? ' is-scrolled' : ''}`}>
        <div className="zen-home-nav-inner">
          <Title level={4} className="zen-brand">
            BOBBuy
          </Title>
          <Space size={isMobile ? 8 : 12}>
            <Select
              size="small"
              value={selectedTripId}
              placeholder={t('orders.trip.select.placeholder')}
              className="zen-select"
              options={trips.map((trip) => ({
                value: trip.id,
                label: `${trip.deliveryArea} · ${trip.deliveryDate}`
              }))}
              onChange={onTripChange}
            />
          </Space>
        </div>
      </header>

      <main className="zen-main">
        <section className="zen-hero">
          <Text className="zen-kicker">PROJECT ZEN</Text>
          <Title className="zen-hero-title">{t('zen.hero_title')}</Title>
          <Text className="zen-hero-subtitle">{t('zen.hero_subtitle')}</Text>
          {partnerWallet && (
            <div className="zen-wallet-pill">
              <Space direction="vertical" size={0}>
                <Text className="zen-wallet-label">{t('zen.wallet_balance')}</Text>
                <Text className="zen-wallet-amount">
                  {partnerWallet.currency} {partnerWallet.balance.toFixed(2)}
                </Text>
              </Space>
              {!isCustomer && (
                <Button 
                  type="link" 
                  size="small" 
                  onClick={() => navigate(`/audit/${selectedTripId}`)}
                  className="zen-audit-link"
                >
                  {t('zen_audit.verified')}
                </Button>
              )}
            </div>
          )}
        </section>

        <section className="zen-trip-pulse">
           {trips.filter(t => t.status === 'PUBLISHED').map(trip => {
             return (
               <div key={trip.id} className="zen-pulse-item">
                 <Text className="serif-font">{trip.deliveryArea}</Text>
                 <Text>{trip.deliveryDate}</Text>
               </div>
             );
           })}
        </section>

        <section className="zen-product-rail" aria-label={t('zen.product_rail_aria_label')}>
          {products.length === 0 ? (
            <Empty description={t('zen.products_empty')} />
          ) : (
            products.map((item) => {
              const media = item.product.mediaGallery?.find((entry) => entry.type === 'image');
              const imageUrl = media?.url || ZEN_PLACEHOLDER_IMAGE;
              return (
                <article key={item.product.id} className="zen-product-card">
                  <img src={imageUrl} alt={item.displayName} className="zen-product-image" loading="lazy" />
                  <div className="zen-product-copy">
                    <Title level={4} className="zen-product-title">
                      {item.displayName}
                    </Title>
                    <Text className="zen-product-description">{item.displayDescription || item.product.brand || '—'}</Text>
                    <Text
                      className="zen-product-price"
                      aria-label={`${t('zen.price_aria_prefix')} ${item.product.basePrice.toFixed(2)} ${t('zen.price_aria_suffix')}`}
                    >
                      ¥ {item.product.basePrice.toFixed(2)}
                    </Text>
                    <Button type="text" className="zen-quick-buy" onClick={() => onQuickBuy(item.product.id)}>
                      {t('zen.quick_buy')}
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </section>

        <section className="zen-live-feed" aria-label={t('zen.live_feed_aria_label')}>
          <Title level={5} className="zen-section-title">
            {t('zen.live_feed_title')}
          </Title>
          <div className="zen-live-stream">
            {liveFeed.length === 0 ? <Text type="secondary">{t('zen.live_feed_empty')}</Text> : null}
            {liveFeed.map((item) => (
              <p key={item.id} className="zen-live-line">
                {item.story}
              </p>
            ))}
          </div>
        </section>

        <section className="zen-statement" aria-label={t('zen.statement_aria_label')}>
          <div className="zen-statement-header">
            <Title level={5} className="zen-section-title">
              {t('zen.statement_title')}
            </Title>
            <Space size={8}>
              <Select
                size="small"
                value={activeBusinessId}
                placeholder={t('zen.statement_select_business')}
                className="zen-select"
                options={statementBusinessIds.map((businessId) => ({ value: businessId, label: businessId }))}
                onChange={setActiveBusinessId}
              />
              <Button size="small" className="zen-statement-download" onClick={downloadStatementPdf}>
                {t('zen.statement_download_pdf')}
              </Button>
            </Space>
          </div>
          <div className="zen-receipt">
            <div className="zen-receipt-row zen-receipt-head">
              <span>{t('zen.receipt_item')}</span>
              <span>{t('zen.receipt_qty')}</span>
              <span>{t('zen.receipt_amount')}</span>
            </div>
            {statementLines.length === 0 ? (
              <div className="zen-receipt-row">
                <span>—</span>
                <span>0</span>
                <span>0.00</span>
              </div>
            ) : (
              statementLines.map((line) => (
                <div key={line.key} className="zen-receipt-row">
                  <span>{line.itemName}</span>
                  <span>{line.quantity}</span>
                  <span>{line.amount.toFixed(2)}</span>
                </div>
              ))
            )}
            <div className="zen-receipt-divider" />
            <div className="zen-receipt-row">
              <span>{t('zen.statement_total_receivable')}</span>
              <span />
              <span>{statementSummary.totalReceivable.toFixed(2)}</span>
            </div>
            <div className="zen-receipt-row">
              <span>{t('zen.statement_paid_deposit')}</span>
              <span />
              <span>{statementSummary.paidDeposit.toFixed(2)}</span>
            </div>
            <div className="zen-receipt-row zen-receipt-outstanding">
              <span>{t('zen.statement_outstanding')}</span>
              <span />
              <span>{statementSummary.outstandingBalance.toFixed(2)}</span>
            </div>
          </div>
        </section>
      </main>
      {/* Chat Widget */}
      <ChatWidget tripId={selectedTripId} senderId="DEMO-CUST" recipientId="PURCHASER" />
    </div>
  );
}
