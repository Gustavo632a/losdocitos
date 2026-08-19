const whatsappNumber = '5581995687007';

document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menu-toggle');
    const menuNav = document.getElementById('menu-nav');
    const menuLinks = document.querySelectorAll('.menu-link');
    const items = document.querySelectorAll('.item');

    if (menuToggle && menuNav) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            menuNav.classList.toggle('active');
        });

        menuLinks.forEach((link) => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const category = link.dataset.category;

                menuLinks.forEach((itemLink) => itemLink.classList.remove('active'));
                link.classList.add('active');

                items.forEach((item) => {
                    const itemCategory = item.dataset.category;
                    if (category === 'todos' || itemCategory === category) {
                        item.style.display = 'block';
                        item.style.animation = 'fadeIn 0.3s ease';
                    } else {
                        item.style.display = 'none';
                    }
                });

                if (window.innerWidth <= 768) {
                    menuToggle.classList.remove('active');
                    menuNav.classList.remove('active');
                }
            });
        });
    }

    document.addEventListener('click', (event) => {
        if (!event.target.closest('.menu-container') && menuNav && menuNav.classList.contains('active')) {
            menuToggle.classList.remove('active');
            menuNav.classList.remove('active');
        }
    });

    const fadeStyle = document.createElement('style');
    fadeStyle.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(fadeStyle);

    const cartItems = {};
    const cartList = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const cartTotal = document.getElementById('cart-total');
    const cartError = document.getElementById('cart-error');
    const buyNowLink = document.getElementById('buy-now-link');
    const cartWidgetCount = document.getElementById('cart-widget-count');
    const cartWidget = document.getElementById('cart-widget');
    const pickupInfo = document.getElementById('pickup-info');

    function renderStoredPickupInfo() {
        const pickupConfirmation = document.getElementById('pickup-confirmation');
        const pickupPhoneInput = document.getElementById('pickup-phone');
        const codigoSalvo = localStorage.getItem('pickupCode');

        if (codigoSalvo && pickupConfirmation) {
            pickupConfirmation.innerHTML = `Seu código de retirada está salvo: <strong>${codigoSalvo}</strong>. Apresente este código na loja.`;
        }

        if (pickupPhoneInput && localStorage.getItem('pickupPhone')) {
            pickupPhoneInput.value = localStorage.getItem('pickupPhone');
        }
    }

    function renderCart() {
        if (!cartList || !cartCount || !cartTotal || !buyNowLink) {
            return;
        }

        const entries = Object.entries(cartItems);
        let totalItems = 0;
        let totalPrice = 0;

        cartList.innerHTML = '';

        entries.forEach(([name, quantity]) => {
            const itemPrice = 15 * quantity;
            totalItems += quantity;
            totalPrice += itemPrice;

            const item = document.createElement('li');
            item.innerHTML = `
                <span>${name}</span>
                <div class="quantity-controls">
                    <button class="qty-btn" data-name="${name}" data-action="remove">-</button>
                    <strong>${quantity}</strong>
                    <button class="qty-btn" data-name="${name}" data-action="add">+</button>
                </div>
            `;
            cartList.appendChild(item);
        });

        document.querySelectorAll('.qty-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const name = button.dataset.name;
                const action = button.dataset.action;

                if (action === 'add') {
                    cartItems[name] = (cartItems[name] || 0) + 1;
                } else if ((cartItems[name] || 0) > 1) {
                    cartItems[name] -= 1;
                } else {
                    delete cartItems[name];
                }

                renderCart();
            });
        });

        const hasItems = totalItems > 0;
        cartCount.textContent = `${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`;
        cartTotal.textContent = `Total: ${totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;

        if (cartWidgetCount) {
            cartWidgetCount.textContent = totalItems;
        }

        if (!hasItems && pickupInfo) {
            pickupInfo.style.display = 'none';
            localStorage.removeItem('orderType');
        }

        buyNowLink.disabled = !hasItems;

        if (hasItems) {
            cartError.textContent = '';
        } else {
            cartError.textContent = 'Adicione pelo menos um item para avançar.';
        }
    }

    const shouldInitCart = Boolean(cartList && cartCount && cartTotal && buyNowLink && cartWidgetCount);
    if (shouldInitCart) {
        document.querySelectorAll('.buy-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const name = button.dataset.name;
                cartItems[name] = (cartItems[name] || 0) + 1;
                renderCart();
            });
        });

        const pickupBtn = document.getElementById('pickup-btn');
        const confirmPickupBtn = document.getElementById('confirm-pickup');

        buyNowLink.addEventListener('click', () => {
            if (Object.keys(cartItems).length === 0) {
                cartError.textContent = 'Adicione pelo menos um item para avançar.';
                return;
            }

            localStorage.setItem('cartData', JSON.stringify(cartItems));
            localStorage.setItem('orderType', 'delivery');
            window.location.href = 'frete.html';
        });

        if (pickupBtn && pickupInfo) {
            pickupBtn.addEventListener('click', () => {
                if (Object.keys(cartItems).length === 0) {
                    cartError.textContent = 'Adicione pelo menos um item para retirada.';
                    pickupInfo.style.display = 'none';
                    return;
                }

                pickupInfo.style.display = 'block';
                localStorage.setItem('orderType', 'pickup');
                renderStoredPickupInfo();
            });
        }

        if (confirmPickupBtn) {
            const pickupConfirmation = document.getElementById('pickup-confirmation');
            const pickupPhoneInput = document.getElementById('pickup-phone');

            confirmPickupBtn.addEventListener('click', () => {
                if (Object.keys(cartItems).length === 0) {
                    cartError.textContent = 'Adicione pelo menos um item antes de confirmar retirada.';
                    return;
                }

                const telefoneCliente = (pickupPhoneInput ? pickupPhoneInput.value.trim() : '').replace(/\D/g, '');
                if (!telefoneCliente || telefoneCliente.length < 10) {
                    cartError.textContent = 'Por favor, insira um número de WhatsApp válido com DDD.';
                    return;
                }

                const codigoRetirada = 'LD-' + Math.floor(1000 + Math.random() * 9000);
                localStorage.setItem('cartData', JSON.stringify(cartItems));
                localStorage.setItem('orderType', 'pickup');
                localStorage.setItem('pickupCode', codigoRetirada);
                localStorage.setItem('pickupPhone', telefoneCliente);
                localStorage.setItem('pickupGeneratedAt', new Date().toISOString());
                localStorage.setItem('freteValue', '0');
                localStorage.removeItem('enderecoEntrega');

                let subtotal = 0;
                let listaItens = '';
                Object.entries(cartItems).forEach(([nome, quantidade]) => {
                    const valor = quantidade * 15;
                    subtotal += valor;
                    listaItens += `- ${nome}: ${quantidade}x\n`;
                });

                const mensagemLoja = encodeURIComponent(
                    `Novo pedido para Retirada (Código: ${codigoRetirada})\n\n` +
                    `Itens:\n${listaItens}\n` +
                    `Total: R$ ${subtotal.toFixed(2).replace('.', ',')}\n\n` +
                    `Cliente: ${telefoneCliente}`
                );

                if (pickupConfirmation) {
                    pickupConfirmation.innerHTML = `Retirada confirmada! Código: <strong>${codigoRetirada}</strong>. Enviando para a loja...`;
                }

                setTimeout(() => {
                    window.location.href = 'compra.html';
                }, 1200);
            });
        }
    }

    const freteForm = document.getElementById('frete-form');
    if (freteForm) {
        const cepInput = document.getElementById('cep');
        const resumoPedido = document.getElementById('resumo-pedido');
        const confirmarBtn = document.getElementById('confirmar-btn');
        const resultBox = document.getElementById('frete-result');
        const requiredInputs = Array.from(freteForm.querySelectorAll('input[required]'));

        function carregarResumo() {
            const cartData = localStorage.getItem('cartData');
            const carrinhoItems = cartData ? JSON.parse(cartData) : {};
            const carrinhoResumo = document.getElementById('carrinho-resumo');
            const subtotalValue = document.getElementById('subtotal-value');

            if (!carrinhoResumo || !subtotalValue) {
                return 0;
            }

            let subtotal = 0;
            carrinhoResumo.innerHTML = '';

            Object.entries(carrinhoItems).forEach(([nome, quantidade]) => {
                const valor = quantidade * 15;
                subtotal += valor;
                const li = document.createElement('li');
                li.innerHTML = `<span>${nome}</span> <span>${quantidade}x R$ 15,00 = R$ ${valor.toFixed(2).replace('.', ',')}</span>`;
                carrinhoResumo.appendChild(li);
            });

            subtotalValue.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
            return subtotal;
        }

        if (resumoPedido && confirmarBtn) {
            carregarResumo();
        }

        function montarMensagemWhatsApp() {
            const cartData = localStorage.getItem('cartData');
            const endereco = JSON.parse(localStorage.getItem('enderecoEntrega') || '{}');
            const carrinhoItems = cartData ? JSON.parse(cartData) : {};
            let subtotal = 0;
            let listaItens = '';

            Object.entries(carrinhoItems).forEach(([nome, quantidade]) => {
                const valor = quantidade * 15;
                subtotal += valor;
                listaItens += `- ${nome}: ${quantidade}x\n`;
            });

            const frete = parseFloat(localStorage.getItem('freteValue') || '0');
            const total = subtotal + frete;

            return `Novo pedido Los Docitos\n\nItens:\n${listaItens || '- Nenhum item selecionado'}\nSubtotal: R$ ${subtotal.toFixed(2).replace('.', ',')}\nFrete: R$ ${frete.toFixed(2).replace('.', ',')}\nTotal: R$ ${total.toFixed(2).replace('.', ',')}\n\nEndereço:\nCEP: ${endereco.cep || '-'}\nRua: ${endereco.rua || '-'}\nNúmero: ${endereco.numero || '-'}\nBairro: ${endereco.bairro || '-'}\nComplemento: ${endereco.complemento || '-'}\nReferência: ${endereco.referencia || '-'}`;
        }

        function atualizarEstadoConfirmarBtn() {
            if (!confirmarBtn) return false;
            const todosPreenchidos = requiredInputs.every((input) => input.value.trim() !== '');
            confirmarBtn.disabled = !todosPreenchidos;
            confirmarBtn.setAttribute('aria-disabled', String(!todosPreenchidos));
            return todosPreenchidos;
        }

        requiredInputs.forEach((input) => {
            input.addEventListener('input', atualizarEstadoConfirmarBtn);
            input.addEventListener('change', atualizarEstadoConfirmarBtn);
        });

        atualizarEstadoConfirmarBtn();

        if (confirmarBtn) {
            confirmarBtn.addEventListener('click', (event) => {
                if (!atualizarEstadoConfirmarBtn()) {
                    event.preventDefault();
                    if (resultBox) {
                        resultBox.innerHTML = '<p class="error-message">Preencha todos os campos obrigatórios antes de confirmar.</p>';
                    }
                    return;
                }

                event.preventDefault();
                window.location.href = 'compra.html';
            });
        }

        if (cepInput) {
            cepInput.addEventListener('blur', async () => {
                const cep = cepInput.value.trim().replace(/\D/g, '');
                if (cep.length !== 8) return;

                try {
                    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                    const data = await response.json();
                    if (data.erro) {
                        alert('CEP não encontrado');
                        return;
                    }

                    document.getElementById('rua').value = data.logradouro;
                    document.getElementById('bairro').value = data.bairro;
                } catch (error) {
                    console.log('Erro ao buscar CEP:', error);
                }
            });
        }

        freteForm.addEventListener('submit', (event) => {
            event.preventDefault();

            const cepValue = document.getElementById('cep').value.trim();
            const bairroInput = document.getElementById('bairro').value.trim();
            const ruaInput = document.getElementById('rua').value.trim();
            const numeroInput = document.getElementById('numero').value.trim();
            const complementoInput = document.getElementById('complemento').value.trim();
            const referenciaInput = document.getElementById('referencia').value.trim();

            if (!cepValue || !bairroInput || !ruaInput || !numeroInput) {
                if (resultBox) {
                    resultBox.innerHTML = '<p class="error-message">Preencha CEP, bairro, rua e número.</p>';
                }
                atualizarEstadoConfirmarBtn();
                return;
            }

            const endereco = {
                cep: cepValue,
                bairro: bairroInput,
                rua: ruaInput,
                numero: numeroInput,
                complemento: complementoInput,
                referencia: referenciaInput,
            };

            localStorage.setItem('enderecoEntrega', JSON.stringify(endereco));

            const cepDestinoTexto = cepValue.replace(/\D/g, '');
            const cepOrigemTexto = '58068404';

            function calcularDistanciaPorCep(destino, origem) {
                if (destino === origem) return 0;
                const prefixo7Destino = destino.substring(0, 7);
                const prefixo7Origem = origem.substring(0, 7);
                const prefixo6Destino = destino.substring(0, 6);
                const prefixo6Origem = origem.substring(0, 6);
                const prefixo5Destino = destino.substring(0, 5);
                const prefixo5Origem = origem.substring(0, 5);
                const prefixo4Destino = destino.substring(0, 4);
                const prefixo4Origem = origem.substring(0, 4);
                const prefixo3Destino = destino.substring(0, 3);
                const prefixo3Origem = origem.substring(0, 3);

                if (prefixo7Destino === prefixo7Origem) {
                    const sufixoOrigem = parseInt(origem.substring(7), 10);
                    const sufixoDestino = parseInt(destino.substring(7), 10);
                    const diferenca = Math.abs(sufixoDestino - sufixoOrigem);
                    return Math.min(1, 0.5 + diferenca / 20);
                }

                if (prefixo6Destino === prefixo6Origem) {
                    const sufixoOrigem = parseInt(origem.substring(6), 10);
                    const sufixoDestino = parseInt(destino.substring(6), 10);
                    const diferenca = Math.abs(sufixoDestino - sufixoOrigem);
                    return Math.min(2, 0.2 + diferenca / 10);
                }

                if (prefixo5Destino === prefixo5Origem) return 2;
                if (prefixo4Destino === prefixo4Origem) return 4;
                if (prefixo3Destino === prefixo3Origem) return 6;
                if (destino.substring(0, 2) === origem.substring(0, 2)) return 10;
                return 15;
            }

            const distanciaEstimada = calcularDistanciaPorCep(cepDestinoTexto, cepOrigemTexto);
            const frete = Math.round(distanciaEstimada * 2 * 100) / 100;

            resultBox.innerHTML = `
                <p><strong>Distância estimada:</strong> ${distanciaEstimada.toFixed(1)} km</p>
                <p><strong>Frete:</strong> R$ ${frete.toFixed(2).replace('.', ',')}</p>
                <p style="margin-top: 12px; color: #666; font-size: 0.85rem;">*Cálculo estimado</p>
            `;

            localStorage.setItem('freteValue', frete.toFixed(2));
            resumoPedido.style.display = 'block';
            document.getElementById('frete-value').textContent = `R$ ${frete.toFixed(2).replace('.', ',')}`;
            atualizarEstadoConfirmarBtn();
            atualizarTotalFinal();
        });

        function atualizarTotalFinal() {
            const subtotalText = document.getElementById('subtotal-value').textContent;
            const freteText = document.getElementById('frete-value').textContent;

            if (freteText === 'A calcular') {
                document.getElementById('total-final').textContent = 'A calcular';
                confirmarBtn.disabled = true;
            } else {
                const subtotal = parseFloat(subtotalText.replace('R$ ', '').replace(',', '.'));
                const frete = parseFloat(freteText.replace('R$ ', '').replace(',', '.'));
                const total = subtotal + frete;
                document.getElementById('total-final').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
                confirmarBtn.disabled = false;
            }
        }
    }

    if (document.getElementById('carrinho-final')) {
        const cartData = localStorage.getItem('cartData');
        const carrinhoFinal = document.getElementById('carrinho-final');
        const freteValue = localStorage.getItem('freteValue') || '0';
        const orderType = localStorage.getItem('orderType');
        const pickupCodeBox = document.getElementById('pickup-code-box');
        const pickupCodeElement = document.getElementById('pickup-code');
        const pickupCode = localStorage.getItem('pickupCode');
        let subtotal = 0;

        if (cartData && carrinhoFinal) {
            const items = JSON.parse(cartData);
            Object.entries(items).forEach(([nome, quantidade]) => {
                const valor = quantidade * 15;
                subtotal += valor;
                const li = document.createElement('li');
                li.innerHTML = `<span>${nome}</span> <span>${quantidade}x R$ 15,00 = R$ ${valor.toFixed(2).replace('.', ',')}</span>`;
                carrinhoFinal.appendChild(li);
            });
        }

        const frete = orderType === 'pickup' ? 0 : parseFloat(freteValue);
        const total = subtotal + frete;

        const subtotalFinal = document.getElementById('subtotal-final');
        const freteFinal = document.getElementById('frete-final');
        const totalFinal = document.getElementById('total-final-compra');

        if (subtotalFinal) subtotalFinal.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
        if (freteFinal) {
            freteFinal.textContent = orderType === 'pickup'
                ? 'Sem frete (Retirada)'
                : frete === 0
                    ? 'A calcular'
                    : `R$ ${frete.toFixed(2).replace('.', ',')}`;
        }
        if (totalFinal) totalFinal.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;

        if (orderType === 'pickup' && pickupCode && pickupCodeBox && pickupCodeElement) {
            pickupCodeBox.style.display = 'block';
            pickupCodeElement.textContent = pickupCode;
        }
    }

    const tabPix = document.getElementById('tab-pix');
    const tabCard = document.getElementById('tab-card');
    const paymentBoxTitle = document.getElementById('payment-box-title');
    const cpfFieldContainer = document.getElementById('cpf-field-container');
    const cardFieldContainer = document.getElementById('card-field-container');
    const buyerCpfInput = document.getElementById('buyer-cpf');
    const btnSubmitPayment = document.getElementById('btn-submit-payment');
    const checkoutForm = document.getElementById('checkout-form');
    const cardNameInput = document.getElementById('card-name');
    const cardInstallmentsSelect = document.getElementById('card-installments');
    const pixQRArea = document.getElementById('pix-qr-area');
    const cardCheckoutArea = document.getElementById('card-checkout-area');
    const qrCodeImg = document.getElementById('qr-code-img');
    const copiaColaText = document.getElementById('copia-cola-text');
    const btnCopiar = document.getElementById('btn-copiar-code');
    const copyFeedback = document.getElementById('copy-feedback');
    const statusContainer = document.getElementById('status-container');
    const simulationAlert = document.getElementById('simulation-alert');
    const cardPayButton = document.getElementById('card-pay-button');
    const whatsappArea = document.getElementById('whatsapp-completion-area');
    const btnEnviarWA = document.getElementById('btn-enviar-wa');
    const paymentSuccessMessage = document.getElementById('payment-success-message');

    if (tabPix && tabCard && checkoutForm) {
        let selectedMethod = 'pix';

        // O formulário inicia na aba Pix; campos ocultos não devem bloquear o envio.
        buyerCpfInput.required = true;
        cardNameInput.required = false;
        cardNameInput.disabled = true;

        tabPix.addEventListener('click', () => {
            selectedMethod = 'pix';
            tabPix.classList.add('active');
            tabCard.classList.remove('active');
            paymentBoxTitle.innerHTML = '📱 Pagamento com Pix';
            cpfFieldContainer.style.display = 'block';
            if (cardFieldContainer) cardFieldContainer.style.display = 'none';
            buyerCpfInput.required = true;
            cardNameInput.required = false;
            cardNameInput.disabled = true;
            btnSubmitPayment.textContent = 'Gerar Pix';
        });

        tabCard.addEventListener('click', () => {
            selectedMethod = 'card';
            tabCard.classList.add('active');
            tabPix.classList.remove('active');
            paymentBoxTitle.innerHTML = '💳 Pagar com Cartão de Crédito';
            cpfFieldContainer.style.display = 'none';
            if (cardFieldContainer) cardFieldContainer.style.display = 'block';
            buyerCpfInput.required = false;
            cardNameInput.required = true;
            cardNameInput.disabled = false;
            btnSubmitPayment.textContent = 'Pagar com Cartão';

            // Inicializar Mercado Pago Fields
            if (!window.mpFieldsInitialized && !window.mpFieldsInitializing) {
                window.mpFieldsInitializing = true;
                (async () => {
                    try {
                        const pkResponse = await fetch('/api/mercadopago-publickey', { credentials: 'include' });

                        if (!pkResponse.ok) {   
                            const text = await pkResponse.text();
                            console.error('Erro HTTP ao obter public key:', pkResponse.status, text);
                            throw new Error(`HTTP ${pkResponse.status}`);
                        }

                            const contentType = pkResponse.headers.get('content-type') || '';
                        if (!contentType.includes('application/json')) {
                            const text = await pkResponse.text();
                            console.error('Resposta inesperada (não JSON):', contentType, text);
                            throw new Error('Resposta inesperada do servidor: não é JSON');
}

                        const pkData = await pkResponse.json();
                        const mpPublicKey = pkData.publicKey;


                        if (!mpPublicKey) {
                            throw new Error('Public Key não disponível');
                        }

                        window.mpInstance = new MercadoPago(mpPublicKey);
                        
                        // Criar os primary fields
                        const cardNumber = window.mpInstance.fields.create('cardNumber', {
                            placeholder: '1234 5678 9012 3456'
                        });
                        cardNumber.mount('cardNumber');

                        const cardExpiryDate = window.mpInstance.fields.create('expirationDate', {
                            placeholder: 'MM/AA'
                        });
                        cardExpiryDate.mount('cardExpiryDate');

                        const cardCvv = window.mpInstance.fields.create('securityCode', {
                            placeholder: 'CVV'
                        });
                        cardCvv.mount('cardCvv');

                        // Aguardar um pouco para garantir que os fields estão prontos
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        window.mpFieldsInitialized = true;
                        window.mpFieldsReady = true;
                        window.mpFieldsInitializing = false;
                    } catch (error) {
                        console.error('Erro ao inicializar Mercado Pago Fields:', error);
                        alert('Erro ao carregar formulário de cartão: ' + error.message);
                        window.mpFieldsInitializing = false;
                    }
                })();
            }
        });

        const urlParams = new URLSearchParams(window.location.search);
        const returnedStatus = urlParams.get('status');
        const returnedPaymentType = urlParams.get('payment_type');

        if (returnedStatus === 'approved') {
            document.getElementById('checkout-main-title').textContent = 'Pedido Confirmado!';
            document.getElementById('checkout-main-subtitle').textContent = 'Agradecemos a sua preferência na Los Docitos.';
            document.getElementById('payment-method-selector').style.display = 'none';
            document.getElementById('payment-container-box').style.display = 'none';
            whatsappArea.style.display = 'block';
            paymentSuccessMessage.textContent = returnedPaymentType === 'credit_card'
                ? '🎉 Pagamento por Cartão de Crédito Confirmado!'
                : '🎉 Pagamento via Pix Confirmado!';
        }

        let pollingInterval = null;

        function iniciarVerificacaoPagamento(paymentId) {
            const statusBadge = statusContainer.querySelector('.status-badge');
            const checkStatus = async () => {
                try {
                    const response = await fetch(`/api/status-pagamento/${paymentId}`);
                    const data = await response.json();
                    if (response.ok && data.status === 'approved') {
                        statusBadge.classList.remove('status-pending');
                        statusBadge.classList.add('status-approved');
                        statusBadge.innerHTML = '<span class="loading-spinner"></span>Pagamento confirmado!';
                        setTimeout(() => {
                            pixQRArea.style.display = 'none';
                            whatsappArea.style.display = 'block';
                            paymentSuccessMessage.textContent = '🎉 Pagamento via Pix Confirmado!';
                        }, 1200);
                        clearInterval(pollingInterval);
                        return;
                    }
                } catch (error) {
                    console.error('Erro ao consultar status do pagamento:', error);
                }
            };

            checkStatus();
            pollingInterval = setInterval(checkStatus, 5000);
        }

        async function obterDadosDoCartao(cardToken) {
            const bin = cardToken.first_six_digits;
            if (!bin) {
                throw new Error('Não foi possível identificar a bandeira do cartão.');
            }

            const paymentMethodsResponse = await window.mpInstance.getPaymentMethods({ bin });
            const paymentMethods = paymentMethodsResponse.results || paymentMethodsResponse;
            const paymentMethod = paymentMethods[0];

            if (!paymentMethod?.id) {
                throw new Error('Não foi possível identificar a forma de pagamento do cartão.');
            }

            let issuerId;
            if (typeof window.mpInstance.getIssuers === 'function') {
                const issuersResponse = await window.mpInstance.getIssuers({
                    paymentMethodId: paymentMethod.id,
                    bin
                });
                const issuers = issuersResponse.results || issuersResponse;
                issuerId = issuers[0]?.id;
            }

            return { paymentMethodId: paymentMethod.id, issuerId };
        }

        checkoutForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            btnSubmitPayment.disabled = true;
            btnSubmitPayment.textContent = 'Processando...';

            const name = document.getElementById('buyer-name').value;
            const email = document.getElementById('buyer-email').value;
            const freteValue = parseFloat(localStorage.getItem('freteValue') || '0');
            const cartData = localStorage.getItem('cartData');
            let subtotal = 0;

            if (cartData) {
                const items = JSON.parse(cartData);
                Object.entries(items).forEach(([_, quantidade]) => {
                    subtotal += quantidade * 15;
                });
            }

            const total = subtotal + freteValue;

            if (selectedMethod === 'pix') {
                const cpf = buyerCpfInput.value;
                try {
                    const response = await fetch('/api/criar-pagamento-pix', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount: total, email, name, cpf })
                    });
                    const data = await response.json();

                    if (response.ok) {
                        checkoutForm.style.display = 'none';
                        pixQRArea.style.display = 'flex';
                        qrCodeImg.src = data.qr_code_base64
                            ? `data:image/png;base64,${data.qr_code_base64}`
                            : `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data.qr_code)}`;
                        copiaColaText.value = data.qr_code;
                        if (data.is_mock) simulationAlert.style.display = 'block';
                        iniciarVerificacaoPagamento(data.id);
                    } else {
                        alert('Erro ao gerar Pix: ' + (data.details || data.error));
                        btnSubmitPayment.disabled = false;
                        btnSubmitPayment.textContent = 'Gerar Pix';
                    }
                } catch (error) {
                    alert('Erro de conexão ao gerar o Pix.');
                    btnSubmitPayment.disabled = false;
                    btnSubmitPayment.textContent = 'Gerar Pix';
                }
            } else {
                try {
                    const cardholderName = cardNameInput.value;
                    const installments = cardInstallmentsSelect.value;

                    if (!cardholderName) {
                        alert('Por favor, preencha o nome do cartão');
                        btnSubmitPayment.disabled = false;
                        btnSubmitPayment.textContent = 'Pagar com Cartão';
                        return;
                    }

                    if (!window.mpInstance) {
                        throw new Error('Mercado Pago não foi inicializado. Por favor, selecione a aba de cartão.');
                    }

                    cardCheckoutArea.style.display = 'flex';
                    checkoutForm.style.display = 'none';

                    // Aguardar que os fields estejam prontos
                    let waitAttempts = 0;
                    const waitForFields = setInterval(() => {
                        waitAttempts++;
                        if (window.mpFieldsReady || waitAttempts > 10) {
                            clearInterval(waitForFields);
                            
                            // Criar o token usando os fields
                            window.mpInstance.fields.createCardToken({
                                cardholderName: cardholderName
                            }).then(async (token) => {
                                const cardToken = token?.response || token;

                                if (cardToken?.id) {
                                    try {
                                        const { paymentMethodId, issuerId } = await obterDadosDoCartao(cardToken);
                                        const paymentResponse = await fetch('/api/processar-pagamento-cartao', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                amount: total,
                                                email: email,
                                                name: name,
                                                token: cardToken.id,
                                                installments: parseInt(installments),
                                                cardholderName: cardholderName,
                                                paymentMethodId,
                                                issuerId
                                            })
                                        });

                                        const paymentData = await paymentResponse.json();

                                        if (paymentResponse.ok && paymentData.status === 'approved') {
                                            checkoutForm.style.display = 'none';
                                            cardCheckoutArea.style.display = 'none';
                                            whatsappArea.style.display = 'block';
                                            paymentSuccessMessage.textContent = '🎉 Pagamento por Cartão de Crédito Confirmado!';
                                        } else if (paymentResponse.ok && paymentData.status === 'pending') {
                                            alert('Seu pagamento está pendente de análise. Você receberá uma confirmação em breve.');
                                            checkoutForm.style.display = 'block';
                                            cardCheckoutArea.style.display = 'none';
                                            btnSubmitPayment.disabled = false;
                                        } else {
                                            alert('Erro ao processar pagamento: ' + (paymentData.message || 'Tente novamente'));
                                            checkoutForm.style.display = 'block';
                                            cardCheckoutArea.style.display = 'none';
                                            btnSubmitPayment.disabled = false;
                                        }
                                    } catch (error) {
                                        alert('Erro ao processar pagamento no servidor: ' + error.message);
                                        checkoutForm.style.display = 'block';
                                        cardCheckoutArea.style.display = 'none';
                                        btnSubmitPayment.disabled = false;
                                    }
                                } else {
                                    throw new Error(cardToken?.message || 'Erro ao gerar token do cartão');
                                }
                            }).catch((error) => {
                                let errorMsg = 'Erro ao gerar token do cartão';
                                if (typeof error === 'object' && Array.isArray(error)) {
                                    const messages = error.map((e) => {
                                        if (typeof e === 'object' && e.message) return e.message;
                                        return String(e);
                                    }).filter(m => m).join(', ');
                                    if (messages) errorMsg += ': ' + messages;
                                } else if (error?.message) {
                                    errorMsg += ': ' + error.message;
                                } else if (typeof error === 'string') {
                                    errorMsg += ': ' + error;
                                }
                                alert(errorMsg + '\n\nCertifique-se de que preencheu todos os campos do cartão corretamente.');
                                checkoutForm.style.display = 'block';
                                cardCheckoutArea.style.display = 'none';
                                btnSubmitPayment.disabled = false;
                                btnSubmitPayment.textContent = 'Pagar com Cartão';
                            });
                        }
                    }, 100);
                } catch (error) {
                    alert('Erro: ' + error.message);
                    checkoutForm.style.display = 'block';
                    cardCheckoutArea.style.display = 'none';
                    btnSubmitPayment.disabled = false;
                    btnSubmitPayment.textContent = 'Pagar com Cartão';
                }
            }
        });

        if (btnCopiar) {
            btnCopiar.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(copiaColaText.value);
                    copyFeedback.style.display = 'inline';
                    setTimeout(() => copyFeedback.style.display = 'none', 1800);
                } catch (error) {
                    copiaColaText.select();
                    document.execCommand('copy');
                    copyFeedback.style.display = 'inline';
                    setTimeout(() => copyFeedback.style.display = 'none', 1800);
                }
            });
        }

        if (btnEnviarWA) {
            btnEnviarWA.addEventListener('click', () => {
                const dadosPedido = JSON.parse(localStorage.getItem('cartData') || '{}');
                const orderType = localStorage.getItem('orderType');
                const pickupCode = localStorage.getItem('pickupCode');
                const enderecoEntrega = JSON.parse(localStorage.getItem('enderecoEntrega') || '{}');
                const itens = Object.entries(dadosPedido)
                    .map(([nome, qtd]) => `${nome} (${qtd}x)`)
                    .join(', ');
                const enderecoFormatado = [
                    enderecoEntrega.rua && `${enderecoEntrega.rua}, ${enderecoEntrega.numero || 's/n'}`,
                    enderecoEntrega.complemento,
                    enderecoEntrega.bairro,
                    enderecoEntrega.cep && `CEP ${enderecoEntrega.cep}`
                ].filter(Boolean).join(' - ');
                const detalhesRetirada = orderType === 'pickup' && pickupCode
                    ? `\n\nTipo do pedido: Retirada\nCódigo de retirada: ${pickupCode}`
                    : enderecoFormatado
                        ? `\n\nTipo do pedido: Entrega\nLocalização do cliente: ${enderecoFormatado}\nMapa: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoFormatado)}`
                        : '\n\nTipo do pedido: Entrega';
                const mensagem = encodeURIComponent(
                    `Olá, meu este é o meu pedido!\n\nItens: ${itens}\nValor total: ${document.getElementById('total-final-compra').textContent}${detalhesRetirada}!`
                );
                window.open(`https://wa.me/${whatsappNumber}?text=${mensagem}`, '_blank');
            });
        }
    }
});
