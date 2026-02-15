let storeData = null;
let cart = [];
let currentDeliveryFee = 0;
let detectedBairro = "";

// Load data from data.json
async function loadData() {
    try {
        const response = await fetch('data.json');
        storeData = await response.json();
        renderCategories();
        renderProducts();
        updateHeader();
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        document.getElementById('storeName').textContent = "Erro ao carregar";
    }
}

const DIAS_SEMANA = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function updateHeader() {
    // API returns 'loja' for store name. Checking both for compatibility.
    const storeName = storeData.loja || storeData.store?.name || "Catálogo Digital";
    const storeDesc = storeData.store?.description || "Selecione seus itens abaixo";

    document.getElementById('storeName').innerHTML = `<i class="fas fa-utensils"></i> ${storeName}`;
    document.getElementById('storeDesc').textContent = storeDesc;

    if (storeData.horarios) {
        renderHorarios();
    }
}

/** Verifica se a loja está aberta agora com base em horarios. */
function isStoreOpenNow() {
    const horarios = storeData.horarios;
    if (!horarios) return null;

    const now = new Date();
    const dia = DIAS_SEMANA[now.getDay()];
    const dayData = horarios[dia];
    if (!dayData) return false;

    if (dayData.fechado_dia === true) return false;

    const timeStr = now.toTimeString().slice(0, 5); // "HH:MM"

    function between(h, a, b) {
        if (!a || !b) return false;
        return (h >= a && h <= b);
    }

    const inFirst = between(timeStr, dayData.aberto, dayData.fechado);
    if (inFirst) return true;
    if (dayData.aberto_2 && dayData.fechado_2) {
        return between(timeStr, dayData.aberto_2, dayData.fechado_2);
    }
    return false;
}

/** Formata o texto de horário de um dia (ex: "08:00–12:00 / 13:22–18:22" ou "Fechado"). */
function formatDayHours(dayData) {
    if (dayData.fechado_dia) return "Fechado";
    let s = (dayData.aberto && dayData.fechado) ? `${dayData.aberto} – ${dayData.fechado}` : "";
    if (dayData.aberto_2 && dayData.fechado_2) {
        s = s ? `${s} / ${dayData.aberto_2} – ${dayData.fechado_2}` : `${dayData.aberto_2} – ${dayData.fechado_2}`;
    }
    return s || "—";
}

function renderHorarios() {
    const container = document.getElementById('storeStatus');
    if (!container) return;

    const open = isStoreOpenNow();
    const horarios = storeData.horarios;
    let html = '<div class="horarios-status">';
    html += open === true
        ? '<span class="status-badge open"><i class="fas fa-clock"></i> Aberto agora</span>'
        : open === false
            ? '<span class="status-badge closed"><i class="fas fa-clock"></i> Fechado</span>'
            : '';

    html += '<details class="horarios-details"><summary>Horários de funcionamento</summary><div class="horarios-table">';
    DIAS_SEMANA.forEach(dia => {
        const d = horarios[dia];
        const text = d ? formatDayHours(d) : "—";
        const today = dia === DIAS_SEMANA[new Date().getDay()];
        html += `<div class="horarios-row ${today ? 'today' : ''}"><span class="dia">${dia}</span><span class="hr">${text}</span></div>`;
    });
    html += '</div></details></div>';
    container.innerHTML = html;
}

function verifyCEP() {
    const cepInput = id('cepInput');
    const status = id('cepStatus');
    let cep = cepInput.value.replace(/\D/g, ""); // Keep only digits

    // Format display
    if (cep.length > 5) {
        cepInput.value = cep.substring(0, 5) + "-" + cep.substring(5, 8);
    }

    if (cep.length === 8) {
        const zones = storeData.zonas_entrega || [];
        const match = zones.find(zone => {
            const start = zone.cep_inicio.replace(/\D/g, "");
            const end = zone.cep_fim.replace(/\D/g, "");
            return parseInt(cep) >= parseInt(start) && parseInt(cep) <= parseInt(end);
        });

        if (match) {
            currentDeliveryFee = parseFloat(match.valor_entrega);
            detectedBairro = match.bairro;
            status.textContent = `✅ ${match.bairro} - Frete R$ ${currentDeliveryFee.toFixed(2)}`;
            status.style.color = "#34d399";
        } else {
            currentDeliveryFee = 0;
            detectedBairro = "";
            status.textContent = "❌ CEP não atendido para entrega.";
            status.style.color = "#f87171";
        }
    } else {
        currentDeliveryFee = 0;
        detectedBairro = "";
        status.textContent = "Aguardando CEP completo...";
        status.style.color = "var(--text-muted)";
    }
    updateCartUI();
}

function renderCategories() {
    const container = document.getElementById('categoryFilter');
    // Extract unique categories from products if not explicitly provided
    let categories = [];
    if (storeData.produtos) {
        categories = [...new Set(storeData.produtos.map(p => p.categoria).filter(Boolean))];
    }

    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'cat-btn';
        btn.textContent = cat;
        btn.dataset.id = cat;
        btn.onclick = () => filterByCategory(cat);
        container.appendChild(btn);
    });
}

