document.addEventListener('DOMContentLoaded', () => {
    const cartItems = {};
    const cartList = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const cartTotal = document.getElementById('cart-total');
    const cartError = document.getElementById('cart-error');
    const buyNowLink = document.getElementById('buy-now-link');

    const shouldInitCart = Boolean(cartList && cartCount && cartTotal && buyNowLink);
    if (shouldInitCart) {
        document.querySelectorAll('.buy-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const name = button.dataset.name;
                cartItems[name] = (cartItems[name] || 0) + 1;
                renderCart();
            });
        });

        buyNowLink.addEventListener('click', () => {
            if (Object.keys(cartItems).length === 0) {
                cartError.textContent = 'Adicione pelo menos um item para avançar.';
                return;
            }

            localStorage.setItem('cartData', JSON.stringify(cartItems));
            window.location.href = 'frete.html';
        });
    }

    const freteForm = document.getElementById('frete-form');
    if (freteForm) {
        const cepInput = document.getElementById('cep');
        const resumoPedido = document.getElementById('resumo-pedido');
        const confirmarBtn = document.getElementById('confirmar-btn');
        const resultBox = document.getElementById('frete-result');
        const requiredInputs = Array.from(freteForm.querySelectorAll('input[required]'));

        // Carrega os itens do carrinho e exibe no resumo
        function carregarResumo() {
            const cartData = localStorage.getItem('cartData');
            const carrinhoItems = cartData ? JSON.parse(cartData) : {};
            const carrinhoResumo = document.getElementById('carrinho-resumo');
            const subtotalValue = document.getElementById('subtotal-value');
            
            if (!carrinhoResumo || !subtotalValue) return 0;
            
            let subtotal = 0;

            carrinhoResumo.innerHTML = '';
            Object.entries(carrinhoItems).forEach(([nome, quantidade]) => {
                const valor = quantidade * 12;
                subtotal += valor;
                const li = document.createElement('li');
                li.innerHTML = `<span>${nome}</span> <span>${quantidade}x R$ 12,00 = R$ ${valor.toFixed(2).replace('.', ',')}</span>`;
                carrinhoResumo.appendChild(li);
            });

            subtotalValue.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
            return subtotal;
        }

        if (resumoPedido && confirmarBtn) {
            carregarResumo();
        }

        const whatsappNumber = '5581995687007';

        function montarMensagemWhatsApp() {
            const cartData = localStorage.getItem('cartData');
            const endereco = JSON.parse(localStorage.getItem('enderecoEntrega') || '{}');
            const carrinhoItems = cartData ? JSON.parse(cartData) : {};
            const telefoneCliente = (endereco.telefone || '').replace(/\D/g, '');

            let subtotal = 0;
            let listaItens = '';

            Object.entries(carrinhoItems).forEach(([nome, quantidade]) => {
                const valor = quantidade * 12;
                subtotal += valor;
                listaItens += `- ${nome}: ${quantidade}x\n`;
            });

            const frete = parseFloat(localStorage.getItem('freteValue') || '0');
            const total = subtotal + frete;

            return `Novo pedido Los Docitos\n\nItens:\n${listaItens || '- Nenhum item selecionado'}\nSubtotal: R$ ${subtotal.toFixed(2).replace('.', ',')}\nFrete: R$ ${frete.toFixed(2).replace('.', ',')}\nTotal: R$ ${total.toFixed(2).replace('.', ',')}\n\nEndereço:\nCEP: ${endereco.cep || '-'}\nRua: ${endereco.rua || '-'}\nNúmero: ${endereco.numero || '-'}\nBairro: ${endereco.bairro || '-'}\nComplemento: ${endereco.complemento || '-'}\nReferência: ${endereco.referencia || '-'}`;
        }

        function enviarMensagemWhatsApp() {
            const mensagemLoja = encodeURIComponent(montarMensagemWhatsApp());
            const endereco = JSON.parse(localStorage.getItem('enderecoEntrega') || '{}');
            const telefoneCliente = (endereco.telefone || '').replace(/\D/g, '');
            const mensagemCliente = encodeURIComponent('Olá! Seu pedido foi confirmado com sucesso pela Los Docitos. Em breve entraremos em contato para confirmar o prazo de entrega. Obrigado pela preferência!');
            const urlLoja = `https://wa.me/${whatsappNumber}?text=${mensagemLoja}`;
            const urlCliente = telefoneCliente ? `https://wa.me/${telefoneCliente}?text=${mensagemCliente}` : null;
            window.location.href = urlLoja;
            if (urlCliente) {
                window.open(urlCliente, '_blank', 'noopener,noreferrer');
            }
        }

        function atualizarEstadoConfirmarBtn() {
            if (!confirmarBtn) {
                return false;
            }

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
                enviarMensagemWhatsApp();
            });
        }

        if (cepInput) {
            cepInput.addEventListener('blur', async () => {
                const cep = cepInput.value.trim().replace(/\D/g, '');

                if (cep.length !== 8) {
                    return;
                }

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
            const referenciaInput = document.getElementById('referencia').value.trim()

            if (!cepValue || !bairroInput || !ruaInput || !numeroInput ) {
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
                if (destino === origem) {
                    return 0;
                }

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

                if (prefixo5Destino === prefixo5Origem) {
                    return 2;
                }

                if (prefixo4Destino === prefixo4Origem) {
                    return 4;
                }

                if (prefixo3Destino === prefixo3Origem) {
                    return 6;
                }

                if (destino.substring(0, 2) === origem.substring(0, 2)) {
                    return 10;
                }

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

    function renderCart() {
        const entries = Object.entries(cartItems);
        let totalItems = 0;
        let totalPrice = 0;

        cartList.innerHTML = '';

        entries.forEach(([name, quantity]) => {
            const itemPrice = 12 * quantity;
            totalItems += quantity;
            totalPrice += itemPrice;

            const item = document.createElement('li');
            item.innerHTML = `
                <span>${name}</span>
                <div class="quantity-controls">
                    <button class="qty-btn" data-name="${name}" data-action="remove">-</button>
                    <strong>${quantity}</strong>
                    <button class="qty-btn" data-name="${name}" data-action="add">+</button>
                </div>`;
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

        buyNowLink.disabled = !hasItems;

        if (hasItems) {
            cartError.textContent = '';
        } else {
            cartError.textContent = 'Adicione pelo menos um item para avançar.';
        }
    }
});

