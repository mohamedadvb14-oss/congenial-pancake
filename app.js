// بيانات المنتجات التجريبية تأتي من DummyJSON؛ كل عمليات البحث والتصفية هنا في المتصفح.
const API_ROOT = 'https://dummyjson.com/products';
const MEN_CATEGORIES = ['mens-shirts', 'mens-shoes'];
const STORAGE_KEYS = { cart: 'souqna-cart-v1', favorites: 'souqna-favorites-v1' };

const arabicCategories = {
  beauty: 'الجمال والعناية', fragrances: 'العطور', furniture: 'الأثاث', groceries: 'البقالة',
  'home-decoration': 'ديكور المنزل', 'kitchen-accessories': 'مستلزمات المطبخ', laptops: 'الحواسيب',
  'mens-shirts': 'قمصان رجالي', 'mens-shoes': 'أحذية رجالي', 'mens-watches': 'ساعات رجالي',
  'mobile-accessories': 'إكسسوارات الجوال', motorcycle: 'الدراجات النارية', 'skin-care': 'العناية بالبشرة',
  smartphones: 'الهواتف الذكية', 'sports-accessories': 'مستلزمات رياضية', sunglasses: 'النظارات الشمسية',
  tablets: 'الأجهزة اللوحية', tops: 'ملابس علوية', vehicle: 'مستلزمات السيارات',
  'womens-bags': 'حقائب نسائية', 'womens-dresses': 'فساتين نسائية', 'womens-jewellery': 'مجوهرات نسائية',
  'womens-shoes': 'أحذية نسائية', 'womens-watches': 'ساعات نسائية'
};

const elements = {
  grid: document.querySelector('#product-grid'),
  categories: document.querySelector('#category-list'),
  search: document.querySelector('#search-input'),
  sort: document.querySelector('#sort-select'),
  results: document.querySelector('#results-count'),
  clear: document.querySelector('#clear-filters'),
  favoritesToggle: document.querySelector('#favorites-toggle'),
  favoriteCount: document.querySelector('#favorite-count'),
  cartCount: document.querySelector('#cart-count'),
  drawerCount: document.querySelector('#drawer-count'),
  drawer: document.querySelector('#cart-drawer'),
  backdrop: document.querySelector('#drawer-backdrop'),
  cartItems: document.querySelector('#cart-items'),
  cartEmpty: document.querySelector('#cart-empty'),
  cartFooter: document.querySelector('#cart-footer'),
  subtotal: document.querySelector('#cart-subtotal'),
  toast: document.querySelector('#toast')
};

const state = {
  products: [],
  category: 'all',
  query: '',
  sort: 'featured',
  favoritesOnly: false,
  favorites: new Set(readStorage(STORAGE_KEYS.favorites, [])),
  cart: readStorage(STORAGE_KEYS.cart, {})
};

let toastTimeout;

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    showToast('تعذّر حفظ التغييرات على هذا الجهاز.');
  }
}

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function categoryName(slug = '') {
  return arabicCategories[slug] || slug.replaceAll('-', ' ');
}

function formatPrice(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => elements.toast.classList.remove('is-visible'), 2200);
}

function renderSkeletons() {
  elements.grid.innerHTML = Array.from({ length: 8 }, () => `
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton skeleton-image"></div><div class="skeleton skeleton-line short"></div>
      <div class="skeleton skeleton-line"></div><div class="skeleton skeleton-button"></div>
    </div>`).join('');
}

async function loadProducts() {
  elements.grid.setAttribute('aria-busy', 'true');
  elements.results.textContent = 'نجهّز لك المنتجات...';
  renderSkeletons();
  elements.categories.innerHTML = '<span class="category-loading">جارٍ تحميل الفئات...</span>';

  try {
    // نجمع القمصان والأحذية الرجالي، ثم نعرض عشرة منتجات كحد أقصى.
    const responses = await Promise.all(MEN_CATEGORIES.map((category) =>
      fetch(`${API_ROOT}/category/${category}?limit=10`)
    ));
    const failedResponse = responses.find((response) => !response.ok);
    if (failedResponse) throw new Error(`تعذّر تحميل المنتجات (${failedResponse.status})`);

    const categoryData = await Promise.all(responses.map((response) => response.json()));
    if (categoryData.some((data) => !Array.isArray(data.products))) {
      throw new Error('وصلتنا بيانات غير متوقعة من الخادم.');
    }

    state.products = categoryData.flatMap((data) => data.products).slice(0, 10);
    renderCategories();
    renderProducts();
    updateCounters();
  } catch (error) {
    console.error('Product API error:', error);
    elements.categories.innerHTML = '';
    elements.results.textContent = 'تعذّر تحميل المنتجات';
    elements.grid.innerHTML = `
      <div class="error-state">
        <span aria-hidden="true">↻</span><h3>لم نتمكن من تحميل المنتجات</h3>
        <p>تحقّق من اتصال الإنترنت ثم حاول مرة أخرى.</p>
        <button type="button" data-action="retry">إعادة المحاولة</button>
      </div>`;
  } finally {
    elements.grid.setAttribute('aria-busy', 'false');
  }
}

