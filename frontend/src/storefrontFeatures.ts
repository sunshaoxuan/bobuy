function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

/** Customer-facing defaults are intentionally closed until each feature is ready. */
export const storefrontFeatures = {
  trips: enabled(import.meta.env.VITE_STOREFRONT_TRIPS_ENABLED),
  // 活动邮报 / Campaign Newsletter / キャンペーン便り; retain the existing deployment flag.
  dealsBulletin: enabled(import.meta.env.VITE_STOREFRONT_DEALS_BULLETIN_ENABLED),
} as const;
