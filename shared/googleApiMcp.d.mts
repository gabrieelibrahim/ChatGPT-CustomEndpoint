export function googleApiService(url: string): string | undefined;
export function createGoogleApiMcp(options: { serviceId: string; token: string; write?: boolean; fetch?: typeof fetch }): {
  rpc(method: string, params?: any, signal?: AbortSignal): Promise<any>;
  close(): void;
};
export function googleApiMcpFetch(options: { serviceId: string; token: string; write?: boolean; fetch?: typeof fetch }): typeof fetch & { close(): void };
