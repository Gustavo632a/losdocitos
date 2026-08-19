const express = require('express');
const cors = require('cors');
const path = require('path');
const { randomUUID } = require('crypto');
const { MercadoPagoConfig, Payment, Preference } = require('mercadopago');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do frontend (pasta raiz)
app.use(express.static(path.join(__dirname)));

// Banco de dados em memória para simulações de Pix
const simulatedPayments = {};

// =============================================
// ROTA: Obter Public Key do Mercado Pago
// =============================================
app.get('/api/mercadopago-publickey', (req, res) => {
    const publicKey = process.env.MP_PUBLIC_KEY;
    if (!publicKey) {
        return res.status(400).json({ error: 'Public Key do Mercado Pago não configurada' });
    }
    return res.json({ publicKey });
});

// =============================================
// ROTA: Criar pagamento Pix
// =============================================
app.post('/api/criar-pagamento-pix', async (req, res) => {
    const { amount, email, name, cpf } = req.body;

    if (!amount || !email || !name) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes (amount, email, name)' });
    }

    const token = process.env.MP_ACCESS_TOKEN;
    const isMockMode = !token || token.startsWith('SEU_') || token.trim() === '';

    if (isMockMode) {
        // MODO SIMULADOR (sem token real)
        const paymentId = 'sim-' + Math.floor(100000 + Math.random() * 900000);
        const qrCodeCopiaCola = `00020101021226870014br.gov.bcb.pix2565pix.losdocitos.com.br/qr/v2/simulated-payment-${paymentId}`;
        
        simulatedPayments[paymentId] = {
            status: 'pending',
            amount: parseFloat(amount),
            createdAt: new Date()
        };

        // Aprovação automática após 15 segundos (apenas para testes)
        setTimeout(() => {
            if (simulatedPayments[paymentId]) {
                simulatedPayments[paymentId].status = 'approved';
                console.log(`[Simulador] Pagamento ${paymentId} aprovado automaticamente.`);
            }
        }, 15000);

        return res.json({
            id: paymentId,
            status: 'pending',
            qr_code: qrCodeCopiaCola,
            qr_code_base64: null,
            is_mock: true
        });
    }

    try {
        // MODO PRODUÇÃO (Mercado Pago real)
        const client = new MercadoPagoConfig({ accessToken: token });
        const payment = new Payment(client);
        const cleanCpf = (cpf || '').replace(/\D/g, '');

        const response = await payment.create({
            body: {
                transaction_amount: parseFloat(amount),
                description: 'Pedido Los Docitos',
                payment_method_id: 'pix',
                payer: {
                    email: email,
                    first_name: name.split(' ')[0],
                    last_name: name.split(' ').slice(1).join(' ') || 'Cliente',
                    identification: cleanCpf ? {
                        type: 'CPF',
                        number: cleanCpf
                    } : undefined
                }
            },
            requestOptions: {
                idempotencyKey: randomUUID()
            }
        });

        return res.json({
            id: response.id,
            status: response.status,
            qr_code: response.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64,
            is_mock: false
        });

    } catch (error) {
        console.error('Erro ao criar pagamento Pix:', error);
        const details = Array.isArray(error.cause)
            ? error.cause
                .map((cause) => [cause.code, cause.description].filter(Boolean).join(': '))
                .filter(Boolean)
                .join('; ')
            : error.message || 'Erro desconhecido';

        return res.status(Number(error.status) || 500).json({ 
            error: 'Erro ao gerar pagamento Pix', 
            details
        });
    }
});

// =============================================
// ROTA: Consultar status do pagamento Pix
// =============================================
app.get('/api/status-pagamento/:id', async (req, res) => {
    const { id } = req.params;

    if (id.startsWith('sim-')) {
        const payment = simulatedPayments[id];
        if (!payment) {
            return res.status(404).json({ error: 'Pagamento simulado não encontrado' });
        }
        return res.json({ status: payment.status });
    }

    const token = process.env.MP_ACCESS_TOKEN;
    if (!token || token.startsWith('SEU_')) {
        return res.status(400).json({ error: 'Token do Mercado Pago não configurado' });
    }

    try {
        const client = new MercadoPagoConfig({ accessToken: token });
        const payment = new Payment(client);
        const response = await payment.get({ id: id });

        return res.json({ status: response.status });
    } catch (error) {
        console.error(`Erro ao consultar pagamento ${id}:`, error);
        return res.status(500).json({ error: 'Erro ao consultar status' });
    }
});