function renderCategories() {
  const categories = [...new Set(state.products.map((product) => product.category).filter(Boolean))]
    .sort((a, b) => categoryName(a).localeCompare(categoryName(b), 'ar'));

  const buttons = [{ slug: 'all', name: 'كل المنتجات' }, ...categories.map((slug) => ({ slug, name: categoryName(slug) }))];
  elements.categories.innerHTML = buttons.map(({ slug, name }) => `
    <button class="category-chip" type="button" data-category="${escapeHTML(slug)}" aria-pressed="${state.category === slug}">${escapeHTML(name)}</button>`).join('');
}

function getVisibleProducts() {
  const query = state.query.trim().toLocaleLowerCase();
  let products = state.products.filter((product) => {
    const matchesCategory = state.category === 'all' || product.category === state.category;
    const searchable = [product.title, product.description, product.brand, product.category].join(' ').toLocaleLowerCase();
    const matchesQuery = !query || searchable.includes(query);
    const matchesFavorite = !state.favoritesOnly || state.favorites.has(product.id);
    return matchesCategory && matchesQuery && matchesFavorite;
  });

  if (state.sort === 'price-low') products.sort((a, b) => a.price - b.price);
  if (state.sort === 'price-high') products.sort((a, b) => b.price - a.price);
  if (state.sort === 'rating') products.sort((a, b) => b.rating - a.rating);
  return products;
}

