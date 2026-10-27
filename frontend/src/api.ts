import { message } from 'antd';
import {
    clearAuthSession,
    getStoredAccessToken,
    getStoredCsrfToken,
    getTestInjectedRole,
    getTestInjectedUser,
    storeAuthSession,
    type AuthenticatedUser
} from './authStorage';
import { getStoredLocale, translate } from './i18n';

export type Metrics = {
    users: number;
    trips: number;
    orders: number;
    gmV: number;
    orderStatusCounts?: Record<string, number>;
    latencyP95Ms?: Record<string, number>;
    latencyP99Ms?: Record<string, number>;
    slowEndpoints?: string[];
};

export type MailSettingsView = { version:number; enabled:boolean; host:string; port:number; tlsMode:'STARTTLS'|'TLS'; username:string;
 fromAddress:string; replyTo:string; passwordStored:boolean; keyId:string|null; keyReady:boolean; updatedAt:string|null;
 allowedHosts:string[]; testRecipients:string[] };
export type MailSettingsEdit = Pick<MailSettingsView,'version'|'enabled'|'host'|'port'|'tlsMode'|'username'|'fromAddress'|'replyTo'> & {password?:string};

export type Trip = {
    id: number;
    agentId: number;
    deliveryArea: string;
    deliveryDate: string;
    status: string;
    statusUpdatedAt?: string;
    settlementFrozen?: boolean;
    settlementFreezeStage?: string;
    settlementFreezeReason?: string;
};

export type OrderLine = {
    id?: number;
    skuId: string;
    itemName: string;
    names?:Record<string,string>;currency?:string;priceRevision?:number;
    spec?: string;
    quantity: number;
    purchasedQuantity?: number;
    unitPrice: number;
    pickingConfirmed?: boolean;
};

export type Order = {
    currency?:string;
    id: number;
    businessId: string;
    customerId: number;
    tripId?: number | null;
    desiredDeliveryWindow?: string;
    status: string;
    statusUpdatedAt?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    deliveryStatus?: string;
    totalAmount: number;
    receiptConfirmedAt?: string;
    receiptConfirmedBy?: string;
    billingConfirmedAt?: string;
    billingConfirmedBy?: string;
    lines: OrderLine[];
};

export type User = {
    id: number;
    name: string;
    roles: Array<'CUSTOMER' | 'AGENT'>;
    rating: number;
    phone?: string;
    email?: string;
    note?: string;
    defaultAddress?: {
        contactName?: string;
        phone?: string;
        countryRegion?: string;
        city?: string;
        addressLine?: string;
        postalCode?: string;
        latitude?: number;
        longitude?: number;
    };
    socialAccounts?: Array<{
        platform?: string;
        handle?: string;
        displayName?: string;
        verified?: boolean;
        note?: string;
    }>;
};

export type ManagedUser = {
    id: number;
    username: string;
    name: string;
    email: string;
    roles: Array<'CUSTOMER' | 'AGENT'>;
    enabled: boolean;
    platformAdmin: boolean;
    emailVerified: boolean;
};
export type UserEdit = Pick<ManagedUser, 'username' | 'name' | 'email' | 'roles' | 'enabled'> & { password?: string };

export type AiExtractedItem = {
    id: string;
    originalName: string;
    matchedName: string;
    quantity: number;
    note: string;
    price: number;
    confidence: number;
};

export type AiParseResponse = {
    items: AiExtractedItem[];
};

export type AiTranslateResponse = {
    translatedText: string;
};

export type CategoryAttributeTemplateField = {
    key: string;
    labelKey?: string;
    label?: string;
    type: 'text' | 'number' | 'select';
    options?: string[];
};

export type MobileCategory = {
    id: string;
    name: Record<string, string>;
    description?: Record<string, string>;
    attributeTemplate: CategoryAttributeTemplateField[];
};

export type MobileSupplier = {
    id: string;
    name: Record<string, string>;
    description?: Record<string, string>;
    contactInfo?: string;
    onboardingRules?: Record<string, any>;
};

export type MobileProductResponse = {
        product: {
            id: string;
            name: Record<string, string>;
        description?: Record<string, string>;
        brand?: string;
        basePrice: number;
        weight?: number;
        volume?: number;
        categoryId?: string;
            itemNumber?: string;
            isRecommended?: boolean;
            isTemporary?: boolean;
            visibilityStatus?: string;
            updatedAt?: string;
            storageCondition?: string;
        orderMethod?: string;
        mediaGallery?: { url: string; title?: Record<string, string>; type: string; sourceUrl?: string; sourceDomain?: string; sourceType?: string }[];
        attributes?: Record<string, string>;
        priceTiers?: PriceTier[];
    };
    displayName: string;
    displayDescription: string;
    reconciledQuantity?: number;
    reconciledTripId?: number;
    allocatedBusinessIds?: string[];
    onboardingTrace?: {
        inputSampleId?: string;
        recognitionSummary?: string;
        sourceDomains?: string[];
        resultDecision?: string;
        finalProductId?: string;
    };
};

export type ProcurementHudStats = {
    tripId: number;
    totalEstimatedProfit: number;
    currentPurchasedAmount: number;
    currentFxRate: number;
    referenceFxRate: number;
    totalTripExpenses: number;
    currentWeight: number;
    currentVolume: number;
    categoryCompletionPercent: Record<string, number>;
    partnerShares: PartnerProfitShare[];
};

export type TripExpense = {
    id: number;
    tripId: number;
    cost: number;
    category: string;
    receiptThumbnailUrl?: string;
    ocrStatus?: string;
    createdAt: string;
};

export type PartnerProfitShare = {
    partnerRole: string;
    ratioPercent: number;
    amount: number;
};

export type ProfitSharingConfig = {
    tripId: number;
    purchaserRatioPercent: number;
    promoterRatioPercent: number;
    shares: PartnerProfitShare[];
};

export type LogisticsTracking = {
    id: number;
    tripId: number;
    trackingNumber: string;
    channel: string;
    provider: string;
    status: string;
    lastMessage: string;
    settlementReminderTriggered: boolean;
    lastCheckedAt: string;
};

export type ManualReconcileResponse = {
    skuId: string;
    fromBusinessId: string;
    toBusinessId: string;
    transferredQuantity: number;
};

export type CustomerBalanceLedgerEntry = {
    tripId: number;
    businessId: string;
    customerId: number;
    customerName?: string;
    totalReceivable: number;
    paidDeposit: number;
    outstandingBalance: number;
    amountDueThisTrip?: number;
    amountReceivedThisTrip?: number;
    amountPendingThisTrip?: number;
    balanceBeforeCarryForward?: number;
    balanceAfterCarryForward?: number;
    settlementStatus: string;
    deliveryStatus?: string;
    deliveryAddressSummary?: string;
    deliveryContactName?: string;
    deliveryContactPhone?: string;
    deliveryLatitude?: number;
    deliveryLongitude?: number;
    settlementFrozen: boolean;
    settlementFreezeStage: string;
    settlementFreezeReason: string;
    receiptConfirmedAt?: string;
    receiptConfirmedBy?: string;
    billingConfirmedAt?: string;
    billingConfirmedBy?: string;
    paymentRecords?: CustomerPaymentRecord[];
    orderLines: {
        skuId: string;
        itemName: string;
    names?:Record<string,string>;currency?:string;priceRevision?:number;
        orderedQuantity: number;
        unitPrice: number;
        purchasedQuantity: number;
        differenceNote: string;
    }[];
};

