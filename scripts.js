/* ═══════════════════════════════════════════════════════
    lomeXpress — scripts.js (Version MySQL Optimisée)
═══════════════════════════════════════════════════════ */

const WA_NUMBER = '22871793479';
const API = 'api.php';
let allProducts = [];
let cart = JSON.parse(localStorage.getItem('lomexpress_cart')) || [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    const yearEl = document.getElementById('footer-year');
    if(yearEl) yearEl.textContent = new Date().getFullYear();

    loadProducts();
    renderCart(); 
    setupScrollEffects();

    const hdr = document.getElementById('main-header');
    window.addEventListener('scroll', () => {
        if(hdr) hdr.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
});

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

    filtered.slice().reverse().forEach(p => {
        grid.appendChild(buildCard(p));
    });
}

function buildCard(p) {
    const isOut = Number(p.qty) <= 0;
    const art = document.createElement('article');
    art.className = 'product-card';
    
    const slides = (p.media || []).map((m, i) => `
        <div class="media-slide ${i===0?'active':''}">
            ${m.type === 'video' 
                ? `<video src="${m.src}" muted playsinline preload="metadata"></video>` 
                : `<img src="${m.src}" loading="lazy" alt="${p.name}">`}
        </div>`).join('');

    art.innerHTML = `
        <div class="product-media">
            ${slides}
            ${(p.media && p.media.length > 1) ? '<button class="media-nav prev">‹</button><button class="media-nav next">›</button>' : ''}
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

function addToCart(pid) {
    const p = allProducts.find(item => item.id == pid);
    if(!p) return;
    const existing = cart.find(item => item.id == pid);
    if (existing) { existing.cartQty++; } else { cart.push({ ...p, cartQty: 1 }); }
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
    if(badge) { badge.textContent = count; badge.style.display = count > 0 ? 'grid' : 'none'; }
    if (!container) return;
    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--muted)">Votre panier est vide.</p>';
        if(footer) footer.style.display = 'none';
        return;
    }
    let total = 0;
    container.innerHTML = cart.map((item, i) => {
        total += item.price * item.cartQty;
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)">
            <div style="flex:1"><div style="font-weight:bold;">${item.name}</div><div style="font-size:0.85rem;color:var(--muted)">${item.cartQty} x ${fmtFCFA(item.price)}</div></div>
            <div style="font-weight:bold; margin-right:15px;">${fmtFCFA(item.price * item.cartQty)}</div>
            <button onclick="removeFromCart(${i})" style="background:none; border:1px solid #ddd; border-radius:4px; padding:2px 6px;">✕</button>
        </div>`;
    }).join('');
    if(totalEl) totalEl.textContent = fmtFCFA(total);
    if(footer) footer.style.display = 'block';
}

function checkout() {
    if(cart.length === 0) return;
    const lines = cart.map(i => `${i.cartQty}x ${i.name} (${fmtFCFA(i.price * i.cartQty)})`).join('\n');
    const total = document.getElementById('cart-total').textContent;
    const msg = `Bonjour lomeXpress, je souhaite commander :\n\n${lines}\n\n*Total : ${total}*\n\nMerci.`;
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
}

function openProductModal(pid) {
    const p = allProducts.find(item => item.id == pid);
    if(!p) return;
    document.getElementById('modal-name').textContent = p.name;
    document.getElementById('modal-price').textContent = fmtFCFA(p.price);
    document.getElementById('modal-desc').textContent = p.desc;
    const container = document.getElementById('modal-media-container');
    container.innerHTML = `<div class="media-scroller" style="display:flex; overflow-x:auto; scroll-snap-type:x mandatory; gap:10px;">
            ${(p.media || []).map(m => `<div style="flex:0 0 100%; scroll-snap-align:start;">
                ${m.type==='video' ? `<video src="${m.src}" controls style="width:100%; border-radius:8px;"></video>` : `<img src="${m.src}" style="width:100%; border-radius:8px; object-fit:contain; max-height:400px;">`}
            </div>`).join('')}</div>`;
    document.getElementById('modal-cart-btn').onclick = () => { addToCart(pid); closeModal('productModal'); };
    openModal('productModal');
}

function fmtFCFA(v) { return new Intl.NumberFormat('fr-TG', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(v); }
function openModal(id) { document.getElementById(id).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id).classList.remove('open'); document.body.style.overflow = ''; }
function showToast(msg, icon = '✅') { 
    const t = document.getElementById('toast'); 
    document.getElementById('toast-msg').textContent = msg;
    document.getElementById('toast-icon').textContent = icon;
    t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); 
}
function filterProducts(cat, btn) {
    currentFilter = cat;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    renderProducts();
}
function updateHeroStats() {
    const skuVal = document.getElementById('hero-sku');
    if(!skuVal) return;
    skuVal.textContent = allProducts.filter(p => Number(p.qty) > 0).length;
}
function initGallery(card) {
    const slides = [...card.querySelectorAll('.media-slide')];
    if (slides.length <= 1) return;
    let idx = 0;
    const go = (n) => { idx = (n + slides.length) % slides.length; slides.forEach((s, i) => s.classList.toggle('active', i === idx)); };
    card.querySelector('.prev').onclick = (e) => { e.stopPropagation(); go(idx-1); };
    card.querySelector('.next').onclick = (e) => { e.stopPropagation(); go(idx+1); };
}
function setupScrollEffects() {
    const observer = new IntersectionObserver((entries) => { entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }); }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}
window.onclick = (e) => { if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id); };