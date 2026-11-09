import { formatIDR } from '../utils.js';

let currentPage = 1;
const itemsPerPage = 10;

export function renderKatalogPage(currentState) {
  // Gunakan state global yang dikirimkan atau impor langsung
  const activeState = currentState || state;
  const tbody = document.getElementById('masterTableBody');
  if (!tbody) return; // Keluar jika bukan halaman katalog

  renderCategoryDropdowns(activeState);
  renderMasterTable(activeState);
  setupTableEventListeners(activeState);
  populateTransactionProductSelect(activeState);
}

// ==================== FILTER & TABLE LOGIC ====================

function getFilteredProducts(activeState) {
  const products = activeState?.products || [];
  const tableQuery = (document.getElementById('tableSearchInput')?.value || '').toLowerCase().trim();
  const categoryVal = document.getElementById('categoryFilter')?.value || 'ALL';
  const brandVal = (document.getElementById('brandFilter')?.value || 'ALL').toUpperCase();

  return products.filter(p => {
    const pBrand = (p.brand || getBrandName(p.name)).toUpperCase();
    const matchSearch = p.name.toLowerCase().includes(tableQuery) || p.id.toLowerCase().includes(tableQuery);
    const matchCat = (categoryVal === 'ALL') || (p.category === categoryVal);
    let matchBrand = true;
    if (brandVal !== 'ALL') {
      matchBrand = brandVal === 'LAINNYA' ? !['INFINIX','IPHONE','OPPO','REDMI','SAMSUNG','VIVO','XIAOMI'].includes(pBrand) : pBrand.includes(brandVal);
    }
    return matchSearch && matchCat && matchBrand;
  });
}

function getBrandName(name) {
  const upper = name.toUpperCase();
  if (upper.includes('IPHONE')) return 'IPHONE';
  if (upper.includes('SAMSUNG')) return 'SAMSUNG';
  if (upper.includes('OPPO')) return 'OPPO';
  if (upper.includes('VIVO')) return 'VIVO';
  if (upper.includes('XIAOMI') || upper.includes('REDMI')) return 'XIAOMI';
  if (upper.includes('INFINIX')) return 'INFINIX';
  return 'LAINNYA';
}