export type ProcurementReceipt = {
    id: number;
    tripId: number;
    fileName?: string;
    originalImageUrl?: string;
    thumbnailUrl?: string;
    processingStatus: string;
    uploadedAt: string;
    updatedAt?: string;
    reconciliationResult: {
        recognitionMode?: string;
        recognitionStatus?: string;
        summary?: string;
        merchantName?: string;
        receiptDate?: string;
        currency?: string;
        confidence?: number;
        reviewStatus?: string;
        reviewedBy?: string;
        reviewedAt?: string;
        trace?: {
            provider?: string;
            activeProvider?: string;
            model?: string;
            stage?: string;
            latencyMs?: number;
            errorCode?: string;
            errorMessage?: string;
            fallbackReason?: string;
            retryCount?: number;
            attemptNo?: number;
            inputRef?: string;
            outputRef?: string;
            status?: string;
            createdAt?: string;
            updatedAt?: string;
        };
        traceHistory?: Array<Record<string, any>>;
        receiptItems: Array<Record<string, any>>;
        matchedOrderLines: Array<Record<string, any>>;
        unmatchedReceiptItems: Array<Record<string, any>>;
        missingOrderedItems: Array<Record<string, any>>;
        selfUseItems: Array<Record<string, any>>;
        [key: string]: any;
    };
    rawRecognitionResult?: Record<string, any>;
    manualReconciliationResult?: Record<string, any>;
};

export type CustomerPaymentRecord = {
    id: number;
    tripId: number;
    businessId: string;
    customerId: number;
    amount: number;
    paymentMethod: string;
    note?: string;
    createdAt: string;
    operator?: string;
};

export type CustomerBalanceSummary = {
    customerId: number;
    currentBalance: number;
};

export type ProcurementItemResponse = {
    skuId: string;
    itemName: string;
    names?:Record<string,string>;currency?:string;priceRevision?:number;
    totalQuantity: number;
    purchasedQuantity: number;
    unitPrice: number;
    businessIds: string[];
};

export type PickingChecklistItem = {
    skuId: string;
    itemName: string;
    names?:Record<string,string>;currency?:string;priceRevision?:number;
    orderedQuantity: number;
    pickedQuantity: number;
    checked: boolean;
    labels: string[];
};

export type PickingChecklist = {
    businessId: string;
    customerId: number;
    customerName?: string;
    deliveryStatus: string;
    addressSummary?: string;
    readyForDelivery: boolean;
    items: PickingChecklistItem[];
};

export type DeliveryPreparation = {
    businessId: string;
    customerId: number;
    customerName?: string;
    deliveryStatus: string;
    addressSummary?: string;
    contactName?: string;
    contactPhone?: string;
    latitude?: number;
    longitude?: number;
    totalPickItems: number;
    pickedItems: number;
};

export type ProcurementDeficitItemResponse = {
    skuId: string;
    itemName: string;
    names?:Record<string,string>;currency?:string;priceRevision?:number;
    deficitQuantity: number;
    completionPercent: number;
    priority: string;
    isTemporary: boolean;
    visibilityStatus: string;
};

export type ChatImageFlowStatus =
    | 'PENDING_CONFIRMATION'
    | 'MATCHED_EXISTING_PRODUCT'
    | 'CANDIDATE_SELECTED'
    | 'TEMP_PRODUCT_CREATED'
    | 'PUBLISHED_TO_MARKET'
    | 'PUBLISH_FAILED';

export type ChatRecoveryAction =
    | 'RETRY_PUBLISH'
    | 'REQUEST_ATTACHMENT_REUPLOAD'
    | 'RETRY_IMAGE_SCAN';

export type ChatCandidateSummary = {
    brand?: string;
    categoryId?: string;
    matchedFragments?: string[];
    aliasSources?: string[];
    presentedCount?: number;
    rejectedCount?: number;
};

export type ChatCandidateAudit = {
    decision: 'EXACT_MATCH' | 'SELECTED_CANDIDATE' | 'CREATED_TEMP_PRODUCT';
    selectedProductId?: string;
    recommendedProductIds?: string[];
    rejectedProductIds?: string[];
    selectedReason?: string;
    confirmedAt: string;
    reviewedBy?: string;
    triggerEntry?: string;
    publishedAt?: string;
};

export type ChatMessageMetadata = {
    conversationType?: 'PRIVATE' | 'ORDER' | 'TRIP';
    source?: 'CHAT_WIDGET' | 'SYSTEM';
    orderId?: number | null;
    tripId?: number | null;
    relatedOrderId?: number | null;
    relatedTripId?: number | null;
    url?: string;
    attachmentUrl?: string;
    attachmentName?: string;
    productId?: string;
    productName?: string;
    itemNumber?: string;
    visibilityStatus?: string;
    isTemporary?: boolean;
    existingProductFound?: boolean;
    matchedBy?: string;
    imageFlowStatus?: ChatImageFlowStatus;
    recoveryAction?: ChatRecoveryAction;
    decisionAt?: string;
    publishedAt?: string;
    operatorId?: string;
    auditVersion?: string;
    candidateSelectionResult?: string;
    candidateAudit?: ChatCandidateAudit;
    candidateSummary?: ChatCandidateSummary;
    candidateReason?: string;
    candidateReasons?: string[];
    clientMessageId?: string;
    deliveryState?: 'PENDING' | 'QUEUED' | 'FAILED';
    productSnapshot?: {
        productId?: string;
        productName?: string;
        itemNumber?: string;
        visibilityStatus?: string;
        summary?: string;
    };
    [key: string]: any;
};

export type ChatMessage = {
    id?: number;
    orderId?: number | null;
    tripId?: number | null;
    senderId: string;
    recipientId: string;
    content: string;
    type: 'TEXT' | 'IMAGE' | 'SYSTEM';
    metadata?: ChatMessageMetadata;
    createdAt?: string;
};

export type ChatConversationSlice = {
    messages: ChatMessage[];
    nextCursor: number | null;
    hasMore: boolean;
};

export type AiProductCandidate = {
    productId: string;
    displayName: string;
    itemNumber?: string;
    matchReason: string;
    matchSignals?: string[];
    score?: number;
    brand?: string;
    categoryId?: string;
    matchedFragments?: string[];
    aliasSources?: string[];
};

export type WalletSummary = {
    partnerId: string;
    balance: number;
    currency: string;
    updatedAt: string;
};

export type WalletTransaction = {
    id: number;
    partnerId: string;
    amount: number;
    type: string;
    tripId: number;
    createdAt: string;
};

export type ProductPatch = Partial<{
    name: Record<string, string | null>;
    description: Record<string, string | null>;
    brand: string;
    basePrice: number;
    weight: number;
    volume: number;
    mediaGallery: { url: string; title?: Record<string, string>; type: string }[];
    storageCondition: string;
    orderMethod: string;
    categoryId: string;
    merchantSkus: Record<string, string>;
    priceTiers: PriceTier[];
    isRecommended: boolean;
    isTemporary: boolean;
    visibilityStatus: string;
}>;

export type FinancialAuditLog = {
    id: number;
    tripId: number;
    actionType: string;
    operatorName: string;
    originalValue: string;
    modifiedValue: string;
    previousHash: string;
    currentHash: string;
    createdAt: string;
};

