const express = require('express');
const cors = require('cors');
const path = require('path');
const { randomUUID } = require('crypto');
const { MercadoPagoConfig, Payment, WebhookSignatureValidator, InvalidWebhookSignatureError } = require('mercadopago');
const orderStore = require('./supabase-store');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ORDER_START_HOUR = 12;
const ORDER_END_HOUR = 21;
const ORDER_TIME_ZONE = 'America/Fortaleza';
const ORDER_TTL_MS = 30 * 60 * 1000;
const PRODUCT_PRICES = Object.freeze({
    Chocolate: 15,
    'Prestígio': 15,
    Ninho: 15,
    'Limão': 15,
    Pudim: 12,
    'Cenoura com Chocolate': 17,
    'Red Velvet': 17,
    'Red Velvet com Limão': 17,
    'Combo Doce (pudim e bolo de pote)': 25,
});
const orders = new Map();
const simulatedPayments = new Map();
const requestLog = new Map();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || false }));
app.use(express.json({ limit: '50kb' }));
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' https://sdk.mercadopago.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https://api.qrserver.com",
        "connect-src 'self' https://api.mercadopago.com https://viacep.com.br",
        "frame-src 'self' https://www.mercadopago.com",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ].join('; '));
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

function rateLimit(req, res, next) {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const entries = (requestLog.get(key) || []).filter((time) => now - time < 60_000);
    if (entries.length >= 30) {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({ error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' });
    }
    entries.push(now);
    requestLog.set(key, entries);
    return next();
}

app.use('/api', rateLimit);

function isOrderingOpen(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: ORDER_TIME_ZONE,
        hour: 'numeric',
        weekday: 'short',
        hourCycle: 'h23'
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    const weekday = parts.find((part) => part.type === 'weekday')?.value;
    return weekday !== 'Sun' && hour >= ORDER_START_HOUR && hour < ORDER_END_HOUR;
}

function requireOrderingHours(req, res, next) {
    if (isOrderingOpen()) return next();
    return res.status(403).json({
        error: 'Pedidos indisponíveis no momento',
        details: 'Os pedidos são aceitos de segunda a sábado, das 12h às 21h (horário de Brasília).'
    });
}

function isMockMode() {
    return process.env.PAYMENT_MODE === 'mock' && process.env.NODE_ENV !== 'production';
}

function getPaymentClient() {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken || accessToken.startsWith('SEU_')) return null;
    return new Payment(new MercadoPagoConfig({ accessToken }));
}

function validateCustomer({ name, email, cpf }) {
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim();
    const cleanCpf = String(cpf || '').replace(/\D/g, '');
    if (cleanName.length < 3 || cleanName.length > 120) return 'Informe um nome válido.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) return 'Informe um e-mail válido.';
    if (cpf !== undefined && cleanCpf.length !== 11) return 'Informe um CPF válido com 11 dígitos.';
    return null;
}

function calculateDistanceByCep(destination, origin = '58068404') {
    if (destination === origin) return 0;
    for (let size = 7; size >= 3; size -= 1) {
        if (destination.slice(0, size) === origin.slice(0, size)) {
            if (size === 7) return Math.min(1, 0.5 + Math.abs(Number(destination.slice(7)) - Number(origin.slice(7))) / 20);
            if (size === 6) return Math.min(2, 0.2 + Math.abs(Number(destination.slice(6)) - Number(origin.slice(6))) / 10);
            return ({ 5: 2, 4: 4, 3: 6 })[size];
        }
    }
    return destination.slice(0, 2) === origin.slice(0, 2) ? 10 : 15;
}

function createOrder(data) {
    const orderType = data.orderType === 'pickup' ? 'pickup' : data.orderType === 'delivery' ? 'delivery' : null;
    if (!orderType) throw new Error('Tipo de pedido inválido.');
    if (!data.items || typeof data.items !== 'object' || Array.isArray(data.items)) throw new Error('Carrinho inválido.');

    const items = Object.entries(data.items).map(([name, quantity]) => {
        const qty = Number(quantity);
        const unitPrice = PRODUCT_PRICES[name];
        if (!Number.isInteger(qty) || qty < 1 || qty > 20 || unitPrice === undefined) throw new Error('Há um item inválido no carrinho.');
        return { name, quantity: qty, unitPrice, total: unitPrice * qty };
    });
    if (items.length === 0 || items.length > 20) throw new Error('Adicione itens válidos ao carrinho.');

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    let address = null;
    let shipping = 0;
    if (orderType === 'delivery') {
        const source = data.address || {};
        const cep = String(source.cep || '').replace(/\D/g, '');
        if (cep.length !== 8 || !String(source.bairro || '').trim() || !String(source.rua || '').trim() || !String(source.numero || '').trim()) {
            throw new Error('Informe um endereço de entrega completo.');
        }
        address = {
            cep,
            bairro: String(source.bairro).trim().slice(0, 100),
            rua: String(source.rua).trim().slice(0, 150),
            numero: String(source.numero).trim().slice(0, 20),
            complemento: String(source.complemento || '').trim().slice(0, 100),
            referencia: String(source.referencia || '').trim().slice(0, 150),
        };
        shipping = Math.round(calculateDistanceByCep(cep) * 2 * 100) / 100;
    }

    const id = randomUUID();
    const order = { id, items, orderType, address, subtotal, shipping, total: subtotal + shipping, status: 'pending', createdAt: Date.now() };
    orders.set(id, order);
    setTimeout(() => orders.delete(id), ORDER_TTL_MS).unref?.();
    return order;
}

async function getOrder(orderId) {
    let order = orders.get(orderId);
    if (!order) {
        order = await orderStore.findOrder(orderId);
        if (order) orders.set(order.id, order);
    }
    if (!order || Date.now() - order.createdAt > ORDER_TTL_MS) {
        orders.delete(orderId);
        return null;
    }
    return order;
}

function publicOrder(order) {
    return { id: order.id, items: order.items, orderType: order.orderType, subtotal: order.subtotal, shipping: order.shipping, total: order.total, status: order.status };
}

async function markPaymentStatus(paymentId, status) {
    let order = [...orders.values()].find((item) => String(item.paymentId) === String(paymentId));
    if (!order) order = await orderStore.findOrderByPayment(paymentId);
    if (!order) return null;
    order.status = status === 'approved' ? 'paid' : status;
    orders.set(order.id, order);
    await orderStore.saveOrder(order);
    await orderStore.updatePaymentStatus(paymentId, status);
    return order;
}

app.use(express.static(path.join(__dirname), { dotfiles: 'ignore', index: 'index.html' }));

app.get('/api/mercadopago-publickey', (req, res) => {
    const publicKey = process.env.MP_PUBLIC_KEY;
    if (!publicKey || isMockMode()) return res.status(400).json({ error: 'Pagamento por cartão indisponível.' });
    return res.json({ publicKey });
});

app.post('/api/pedidos', requireOrderingHours, async (req, res) => {
    try {
        const order = createOrder(req.body);
        await orderStore.saveOrder(order);
        return res.status(201).json(publicOrder(order));
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

app.post('/api/criar-pagamento-pix', requireOrderingHours, async (req, res) => {
    const { orderId, name, email, cpf } = req.body;
    const validationError = validateCustomer({ name, email, cpf });
    const order = await getOrder(orderId);
    if (validationError) return res.status(400).json({ error: validationError });
    if (!order || order.status !== 'pending') return res.status(409).json({ error: 'Pedido inválido ou expirado. Revise o carrinho e tente novamente.' });

    if (isMockMode()) {
        const paymentId = `sim-${randomUUID()}`;
        simulatedPayments.set(paymentId, { status: 'pending', orderId });
        order.paymentId = paymentId;
        order.customerName = name.trim();
        order.customerEmail = email.trim();
        await orderStore.saveOrder(order);
        await orderStore.recordPayment(order, 'pix');
        setTimeout(() => {
            const payment = simulatedPayments.get(paymentId);
            if (payment) payment.status = 'approved';
        }, 15_000).unref?.();
        return res.json({ id: paymentId, status: 'pending', qr_code: `SIMULATED-PIX-${paymentId}`, qr_code_base64: null, is_mock: true });
    }

    const payment = getPaymentClient();
    if (!payment) return res.status(503).json({ error: 'Pagamentos indisponíveis. Configure as credenciais do Mercado Pago.' });
    try {
        const response = await payment.create({
            body: {
                transaction_amount: order.total,
                description: `Pedido Los Docitos ${order.id}`,
                external_reference: order.id,
                payment_method_id: 'pix',
                payer: { email: email.trim(), first_name: name.trim().split(' ')[0], last_name: name.trim().split(' ').slice(1).join(' ') || 'Cliente', identification: { type: 'CPF', number: String(cpf).replace(/\D/g, '') } }
            },
            requestOptions: { idempotencyKey: randomUUID() }
        });
        order.paymentId = String(response.id);
        order.customerName = name.trim();
        order.customerEmail = email.trim();
        await orderStore.saveOrder(order);
        await orderStore.recordPayment(order, 'pix');
        return res.json({ id: response.id, status: response.status, qr_code: response.point_of_interaction?.transaction_data?.qr_code, qr_code_base64: response.point_of_interaction?.transaction_data?.qr_code_base64, is_mock: false });
    } catch (error) {
        console.error('Erro ao criar pagamento Pix:', error.message);
        return res.status(Number(error.status) || 500).json({ error: 'Erro ao gerar pagamento Pix.' });
    }
});

app.post('/api/processar-pagamento-cartao', requireOrderingHours, async (req, res) => {
    const { orderId, name, email, token, installments, paymentMethodId, issuerId } = req.body;
    const validationError = validateCustomer({ name, email });
    const order = await getOrder(orderId);
    if (validationError || !token || !paymentMethodId) return res.status(400).json({ error: validationError || 'Dados do cartão inválidos.' });
    if (!order || order.status !== 'pending') return res.status(409).json({ error: 'Pedido inválido ou expirado. Revise o carrinho e tente novamente.' });
    if (isMockMode()) return res.status(503).json({ error: 'Cartão não está disponível no modo de simulação.' });

    const payment = getPaymentClient();
    if (!payment) return res.status(503).json({ error: 'Pagamentos indisponíveis. Configure as credenciais do Mercado Pago.' });
    try {
        const response = await payment.create({
            body: {
                transaction_amount: order.total,
                installments: Math.min(Math.max(Number.parseInt(installments, 10) || 1, 1), 12),
                payment_method_id: paymentMethodId,
                issuer_id: issuerId || undefined,
                token,
                description: `Pedido Los Docitos ${order.id}`,
                external_reference: order.id,
                payer: { email: email.trim(), first_name: name.trim().split(' ')[0], last_name: name.trim().split(' ').slice(1).join(' ') || 'Cliente' }
            },
            requestOptions: { idempotencyKey: randomUUID() }
        });
        order.paymentId = String(response.id);
        order.status = response.status === 'approved' ? 'paid' : response.status;
        order.customerName = name.trim();
        order.customerEmail = email.trim();
        await orderStore.saveOrder(order);
        await orderStore.recordPayment(order, 'credit_card');
        return res.json({ id: response.id, status: response.status, status_detail: response.status_detail, transaction_amount: response.transaction_amount, installments: response.installments, is_mock: false });
    } catch (error) {
        console.error('Erro ao processar pagamento com cartão:', error.message);
        return res.status(Number(error.status) || 500).json({ error: 'Erro ao processar pagamento com cartão.' });
    }
});

app.get('/api/status-pagamento/:id', async (req, res) => {
    const { id } = req.params;
    const mockPayment = simulatedPayments.get(id);
    if (mockPayment) {
        const order = await markPaymentStatus(id, mockPayment.status);
        return res.json({ status: mockPayment.status, order: order ? publicOrder(order) : undefined });
    }
    const payment = getPaymentClient();
    if (!payment) return res.status(503).json({ error: 'Consulta de pagamento indisponível.' });
    try {
        const response = await payment.get({ id });
        const order = await markPaymentStatus(id, response.status);
        return res.json({ status: response.status, order: order ? publicOrder(order) : undefined });
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao consultar status do pagamento.' });
    }
});

// O webhook consulta o Mercado Pago antes de alterar qualquer status local; nunca confia no corpo recebido.
app.post('/api/webhooks/mercadopago', async (req, res) => {
    const webhookSecret = process.env.MP_WEBHOOK_SECRET;
    const paymentId = req.query['data.id'];
    if (!webhookSecret || !paymentId) return res.sendStatus(401);
    try {
        WebhookSignatureValidator.validate({
            xSignature: req.headers['x-signature'],
            xRequestId: req.headers['x-request-id'],
            dataId: paymentId,
            secret: webhookSecret,
            toleranceSeconds: 300,
        });
    } catch (error) {
        if (error instanceof InvalidWebhookSignatureError) return res.sendStatus(401);
        console.error('Erro ao validar assinatura do webhook:', error.message);
        return res.sendStatus(500);
    }
    const payment = getPaymentClient();
    if (!payment) return res.sendStatus(503);
    try {
        const response = await payment.get({ id: paymentId });
        const order = await getOrder(response.external_reference);
        if (order && String(order.paymentId) === String(paymentId)) {
            order.status = response.status === 'approved' ? 'paid' : response.status;
            await orderStore.saveOrder(order);
            await orderStore.updatePaymentStatus(paymentId, response.status);
        }
        return res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao processar webhook do Mercado Pago:', error.message);
        return res.sendStatus(500);
    }
});

if (require.main === module) {
    app.listen(PORT, () => console.log(`Servidor Los Docitos rodando na porta ${PORT}`));
}

module.exports = app;