function renderMasterTable(activeState) {
  const tbody = document.getElementById('masterTableBody');
  const infoText = document.getElementById('tableInfoText');
  if (!tbody) return;

  const filtered = getFilteredProducts(activeState);
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startIdx = (currentPage - 1) * itemsPerPage;
  const pageItems = filtered.slice(startIdx, startIdx + itemsPerPage);

  if (infoText) infoText.innerText = `Menampilkan ${totalItems === 0 ? 0 : startIdx + 1} - ${Math.min(startIdx + itemsPerPage, totalItems)} dari ${totalItems} produk`;

  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-400"><p class="text-xs font-semibold">Tidak Ada Produk Ditemukan</p></td></tr>`;
    renderPagination(totalPages, activeState);
    return;
  }

  tbody.innerHTML = pageItems.map(item => {
    let statusBadge = item.stock === 0 
      ? `<span class="bg-rose-100 text-rose-700 font-bold text-[10px] px-2.5 py-1 rounded-full">Habis</span>`
      : (item.stock <= item.minStock 
        ? `<span class="bg-amber-100 text-amber-800 font-bold text-[10px] px-2.5 py-1 rounded-full">Menipis</span>`
        : `<span class="bg-emerald-100 text-emerald-700 font-bold text-[10px] px-2.5 py-1 rounded-full">Aman</span>`);

    const assetValue = item.stock * (item.hpp || 0);

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="py-3 px-4 font-mono font-semibold text-xs text-indigo-600">${item.id}</td>
        <td class="py-3 px-4 font-bold text-slate-800">${item.name}</td>
        <td class="py-3 px-4"><span class="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded text-[11px] font-semibold">${item.category}</span></td>
        <td class="py-3 px-4 text-right font-extrabold ${item.stock === 0 ? 'text-rose-600' : 'text-slate-800'}">${item.stock} Pcs</td>
        <td class="py-3 px-4 text-right font-semibold text-slate-700">${formatIDR(item.hpp)}</td>
        <td class="py-3 px-4 text-right font-semibold text-emerald-600">${formatIDR(item.price)}</td>
        <td class="py-3 px-4 text-right font-bold text-slate-800">${formatIDR(assetValue)}</td>
        <td class="py-3 px-4 text-center">${statusBadge}</td>
        <td class="py-3 px-4 text-center">
          <div class="flex items-center justify-center space-x-1">
            <button type="button" onclick="quickRestock('${item.docId}')" title="Restock" class="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"><i class="fa-solid fa-plus-circle"></i></button>
            <button type="button" onclick="editProduct('${item.docId}')" title="Edit" class="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"><i class="fa-solid fa-pen-to-square"></i></button>
            <button type="button" onclick="openDeleteModal('${item.docId}')" title="Hapus" class="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination(totalPages, activeState);
}

function renderPagination(totalPages, activeState) {
  const controls = document.getElementById('paginationControls');
  if (!controls) return;
  let html = `<button type="button" onclick="changePage(${currentPage - 1}, ${activeState})" ${currentPage === 1 ? 'disabled class="opacity-40 cursor-not-allowed px-2.5 py-1 border rounded-lg"' : 'class="px-2.5 py-1 border rounded-lg hover:bg-slate-100"'}>&lt;</button>`;

  for (let i = 1; i <= totalPages; i++) {
    if (i === currentPage) {
      html += `<button type="button" class="px-3 py-1 bg-indigo-600 text-white font-bold rounded-lg text-xs">${i}</button>`;
    } else if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<button type="button" onclick="changePage(${i})" class="px-3 py-1 border rounded-lg hover:bg-slate-100 text-xs">${i}</button>`;
    }
  }

  html += `<button type="button" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled class="opacity-40 cursor-not-allowed px-2.5 py-1 border rounded-lg"' : 'class="px-2.5 py-1 border rounded-lg hover:bg-slate-100"'}>&gt;</button>`;
  controls.innerHTML = html;
}

window.changePage = function(page) {
  currentPage = page;
  renderKatalogPage(state);
};

window.resetFilters = function() {
  if (document.getElementById('tableSearchInput')) document.getElementById('tableSearchInput').value = '';
  if (document.getElementById('categoryFilter')) document.getElementById('categoryFilter').value = 'ALL';
  if (document.getElementById('brandFilter')) document.getElementById('brandFilter').value = 'ALL';
  currentPage = 1;
  renderKatalogPage(state);
  window.showToast?.('Filter pencarian di-reset', 'info');
};

function setupTableEventListeners(activeState) {
  const tableSearch = document.getElementById('tableSearchInput');
  const catFilter = document.getElementById('categoryFilter');
  const brandFilter = document.getElementById('brandFilter');

  if (tableSearch && !tableSearch.dataset.listenerAttached) {
    tableSearch.addEventListener('input', () => { currentPage = 1; renderMasterTable(activeState); });
    tableSearch.dataset.listenerAttached = "true";
  }
  if (catFilter && !catFilter.dataset.listenerAttached) {
    catFilter.addEventListener('change', () => { currentPage = 1; renderMasterTable(activeState); });
    catFilter.dataset.listenerAttached = "true";
  }
  if (brandFilter && !brandFilter.dataset.listenerAttached) {
    brandFilter.addEventListener('change', () => { currentPage = 1; renderMasterTable(activeState); });
    brandFilter.dataset.listenerAttached = "true";
  }
}

// ==================== MANAGING CATEGORIES & MODALS ====================

function renderCategoryDropdowns(activeState) {
  const categories = activeState?.categories || [];
  const filterSelect = document.getElementById('categoryFilter');
  if (filterSelect) {
    let filterHtml = '<option value="ALL">Semua Kategori</option>';
    categories.forEach(cat => { filterHtml += `<option value="${cat}">${cat}</option>`; });
    filterSelect.innerHTML = filterHtml;
  }

  const prodCatSelect = document.getElementById('prodCategory');
  if (prodCatSelect) {
    let catFormHtml = '';
    categories.forEach(cat => { catFormHtml += `<option value="${cat}">${cat}</option>`; });
    prodCatSelect.innerHTML = catFormHtml;
  }
}

function populateTransactionProductSelect(activeState) {
  const select = document.getElementById('transProductSelect');
  const products = activeState?.products || [];
  if (select) {
    select.innerHTML = products.map(p => 
      `<option value="${p.docId}">[${p.id}] ${p.name} - Stok: ${p.stock} Pcs (HPP: ${formatIDR(p.hpp)})</option>`
    ).join('');
  }
}

window.openModal = function(id) {
  document.getElementById(id)?.classList.remove('hidden');
};

window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
  if (id === 'productModal') {
    document.getElementById('productForm')?.reset();
    if (document.getElementById('editDocId')) document.getElementById('editDocId').value = '';
    window.setElText?.('productModalTitle', 'Tambah Produk & Finansial');
  }
};

window.quickRestock = function(docId) {
  window.openModal('transactionModal');
  const select = document.getElementById('transProductSelect');
  if (select) select.value = docId;
};

window.editProduct = function(docId) {
  const products = state.products || [];
  const item = products.find(p => p.docId === docId);
  if (!item) return;

  if (document.getElementById('editDocId')) document.getElementById('editDocId').value = item.docId;
  if (document.getElementById('prodSku')) document.getElementById('prodSku').value = item.id;
  if (document.getElementById('prodName')) document.getElementById('prodName').value = item.name;
  if (document.getElementById('prodCategory')) document.getElementById('prodCategory').value = item.category || (state.categories ? state.categories[0] : '');
  if (document.getElementById('prodHpp')) document.getElementById('prodHpp').value = item.hpp || 0;
  if (document.getElementById('prodPrice')) document.getElementById('prodPrice').value = item.price || 0;
  if (document.getElementById('prodBrand')) document.getElementById('prodBrand').value = item.brand || getBrandName(item.name);
  if (document.getElementById('prodStock')) document.getElementById('prodStock').value = item.stock;
  if (document.getElementById('prodMinStock')) document.getElementById('prodMinStock').value = item.minStock;

  window.setElText?.('productModalTitle', 'Edit Produk & HPP');
  window.openModal('productModal');
};

window.openDeleteModal = function(docId) {
  const products = state.products || [];
  const item = products.find(p => p.docId === docId);
  if (!item) return;
  if (document.getElementById('deleteDocId')) document.getElementById('deleteDocId').value = docId;
  window.setElText?.('deleteProductName', `"${item.name}" [${item.id}]`);
  window.openModal('deleteModal');
};

// ==================== FORM SUBMISSIONS & SAVING ====================

window.handleProductSubmit = async function(e) {
  e.preventDefault();
  console.log("handleProductSubmit dipanggil");

  const editDocId = document.getElementById('editDocId')?.value;
  const sku = document.getElementById('prodSku')?.value.trim();
  const name = document.getElementById('prodName')?.value.trim().toUpperCase();
  const category = document.getElementById('prodCategory')?.value;
  const hpp = parseFloat(document.getElementById('prodHpp')?.value) || 0;
  const price = parseFloat(document.getElementById('prodPrice')?.value) || 0;
  const stock = parseInt(document.getElementById('prodStock')?.value, 10) || 0;
  const minStock = parseInt(document.getElementById('prodMinStock')?.value, 10) || 10;
  let brand = document.getElementById('prodBrand')?.value.trim() || getBrandName(name);

  if (!state.products) state.products = [];

  if (editDocId) {
    const item = state.products.find(p => p.docId === editDocId);
    if (item) {
      Object.assign(item, { id: sku, name, category, brand, hpp, price, stock, minStock });
    }
  } else {
    state.products.unshift({
      docId: `prod_${sku.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`,
      id: sku, name, category, brand, hpp, price, stock, minStock,
      unit: 'Pcs', outgoing: 0, supplierDamaged: 0, shippingDamaged: 0
    });
  }

  // Simpan ke Cloud dan LocalStorage
  if (typeof saveStateToCloud === 'function') await saveStateToCloud();
  if (typeof saveLocalStorageFallback === 'function') saveLocalStorageFallback();

  renderKatalogPage(state);
  window.closeModal('productModal');
  window.showToast?.(`Produk ${name} berhasil disimpan`, 'success');
};

window.confirmDeleteProduct = async function() {
  const docId = document.getElementById('deleteDocId')?.value;
  if (!docId || !state.products) return;

  state.products = state.products.filter(p => p.docId !== docId);

  if (typeof saveStateToCloud === 'function') await saveStateToCloud();
  if (typeof saveLocalStorageFallback === 'function') saveLocalStorageFallback();

  renderKatalogPage(state);
  window.closeModal('deleteModal');
  window.showToast?.("Produk berhasil dihapus", "success");
};

window.handleTransactionSubmit = async function(e) {
  e.preventDefault();
  const docId = document.getElementById('transProductSelect')?.value;
  const type = document.querySelector('input[name="transType"]:checked')?.value;
  const product = state.products?.find(p => p.docId === docId);
  if (!product) return;

  if (type === 'IN') {
    const qtyGood = parseInt(document.getElementById('transQtyGood')?.value, 10) || 0;
    const qtySupplierDamaged = parseInt(document.getElementById('transQtySupplierDamaged')?.value, 10) || 0;
    product.stock += qtyGood;
    product.supplierDamaged = (product.supplierDamaged || 0) + qtySupplierDamaged;
    window.showToast?.(`Kulakan Tercatat: +${qtyGood} Stok Bagus`, 'success');
  }

  if (typeof saveStateToCloud === 'function') await saveStateToCloud();
  if (typeof saveLocalStorageFallback === 'function') saveLocalStorageFallback();

  renderKatalogPage(state);
  window.closeModal('transactionModal');
};
