const urlsEndpoint =
  "https://raw.githubusercontent.com/Zenda-Cross/vega-providers/refs/heads/main/urls.json";
const cacheTtl = 60 * 60 * 1000;

type ProviderUrls = Record<string, { url: string }>;

type BaseUrlCache = {
  data?: ProviderUrls;
  expiresAt: number;
  request?: Promise<ProviderUrls>;
};

type ProviderState = {
  __vegaProviderBaseUrlCache__?: BaseUrlCache;
};

// Host-app overrides (e.g. harustream seeds these from its urls.ts so both
// repos resolve identical base URLs without a network round-trip).
const baseUrlOverrides = new Map<string, string>();

export function setBaseUrlOverride(providerValue: string, url: string): void {
  baseUrlOverrides.set(providerValue, url.replace(/\/+$/, ""));
}

export function setBaseUrlOverrides(entries: Record<string, string>): void {
  for (const [key, url] of Object.entries(entries)) setBaseUrlOverride(key, url);
}

declare const providerGlobal: ProviderState | undefined;

function getCache(): BaseUrlCache {
  const state =
    typeof providerGlobal !== "undefined" && providerGlobal
      ? providerGlobal
      : (globalThis as typeof globalThis & ProviderState);

  state.__vegaProviderBaseUrlCache__ ??= { expiresAt: 0 };
  return state.__vegaProviderBaseUrlCache__;
}

async function fetchProviderUrls(): Promise<ProviderUrls> {
  const cache = getCache();

  if (cache.data && Date.now() < cache.expiresAt) {
    return cache.data;
  }

  if (cache.request) {
    return cache.request;
  }

  const request = fetch(urlsEndpoint)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`URL configuration request failed: ${response.status}`);
      }

      const data = (await response.json()) as ProviderUrls;
      console.log("Fetched provider URL configuration");
      cache.data = data;
      cache.expiresAt = Date.now() + cacheTtl;
      return data;
    })
    .catch((error) => {
      if (cache.data) {
        console.warn("Using stale provider URL configuration", error);
        return cache.data;
      }

      throw error;
    })
    .finally(() => {
      cache.request = undefined;
    });

  Object.defineProperty(cache, "request", {
    configurable: true,
    enumerable: false,
    value: request,
    writable: true,
  });
  return request;
}

export const getBaseUrl = async (providerValue: string) => {
  const override = baseUrlOverrides.get(providerValue);
  if (override) return override;
  try {
    const providerUrls = await fetchProviderUrls();
    return providerUrls[providerValue]?.url ?? "";
  } catch (error) {
    console.error(`Error fetching baseUrl: ${providerValue}`, error);
    throw error;
  }
};
