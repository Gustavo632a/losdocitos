const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function isConfigured() {
    return Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);
}

async function request(path, options = {}) {
    if (!isConfigured()) return null;
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...options,
        headers: {
            apikey: SUPABASE_SECRET_KEY,
            Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });
    if (!response.ok) throw new Error(`Supabase respondeu com HTTP ${response.status}.`);
    if (response.status === 204) return null;
    return response.json();
}

function toRow(order) {
    return {
        id: order.id,
        status: order.status,
        order_type: order.orderType,
        items: order.items,
        address: order.address,
        subtotal: order.subtotal,
        shipping: order.shipping,
        total: order.total,
        payment_id: order.paymentId || null,
        payment_status: order.status,
        customer_name: order.customerName || null,
        customer_email: order.customerEmail || null,
        created_at: new Date(order.createdAt).toISOString(),
        expires_at: new Date(order.createdAt + 30 * 60 * 1000).toISOString(),
        paid_at: order.status === 'paid' ? new Date().toISOString() : null,
    };
}

function fromRow(row) {
    if (!row) return null;
    return {
        id: row.id,
        items: row.items,
        orderType: row.order_type,
        address: row.address,
        subtotal: Number(row.subtotal),
        shipping: Number(row.shipping),
        total: Number(row.total),
        status: row.status,
        paymentId: row.payment_id,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        createdAt: new Date(row.created_at).getTime(),
    };
}

async function saveOrder(order) {
    if (!isConfigured()) return;
    await request('orders', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(toRow(order)),
    });
}

async function findOrder(id) {
    if (!isConfigured()) return null;
    const rows = await request(`orders?id=eq.${encodeURIComponent(id)}&limit=1`);
    return fromRow(rows?.[0]);
}

async function findOrderByPayment(paymentId) {
    if (!isConfigured()) return null;
    const rows = await request(`orders?payment_id=eq.${encodeURIComponent(paymentId)}&limit=1`);
    return fromRow(rows?.[0]);
}

async function recordPayment(order, method) {
    if (!isConfigured() || !order.paymentId) return;
    await request('payments?on_conflict=provider_payment_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
            order_id: order.id,
            provider_payment_id: String(order.paymentId),
            method,
            status: order.status,
            amount: order.total,
        }),
    });
}

async function updatePaymentStatus(paymentId, status) {
    if (!isConfigured()) return;
    await request(`payments?provider_payment_id=eq.${encodeURIComponent(paymentId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
    });
}

module.exports = { isConfigured, saveOrder, findOrder, findOrderByPayment, recordPayment, updatePaymentStatus };
