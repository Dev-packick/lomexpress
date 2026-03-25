/* ═══════════════════════════════════════════════════════
    lomeXpress — scripts.js (Version Complète Corrigée)
═══════════════════════════════════════════════════════ */

const WA_NUMBER = '22871793479';
const API = 'api.php';
let allProducts = [];
let cart = JSON.parse(localStorage.getItem('lomexpress_cart')) || [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    // Année dynamique au footer
    const yearEl = document.getElementById('footer-year');
    if(yearEl) yearEl.textContent = new Date().getFullYear();

    loadProducts();
    renderCart(); 
    setupScrollEffects();

    // Effet ombre au scroll sur le header
    const hdr = document.getElementById('main-header');
    window.addEventListener('scroll', () => {
        if(hdr) hdr.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
});

// --- API & CHARGEMENT ---
async function loadProducts() {
    try {
        const res = await fetch(`${API}?action=list`);
        const data = await res.json();
        if (data.ok) {
            allProducts = data.products;
            renderProducts();
            updateHeroStats();
        }
    } catch(e) {
        const loader = document.getElementById('products-loading');
        if(loader) loader.textContent = 'Erreur de connexion au serveur.';
    }
}

// --- RENDU DU CATALOGUE ---
function renderProducts() {
    const grid = document.getElementById('products-grid');
    if(!grid) return;
    grid.innerHTML = '';

    const filtered = currentFilter === 'all' 
        ? allProducts 
        : allProducts.filter(p => p.category === currentFilter);
    
    if (filtered.length === 0) {
        grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--muted)">Aucun produit disponible dans cette catégorie.</p>';
        return;
    }

    // Affichage du plus récent au plus ancien
    filtered.slice().reverse().forEach(p => {
        grid.appendChild(buildCard(p));
    });
}

function buildCard(p) {
    const isOut = +p.qty <= 0;
    const art = document.createElement('article');
    art.className = 'product-card';
    
    const slides = p.media.map((m, i) => `
        <div class="media-slide ${i===0?'active':''}">
            ${m.type === 'video' 
                ? `<video src="${m.src}" muted playsinline preload="metadata"></video>` 
                : `<img src="${m.src}" loading="lazy" alt="${p.name}">`}
        </div>`).join('');

    art.innerHTML = `
        <div class="product-media">
            ${slides}
            ${p.media.length > 1 ? '<button class="media-nav prev">‹</button><button class="media-nav next">›</button>' : ''}
            <span class="badge ${p.stock==='special'?'badge-special':'badge-local'}">
                ${p.stock==='special'?'Commande spéciale':'En Stock'}
            </span>
        </div>
        <div class="product-body" onclick="openProductModal('${p.id}')">
            <div class="product-name">${p.name}</div>
            <div class="product-desc" style="font-size:0.85rem; color:var(--muted); margin-bottom:0.5rem;">
                ${p.desc.substring(0, 60)}${p.desc.length > 60 ? '...' : ''}
            </div>
            <div class="product-price">${fmtFCFA(p.price)}</div>
        </div>
        <div class="product-footer">
            <button class="btn-add" ${isOut?'disabled':''} onclick="addToCart('${p.id}')">
                ${isOut ? 'Épuisé' : '+ Panier'}
            </button>
            <button class="btn-view-sm" onclick="openProductModal('${p.id}')">Détails</button>
        </div>
    `;
    
    initGallery(art);
    return art;
}

// --- GESTION DU PANIER ---
function addToCart(pid) {
    const p = allProducts.find(item => item.id === pid);
    if(!p) return;
    
    const existing = cart.find(item => item.id === pid);
    if (existing) {
        existing.cartQty++;
    } else {
        cart.push({ ...p, cartQty: 1 });
    }
    
    saveCart();
    showToast(`${p.name} ajouté !`, '🛒');
}

function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
}

function saveCart() {
    localStorage.setItem('lomexpress_cart', JSON.stringify(cart));
    renderCart();
}

