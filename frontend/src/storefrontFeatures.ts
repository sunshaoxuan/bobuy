function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

/** Customer-facing defaults are intentionally closed until each feature is ready. */
export const storefrontFeatures = {
  trips: enabled(import.meta.env.VITE_STOREFRONT_TRIPS_ENABLED),
  dealsBulletin: enabled(import.meta.env.VITE_STOREFRONT_DEALS_BULLETIN_ENABLED),
} as const;
