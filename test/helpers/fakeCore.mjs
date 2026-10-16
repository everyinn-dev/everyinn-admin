/**
 * Fake Core Service Binding for Admin BFF route testing (S0-1).
 *
 * Implements the Cloudflare Fetcher interface: { fetch(url, init): Promise<Response> }
 */
export class FakeCore {
  constructor(name = "core") {
    this.name = name;
    this.handlers = [];
    this.calls = [];
  }

  /**
   * Register a route handler.
   * @param {"GET"|"POST"|"PATCH"|"PUT"|"DELETE"|"*"} method
   * @param {string|RegExp} pathPattern
   * @param {Function} responder
   */
  on(method, pathPattern, responder) {
    this.handlers.push({ method: method.toUpperCase(), pathPattern, responder });
    return this;
  }

  async fetch(urlOrRequest, init = {}) {
    const url = new URL(typeof urlOrRequest === "string" ? urlOrRequest : urlOrRequest.url);
    const method = (init.method || "GET").toUpperCase();

    let parsedBody = init.body;
    if (typeof init.body === "string") {
      try {
        parsedBody = JSON.parse(init.body);
      } catch {
        parsedBody = init.body;
      }
    }

    const normalizedHeaders = init.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    normalizedHeaders.get = (name) => normalizedHeaders[name.toLowerCase()];

    const callRecord = {
      url,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      method,
      headers: normalizedHeaders,
      body: parsedBody,
    };
    this.calls.push(callRecord);

    for (const h of this.handlers) {
      const methodMatch = h.method === "*" || h.method === method;
      const pathMatch =
        typeof h.pathPattern === "string"
          ? url.pathname === h.pathPattern
          : h.pathPattern.test(url.pathname);

      if (methodMatch && pathMatch) {
        const result = await h.responder(callRecord);
        if (result instanceof Response) return result;

        const status = result.status ?? 200;
        const headers = new Headers(result.headers ?? {});
        if (!headers.has("content-type")) {
          headers.set("content-type", "application/json");
        }
        if (!headers.has("x-request-id")) {
          headers.set("x-request-id", "mock-req-id");
        }

        if (status === 204 || status === 205 || status === 304) {
          return new Response(null, { status, headers });
        }

        const bodyStr =
          typeof result.body === "string"
            ? result.body
            : JSON.stringify(result.body ?? result);

        return new Response(bodyStr, { status, headers });
      }
    }

    return new Response(
      JSON.stringify({
        error: {
          code: "MOCK_NOT_FOUND",
          message: `FakeCore [${this.name}] has no handler for ${method} ${url.pathname}`,
        },
      }),
      { status: 404, headers: { "content-type": "application/json" } }
    );
  }
}