function renderCart() {
    const badge = document.getElementById('cart-badge');
    const container = document.getElementById('cart-items');
    const footer = document.getElementById('cart-footer');
    const totalEl = document.getElementById('cart-total');

    const count = cart.reduce((sum, item) => sum + item.cartQty, 0);
    if(badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'grid' : 'none';
    }

    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--muted)">Votre panier est vide.</p>';
        if(footer) footer.style.display = 'none';
        return;
    }

    let total = 0;
    container.innerHTML = cart.map((item, i) => {
        total += item.price * item.cartQty;
        return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)">
            <div style="flex:1">
                <div style="font-weight:bold; font-size:0.95rem;">${item.name}</div>
                <div style="font-size:0.85rem;color:var(--muted)">${item.cartQty} x ${fmtFCFA(item.price)}</div>
            </div>
            <div style="font-weight:bold; margin-right:15px;">${fmtFCFA(item.price * item.cartQty)}</div>
            <button onclick="removeFromCart(${i})" style="background:none; border:1px solid #ddd; border-radius:4px; cursor:pointer; padding:2px 6px;">✕</button>
        </div>`;
    }).join('');

    if(totalEl) totalEl.textContent = fmtFCFA(total);
    if(footer) footer.style.display = 'block';
}

function checkout() {
    if(cart.length === 0) return;
    const lines = cart.map(i => `${i.cartQty}x ${i.name} (${fmtFCFA(i.price * i.cartQty)})`).join('\n');
    const total = document.getElementById('cart-total').textContent;
    const msg = `Bonjour lomeXpress, je souhaite commander :\n\n${lines}\n\n*Total : ${total}*\n\nMerci de confirmer la disponibilité.`;
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
}

// --- MODAL PRODUIT ---
function openProductModal(pid) {
    const p = allProducts.find(item => item.id === pid);
    if(!p) return;

    document.getElementById('modal-name').textContent = p.name;
    document.getElementById('modal-price').textContent = fmtFCFA(p.price);
    document.getElementById('modal-desc').textContent = p.desc;
    
    const container = document.getElementById('modal-media-container');
    container.innerHTML = `
        <div class="media-scroller" style="display:flex; overflow-x:auto; scroll-snap-type:x mandatory; gap:10px; -webkit-overflow-scrolling:touch;">
            ${p.media.map(m => `
                <div style="flex:0 0 100%; scroll-snap-align:start;">
                    ${m.type==='video' 
                        ? `<video src="${m.src}" controls style="width:100%; border-radius:8px; background:#000;"></video>` 
                        : `<img src="${m.src}" style="width:100%; border-radius:8px; object-fit:contain; max-height:400px; background:#f9f9f9;">`}
                </div>
            `).join('')}
        </div>
        <p style="text-align:center; font-size:0.75rem; color:var(--muted); margin-top:5px;">← Balayez pour voir plus →</p>
    `;
    
    document.getElementById('modal-cart-btn').onclick = () => { 
        addToCart(pid); 
        closeModal('productModal'); 
    };
    openModal('productModal');
}

// --- COMMANDES SPÉCIALES ---
async function handleSpecialOrder(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    
    const msg = `*DEMANDE DE COMMANDE SPÉCIALE*\n\n` +
                `📦 *Produit:* ${fd.get('product_name')}\n` +
                `🔗 *Lien:* ${fd.get('product_link') || 'Non précisé'}\n` +
                `💰 *Budget:* ${fd.get('budget') || 'À discuter'} FCFA\n` +
                `📞 *WhatsApp:* ${fd.get('client_phone')}\n` +
                `💬 *Détails:* ${fd.get('details')}`;

    // On peut aussi sauvegarder ici si ton api.php gère 'save_order'
    fd.append('action', 'save_order');
    fetch(API, { method: 'POST', body: fd }).catch(() => {}); // Silencieux si échec

    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
    showToast('Demande envoyée !', '📦');
    form.reset();
}

function handleContact(e) {
    e.preventDefault();
    showToast('Message envoyé !', '✉️');
    e.target.reset();
}

// --- UTILITAIRES ---
function fmtFCFA(v) { 
    return new Intl.NumberFormat('fr-TG', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(v); 
}

function openModal(id) { 
    document.getElementById(id).classList.add('open');
    document.body.style.overflow = 'hidden'; 
}

function closeModal(id) { 
    document.getElementById(id).classList.remove('open');
    document.body.style.overflow = ''; 
}

function showToast(msg, icon = '✅') { 
    const t = document.getElementById('toast'); 
    const m = document.getElementById('toast-msg');
    const i = document.getElementById('toast-icon');
    if(m) m.textContent = msg;
    if(i) i.textContent = icon;
    t.classList.add('show'); 
    setTimeout(() => t.classList.remove('show'), 3000); 
}

function filterProducts(cat, btn) {
    currentFilter = cat;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    renderProducts();
}

function filterCat(cat) {
    const target = document.getElementById('catalog');
    if(target) target.scrollIntoView({ behavior: 'smooth' });
    const btn = document.querySelector(`.filter-btn[data-filter="${cat}"]`);
    filterProducts(cat, btn);
}

function updateHeroStats() {
    const skuVal = document.getElementById('hero-sku');
    const skuLbl = document.getElementById('hero-sku-lbl');
    if(!skuVal) return;

    const inStockCount = allProducts.filter(p => +p.qty > 0).length;
    const totalUnits = allProducts.reduce((sum, p) => sum + Math.max(0, +p.qty), 0);

    skuVal.textContent = inStockCount;
    if(skuLbl) skuLbl.textContent = `${totalUnits} articles en stock`;
}

function initGallery(card) {
    const slides = [...card.querySelectorAll('.media-slide')];
    if (slides.length <= 1) return;
    let idx = 0;
    const go = (n) => {
        idx = (n + slides.length) % slides.length;
        slides.forEach((s, i) => s.classList.toggle('active', i === idx));
    };
    const prev = card.querySelector('.prev');
    const next = card.querySelector('.next');
    if(prev) prev.onclick = (e) => { e.stopPropagation(); go(idx-1); };
    if(next) next.onclick = (e) => { e.stopPropagation(); go(idx+1); };
}

function setupScrollEffects() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// Fermeture des modals au clic extérieur
window.onclick = (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        closeModal(e.target.id);
    }
};