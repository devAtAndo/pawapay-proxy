var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
function extractService(metadata) {
  if (!Array.isArray(metadata)) return null;
  const serviceField = metadata.find((entry) => entry.fieldName === "service");
  return serviceField ? serviceField.fieldValue : null;
}
__name(extractService, "extractService");
function detectCallbackType(payload) {
  if ("depositId" in payload) return "deposit";
  if ("payoutId" in payload) return "payout";
  if ("refundId" in payload) return "refund";
  return null;
}
__name(detectCallbackType, "detectCallbackType");
function getTransactionId(payload) {
  return payload.depositId || payload.payoutId || payload.refundId || null;
}
__name(getTransactionId, "getTransactionId");
function resolveDownstreamUrl(service, callbackType, env) {
  const routes = {
    CUST: {
      deposit: env.CUSTOMER_DEPOSIT_CALLBACK_URL,
      payout: env.CUSTOMER_PAYOUT_CALLBACK_URL,
      refund: env.CUSTOMER_REFUND_CALLBACK_URL
    },
    RIDER: {
      deposit: env.RIDER_DEPOSIT_CALLBACK_URL,
      payout: env.RIDER_PAYOUT_CALLBACK_URL,
      refund: env.RIDER_REFUND_CALLBACK_URL
    }
  };
  return routes[service]?.[callbackType] || null;
}
__name(resolveDownstreamUrl, "resolveDownstreamUrl");
var src_default = {
  /**
   * @param {Request} request
   * @param {Env} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({ status: "ok", service: "pawapay-callback-proxy" });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    if (!url.pathname.startsWith("/callback/pawapay/")) {
      return new Response("Not found", { status: 404 });
    }
    let payload;
    let rawBody;
    try {
      rawBody = await request.text();
      payload = JSON.parse(rawBody);
    } catch {
      console.error("Invalid JSON in callback body");
      return new Response("Invalid JSON", { status: 200 });
    }
    const transactionId = getTransactionId(payload);
    if (!transactionId) {
      console.warn("No transaction ID found in payload");
      return new Response("No transaction ID", { status: 200 });
    }
    const callbackType = detectCallbackType(payload);
    if (!callbackType) {
      console.warn("Could not determine callback type");
      return new Response("Unknown callback type", { status: 200 });
    }
    const service = extractService(payload.metadata);
    if (!service) {
      console.warn(
        `No 'service' field in metadata for transaction ${transactionId}`
      );
      return new Response("No service in metadata", { status: 200 });
    }
    const downstreamUrl = resolveDownstreamUrl(service, callbackType, env);
    if (!downstreamUrl) {
      console.warn(
        `No route configured for service=${service} type=${callbackType}`
      );
      return new Response("No route configured", { status: 200 });
    }
    const forwardHeaders = {
      "Content-Type": request.headers.get("content-type") || "application/json"
    };
    const signature = request.headers.get("x-pawapay-signature");
    if (signature) {
      forwardHeaders["x-pawapay-signature"] = signature;
    }
    try {
      const downstreamResponse = await fetch(downstreamUrl, {
        method: "POST",
        headers: forwardHeaders,
        body: rawBody
      });
      console.log(
        `Forwarded ${callbackType} for ${service} (${transactionId}) \u2192 ${downstreamUrl} \u2014 ${downstreamResponse.status}`
      );
      if (downstreamResponse.ok) {
        return new Response("OK", { status: 200 });
      }
      console.warn(
        `Downstream returned ${downstreamResponse.status} for ${transactionId}`
      );
      return new Response("Forwarded (downstream error)", { status: 200 });
    } catch (err) {
      console.error(`Failed to reach ${downstreamUrl}: ${err.message}`);
      return new Response("Downstream unreachable", { status: 500 });
    }
  }
};

// ../../../Library/Caches/pnpm/dlx/f50561f85c3547d03fc3c52ccea0915f47f912a3b14cd3fb8ebcd2c046c9cb56/19d3f17739e-14f71/node_modules/.pnpm/wrangler@4.78.0/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../Library/Caches/pnpm/dlx/f50561f85c3547d03fc3c52ccea0915f47f912a3b14cd3fb8ebcd2c046c9cb56/19d3f17739e-14f71/node_modules/.pnpm/wrangler@4.78.0/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-KUL4Pb/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../Library/Caches/pnpm/dlx/f50561f85c3547d03fc3c52ccea0915f47f912a3b14cd3fb8ebcd2c046c9cb56/19d3f17739e-14f71/node_modules/.pnpm/wrangler@4.78.0/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-KUL4Pb/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