function renderProducts() {
  const products = getVisibleProducts();
  const filtersActive = Boolean(state.query || state.favoritesOnly || state.category !== 'all');
  elements.clear.hidden = !filtersActive;
  elements.results.textContent = `عرض ${products.length} من ${state.products.length} منتج`;

  if (!products.length) {
    const title = state.favoritesOnly && state.favorites.size === 0 ? 'قائمة المفضلة فارغة' : 'لم نعثر على منتجات';
    const message = state.favoritesOnly && state.favorites.size === 0
      ? 'اضغط على علامة القلب في أي منتج لإضافته إلى قائمتك.'
      : 'جرّب تغيير كلمة البحث أو اختيار فئة أخرى.';
    elements.grid.innerHTML = `<div class="empty-state"><span aria-hidden="true">⌕</span><h3>${title}</h3><p>${message}</p></div>`;
    return;
  }

  elements.grid.innerHTML = products.map((product, index) => {
    const image = product.thumbnail || product.images?.[0] || '';
    const favorite = state.favorites.has(product.id);
    const discount = Math.round(product.discountPercentage || 0);
    return `
      <article class="product-card" style="animation-delay:${Math.min(index % 8, 7) * 35}ms">
        <div class="product-visual">
          ${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(product.title)}" loading="lazy" data-product-image />` : '<div class="image-fallback" aria-hidden="true">✳</div>'}
          ${discount >= 10 ? `<span class="product-tag">خصم ${discount}%</span>` : ''}
          <button class="favorite-button ${favorite ? 'is-favorite' : ''}" type="button" data-action="favorite" data-id="${Number(product.id)}" aria-label="${favorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}" aria-pressed="${favorite}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 8.7c0 5-8.4 10-8.4 10s-8.4-5-8.4-10A4.4 4.4 0 0 1 12 6.1a4.4 4.4 0 0 1 8.4 2.6Z"/></svg>
          </button>
        </div>
        <div class="product-info">
          <p class="product-category">${escapeHTML(categoryName(product.category))}</p>
          <h3 class="product-title" title="${escapeHTML(product.title)}">${escapeHTML(product.title)}</h3>
          <div class="product-meta"><span class="product-price">${formatPrice(product.price)}</span><span class="product-rating"><span>★</span> ${Number(product.rating || 0).toFixed(1)}</span></div>
          <button class="add-to-cart" type="button" data-action="add" data-id="${Number(product.id)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 11.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 1.9-1.4L22 8H6"/><circle cx="9.5" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>
            أضف إلى السلة
          </button>
        </div>
      </article>`;
  }).join('');
}

function updateCounters() {
  const cartTotal = Object.values(state.cart).reduce((sum, quantity) => sum + quantity, 0);
  elements.cartCount.textContent = cartTotal;
  elements.drawerCount.textContent = `(${cartTotal})`;
  elements.favoriteCount.textContent = state.favorites.size;
  elements.favoritesToggle.setAttribute('aria-pressed', String(state.favoritesOnly));
}

function addToCart(productId) {
  state.cart[productId] = (state.cart[productId] || 0) + 1;
  writeStorage(STORAGE_KEYS.cart, state.cart);
  updateCounters();
  renderCart();
  const product = state.products.find((item) => item.id === productId);
  showToast(`أُضيف «${product?.title || 'المنتج'}» إلى السلة`);
}

function toggleFavorite(productId) {
  if (state.favorites.has(productId)) {
    state.favorites.delete(productId);
    showToast('أُزيل المنتج من المفضلة');
  } else {
    state.favorites.add(productId);
    showToast('أُضيف المنتج إلى المفضلة');
  }
  writeStorage(STORAGE_KEYS.favorites, [...state.favorites]);
  updateCounters();
  renderProducts();
}

function renderCart() {
  const entries = Object.entries(state.cart).filter(([, quantity]) => quantity > 0);
  const cartTotal = entries.reduce((sum, [, quantity]) => sum + quantity, 0);
  const productsById = new Map(state.products.map((product) => [String(product.id), product]));
  const knownEntries = entries.map(([id, quantity]) => ({ product: productsById.get(id), quantity, id })).filter((entry) => entry.product);
  const subtotal = knownEntries.reduce((sum, entry) => sum + entry.product.price * entry.quantity, 0);

  elements.cartEmpty.hidden = knownEntries.length > 0;
  elements.cartFooter.hidden = knownEntries.length === 0;
  elements.cartItems.innerHTML = knownEntries.map(({ product, quantity }) => `
    <article class="cart-line">
      <div class="cart-line-image">${product.thumbnail ? `<img src="${escapeHTML(product.thumbnail)}" alt="" loading="lazy" />` : '✳'}</div>
      <div class="cart-line-copy"><p>${escapeHTML(categoryName(product.category))}</p><h3>${escapeHTML(product.title)}</h3><strong>${formatPrice(product.price)}</strong>
        <div class="quantity-control" aria-label="الكمية">
          <button type="button" data-action="quantity" data-id="${Number(product.id)}" data-change="-1" aria-label="تقليل الكمية">−</button>
          <span>${quantity}</span>
          <button type="button" data-action="quantity" data-id="${Number(product.id)}" data-change="1" aria-label="زيادة الكمية">+</button>
        </div>
      </div>
      <button class="remove-line" type="button" data-action="remove" data-id="${Number(product.id)}" aria-label="حذف ${escapeHTML(product.title)}">×</button>
    </article>`).join('');
  elements.subtotal.textContent = formatPrice(subtotal);
  elements.cartCount.textContent = cartTotal;
  elements.drawerCount.textContent = `(${cartTotal})`;
}

function setDrawerOpen(isOpen) {
  elements.drawer.classList.toggle('is-open', isOpen);
  elements.drawer.setAttribute('aria-hidden', String(!isOpen));
  elements.drawer.inert = !isOpen;
  elements.backdrop.hidden = !isOpen;
  document.body.style.overflow = isOpen ? 'hidden' : '';
  if (isOpen) document.querySelector('#close-drawer').focus();
}

function clearFilters() {
  state.category = 'all';
  state.query = '';
  state.favoritesOnly = false;
  state.sort = 'featured';
  elements.search.value = '';
  elements.sort.value = 'featured';
  renderCategories();
  updateCounters();
  renderProducts();
}

elements.categories.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  state.category = button.dataset.category;
  renderCategories();
  renderProducts();
});

elements.grid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const productId = Number(button.dataset.id);
  if (button.dataset.action === 'add') addToCart(productId);
  if (button.dataset.action === 'favorite') toggleFavorite(productId);
  if (button.dataset.action === 'retry') loadProducts();
});

elements.cartItems.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const id = button.dataset.id;
  if (button.dataset.action === 'quantity') {
    state.cart[id] = (state.cart[id] || 0) + Number(button.dataset.change);
    if (state.cart[id] <= 0) delete state.cart[id];
  }
  if (button.dataset.action === 'remove') delete state.cart[id];
  writeStorage(STORAGE_KEYS.cart, state.cart);
  updateCounters();
  renderCart();
});

elements.search.addEventListener('input', () => {
  state.query = elements.search.value;
  renderProducts();
});
elements.sort.addEventListener('change', () => {
  state.sort = elements.sort.value;
  renderProducts();
});
elements.clear.addEventListener('click', clearFilters);
elements.favoritesToggle.addEventListener('click', () => {
  state.favoritesOnly = !state.favoritesOnly;
  updateCounters();
  renderProducts();
  document.querySelector('#collection').scrollIntoView({ behavior: 'smooth' });
});
document.querySelector('#cart-trigger').addEventListener('click', () => { renderCart(); setDrawerOpen(true); });
document.querySelector('#close-drawer').addEventListener('click', () => setDrawerOpen(false));
document.querySelector('#continue-shopping').addEventListener('click', () => setDrawerOpen(false));
elements.backdrop.addEventListener('click', () => setDrawerOpen(false));
document.querySelector('#checkout-button').addEventListener('click', () => showToast('هذه واجهة تجريبية — لم يتم إرسال أي طلب.'));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setDrawerOpen(false); });
document.addEventListener('error', (event) => {
  if (event.target.matches?.('[data-product-image]')) {
    const fallback = document.createElement('div');
    fallback.className = 'image-fallback';
    fallback.setAttribute('aria-hidden', 'true');
    fallback.textContent = '✳';
    event.target.replaceWith(fallback);
  }
}, true);

renderCart();
updateCounters();
loadProducts();