function filterByCategory(category) {
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.id === category);
    });
    renderProducts(category === 'all' ? null : category);
}

function renderProducts(filter = null, search = "") {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = "";

    const products = storeData.produtos || [];
    const filtered = products.filter(p => {
        const matchesFilter = !filter || p.categoria === filter;
        const matchesSearch = !search || p.titulo.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <img src="${p.imagem}" class="card-img" alt="${p.titulo}" onerror="this.src='https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=500'">
            <div class="card-content">
                <h3 class="card-title">${p.titulo}</h3>
                <p class="card-desc">${p.descricao}</p>
                <div class="card-footer">
                    <span class="price">R$ ${parseFloat(p.preco).toFixed(2)}</span>
                    <button class="btn-add" onclick="addToCart(${p.id})">
                        <i class="fas fa-plus"></i> Add
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Cart Logic
function addToCart(productId) {
    const product = storeData.produtos.find(p => p.id === productId);
    const existing = cart.find(item => item.id === productId);

    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    updateCartUI();
    // Micro-animation for FAB
    const fab = document.querySelector('.cart-fab');
    fab.style.transform = "scale(1.2)";
    setTimeout(() => fab.style.transform = "scale(1)", 200);
}

function updateCartUI() {
    const itemsContainer = document.getElementById('cartItems');
    const countLabel = id('cartCount');
    const subtotalLabel = id('cartSubtotal');
    const deliveryLabel = id('deliveryFee');
    const totalLabel = id('cartTotal');

    itemsContainer.innerHTML = "";
    let subtotal = 0;
    let count = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.preco * item.quantity;
        subtotal += itemTotal;
        count += item.quantity;

        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <img src="${item.imagem}" alt="${item.titulo}">
            <div class="cart-item-info">
                <h4>${item.titulo}</h4>
                <span>R$ ${parseFloat(item.preco).toFixed(2)}</span>
                <div class="cart-item-controls">
                    <button class="qty-btn" onclick="changeQty(${index}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="qty-btn" onclick="changeQty(${index}, 1)">+</button>
                </div>
            </div>
            <button class="close-btn" style="font-size: 1.2rem;" onclick="removeFromCart(${index})">&times;</button>
        `;
        itemsContainer.appendChild(div);
    });

    const total = subtotal + currentDeliveryFee;

    countLabel.textContent = count;
    subtotalLabel.textContent = `R$ ${subtotal.toFixed(2)}`;
    deliveryLabel.textContent = `R$ ${currentDeliveryFee.toFixed(2)}`;
    totalLabel.textContent = `R$ ${total.toFixed(2)}`;

    // Auto-save address for convenience
    localStorage.setItem('lastCart', JSON.stringify(cart));
}

function changeQty(index, delta) {
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }
    updateCartUI();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
}

function toggleCart() {
    id('cartSidebar').classList.toggle('active');
    id('cartOverlay').classList.toggle('active');
}

function sendOrder() {
    if (cart.length === 0) return alert("Seu carrinho está vazio!");

    if (storeData.horarios && isStoreOpenNow() === false) {
        if (!confirm("A loja está fechada no momento. Deseja mesmo enviar o pedido? O atendimento pode ser feito quando abrir.")) return;
    }

    const name = id('custName').value;
    const address = id('custAddress').value;
    const cep = id('cepInput').value;
    const payment = id('paymentMethod').value;

    if (!name || !address || !cep) return alert("Preencha seu nome, endereço e CEP!");
    if (currentDeliveryFee === 0 && detectedBairro === "") return alert("Infelizmente não entregamos neste CEP.");

    let message = `*Novo Pedido!* 🍔\n\n`;
    message += `👤 *Cliente:* ${name}\n`;
    message += `📍 *Endereço:* ${address}\n`;
    message += `📮 *CEP:* ${cep} (${detectedBairro})\n`;
    message += `💳 *Pagamento:* ${payment}\n\n`;
    message += `🛒 *Itens:*\n`;

    let subtotal = 0;
    cart.forEach(item => {
        const itemTotal = item.preco * item.quantity;
        message += `- ${item.quantity}x ${item.titulo} (R$ ${itemTotal.toFixed(2)})\n`;
        subtotal += itemTotal;
    });

    const total = subtotal + currentDeliveryFee;
    message += `\n*Subtotal:* R$ ${subtotal.toFixed(2)}`;
    message += `\n*Frete:* R$ ${currentDeliveryFee.toFixed(2)}`;
    message += `\n*Total: R$ ${total.toFixed(2)}*`;

    const phone = storeData.whatsapp || "5511999999999";
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
}

// Helpers
function id(name) { return document.getElementById(name); }

// Search Listeners
id('searchInput').addEventListener('input', (e) => {
    renderProducts(null, e.target.value);
});

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    // Load saved cart if any
    const saved = localStorage.getItem('lastCart');
    if (saved) {
        cart = JSON.parse(saved);
        updateCartUI();
    }
});
