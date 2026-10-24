export interface HttpRequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  signal?: AbortSignal;
}

export type HttpInterceptorFn = (
  req: { url: string; method: string; headers: Record<string, string>; body?: any; signal?: AbortSignal },
  next: (req: { url: string; method: string; headers: Record<string, string>; body?: any; signal?: AbortSignal }) => Promise<any>
) => Promise<any>;

export class HttpClient {
  readonly baseUrl: string;
  private readonly interceptors: HttpInterceptorFn[];

  constructor(baseUrl: string = '', interceptors: HttpInterceptorFn[] = []) {
    this.baseUrl = baseUrl;
    this.interceptors = interceptors;
  }

  async get<T>(url: string, options?: HttpRequestOptions): Promise<T> {
    return this.request<T>('GET', url, undefined, options);
  }

  async post<T>(url: string, body?: any, options?: HttpRequestOptions): Promise<T> {
    return this.request<T>('POST', url, body, options);
  }

  async put<T>(url: string, body?: any, options?: HttpRequestOptions): Promise<T> {
    return this.request<T>('PUT', url, body, options);
  }

  async delete<T>(url: string, options?: HttpRequestOptions): Promise<T> {
    return this.request<T>('DELETE', url, undefined, options);
  }

  async request<T>(method: string, url: string, body?: any, options?: HttpRequestOptions): Promise<T> {
    const fullUrl = this.buildUrl(url, options?.params);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    };

    const initialReq = {
      url: fullUrl,
      method,
      headers,
      body,
      signal: options?.signal
    };

    // Chain interceptors
    const executeFetch = async (req: typeof initialReq): Promise<T> => {
      const reqInit: RequestInit = {
        method: req.method,
        headers: req.headers,
        signal: req.signal
      };

      if (req.body !== undefined) {
        reqInit.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }

      const resp = await fetch(req.url, reqInit);
      if (!resp.ok) {
        throw new Error('[HttpClient] HTTP ' + resp.status + ' ' + resp.statusText + ' on ' + req.method + ' ' + req.url);
      }

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return (await resp.json()) as T;
      }
      return (await resp.text()) as unknown as T;
    };

    const chain = this.interceptors.reduceRight<() => Promise<T>>(
      (next, interceptor) => () => interceptor(initialReq, (r) => next()),
      () => executeFetch(initialReq)
    );

    return chain();
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const base = this.baseUrl ? this.baseUrl.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '') : path;
    if (!params || Object.keys(params).length === 0) {
      return base;
    }
    const query = new URLSearchParams(params).toString();
    const separator = base.includes('?') ? '&' : '?';
    return base + separator + query;
  }
}
