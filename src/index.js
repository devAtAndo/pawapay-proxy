/**
 * PawaPay Callback Proxy — Cloudflare Worker
 * ============================================
 * Receives PawaPay webhook callbacks and routes them to the correct
 * downstream service based on the `service` field in the metadata array.
 *
 * PawaPay callback metadata format:
 * {
 *   "depositId": "550e8400-e29b-41d4-a716-446655440000",
 *   "metadata": [
 *     { "fieldName": "service", "fieldValue": "RIDER" },
 *     { "fieldName": "orderId", "fieldValue": "12345" }
 *   ]
 * }
 *
 * Routing:
 *   service=CUST  → Customer app
 *   service=RIDER → Rider app
 */

// ---------------------------------------------------------------------------
//  Route configuration (set these in wrangler.toml as environment variables)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Env
 * @property {string} CUSTOMER_DEPOSIT_CALLBACK_URL
 * @property {string} CUSTOMER_PAYOUT_CALLBACK_URL
 * @property {string} CUSTOMER_REFUND_CALLBACK_URL
 * @property {string} RIDER_DEPOSIT_CALLBACK_URL
 * @property {string} RIDER_PAYOUT_CALLBACK_URL
 * @property {string} RIDER_REFUND_CALLBACK_URL
 */

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the `service` value from PawaPay's metadata array.
 * PawaPay metadata is an array of { fieldName, fieldValue } objects.
 *
 * @param {Array<{fieldName: string, fieldValue: string}>} metadata
 * @returns {string|null}
 */
function extractService(metadata) {
  if (!Array.isArray(metadata)) return null;

  const serviceField = metadata.find((entry) => entry.fieldName === 'service');

  return serviceField ? serviceField.fieldValue : null;
}

/**
 * Determine callback type from the payload fields.
 * PawaPay uses different ID field names per event type.
 *
 * @param {Object} payload
 * @returns {"deposit"|"payout"|"refund"|null}
 */
function detectCallbackType(payload) {
  if ('depositId' in payload) return 'deposit';
  if ('payoutId' in payload) return 'payout';
  if ('refundId' in payload) return 'refund';
  return null;
}

/**
 * Get the transaction ID from the payload regardless of type.
 *
 * @param {Object} payload
 * @returns {string|null}
 */
function getTransactionId(payload) {
  return payload.depositId || payload.payoutId || payload.refundId || null;
}

/**
 * Resolve the downstream URL based on service + callback type.
 *
 * @param {string} service - "CUST" or "RIDER"
 * @param {string} callbackType - "deposit", "payout", or "refund"
 * @param {Env} env
 * @returns {string|null}
 */
function resolveDownstreamUrl(service, callbackType, env) {
  const routes = {
    CUST: {
      deposit: env.CUSTOMER_DEPOSIT_CALLBACK_URL,
      payout: env.CUSTOMER_PAYOUT_CALLBACK_URL,
      refund: env.CUSTOMER_REFUND_CALLBACK_URL,
    },
    RIDER: {
      deposit: env.RIDER_DEPOSIT_CALLBACK_URL,
      payout: env.RIDER_PAYOUT_CALLBACK_URL,
      refund: env.RIDER_REFUND_CALLBACK_URL,
    },
  };

  return routes[service]?.[callbackType] || null;
}

// ---------------------------------------------------------------------------
//  Request handler
// ---------------------------------------------------------------------------

export default {
  /**
   * @param {Request} request
   * @param {Env} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    const url = new URL(request.url);

    // ---- Health check ----
    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json({ status: 'ok', service: 'pawapay-callback-proxy' });
    }

    // ---- Only accept POST to callback paths ----
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    if (!url.pathname.startsWith('/callback/pawapay/')) {
      return new Response('Not found', { status: 404 });
    }

    // ---- Parse body ----
    let payload;
    let rawBody;

    try {
      rawBody = await request.text();
      payload = JSON.parse(rawBody);
    } catch {
      console.error('Invalid JSON in callback body');
      return new Response('Invalid JSON', { status: 200 });
    }

    // ---- Extract routing info ----
    const transactionId = getTransactionId(payload);
    if (!transactionId) {
      console.warn('No transaction ID found in payload');
      return new Response('No transaction ID', { status: 200 });
    }

    const callbackType = detectCallbackType(payload);
    if (!callbackType) {
      console.warn('Could not determine callback type');
      return new Response('Unknown callback type', { status: 200 });
    }

    // ---- Route using metadata ----
    const service = extractService(payload.metadata);
    if (!service) {
      console.warn(
        `No 'service' field in metadata for transaction ${transactionId}`,
      );
      return new Response('No service in metadata', { status: 200 });
    }

    const downstreamUrl = resolveDownstreamUrl(service, callbackType, env);
    if (!downstreamUrl) {
      console.warn(
        `No route configured for service=${service} type=${callbackType}`,
      );
      return new Response('No route configured', { status: 200 });
    }

    // ---- Forward to downstream ----
    const forwardHeaders = {
      'Content-Type': request.headers.get('content-type') || 'application/json',
      'Content-Length': rawBody.length.toString(),
    };

    // Forward PawaPay signature for downstream verification
    const signature = request.headers.get('x-pawapay-signature');
    if (signature) {
      forwardHeaders['x-pawapay-signature'] = signature;
    }

    try {
      const downstreamResponse = await fetch(downstreamUrl, {
        method: 'POST',
        headers: forwardHeaders,
        body: rawBody,
      });

      console.log(
        `Forwarded ${callbackType} for ${service} (${transactionId}) → ${downstreamUrl} — ${downstreamResponse.status}`,
      );

      if (downstreamResponse.ok) {
        return Response.json({ status: 'OK' }, { status: 200 });
      }

      // Downstream error — still return 200 to PawaPay to prevent retries
      // The downstream app handles its own error recovery
      console.warn(
        `Downstream returned ${downstreamResponse.status} for ${transactionId}`,
      );
      return Response.json({ status: 'error' }, { status: 200 });
    } catch (err) {
      // Downstream completely unreachable — return 500 so PawaPay retries
      console.error(`Failed to reach ${downstreamUrl}: ${err.message}`);
      return Response.json({ status: 'error' }, { status: 500 });
    }
  },
};
