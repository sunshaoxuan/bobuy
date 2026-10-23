import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ProcurementHUD from '../pages/ProcurementHUD';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from '../i18n';
import { api } from '../api';

vi.mock('antd', async () => {
    const antd = await vi.importActual<typeof import('antd')>('antd');
    return {
        ...antd,
        Table: ({ dataSource = [] }: any) => <div>{dataSource.map((item: any) => item.businessId ?? item.category ?? '').join(' ')}</div>,
        Select: ({ options = [], onChange, value }: any) => (
            <select
                data-testid="trip-select"
                value={value}
                onChange={(event) => onChange?.(Number(event.target.value))}
            >
                {options.map((option: any) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        )
    };
});

vi.mock('../api', () => ({
    api: {
        trips: () => Promise.resolve([
            { id: 2000, agentId: 1, origin: 'Tokyo', destination: 'Shanghai', departDate: '2026-01-01', capacity: 10, reservedCapacity: 1, status: 'PUBLISHED', settlementFrozen: false, settlementFreezeStage: 'ACTIVE', settlementFreezeReason: '' }
        ]),
        procurementHud: () => Promise.resolve({
            tripId: 2000,
            totalEstimatedProfit: 20,
            currentPurchasedAmount: 80,
            currentFxRate: 1,
            referenceFxRate: 1,
            totalTripExpenses: 5,
            currentWeight: 6,
            currentVolume: 2,
            categoryCompletionPercent: {},
            partnerShares: [
                { partnerRole: 'PURCHASER', ratioPercent: 70, amount: 14 },
                { partnerRole: 'PROMOTER', ratioPercent: 30, amount: 6 }
            ]
        }),
        procurementExpenses: () => Promise.resolve([
            { id: 1, tripId: 2000, cost: 5, category: '停车费', createdAt: '2026-01-01T00:00:00' }
        ]),
        procurementReceipts: () => Promise.resolve([
            {
                id: 11,
                tripId: 2000,
                fileName: 'receipt-1.jpg',
                originalImageUrl: 'https://example.com/receipt.jpg',
                thumbnailUrl: 'https://example.com/receipt.jpg',
                processingStatus: 'READY_FOR_REVIEW',
                uploadedAt: '2026-01-01T00:00:00',
                updatedAt: '2026-01-01T00:00:00',
                reconciliationResult: {
                    recognitionMode: 'AI',
                    recognitionStatus: 'PENDING_MANUAL_REVIEW',
                    confidence: 0.91,
                    reviewStatus: 'PENDING_REVIEW',
                    trace: { activeProvider: 'ollama-compatible', model: 'llava', stage: 'LLM_STRUCTURING', attemptNo: 2 },
                    receiptItems: [{ name: 'Matcha Kit', quantity: 1, unitPrice: 50 }],
                    matchedOrderLines: [],
                    unmatchedReceiptItems: [{ name: 'Store item', quantity: 1, disposition: 'UNREVIEWED' }],
                    missingOrderedItems: [],
                    selfUseItems: []
                },
                rawRecognitionResult: { reviewStatus: 'PENDING_REVIEW' },
                manualReconciliationResult: {}
            }
        ]),
        procurementAuditLogs: () => Promise.resolve([
            {
                id: 1,
                tripId: 2000,
                actionType: 'EXPENSE_CREATE',
                operatorName: 'SYSTEM',
                originalValue: '{"cost":0}',
                modifiedValue: '{"cost":5}',
                previousHash: 'GENESIS',
                currentHash: 'abc',
                createdAt: '2026-01-01T00:00:00'
            }
        ]),
        customerBalanceLedger: () => Promise.resolve([
            {
                tripId: 2000,
                businessId: '20260117001',
                customerId: 1001,
                customerName: 'Chen Li',
                totalReceivable: 100,
                paidDeposit: 0,
                outstandingBalance: 100,
                amountDueThisTrip: 100,
                amountReceivedThisTrip: 0,
                amountPendingThisTrip: 100,
                balanceBeforeCarryForward: 5,
                balanceAfterCarryForward: -95,
                settlementStatus: 'PENDING_CONFIRMATION',
                deliveryStatus: 'PENDING_DELIVERY',
                deliveryAddressSummary: 'Shanghai Pudong Century Ave 88',
                settlementFrozen: false,
                settlementFreezeStage: 'ACTIVE',
                settlementFreezeReason: '',
                paymentRecords: [],
                orderLines: []
            }
        ]),
        createProcurementExpense: () => Promise.resolve({ id: 2, tripId: 2000, cost: 1, category: '运费', createdAt: '2026-01-01T00:00:00' }),
        manualReconcile: () => Promise.resolve({ skuId: 'prd-1000', fromBusinessId: '20260117001', toBusinessId: '20260117002', transferredQuantity: 1 }),
        exportProcurementSettlement: () => Promise.resolve(new Blob()),
        exportCustomerStatement: () => Promise.resolve(new Blob()),
        expenseReceiptPreview: () => Promise.resolve({ expenseId: 1, previewUrl: 'https://example.com/preview' }),
        procurementProfitSharing: () => Promise.resolve({
            tripId: 2000,
            purchaserRatioPercent: 70,
            promoterRatioPercent: 30,
            shares: [
                { partnerRole: 'PURCHASER', ratioPercent: 70, amount: 14 },
                { partnerRole: 'PROMOTER', ratioPercent: 30, amount: 6 }
            ]
        }),
        updateProcurementProfitSharing: () => Promise.resolve({
            tripId: 2000,
            purchaserRatioPercent: 70,
            promoterRatioPercent: 30,
            shares: []
        }),
        procurementLogistics: () => Promise.resolve([]),
        createProcurementLogistics: () => Promise.resolve({
            id: 1,
            tripId: 2000,
            trackingNumber: 'MOCK-1',
            channel: 'DOMESTIC',
            provider: 'MOCK',
            status: 'IN_TRANSIT',
            lastMessage: 'Package in transit',
            settlementReminderTriggered: false,
            lastCheckedAt: '2026-01-01T00:00:00'
        }),
        refreshProcurementLogistics: () => Promise.resolve({
            id: 1,
            tripId: 2000,
            trackingNumber: 'MOCK-1',
            channel: 'DOMESTIC',
            provider: 'MOCK',
            status: 'DELIVERED',
            lastMessage: 'Delivered',
            settlementReminderTriggered: true,
            lastCheckedAt: '2026-01-01T00:00:00'
        }),
        orders: () => Promise.resolve([
            {
                id: 3000,
                businessId: '20260117001',
                customerId: 1001,
                tripId: 2000,
                status: 'NEW',
                totalAmount: 100,
                lines: [{ skuId: 'prd-1000', itemName: 'Matcha Kit', quantity: 2, purchasedQuantity: 1, unitPrice: 50 }]
            }
        ]),
        getWallet: (partnerId: string) => Promise.resolve({
            partnerId,
            balance: partnerId === 'PURCHASER' ? 120 : 80,
            currency: 'CNY',
            updatedAt: '2026-01-01T00:00:00'
        }),
        getWalletTransactions: (partnerId: string) => Promise.resolve([
            {
                id: 1,
                partnerId,
                amount: 20,
                type: 'TRIP_PAYOUT',
                tripId: 2000,
                createdAt: '2026-01-01T00:00:00'
            }
        ]),
        procurementDeficitItems: () => Promise.resolve([
            {
                skuId: 'prd-1000',
                itemName: 'Matcha Kit',
                deficitQuantity: 1,
                completionPercent: 50,
                priority: 'CRITICAL',
                isTemporary: true,
                visibilityStatus: 'DRAFTER_ONLY'
            }
        ]),
        patchProduct: () => Promise.resolve({
            product: {
                id: 'prd-1000',
                name: { 'en-US': 'Matcha Kit' },
                basePrice: 50,
                mediaGallery: []
            },
            displayName: 'Matcha Kit',
            displayDescription: 'Updated'
        }),
        finalizeProcurementSettlement: () => Promise.resolve(undefined),
        uploadProcurementReceipts: () => Promise.resolve([]),
        saveProcurementReceipt: () => Promise.resolve({}),
        rerecognizeProcurementReceipt: () => Promise.resolve({}),
        recordOfflinePayment: () => Promise.resolve({}),
        procurementList: () => Promise.resolve([]),
        procurementDeliveryPreparations: () => Promise.resolve([
            {
                businessId: '20260117001',
                customerId: 1001,
                customerName: 'Chen Li',
                deliveryStatus: 'PENDING_DELIVERY',
                addressSummary: 'Shanghai Pudong Century Ave 88',
                contactName: 'Chen Li',
                contactPhone: '13800000001',
                latitude: 31.23,
                longitude: 121.47,
                totalPickItems: 1,
                pickedItems: 0
            }
        ]),
        procurementPickingChecklist: () => Promise.resolve([
            {
                businessId: '20260117001',
                customerId: 1001,
                customerName: 'Chen Li',
                deliveryStatus: 'PENDING_DELIVERY',
                addressSummary: 'Shanghai Pudong Century Ave 88',
                readyForDelivery: false,
                items: [{ skuId: 'prd-1000', itemName: 'Matcha Kit', orderedQuantity: 2, pickedQuantity: 1, checked: false, labels: ['SHORT_SHIPPED'] }]
            }
        ]),
        updateProcurementPickingChecklist: () => Promise.resolve({}),
        exportDeliveryPreparations: () => Promise.resolve(new Blob())
    }
}));

describe('ProcurementHUD Component', () => {
    beforeEach(() => {
        window.localStorage.setItem('bobbuy_locale', 'en-US');
    });

    afterEach(() => {
        window.localStorage.removeItem('bobbuy_locale');
    });

    it('renders profit/load/reconcile sections', async () => {
        const walletRead = vi.spyOn(api, 'getWallet');
        const walletHistory = vi.spyOn(api, 'getWalletTransactions');
        render(
            <I18nProvider>
                <BrowserRouter>
                    <ProcurementHUD />
                </BrowserRouter>
            </I18nProvider>
        );

        expect(await screen.findByText(/Profit Insight|利润透视/i)).toBeInTheDocument();
        expect(await screen.findByText(/Capacity Redline|容积红线/i)).toBeInTheDocument();
        expect(await screen.findByText(/Reconcile Detail|对账详情/i)).toBeInTheDocument();
        expect((await screen.findAllByText(/Extra Expenses|额外支出列表/i)).length).toBeGreaterThan(0);
        expect(await screen.findByText(/Procurement Receipt Workbench|采购小票核销工作台/i)).toBeInTheDocument();
        expect(await screen.findByText(/Customer Balance Ledger|客户结算/i)).toBeInTheDocument();
        expect(await screen.findByText(/Pending Delivery Customers|待配送客户列表/i)).toBeInTheDocument();
        expect(await screen.findByText(/Picking Checklist|拣货确认清单/i)).toBeInTheDocument();
        expect(await screen.findByText(/Operation History|操作历史/i)).toBeInTheDocument();
        expect((await screen.findAllByText('20260117001')).length).toBeGreaterThan(0);
        expect(await screen.findByText('PENDING_MANUAL_REVIEW')).toBeInTheDocument();
        expect((await screen.findAllByText(/ollama-compatible/i)).length).toBeGreaterThan(0);
        expect(walletRead).not.toHaveBeenCalled();
        expect(walletHistory).not.toHaveBeenCalled();
        expect(screen.queryByText('Wallet Center')).not.toBeInTheDocument();
    });
});