// =============================================
// ROTA: Criar link de pagamento (Cartão de Crédito)
// =============================================
app.post('/api/criar-link-cartao', async (req, res) => {
    const { amount, email, name } = req.body;

    if (!amount || !email || !name) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes (amount, email, name)' });
    }

    const token = process.env.MP_ACCESS_TOKEN;
    const isMockMode = !token || token.startsWith('SEU_') || token.trim() === '';

    const host = req.get('host');
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;

    if (isMockMode) {
        const mockCheckoutUrl = `${baseUrl}/compra.html?status=approved&payment_type=credit_card&is_mock=true`;
        console.log(`[Simulador] Link de pagamento por cartão gerado: ${mockCheckoutUrl}`);
        return res.json({
            init_point: mockCheckoutUrl,
            is_mock: true
        });
    }

    try {
        const client = new MercadoPagoConfig({ accessToken: token });
        const preference = new Preference(client);

        const firstName = name.split(' ')[0];
        const lastName = name.split(' ').slice(1).join(' ') || 'Cliente';

        const response = await preference.create({
            body: {
                items: [
                    {
                        id: 'pedido-doces',
                        title: 'Pedido Los Docitos',
                        description: 'Compra de doces artesanais Los Docitos',
                        quantity: 1,
                        unit_price: parseFloat(amount),
                        currency_id: 'BRL'
                    }
                ],
                payer: {
                    name: firstName,
                    surname: lastName,
                    email: email,
                    phone: {
                        area_code: '55',
                        number: '0000000000'
                    },
                    address: {
                        street_name: 'N/A',
                        street_number: 0,
                        zip_code: '00000-000'
                    }
                },
                payment_methods: {
                    excluded_payment_types: [
                        { id: 'ticket' },
                        { id: 'bank_transfer' },
                        { id: 'pix' }
                    ],
                    excluded_payment_methods: [],
                    installments: 12,
                    default_installments: 1
                },
                back_urls: {
                    success: `${baseUrl}/compra.html?status=approved&payment_type=credit_card`,
                    failure: `${baseUrl}/compra.html?status=failure`,
                    pending: `${baseUrl}/compra.html?status=pending`
                },
                binary_mode: true,
                statement_descriptor: 'LOS DOCITOS'
            }
        });

        console.log(`[Produção] Preferência de cartão criada: ${response.id}`);
        return res.json({
            init_point: response.init_point,
            preference_id: response.id,
            is_mock: false
        });

    } catch (error) {
        console.error('Erro ao criar preferência de cartão:', error.message);
        console.error('Detalhes do erro:', error.response?.data || error);
        return res.status(500).json({ 
            error: 'Erro ao gerar link de cartão de crédito', 
            details: error.message || 'Erro desconhecido' 
        });
    }
});

// =============================================
// ROTA: Processar pagamento com cartão (token)
// =============================================
app.post('/api/processar-pagamento-cartao', async (req, res) => {
    const { amount, email, name, token, installments, cardholderName, paymentMethodId, issuerId } = req.body;

    if (!amount || !email || !name || !token || !paymentMethodId) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    }

    const mpToken = process.env.MP_ACCESS_TOKEN;
    const isMockMode = !mpToken || mpToken.startsWith('SEU_') || mpToken.trim() === '';

    if (isMockMode) {
        // MODO SIMULADOR
        const mockPaymentId = Math.floor(1000000 + Math.random() * 9000000);
        console.log(`[Simulador] Pagamento de cartão aprovado automaticamente: ${mockPaymentId}`);
        return res.json({
            id: mockPaymentId,
            status: 'approved',
            status_detail: 'accredited',
            transaction_amount: parseFloat(amount),
            installments: installments,
            is_mock: true
        });
    }

    try {
        const client = new MercadoPagoConfig({ accessToken: mpToken });
        const payment = new Payment(client);

        const response = await payment.create({
            body: {
                transaction_amount: parseFloat(amount),
                installments: parseInt(installments) || 1,
                payment_method_id: paymentMethodId,
                issuer_id: issuerId || undefined,
                token: token,
                description: 'Pedido Los Docitos',
                payer: {
                    email: email,
                    first_name: name.split(' ')[0],
                    last_name: name.split(' ').slice(1).join(' ') || 'Cliente'
                },
                statement_descriptor: 'LOS DOCITOS'
            },
            requestOptions: {
                idempotencyKey: randomUUID()
            }
        });

        console.log(`[Produção] Pagamento de cartão processado: ${response.id} - Status: ${response.status}`);
        
        return res.json({
            id: response.id,
            status: response.status,
            status_detail: response.status_detail,
            transaction_amount: response.transaction_amount,
            installments: response.installments,
            is_mock: false
        });

    } catch (error) {
        console.error('Erro ao processar pagamento com cartão:', error.message);
        console.error('Detalhes do erro:', error.response?.data || error);
        const details = Array.isArray(error.cause)
            ? error.cause
                .map((cause) => [cause.code, cause.description].filter(Boolean).join(': '))
                .filter(Boolean)
                .join('; ')
            : error.response?.data?.message || error.message || 'Erro desconhecido';

        return res.status(Number(error.status) || 500).json({ 
            error: 'Erro ao processar pagamento com cartão',
            message: details,
            details
        });
    }
});

// =============================================
// Iniciar Servidor
// =============================================
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Servidor Los Docitos rodando na porta ${PORT}`);
    console.log(`👉 Acesse: http://localhost:${PORT}`);
    console.log(`⚙️  Modo: ${process.env.MP_ACCESS_TOKEN && !process.env.MP_ACCESS_TOKEN.startsWith('SEU_') ? 'Mercado Pago API (Produção/Sandbox)' : 'Simulador Offline'}`);
    console.log(`======================================================\n`);
});
