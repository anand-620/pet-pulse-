(() => {
  //const API_BASE = 'http://localhost:4000';
  const API_BASE = 'http://127.0.0.1:4000';


  /* ======================
     CART HELPERS
     ====================== */
  function getCart() { return JSON.parse(localStorage.getItem('cart') || '[]'); }
  function saveCart(cart) { localStorage.setItem('cart', JSON.stringify(cart)); updateCartCount(); if (typeof loadCart === 'function') loadCart(); }
  function updateCartCount() {
    const el = document.getElementById('cartCount');
    if (!el) return;
    const qty = getCart().reduce((s, i) => s + (i.qty || 1), 0);
    el.textContent = qty;
  }

  function addToCart(item) {
    // item = { id, name, price, qty, img }
    const cart = getCart();
    const idx = cart.findIndex(x => String(x.id) === String(item.id));
    if (idx !== -1) cart[idx].qty = (cart[idx].qty || 1) + (item.qty || 1);
    else cart.push({ id: item.id, name: item.name, price: Number(item.price || 0), qty: item.qty || 1, img: item.img || null });
    saveCart(cart);
  }

  // expose for other scripts
  window.addToCart = addToCart;
  window.updateCartCount = updateCartCount;

  // minimal cart UI loader (if you include a #cart-container and #total-price)
  function loadCart() {
    const container = document.getElementById('cart-container');
    const totalEl = document.getElementById('total-price');
    if (!container) return;
    const cart = getCart();
    container.innerHTML = '';
    if (cart.length === 0) {
      container.innerHTML = '<p>Your cart is empty 🛒</p>';
      if (totalEl) totalEl.textContent = '';
      return;
    }
    let total = 0;
    cart.forEach(it => {
      total += (Number(it.price || 0) * (it.qty || 1));
      const div = document.createElement('div');
      div.className = 'cart-item';
      div.innerHTML = `<h3>${escapeHtml(it.name)}</h3><p>Price: ₹${Number(it.price||0)}</p><p>Qty: ${it.qty||1}</p>`;
      container.appendChild(div);
    });
    if (totalEl) totalEl.textContent = `Total: ₹${Number(total).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }

  window.loadCart = loadCart;

  /* ======================
     DARK MODE
     ====================== */
  function initDarkMode() {
    const btn = document.getElementById('darkModeToggle');
    if (!btn) return;
    const body = document.body;
    if (localStorage.getItem('theme') === 'dark') { body.classList.add('dark-mode'); btn.textContent = '☀️ Light Mode'; }
    btn.addEventListener('click', () => {
      body.classList.toggle('dark-mode');
      if (body.classList.contains('dark-mode')) { localStorage.setItem('theme', 'dark'); btn.textContent = '☀️ Light Mode'; }
      else { localStorage.setItem('theme', 'light'); btn.textContent = '🌙 Dark Mode'; }
    });
  }

  /* ======================
     SIMPLE UTILS
     ====================== */
  function escapeHtml(s){ return String(s||'').replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\\':'\\\\','"':'&quot;',"'":"&#39;"})[m]); }
  function fmtRupee(n){ return '₹' + Number(n||0).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

  /* ======================
     PET POPUP / ENQUIRY MODAL
     ====================== */
  function createEnquiryModalIfNeeded() {
    if (document.getElementById('inquiryModal')) return document.getElementById('inquiryModal');
    const modal = document.createElement('div');
    modal.id = 'inquiryModal';
    modal.style = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);z-index:9999;padding:20px';
    modal.innerHTML = `
      <div style="background:#fff;padding:18px;border-radius:10px;max-width:520px;width:100%;">
        <h3 style="margin:0 0 8px">Enquiry about <span id="inqProductName" style="font-weight:700"></span></h3>
        <form id="inqForm">
          <input id="inqName" placeholder="Your name" required style="width:100%;padding:8px;margin:6px 0;border:1px solid #eee;border-radius:8px" />
          <input id="inqPhone" placeholder="Phone" required style="width:100%;padding:8px;margin:6px 0;border:1px solid #eee;border-radius:8px" />
          <textarea id="inqMsg" placeholder="Message" style="width:100%;padding:8px;margin:6px 0;border:1px solid #eee;border-radius:8px"></textarea>
          <div style="text-align:right;margin-top:8px">
            <button type="submit" style="padding:8px 12px;border-radius:8px;background:#ff8d57;color:#fff;border:none">Send</button>
            <button type="button" id="inqClose" style="margin-left:8px;padding:8px 12px;border-radius:8px;background:#fff;border:1px solid #eee;color:#333">Close</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#inqClose').addEventListener('click', () => modal.remove());
    modal.querySelector('#inqForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        pet_id: modal.__currentProductId || null,
        name: document.getElementById('inqName').value.trim(),
        phone: document.getElementById('inqPhone').value.trim(),
        message: document.getElementById('inqMsg').value.trim()
      };
      try {
        await fetch(API_BASE + '/api/adopt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        alert('Inquiry sent. We will contact you soon.');
      } catch (err) {
        console.error(err);
        const local = JSON.parse(localStorage.getItem('inquiries') || '[]');
        local.push({ ...payload, created_at: new Date().toISOString() });
        localStorage.setItem('inquiries', JSON.stringify(local));
        alert('Could not reach server — saved locally.');
      }
      modal.remove();
    });
    return modal;
  }

  function openEnquiryModal(product){
    const modal = createEnquiryModalIfNeeded();
    document.getElementById('inqProductName').textContent = product.name || 'Item';
    modal.__currentProductId = product.id || null;
    modal.style.display = 'flex';
    setTimeout(()=> document.getElementById('inqName').focus(), 50);
  }

  /* ======================
     PET CARD LISTENERS
     Attach to .pet-card elements (for keyboard + click)
     ====================== */
  function attachPetListeners(){
    const petBoxes = document.querySelectorAll('.pet-card');
    petBoxes.forEach(box => {
      if (box.dataset.popupBound === 'true') return;
      box.dataset.popupBound = 'true';
      box.setAttribute('tabindex', '0');
      box.style.cursor = 'pointer';
      box.addEventListener('click', () => {
        const img = box.querySelector('img');
        const src = (img && (img.getAttribute('src') || img.src) || '').toLowerCase();
        const alt = (img && (img.getAttribute('alt') || '') || '').toLowerCase();
        // pick a simple map by keywords
        const map = [
          { match: 'dog', title: 'Adopt a Friend: Dog', quote: 'When you adopt a dog, you gain a friend.' },
          { match: 'cat', title: 'Adopt a Friend: Cat', quote: 'Cats choose soft laps — adopt, and get both.' },
          { match: 'bird', title: 'Adopt a Friend: Bird', quote: 'A small chirp can fill your home with sunshine.' }
        ];
        let chosen = map[0];
        for (const m of map) { if ((src && src.includes(m.match)) || (alt && alt.includes(m.match))) { chosen = m; break; } }
        const data = Object.assign({}, chosen, { img: img ? (img.getAttribute('src') || img.src) : '' });
        openPetPopup(data);
      });
      box.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); box.click(); } });
    });
  }

  function openPetPopup(data){
    // reuse the same visual modal as enquiry but more visual
    // create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'pet-popup-backdrop';
    backdrop.style = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);z-index:9999;padding:20px';
    const popup = document.createElement('div');
    popup.className = 'pet-popup';
    popup.style = 'background:#fff;border-radius:10px;max-width:820px;width:100%;display:flex;gap:12px;overflow:auto';
    popup.innerHTML = `
      <div style="flex:0 0 320px;max-width:320px;padding:12px">
        <img src="${escapeHtml(data.img||'')}" alt="${escapeHtml(data.title||'pet')}" style="width:100%;height:auto;border-radius:8px;object-fit:cover;" />
      </div>
      <div style="flex:1;padding:12px">
        <h3 style="margin-top:0">${escapeHtml(data.title||'Adopt')}</h3>
        <p style="color:#666">${escapeHtml(data.quote||'')}</p>
        <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
          <button id="ppAdopt" style="padding:8px 12px;border-radius:8px;background:#ff8d57;color:#fff;border:none">Start Adoption</button>
          <button id="ppClose" style="padding:8px 12px;border-radius:8px;background:#fff;border:1px solid #eee;color:#333">Close</button>
        </div>
      </div>
    `;
    backdrop.appendChild(popup);
    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) { backdrop.remove(); document.body.style.overflow = ''; } });
    popup.querySelector('#ppClose').addEventListener('click', ()=>{ backdrop.remove(); document.body.style.overflow = ''; });
    popup.querySelector('#ppAdopt').addEventListener('click', ()=>{ window.location.href = 'adopt.html'; });
  }

  /* ======================
     PRODUCTS LOADER
     - pets.html shows type==='pet'
     - petfood.html shows type!=='pet'
     ====================== */
  function loadProducts() {
    const container = document.getElementById('productsList');
    if (!container) { console.warn('No #productsList element found'); return; }
    container.innerHTML = '<div style="padding:16px;color:#666">Loading products…</div>';

    fetch(API_BASE + '/api/products')
      .then(r => { if(!r.ok) throw new Error('Fetch failed'); return r.json(); })
      .then(list => {
        const path = window.location.pathname.toLowerCase();
        const onPetsPage = path.includes('pets.html') || document.body.classList.contains('pets-page');
        const onProductPage = path.includes('petfood.html') || document.body.classList.contains('product-page') || path.includes('food');

        // filter according to page
        list = list.filter(p => {
          const t = String(p.type || '').toLowerCase();
          if (onPetsPage) return t === 'pet';
          if (onProductPage) return t !== 'pet';
          return true;
        });

        if (!Array.isArray(list) || list.length === 0) { container.innerHTML = '<div style="padding:16px;color:#666">No products found.</div>'; return; }

        container.innerHTML = '';
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fit,minmax(220px,1fr))';
        grid.style.gap = '16px';

        list.forEach(p => {
          const isPet = String(p.type || '').toLowerCase() === 'pet';
          const card = document.createElement('div');
          card.className = isPet ? 'pet-card' : 'product-card';
          card.style = 'background:#fff;border-radius:10px;padding:12px;box-shadow:0 6px 18px rgba(0,0,0,0.06);display:flex;flex-direction:column;gap:8px;';

          const imgDiv = document.createElement('div');
          imgDiv.style = 'height:140px;border-radius:8px;overflow:hidden;background:#fff8f6;display:flex;align-items:center;justify-content:center';
          if (p.img) {
            const img = document.createElement('img');
            img.src = (p.img.startsWith('http') ? p.img : (API_BASE + p.img));
            img.alt = p.name || 'product';
            img.style = 'width:100%;height:100%;object-fit:cover';
            imgDiv.appendChild(img);
          } else {
            imgDiv.textContent = 'No Image'; imgDiv.style.color = '#b84b18'; imgDiv.style.fontWeight = '700';
          }

          const title = document.createElement('div'); title.textContent = p.name || 'Unnamed'; title.style = 'font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
          const cat = document.createElement('div'); cat.textContent = p.category || p.type || ''; cat.className = 'muted'; cat.style = 'color:#666;font-size:13px';
          const price = document.createElement('div'); price.textContent = fmtRupee(p.price); price.style = 'font-weight:900';

          const btnRow = document.createElement('div'); btnRow.style = 'margin-top:auto;display:flex;gap:8px';

          if (isPet && (window.location.pathname.toLowerCase().includes('pets.html') || document.body.classList.contains('pets-page'))) {
            const enquireBtn = document.createElement('button'); enquireBtn.textContent = 'Enquire'; enquireBtn.className = 'enquire-btn';
            enquireBtn.style = 'padding:8px 10px;border-radius:8px;background:#ff8d57;color:#fff;border:none;cursor:pointer';
            enquireBtn.addEventListener('click', ()=> openEnquiryModal(p));
            btnRow.appendChild(enquireBtn);
            card.classList.add('pet-card');
          } else {
            const addBtn = document.createElement('button'); addBtn.textContent = 'Add to cart'; addBtn.className = 'add-to-cart';
            addBtn.style = 'padding:8px 10px;border-radius:8px;background:#ff8d57;color:#fff;border:none;cursor:pointer';
            addBtn.addEventListener('click', ()=>{ addToCart({ id: p.id, name: p.name, price: Number(p.price||0), qty:1, img: (p.img? (API_BASE + p.img) : null) }); if(typeof toast === 'function') toast(`${p.name} added to cart`); else alert(`${p.name} added to cart`); });
            btnRow.appendChild(addBtn);
          }

          const view = document.createElement('a'); view.href='#'; view.textContent='View'; view.style = 'display:inline-block;padding:8px 10px;border-radius:8px;background:#fff;color:#ff8d57;text-decoration:none;border:1px solid #ff8d57'; btnRow.appendChild(view);

          card.appendChild(imgDiv); card.appendChild(title); card.appendChild(cat); card.appendChild(price); card.appendChild(btnRow);
          grid.appendChild(card);
        });

        container.appendChild(grid);
        // attach pet listeners for dynamic .pet-card nodes
        if (typeof attachPetListeners === 'function') attachPetListeners();
        else setTimeout(()=> { const petCards = document.querySelectorAll('.pet-card'); if(petCards.length) { petCards.forEach(c=>c.click = c.click); } }, 100);

        updateCartCount();
      })
      .catch(err => { console.error(err); container.innerHTML = '<div style="padding:16px;color:#b84b18">Could not load products. Check backend.</div>'; });
  }

  /* ======================
     INIT
     ====================== */
  document.addEventListener('DOMContentLoaded', ()=>{
    initDarkMode();
    loadCart();
    updateCartCount();
    loadProducts();
    // re-run attach after slight delay for pages that add static cards later
    setTimeout(()=> { if(typeof attachPetListeners === 'function') attachPetListeners(); }, 400);
  });

})();