const fallbackStockCategories: MobileCategory[] = [
// ... (rest of file)
    {
        id: 'cat-1001',
        name: { 'zh-CN': '服装', 'ja-JP': '衣料品', 'en-US': 'Clothing' },
        description: { 'zh-CN': '服装类商品', 'ja-JP': '衣料品カテゴリ', 'en-US': 'Clothing products' },
        attributeTemplate: [
            { key: 'size', labelKey: 'stock.dynamic.size', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL'] },
            { key: 'material', labelKey: 'stock.dynamic.material', type: 'text' },
            { key: 'color', labelKey: 'stock.dynamic.color', type: 'text' }
        ]
    },
    {
        id: 'cat-1000',
        name: { 'zh-CN': '食品', 'ja-JP': '食品', 'en-US': 'Food' },
        description: { 'zh-CN': '食品类商品', 'ja-JP': '食品カテゴリ', 'en-US': 'Food products' },
        attributeTemplate: [
            { key: 'shelfLifeDays', labelKey: 'stock.dynamic.shelf_life_days', type: 'number' },
            { key: 'storageTemp', labelKey: 'stock.dynamic.storage_temp', type: 'text' },
            { key: 'flavor', labelKey: 'stock.dynamic.flavor', type: 'text' }
        ]
    }
];

const fallback = {
    metrics: { users: 2, trips: 1, orders: 1, gmV: 65, orderStatusCounts: { CONFIRMED: 1 } },
    trips: [
        {
            id: 2000,
            agentId: 1000,
            deliveryArea: 'Shanghai',
            deliveryDate: new Date().toISOString().slice(0, 10),



            status: 'PUBLISHED'
        }
    ],
    orders: [
        {
            id: 3000,
            businessId: '20260117001',
            customerId: 1001,
            tripId: 2000,
            status: 'CONFIRMED',
            paymentMethod: 'ALIPAY',
            paymentStatus: 'UNPAID',
            totalAmount: 65,
            lines: [
                {
                    skuId: 'SKU001',
                    itemName: 'Matcha Kit',
                    quantity: 2,
                    unitPrice: 32.5
                }
            ]
        }
    ],
    users: [
        {
            id: 1000,
            name: 'Aiko Tan',
            roles: ['AGENT' as const],
            rating: 4.8,
            phone: '+81-90-1000-0000',
            email: 'aiko@bobbuy.test',
            note: 'Primary procurement coordinator',
            defaultAddress: {
                contactName: 'Aiko Tan',
                phone: '+81-90-1000-0000',
                countryRegion: 'Japan',
                city: 'Tokyo',
                addressLine: 'Shibuya 1-2-3',
                postalCode: '150-0002'
            },
            socialAccounts: [{ platform: 'LINE', handle: '@aiko-tan', displayName: 'Aiko Tan', verified: false, note: 'Registration only' }]
        },
        {
            id: 1001,
            name: 'Chen Li',
            roles: ['CUSTOMER' as const],
            rating: 4.6,
            phone: '+86-138-0000-0001',
            email: 'chen.li@bobbuy.test',
            note: 'Prefers pickup at station',
            defaultAddress: {
                contactName: 'Chen Li',
                phone: '+86-138-0000-0001',
                countryRegion: 'China',
                city: 'Shanghai',
                addressLine: 'Pudong Century Ave 88',
                postalCode: '200120'
            },
            socialAccounts: [{ platform: 'WeChat', handle: 'chen-li-1001', displayName: 'Chen Li', verified: false, note: 'Registration only' }]
        }
    ],
    stockCategories: fallbackStockCategories,
    products: [
        {
            product: {
                id: 'prd-1000',
                name: { 'zh-CN': 'Organic Milk', 'ja-JP': 'Organic Milk', 'en-US': 'Organic Milk' },
                description: { 'zh-CN': 'Fresh milk', 'ja-JP': 'Fresh milk', 'en-US': 'Fresh milk' },
                brand: 'BOBBuy Select',
                basePrice: 12.99,
                categoryId: 'cat-1000',
                itemNumber: 'SKU-20934',
                mediaGallery: []
            },
            displayName: 'Organic Milk',
            displayDescription: 'Fresh milk'
        },
        {
            product: {
                id: 'prd-1001',
                name: { 'zh-CN': 'Fresh Spinach', 'ja-JP': 'Fresh Spinach', 'en-US': 'Fresh Spinach' },
                description: { 'zh-CN': 'Leafy greens', 'ja-JP': 'Leafy greens', 'en-US': 'Leafy greens' },
                brand: 'BOBBuy Select',
                basePrice: 4.49,
                categoryId: 'cat-1000',
                itemNumber: 'SKU-88210',
                mediaGallery: []
            },
            displayName: 'Fresh Spinach',
            displayDescription: 'Leafy greens'
        }
    ] as MobileProductResponse[],
    walletSummary: {
        partnerId: 'PURCHASER',
        balance: 1250.5,
        currency: 'CNY',
        updatedAt: new Date().toISOString()
    } as WalletSummary,
    walletTransactions: [
        {
            id: 9000,
            partnerId: 'PURCHASER',
            amount: 45.2,
            type: 'TRIP_PAYOUT',
            tripId: 2000,
            createdAt: new Date().toISOString()
        }
    ] as WalletTransaction[]
};

type ApiResponse<T> = {
    status: 'success' | 'error';
    data?: T;
    meta?: { total?: number };
};

type ApiErrorResponse = {
    status: 'error';
    errorCode?: string;
    message?: string;
};

export type AuthSessionResponse = {
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshTokenExpiresAt: string;
    user: AuthenticatedUser;
};

type RequestOptions = {
    includeAccessToken?: boolean;
    includeCsrfToken?: boolean;
    retryOnUnauthorized?: boolean;
    withJsonContentType?: boolean;
};

let refreshSessionPromise: Promise<AuthSessionResponse | null> | null = null;

const genericErrorMessage = () => translate(getStoredLocale(), 'errors.request_failed');

const isMockApiEnabled = () =>
    typeof window !== 'undefined' && window.localStorage.getItem('bobbuy_enable_mock_api') === 'true';

function createRequestHeaders(
    initHeaders?: HeadersInit,
    withJsonContentType = false,
    includeAccessToken = true,
    includeCsrfToken = false
): Headers {
    const headers = new Headers(initHeaders);
    if (!headers.has('Accept-Language')) {
        headers.set('Accept-Language', getStoredLocale());
    }
    if (includeCsrfToken && !headers.has('X-BOBBUY-CSRF-TOKEN')) {
        const csrfToken = getStoredCsrfToken();
        if (csrfToken) {
            headers.set('X-BOBBUY-CSRF-TOKEN', csrfToken);
        }
    }
    const accessToken = includeAccessToken ? getStoredAccessToken() : null;
    if (accessToken && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${accessToken}`);
    } else if (!accessToken) {
        const injectedRole = getTestInjectedRole();
        if (injectedRole) {
            headers.set('X-BOBBUY-ROLE', injectedRole);
        }
        const injectedUser = getTestInjectedUser();
        if (injectedUser) {
            headers.set('X-BOBBUY-USER', injectedUser);
        }
    }
    if (withJsonContentType && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
    return headers;
}

function isAuthEndpoint(url: string) {
    return url === '/api/auth/login' || url === '/api/auth/refresh' || url === '/api/auth/logout';
}

async function authorizedFetch(url: string, init?: RequestInit, options?: RequestOptions): Promise<Response> {
    const requestOptions = options ?? {};
    const response = await fetch(url, {
        ...init,
        credentials: 'same-origin',
        headers: createRequestHeaders(
            init?.headers,
            requestOptions.withJsonContentType,
            requestOptions.includeAccessToken !== false,
            requestOptions.includeCsrfToken === true
        )
    });
    if (response.status === 401 && requestOptions.retryOnUnauthorized !== false && !isAuthEndpoint(url)) {
        const refreshedSession = await refreshAuthSession();
        if (refreshedSession) {
            return authorizedFetch(url, init, { ...requestOptions, retryOnUnauthorized: false });
        }
    }
    return response;
}

async function parseSuccessPayload<T>(response: Response, fallbackValue?: T): Promise<T> {
    const payload = (await response.json()) as ApiResponse<T> | T;
    if (typeof payload === 'object' && payload !== null && 'status' in payload && 'data' in payload) {
        if (payload.data !== undefined) {
            return payload.data as T;
        }
        if (fallbackValue !== undefined && isMockApiEnabled()) {
            return fallbackValue;
        }
        throw new Error(genericErrorMessage());
    }
    return payload as T;
}

export async function refreshAuthSession(): Promise<AuthSessionResponse | null> {
    if (refreshSessionPromise) {
        return refreshSessionPromise;
    }
    refreshSessionPromise = (async () => {
        try {
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                credentials: 'same-origin',
                headers: createRequestHeaders(undefined, false, false, true)
            });
            if (!response.ok) {
                clearAuthSession();
                return null;
            }
            const session = await parseSuccessPayload<AuthSessionResponse>(response);
            storeAuthSession(session);
            return session;
        } catch {
            clearAuthSession();
            return null;
        }
    })().finally(() => {
        refreshSessionPromise = null;
    });
    return refreshSessionPromise;
}

async function parseErrorMessage(response: Response): Promise<string> {
    try {
        const payload = (await response.json()) as ApiErrorResponse;
        if (payload?.message) {
            return payload.message;
        }
    } catch {
        // Ignore parse errors and fall back to status text.
    }
    return response.statusText || genericErrorMessage();
}

async function fetchJson<T>(url: string, fallbackValue: T, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
        response = await authorizedFetch(url, init);
    } catch (error) {
        console.error(`[API ERROR] FETCH failure at ${url}:`, error);
        if (isMockApiEnabled()) {
            message.warning('[Mock API] Falling back to local sample data.');
            return fallbackValue;
        }
        const errorMessage = error instanceof Error ? error.message : genericErrorMessage();
        message.error(errorMessage);
        throw error instanceof Error ? error : new Error(errorMessage);
    }
    if (!response.ok) {
        if (response.status === 401) {
            clearAuthSession();
        }
        const errorMessage = await parseErrorMessage(response);
        message.error(errorMessage);
        if (isMockApiEnabled()) {
            return fallbackValue;
        }
        throw new Error(errorMessage);
    }
    return parseSuccessPayload(response, fallbackValue);
}

async function postJson<TResponse, TBody>(url: string, body: TBody, options?: RequestOptions): Promise<TResponse> {
    const response = await authorizedFetch(url, {
        method: 'POST',
        body: JSON.stringify(body)
    }, { ...options, withJsonContentType: true });
    if (!response.ok) {
        if (response.status === 401) {
            clearAuthSession();
        }
        console.error(`[API ERROR] POST failure at ${url} (Status: ${response.status})`);
        const errorMessage = await parseErrorMessage(response);
        message.error(errorMessage);
        throw new Error(errorMessage);
    }
    return parseSuccessPayload(response);
}

async function patchJson<TResponse, TBody>(url: string, body: TBody, options?: RequestOptions): Promise<TResponse> {
    const response = await authorizedFetch(url, {
        method: 'PATCH',
        body: JSON.stringify(body)
    }, { ...options, withJsonContentType: true });
    if (!response.ok) {
        if (response.status === 401) {
            clearAuthSession();
        }
        const errorMessage = await parseErrorMessage(response);
        message.error(errorMessage);
        throw new Error(errorMessage);
    }
    return parseSuccessPayload(response);
}

async function putJson<TResponse, TBody>(url: string, body: TBody, options?: RequestOptions): Promise<TResponse> {
    const response = await authorizedFetch(url, {
        method: 'PUT',
        body: JSON.stringify(body)
    }, { ...options, withJsonContentType: true });
    if (!response.ok) {
        if (response.status === 401) {
            clearAuthSession();
        }
        const errorMessage = await parseErrorMessage(response);
        message.error(errorMessage);
        throw new Error(errorMessage);
    }
    return parseSuccessPayload(response);
}

export type PriceTier = {
    tierName: string;
    price: number;
    currency: string;
    agentOnly: boolean;
    note?: string;
    updatedAt?: string;
};

export type AiOnboardingSuggestion = {
    name: string;
    brand?: string;
    description?: string;
    price?: number;
    categoryId?: string;
    itemNumber?: string;
    storageCondition?: string;
    orderMethod?: string;
    mediaGallery?: { url: string; title?: Record<string, string>; type: string; visible?: boolean; sourceUrl?: string; sourceDomain?: string; sourceType?: string }[];
    attributes?: Record<string, string>;
    existingProductFound?: boolean;
    existingProductId?: string;
    similarProductCandidates?: AiProductCandidate[];
    visibilityStatus?: string;
    detectedPriceTiers?: PriceTier[];
    originalPhotoBase64?: string;
    inputSampleId?: string;
    recognitionSummary?: string;
    sourceDomains?: string[];
    rejectedSourceDomains?: string[];
    sourcePolicyVersion?: string;
    trace?: {
        inputSampleId?: string;
        recognitionSummary?: string;
        sourceDomains?: string[];
        resultDecision?: string;
        finalProductId?: string;
        provider?: string;
        activeProvider?: string;
        model?: string;
        stage?: string;
        latencyMs?: number;
        errorCode?: string;
        errorMessage?: string;
        fallbackReason?: string;
        retryCount?: number;
        attemptNo?: number;
        inputRef?: string;
        outputRef?: string;
        recognitionStatus?: string;
        manualReviewRequired?: boolean;
        createdAt?: string;
        updatedAt?: string;
        events?: Array<Record<string, any>>;
    };
    matchScore?: number;
    semanticReasoning?: string;
    fieldDiffs?: {
        field: string;
        label: string;
        oldValue?: string;
        newValue?: string;
        different: boolean;
        identityField: boolean;
    }[];
    verificationTarget?: {
        productId: string;
        displayName: string;
        mediaGallery?: { url: string; title?: Record<string, string>; type: string; visible?: boolean; sourceUrl?: string; sourceDomain?: string; sourceType?: string }[];
    };
};

export type RecommendationSummary = { id: number; title: string; published: boolean; version: number; updatedAt: string; publishedAt?: string; publisherName?: string; coverImageUrl?: string; merchantId?:number };
export type RecommendationFacts = { name: string; itemNumber?: string | null; referencePrice?: number | null; originalPrice?: number | null; discountAmount?: number | null; priceUnit?: string | null; offerStart?: string | null; offerEnd?: string | null; couponStart?: string | null; couponEnd?: string | null; offerNotes?: string | null };
export type RecommendationLabel = {id:string;name:Record<string,string>};
export type RecommendationText={name:string;specification?:string|null;description?:string|null;offerNotes?:string|null};
export type LocalizationRow={itemId:number;sourceHash:string;specification?:string|null;description?:string|null;translations:Record<string,RecommendationText>};
export type ProductSale={amount:number;currency:string;unit:string;validFrom?:string|null;validThrough?:string|null;revision:number;enabled:boolean};
export type SaleReview={itemId:number;amount:number;currency:string;unit:string;validFrom?:string|null;validThrough?:string|null;revision:number;replaceExisting:boolean;enabled:boolean};
export type RecommendationPicture={id:string;url:string;hash:string;sourceUrl:string;assetKey:string;label:string};
export type RecommendationItem = RecommendationFacts & {catalogDriven?:boolean;sourceFacts?:{name:string;itemNumber?:string|null;specification?:string|null;description?:string|null;translations:Record<string,RecommendationText>;translationSource:string};brand?:string|null;model?:string|null;packaging?:string|null;gallery?:RecommendationPicture[];specification?:string|null;description?:string|null;translations?:Record<string,RecommendationText>;translationSource?:string;translationStatus?:string; id: number; productId?: string | null; currency?: 'JPY'; imageUrl: string; categoryIds?:string[]; categories?:RecommendationLabel[]; supplierId?:string|null; supplierName?:Record<string,string>|null; showSupplier?:boolean };
export type RecommendationChoice = RecommendationLabel & {editable:boolean};
export type RecommendationAssignment = {itemIds:number[];categoryIds:string[];categoryMode:'add'|'remove'|'replace';updateCategories:boolean;supplierId:string|null;updateSupplier:boolean;showSupplier:boolean;version:number};
export const recommendationTaxonomyApi = {
    options:()=>storeGet<{categories:RecommendationChoice[];suppliers:RecommendationChoice[]}>('/api/merchant/recommendation-taxonomy'),
    category:(id:string|undefined,name:string,locale:string)=>id
        ? putJson<RecommendationChoice,object>('/api/merchant/recommendation-taxonomy/categories/'+id,{name,locale})
        : postJson<RecommendationChoice,object>('/api/merchant/recommendation-taxonomy/categories',{name,locale}),
    assign:(id:number,input:RecommendationAssignment)=>putJson<RecommendationDetail,RecommendationAssignment>(recommendationBase+'/'+id+'/classification',input)
};
export type RecommendationDetail = { post: RecommendationSummary; body: string; items: RecommendationItem[] };
const recommendationBase = '/api/merchant/recommendations';
export type CatalogMedia={url:string;type:string;title:Record<string,string>;visible:boolean;sha256?:string|null;sourceUrl?:string|null;sourceDomain?:string|null;sourceType?:string|null};
export type CatalogInput={productId:string;version:number;name:Record<string,string>;description:Record<string,string>;itemNumber?:string|null;brand?:string|null;specification:Record<string,string>;model?:string|null;packaging?:string|null;categoryIds:string[];supplierId?:string|null;gallery:CatalogMedia[];translationsReviewed:boolean};
export type CatalogProposal={value:CatalogInput;changes:string[];warnings:string[]};
export type PriceAdjustment={id:number;version:number;productId:string;channel:string;currency:string;amount:number;unit?:string;startsAt:string;endsAt:string;status:'DRAFT'|'APPROVED'|'CANCELLED';sourceNote:string;createdBy:number;createdAt:string;updatedAt:string;approvedAt?:string;cancelledAt?:string};
export type PricingInput={channel:string;currency:string;amount:number;startsAt:string;endsAt:string;sourceNote:string;version:number};
export type PricingSheet={productId:string;regular:ProductSale|null;visibility:string;orderMethod:string;now:string;timezone:string;effective:{amount:number;currency:string;unit:string;regularAmount:number;adjustmentId?:number}|null;history:{value:PriceAdjustment;state:string}[]};
export const productPricingApi={
 get:(id:string)=>storeGet<PricingSheet>('/api/merchant/product-pricing/'+encodeURIComponent(id)),
 draft:(id:string,value:PricingInput,adjustmentId?:number)=>adjustmentId?putJson<PricingSheet,object>('/api/merchant/product-pricing/'+encodeURIComponent(id)+'/adjustments/'+adjustmentId,value):postJson<PricingSheet,object>('/api/merchant/product-pricing/'+encodeURIComponent(id)+'/adjustments',value),
 approve:(id:string,adjustment:PriceAdjustment)=>postJson<PricingSheet,object>('/api/merchant/product-pricing/'+encodeURIComponent(id)+'/adjustments/'+adjustment.id+'/approve',{version:adjustment.version,confirmed:true}),
 cancel:(id:string,adjustment:PriceAdjustment)=>postJson<PricingSheet,object>('/api/merchant/product-pricing/'+encodeURIComponent(id)+'/adjustments/'+adjustment.id+'/cancel',{version:adjustment.version,confirmed:true}),
 regular:(id:string,value:Omit<ProductSale,'reviewedBy'|'reviewedAt'>)=>putJson<PricingSheet,object>('/api/merchant/product-pricing/'+encodeURIComponent(id)+'/regular',{...value,confirmed:true,replaceExisting:true})
};
export const productCatalogApi={
 get:(id:string)=>storeGet<{value:CatalogInput;canonical:boolean;sourceItemIds:number[]}>('/api/merchant/product-catalog/'+encodeURIComponent(id)),
 proposals:()=>storeGet<CatalogProposal[]>('/api/merchant/product-catalog'),
 preview:(rows:CatalogInput[])=>postJson<CatalogProposal[],object>('/api/merchant/product-catalog/preview',{rows,reviewed:false}),
 save:(rows:CatalogInput[])=>putJson<{value:CatalogInput;canonical:boolean;sourceItemIds:number[]}[],object>('/api/merchant/product-catalog',{rows,reviewed:true}),
 upload:async(id:string,file:File,sourceUrl:string,label:string)=>{const form=new FormData();form.set('file',file);form.set('sourceUrl',sourceUrl);form.set('label',label);form.set('verified','true');const response=await authorizedFetch('/api/merchant/product-catalog/'+encodeURIComponent(id)+'/images',{method:'POST',body:form});if(!response.ok)throw new Error(await parseErrorMessage(response));return parseSuccessPayload<CatalogMedia>(response);}
};
export const recommendationApi = {
    galleryOrder:(post:number,item:number,orderedIds:string[],version:number)=>putJson<RecommendationDetail,object>(recommendationBase+'/'+post+'/items/'+item+'/gallery',{orderedIds,version}),
    galleryUpload:async(post:number,item:number,file:File,input:{version:number;sourceUrl:string;assetKey:string;label:string;itemNumber?:string|null;verified:boolean})=>{
        const form=new FormData();form.set('file',file);Object.entries(input).forEach(([key,value])=>{if(value!=null)form.set(key,String(value));});
        const response=await authorizedFetch(recommendationBase+'/'+post+'/items/'+item+'/gallery',{method:'POST',body:form});
        if(!response.ok)throw new Error(await parseErrorMessage(response));return parseSuccessPayload<RecommendationDetail>(response);
    },
    currencies:()=>storeGet<{code:string;symbol:string;fractionDigits:number;name:string;saleEnabled:boolean}[]>('/api/merchant/currencies'),
    sales:(id:number,input:{reviews:SaleReview[];version:number;confirmedPreorder:boolean})=>putJson<RecommendationDetail,object>(recommendationBase+'/'+id+'/sales',input),
    localize:(id:number,input:{rows:LocalizationRow[];version:number;reviewed:boolean})=>putJson<RecommendationDetail,object>(recommendationBase+'/'+id+'/localizations',input),
    catalog:(id:number,input:{itemIds:number[];productId?:string;version:number})=>putJson<RecommendationDetail,object>(recommendationBase+'/'+id+'/catalog',input),
    list: (page: number) => storeGet<RecommendationSummary[]>(recommendationBase + '?page=' + page),
    nodes: () => storeGet<{id:number;name:string}[]>('/api/storefront/recommendation-nodes'),
    feed: (page: number, merchantId?:number) => storeGet<RecommendationDetail[]>('/api/storefront/recommendations?page=' + page + (merchantId ? '&merchantId='+merchantId : '')),
    get: (id: number, publicView = false, merchantId?:number) => storeGet<RecommendationDetail>((publicView ? '/api/storefront/recommendations/' : recommendationBase + '/') + id + (publicView && merchantId ? '?merchantId='+merchantId : '')),
    create: () => postJson<RecommendationDetail, object>(recommendationBase, {}),
    save: (id: number, title: string, body: string, version: number) => putJson<RecommendationDetail, object>(recommendationBase + '/' + id, { title, body, version }),
    publish: (id: number, version: number, publish: boolean) => postJson<RecommendationDetail, object>(recommendationBase + '/' + id + (publish ? '/publish' : '/withdraw'), { version }),
    editItem: (id: number, itemId: number, facts: RecommendationFacts, version: number) => putJson<RecommendationDetail, object>(recommendationBase + '/' + id + '/items/' + itemId, { facts, version }),
    sourceImage: (id: number, imageUrl: string, facts: RecommendationFacts, version: number) => postJson<{detail: RecommendationDetail; productCreated: boolean; imageReused: boolean; priceUpdated: boolean}, object>(recommendationBase + '/' + id + '/source-image', {imageUrl,facts,version}),
    upload: async (id: number, file: File, name: string, itemNumber: string, referencePrice: number | null, version: number, facts?: RecommendationFacts) => {
        const body = new FormData();
        body.append('file', file);
        for (const [key,value] of Object.entries(facts ?? {name,itemNumber,referencePrice})) if (value != null && value !== '') body.append(key,String(value));
        body.append('version', String(version));
        const response = await authorizedFetch(recommendationBase + '/' + id + '/images', { method: 'POST', body });
        if (!response.ok) throw new Error(await parseErrorMessage(response));
        return parseSuccessPayload<{ detail: RecommendationDetail; productCreated: boolean; imageReused: boolean; priceUpdated: boolean }>(response);
    },
    remove: async (id: number, itemId: number, version: number) => {
        const response = await authorizedFetch(recommendationBase + '/' + id + '/items/' + itemId + '?version=' + version, { method: 'DELETE' });
        if (!response.ok) throw new Error(await parseErrorMessage(response));
        return parseSuccessPayload<RecommendationDetail>(response);
    }
};

export const api = {
    auth: {
        register: (payload: { username: string; password: string; email: string }) =>
            postJson<AuthSessionResponse, typeof payload>('/api/auth/register', payload, { includeAccessToken: false, retryOnUnauthorized: false }),
        login: (payload: { username: string; password: string }) =>
            postJson<AuthSessionResponse, { username: string; password: string }>('/api/auth/login', payload, {
                includeAccessToken: false,
                retryOnUnauthorized: false
            }),
        refresh: () => refreshAuthSession(),
        logout: () =>
            postJson<{ revoked: boolean }, Record<string, never>>('/api/auth/logout', {}, {
                includeAccessToken: false,
                includeCsrfToken: true,
                retryOnUnauthorized: false
            }),
        me: () =>
            fetchJson<AuthenticatedUser>('/api/auth/me', {
                id: 0,
                username: '',
                name: '',
                roles: ['CUSTOMER']
            })
    },
    metrics: () => fetchJson<Metrics>('/api/metrics', fallback.metrics),
    trips: () => fetchJson<Trip[]>('/api/trips', fallback.trips),
    orders: (tripId?: number) =>
        fetchJson<Order[]>(
            typeof tripId === 'number' ? `/api/orders?tripId=${tripId}` : '/api/orders',
            fallback.orders
        ),
    users: () => fetchJson<User[]>('/api/users', fallback.users),
    adminUsers: () => fetchJson<ManagedUser[]>('/api/admin/users', []),
    privateMedia: async (path:string) => {
        if(!/^\/api\/merchant\/media\/[a-zA-Z0-9-]+$/.test(path)) throw new Error('Invalid media path');
        const response=await authorizedFetch(path);
        if(!response.ok) throw new Error(genericErrorMessage());
        return response.blob();
    },
    mailSettings: () => fetchJson<MailSettingsView | null>('/api/admin/settings/mail', null),
    saveMailSettings: (settings:MailSettingsEdit) => putJson<MailSettingsView,MailSettingsEdit>('/api/admin/settings/mail',settings),
    testMailSettings: (recipient:string) => postJson<string,{recipient:string}>('/api/admin/settings/mail/test',{recipient}),
    customerTrips: () => fetchJson<Trip[]>('/api/customer/trips', []),
    customerOrders: (tripId: number) => fetchJson<Order[]>(`/api/customer/orders?tripId=${tripId}`, []),
    customerViewLedger: (tripId: number) => fetchJson<CustomerBalanceLedgerEntry[]>(`/api/customer/procurement/${tripId}/ledger`, []),
    confirmOwnLedger: (tripId: number, businessId: string, action: 'RECEIPT' | 'BILLING') =>
        postJson<CustomerBalanceLedgerEntry, { action: 'RECEIPT' | 'BILLING' }>(`/api/customer/procurement/${tripId}/ledger/${encodeURIComponent(businessId)}/confirm`, { action }),
    registerAccount: (account: { username: string; password: string; email: string }) =>
        postJson<AuthSessionResponse, { account: typeof account }>('/api/auth/register-account', { account }, { includeAccessToken: false, retryOnUnauthorized: false }),
    createUser: (user: UserEdit) => postJson<ManagedUser, UserEdit>('/api/admin/users', user),
    updateUser: (id: number, user: UserEdit) => putJson<ManagedUser, UserEdit>(`/api/admin/users/${id}`, user),
    createTrip: (trip: Pick<Trip, 'deliveryArea' | 'deliveryDate'>) =>
        postJson<Trip, Pick<Trip, 'deliveryArea' | 'deliveryDate'>>('/api/trips', trip),
    updateTrip: (id: number, trip: Pick<Trip, 'deliveryArea' | 'deliveryDate'>) =>
        putJson<Trip, Pick<Trip, 'deliveryArea' | 'deliveryDate'>>(`/api/trips/${id}`, trip),
    createOrder: (order: Omit<Order, 'id' | 'statusUpdatedAt' | 'totalAmount'>) =>
        postJson<Order, Omit<Order, 'id' | 'statusUpdatedAt' | 'totalAmount'>>('/api/orders', order),
    parseOrderText: (text: string) =>
        postJson<AiParseResponse, { text: string }>('/api/ai/parse', { text }),
    confirmAiMapping: (originalName: string, matchedName: string) =>
        postJson<void, { originalName: string; matchedName: string }>('/api/ai/experience/confirm', {
            originalName,
            matchedName
        }),
    updateOrderStatus: (orderId: number, status: string) =>
        patchJson<Order, { status: string }>(`/api/orders/${orderId}/status`, { status }),
    bulkUpdateTripOrderStatus: (tripId: number, targetStatus: string) =>
        patchJson<Order[], { targetStatus: string }>(`/api/trips/${tripId}/orders/bulk-status`, { targetStatus }),
    stockCategories: () => fetchJson<MobileCategory[]>('/api/mobile/categories', fallback.stockCategories),
    suppliers: () => fetchJson<MobileSupplier[]>('/api/mobile/suppliers', []),
    createSupplier: (supplier: MobileSupplier) =>
        postJson<MobileSupplier, MobileSupplier>('/api/mobile/suppliers', supplier),
    updateSupplier: (id: string, supplier: MobileSupplier) =>
        putJson<MobileSupplier, MobileSupplier>(`/api/mobile/suppliers/${id}`, supplier),
    translate: (text: string, targetLocale: string) =>
        postJson<AiTranslateResponse, { text: string; targetLocale: string }>('/api/ai/translate', {
            text,
            targetLocale
        }),
    onboardScan: (base64Image: string, sampleId?: string) =>
        postJson<AiOnboardingSuggestion, { base64Image: string; sampleId?: string }>('/api/ai/onboard/scan', { base64Image, sampleId }),
    onboardConfirm: (suggestion: AiOnboardingSuggestion) =>
        postJson<MobileProductResponse, AiOnboardingSuggestion>('/api/ai/onboard/confirm', suggestion),
    products: () => fetchJson<MobileProductResponse[]>('/api/mobile/products', fallback.products),
    patchProduct: (id: string, patch: ProductPatch) =>
        patchJson<MobileProductResponse, ProductPatch>(`/api/mobile/products/${id}`, patch),
    procurementHud: (tripId: number) =>
        fetchJson<ProcurementHudStats>(`/api/procurement/${tripId}/hud`, {
            tripId,
            totalEstimatedProfit: 0,
            currentPurchasedAmount: 0,
            currentFxRate: 1,
            referenceFxRate: 1,
            totalTripExpenses: 0,
            currentWeight: 0,
            currentVolume: 0,
            categoryCompletionPercent: {},
            partnerShares: []
        }),
    procurementExpenses: (tripId: number) => fetchJson<TripExpense[]>(`/api/procurement/${tripId}/expenses`, []),
    createProcurementExpense: (
        tripId: number,
        payload: { cost: number; category: string; receiptImageBase64?: string }
    ) =>
        postJson<TripExpense, { cost: number; category: string; receiptImageBase64?: string }>(
            `/api/procurement/${tripId}/expenses`,
            payload
        ),
    expenseReceiptPreview: (tripId: number, expenseId: number) =>
        fetchJson<{ expenseId: number; previewUrl: string }>(
            `/api/procurement/${tripId}/expenses/${expenseId}/receipt-preview`,
            { expenseId, previewUrl: '' }
        ),
    procurementProfitSharing: (tripId: number) =>
        fetchJson<ProfitSharingConfig>(`/api/procurement/${tripId}/profit-sharing`, {
            tripId,
            purchaserRatioPercent: 70,
            promoterRatioPercent: 30,
            shares: []
        }),
    updateProcurementProfitSharing: (
        tripId: number,
        payload: { purchaserRatioPercent: number; promoterRatioPercent: number }
    ) =>
        patchJson<ProfitSharingConfig, { purchaserRatioPercent: number; promoterRatioPercent: number }>(
            `/api/procurement/${tripId}/profit-sharing`,
            payload
        ),
    procurementLogistics: (tripId: number) =>
        fetchJson<LogisticsTracking[]>(`/api/procurement/${tripId}/logistics`, []),
    createProcurementLogistics: (
        tripId: number,
        payload: { trackingNumber: string; channel: string; provider: string }
    ) =>
        postJson<LogisticsTracking, { trackingNumber: string; channel: string; provider: string }>(
            `/api/procurement/${tripId}/logistics`,
            payload
        ),
    refreshProcurementLogistics: (tripId: number, trackingId: number) =>
        postJson<LogisticsTracking, Record<string, never>>(
            `/api/procurement/${tripId}/logistics/${trackingId}/refresh`,
            {}
        ),
    procurementAuditLogs: (tripId: number) =>
        fetchJson<FinancialAuditLog[]>(`/api/procurement/${tripId}/audit-logs`, []),
    customerBalanceLedger: (tripId: number) =>
        fetchJson<CustomerBalanceLedgerEntry[]>(`/api/procurement/${tripId}/ledger`, []),
    recordOfflinePayment: (
        tripId: number,
        payload: { businessId: string; amount: number; paymentMethod: string; note?: string }
    ) =>
        postJson<CustomerPaymentRecord, { businessId: string; amount: number; paymentMethod: string; note?: string }>(
            `/api/procurement/${tripId}/payments`,
            payload
        ),
    customerBalance: (customerId: number) =>
        fetchJson<CustomerBalanceSummary>(`/api/procurement/customers/${customerId}/balance`, {
            customerId,
            currentBalance: 0
        }),
    procurementPickingChecklist: (tripId: number) =>
        fetchJson<PickingChecklist[]>(`/api/procurement/${tripId}/picking`, []),
    updateProcurementPickingChecklist: (tripId: number, businessId: string, payload: { skuId: string; checked: boolean }) =>
        patchJson<PickingChecklist, { skuId: string; checked: boolean }>(
            `/api/procurement/${tripId}/picking/${encodeURIComponent(businessId)}`,
            payload
        ),
    procurementDeliveryPreparations: (tripId: number) =>
        fetchJson<DeliveryPreparation[]>(`/api/procurement/${tripId}/delivery-preparations`, []),
    exportDeliveryPreparations: async (tripId: number) => {
        const response = await authorizedFetch(`/api/procurement/${tripId}/delivery-preparations/export`);
        if (!response.ok) {
            const errorMessage = await parseErrorMessage(response);
            message.error(errorMessage);
            throw new Error(errorMessage);
        }
        return response.blob();
    },
    customerLedgerHistory: (customerId: number) =>
        fetchJson<CustomerPaymentRecord[]>(`/api/procurement/customers/${customerId}/ledger-history`, []),
    tripCustomerPayments: (tripId: number, businessId: string) =>
        fetchJson<CustomerPaymentRecord[]>(`/api/procurement/${tripId}/ledger/${encodeURIComponent(businessId)}/payments`, []),
    confirmCustomerLedger: (
        tripId: number,
        businessId: string,
        action: 'RECEIPT' | 'BILLING'
    ) =>
        postJson<CustomerBalanceLedgerEntry, { action: 'RECEIPT' | 'BILLING' }>(
            `/api/procurement/${tripId}/ledger/${encodeURIComponent(businessId)}/confirm`,
            { action }
        ),
    manualReconcile: (
        tripId: number,
        payload: { skuId: string; fromBusinessId: string; toBusinessId: string; quantity: number }
    ) =>
        postJson<ManualReconcileResponse, { skuId: string; fromBusinessId: string; toBusinessId: string; quantity: number }>(
            `/api/procurement/${tripId}/manual-reconcile`,
            payload
        ),
    exportProcurementSettlement: async (tripId: number, format: 'csv' | 'pdf') => {
        const response = await authorizedFetch(`/api/procurement/${tripId}/export?format=${format}`);
        if (!response.ok) {
            const errorMessage = await parseErrorMessage(response);
            message.error(errorMessage);
            throw new Error(errorMessage);
        }
        return response.blob();
    },
    exportCustomerStatement: async (tripId: number, businessId: string) => {
        const response = await authorizedFetch(`/api/procurement/${tripId}/customers/${encodeURIComponent(businessId)}/statement`);
        if (!response.ok) {
            const errorMessage = await parseErrorMessage(response);
            message.error(errorMessage);
            throw new Error(errorMessage);
        }
        return response.blob();
    },
    finalizeProcurementSettlement: (tripId: number) =>
        postJson<void, Record<string, never>>(`/api/procurement/${tripId}/finalize-settlement`, {}),
    procurementReceipts: (tripId: number) =>
        fetchJson<ProcurementReceipt[]>(`/api/procurement/${tripId}/receipts`, []),
    uploadProcurementReceipts: (
        tripId: number,
        payload: { receipts: Array<{ imageBase64: string; fileName?: string }> }
    ) =>
        postJson<ProcurementReceipt[], { receipts: Array<{ imageBase64: string; fileName?: string }> }>(
            `/api/procurement/${tripId}/receipts`,
            payload
        ),
    saveProcurementReceipt: (
        tripId: number,
        receiptId: number,
        payload: { processingStatus?: string; reconciliationResult: ProcurementReceipt['reconciliationResult'] }
    ) =>
        patchJson<ProcurementReceipt, { processingStatus?: string; reconciliationResult: ProcurementReceipt['reconciliationResult'] }>(
            `/api/procurement/${tripId}/receipts/${receiptId}`,
            payload
        ),
    rerecognizeProcurementReceipt: (tripId: number, receiptId: number) =>
        postJson<ProcurementReceipt, Record<string, never>>(
            `/api/procurement/${tripId}/receipts/${receiptId}/re-recognize`,
            {}
        ),
    getWallet: (partnerId: string) =>
        fetchJson<WalletSummary>(`/api/procurement/wallets/${partnerId}`, fallback.walletSummary),
    getWalletTransactions: (partnerId: string) =>
        fetchJson<WalletTransaction[]>(`/api/procurement/wallets/${partnerId}/transactions`, fallback.walletTransactions),
    quickOrder: (tripId: number, payload: { skuId: string; quantity: number; businessId: string }) =>
        postJson<Order, { skuId: string; quantity: number; businessId: string }>(`/api/orders/${tripId}/quick-order`, payload),
    getFinancialAuditLogs: (tripId: number) =>
        fetchJson<FinancialAuditLog[]>(`/api/financial/audit/${tripId}`, []),
    checkFinancialAuditIntegrity: (tripId: number) =>
        fetchJson<{ isValid: boolean }>(`/api/financial/audit/${tripId}/check-integrity`, { isValid: false }),
    procurementDeficitItems: (tripId: number) =>
        fetchJson<ProcurementDeficitItemResponse[]>(`/api/procurement/${tripId}/deficit`, []),
    procurementList: (tripId: number) =>
        fetchJson<ProcurementItemResponse[]>(`/api/trips/${tripId}/procurement-list`, []),
    sendChatMessage: (message: ChatMessage) =>
        postJson<ChatMessage, ChatMessage>('/api/chat/send', message),
    getOrderChatCursor: (orderId: number, params?: { beforeId?: number; limit?: number }) =>
        fetchJson<ChatConversationSlice>(
            `/api/chat/orders/${orderId}/cursor${buildChatCursorQuery(params)}`,
            { messages: [], nextCursor: null, hasMore: false }
        ),
    getOrderChat: (orderId: number) =>
        fetchJson<ChatMessage[]>(`/api/chat/orders/${orderId}`, []),
    getTripChatCursor: (tripId: number, params?: { beforeId?: number; limit?: number }) =>
        fetchJson<ChatConversationSlice>(
            `/api/chat/trips/${tripId}/cursor${buildChatCursorQuery(params)}`,
            { messages: [], nextCursor: null, hasMore: false }
        ),
    getTripChat: (tripId: number) =>
        fetchJson<ChatMessage[]>(`/api/chat/trips/${tripId}`, []),
    getPrivateChatCursor: (userA: string, userB: string, params?: { beforeId?: number; limit?: number }) =>
        fetchJson<ChatConversationSlice>(
            `/api/chat/private/cursor?userA=${encodeURIComponent(userA)}&userB=${encodeURIComponent(userB)}${buildChatCursorQuery(params, true)}`,
            { messages: [], nextCursor: null, hasMore: false }
        ),
    getPrivateChat: (userA: string, userB: string) =>
        fetchJson<ChatMessage[]>(`/api/chat/private?userA=${userA}&userB=${userB}`, []),
    deleteProduct: (id: string) =>
        authorizedFetch(`/api/mobile/products/${id}`, {
            method: 'DELETE'
        }).then(res => {
            if (!res.ok) throw new Error('Delete failed');
        })
};

export type StoreTrip = { id: number; merchantId: number; merchantName: string; deliveryArea: string; deliveryDate: string };
export type StoreProduct = { id: string; merchantId: number; name: Record<string, string>; description: Record<string, string>; brand: string; price: number; categoryId: string; images: string[]; recommendationReady?:boolean;currency?:string;saleUnit?:string;priceRevision?:number;priceToken?:string;regularPrice?:number;priceAdjustmentId?:number;priceValidFrom?:string;priceValidUntil?:string };
export type MerchantCustomer = { customerId: number; name: string; emailVerified: boolean; merchantApproved: boolean; approvedAt?: string };
async function storeGet<T>(path: string): Promise<T> {
    const response = await authorizedFetch(path, undefined, { retryOnUnauthorized: !path.startsWith('/api/storefront/') });
    if (!response.ok) throw new Error(await parseErrorMessage(response));
    return parseSuccessPayload<T>(response);
}
export const storefrontApi = {
    trips: () => storeGet<StoreTrip[]>('/api/storefront/trips'),
    products: () => storeGet<StoreProduct[]>('/api/storefront/products'),
    customers: () => storeGet<MerchantCustomer[]>('/api/merchant/customers'),
    approve: (id: number) => postJson<boolean, object>(`/api/merchant/customers/${id}/approve`, {}),
    resend: () => postJson<boolean, object>('/api/auth/email/resend', {}),
    verify: (code: string) => postJson<boolean, object>('/api/auth/email/verify', { code }),
    checkout: (payload: { requestId: string; tripId: number; currency?:string; items: { productId: string; quantity: number;priceRevision?:number;currency?:string;priceToken?:string }[] }) =>
        postJson<{ orderId: number; total: number;currency:string; status: string; emailVerified: boolean; merchantApproved: boolean }, typeof payload>('/api/checkout', payload)
};

function buildChatCursorQuery(params?: { beforeId?: number; limit?: number }, hasExistingQuery = false) {
    if (!params?.beforeId && !params?.limit) {
        return '';
    }
    const search = new URLSearchParams();
    if (params.beforeId) {
        search.set('beforeId', String(params.beforeId));
    }
    if (params.limit) {
        search.set('limit', String(params.limit));
    }
    return `${hasExistingQuery ? '&' : '?'}${search.toString()}`;
}
