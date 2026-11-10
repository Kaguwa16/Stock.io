import { formatIDR } from '../utils.js';
import { state, saveState, saveLocalStorageFallback } from '../state.js'; 

let currentPage = 1;
const itemsPerPage = 10;

// Variabel penampung state di level modul agar bisa diakses semua fungsi window.*
let appState = { products: [], categories: [] };
let editingCatIndex = -1; // indeks kategori yang sedang diedit di modal Kelola Kategori (-1 = tidak ada)

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

export function renderKatalogPage(stateData) {
  if (stateData) {
    appState = stateData; // Sinkronkan data state terbaru
  }
  
  const tbody = document.getElementById('masterTableBody');
  if (!tbody) return; // Keluar jika bukan halaman katalog

  renderCategoryDropdowns();
  renderMasterTable();
  setupTableEventListeners();
  populateTransactionProductSelect();
  if (editingCatIndex === -1) renderCategoryList(); // jangan ganggu input yang sedang diketik
}

// ==================== FILTER & TABLE LOGIC ====================

function getFilteredProducts() {
  const products = appState?.products || [];
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

function renderMasterTable() {
  const tbody = document.getElementById('masterTableBody');
  const infoText = document.getElementById('tableInfoText');
  if (!tbody) return;

  const filtered = getFilteredProducts();
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startIdx = (currentPage - 1) * itemsPerPage;
  const pageItems = filtered.slice(startIdx, startIdx + itemsPerPage);

  if (infoText) infoText.innerText = `Menampilkan ${totalItems === 0 ? 0 : startIdx + 1} - ${Math.min(startIdx + itemsPerPage, totalItems)} dari ${totalItems} produk`;

  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-400"><p class="text-xs font-semibold">Tidak Ada Produk Ditemukan</p></td></tr>`;
    renderPagination(totalPages);
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

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const controls = document.getElementById('paginationControls');
  if (!controls) return;
  let html = `<button type="button" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled class="opacity-40 cursor-not-allowed px-2.5 py-1 border rounded-lg"' : 'class="px-2.5 py-1 border rounded-lg hover:bg-slate-100"'}>&lt;</button>`;

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
  renderMasterTable();
};

window.resetFilters = function() {
  if (document.getElementById('tableSearchInput')) document.getElementById('tableSearchInput').value = '';
  if (document.getElementById('categoryFilter')) document.getElementById('categoryFilter').value = 'ALL';
  if (document.getElementById('brandFilter')) document.getElementById('brandFilter').value = 'ALL';
  currentPage = 1;
  renderMasterTable();
  window.showToast?.('Filter pencarian di-reset', 'info');
};

function setupTableEventListeners() {
  const tableSearch = document.getElementById('tableSearchInput');
  const catFilter = document.getElementById('categoryFilter');
  const brandFilter = document.getElementById('brandFilter');

  if (tableSearch && !tableSearch.dataset.listenerAttached) {
    tableSearch.addEventListener('input', () => { currentPage = 1; renderMasterTable(); });
    tableSearch.dataset.listenerAttached = "true";
  }
  if (catFilter && !catFilter.dataset.listenerAttached) {
    catFilter.addEventListener('change', () => { currentPage = 1; renderMasterTable(); });
    catFilter.dataset.listenerAttached = "true";
  }
  if (brandFilter && !brandFilter.dataset.listenerAttached) {
    brandFilter.addEventListener('change', () => { currentPage = 1; renderMasterTable(); });
    brandFilter.dataset.listenerAttached = "true";
  }
}

// ==================== MANAGING CATEGORIES & MODALS ====================

function renderCategoryDropdowns() {
  const categories = appState?.categories || [];
  const options = categories.map(cat => `<option value="${esc(cat)}">${esc(cat)}</option>`).join('');

  // Filter: pertahankan pilihan saat ini kalau kategorinya masih ada
  const filterSelect = document.getElementById('categoryFilter');
  if (filterSelect) {
    const prev = filterSelect.value || 'ALL';
    filterSelect.innerHTML = '<option value="ALL">Semua Kategori</option>' + options;
    filterSelect.value = categories.includes(prev) ? prev : 'ALL';
  }

  // Form produk: pertahankan pilihan saat ini kalau kategorinya masih ada
  const prodCatSelect = document.getElementById('prodCategory');
  if (prodCatSelect) {
    const prev = prodCatSelect.value;
    prodCatSelect.innerHTML = options;
    if (categories.includes(prev)) prodCatSelect.value = prev;
  }
}

function populateTransactionProductSelect() {
  const select = document.getElementById('transProductSelect');
  const products = appState?.products || [];
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
  const products = appState.products || [];
  const item = products.find(p => p.docId === docId);
  if (!item) return;

  if (document.getElementById('editDocId')) document.getElementById('editDocId').value = item.docId;
  if (document.getElementById('prodSku')) document.getElementById('prodSku').value = item.id;
  if (document.getElementById('prodName')) document.getElementById('prodName').value = item.name;
  if (document.getElementById('prodCategory')) document.getElementById('prodCategory').value = item.category || (appState.categories ? appState.categories[0] : '');
  if (document.getElementById('prodHpp')) document.getElementById('prodHpp').value = item.hpp || 0;
  if (document.getElementById('prodPrice')) document.getElementById('prodPrice').value = item.price || 0;
  if (document.getElementById('prodBrand')) document.getElementById('prodBrand').value = item.brand || getBrandName(item.name);
  if (document.getElementById('prodStock')) document.getElementById('prodStock').value = item.stock;
  if (document.getElementById('prodMinStock')) document.getElementById('prodMinStock').value = item.minStock;

  window.setElText?.('productModalTitle', 'Edit Produk & HPP');
  window.openModal('productModal');
};

window.openDeleteModal = function(docId) {
  const products = appState.products || [];
  const item = products.find(p => p.docId === docId);
  if (!item) return;
  if (document.getElementById('deleteDocId')) document.getElementById('deleteDocId').value = docId;
  window.setElText?.('deleteProductName', `"${item.name}" [${item.id}]`);
  window.openModal('deleteModal');
};

// ==================== KELOLA KATEGORI (TAMBAH / EDIT / HAPUS) ====================

function getCategories() {
  if (!appState.categories) appState.categories = [];
  return appState.categories;
}

function countProductsIn(name) {
  return (appState.products || []).filter(p => p.category === name).length;
}

function cleanCategoryName(v) {
  return String(v || '').trim().replace(/\s+/g, ' ');
}

function isDuplicateCategory(name, exceptIndex = -1) {
  const key = name.toLowerCase();
  return getCategories().some((c, i) => i !== exceptIndex && c.toLowerCase() === key);
}

async function persistCategories() {
  await saveState();            // categories dan products (kalau ada yang dipindah) tersimpan sekaligus
  saveLocalStorageFallback();
  renderKatalogPage(appState);
  renderCategoryList();
}

function renderCategoryList() {
  const box = document.getElementById('categoryList');
  if (!box) return;

  const cats = getCategories();
  if (!cats.length) {
    box.innerHTML = '<div class="px-4 py-6 text-center text-xs text-slate-400">Belum ada kategori</div>';
    return;
  }

  box.innerHTML = cats.map((cat, i) => {
    if (i === editingCatIndex) {
      return `
        <div class="flex items-center gap-2 px-3 py-2.5 bg-indigo-50/60">
          <input id="editCategoryInput" type="text" maxlength="40" value="${esc(cat)}"
            onkeydown="if(event.key==='Enter'){event.preventDefault();saveEditCategory(${i})}else if(event.key==='Escape'){cancelEditCategory()}"
            class="flex-1 min-w-0 px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500">
          <button type="button" onclick="saveEditCategory(${i})" class="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-[11px] font-semibold hover:bg-indigo-700 transition">Simpan</button>
          <button type="button" onclick="cancelEditCategory()" class="px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-semibold hover:bg-slate-200 transition">Batal</button>
        </div>`;
    }
    const n = countProductsIn(cat);
    return `
      <div class="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50 transition">
        <div class="min-w-0 flex items-center gap-2">
          <span class="truncate text-xs font-semibold text-slate-700">${esc(cat)}</span>
          <span class="shrink-0 text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">${n} produk</span>
        </div>
        <div class="shrink-0 flex items-center space-x-1">
          <button type="button" onclick="startEditCategory(${i})" title="Edit" class="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"><i class="fa-solid fa-pen-to-square"></i></button>
          <button type="button" onclick="openDeleteCategory(${i})" title="Hapus" class="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </div>`;
  }).join('');

  if (editingCatIndex >= 0) {
    const el = document.getElementById('editCategoryInput');
    el?.focus();
    el?.select();
  }
}

window.openCategoryModal = function () {
  editingCatIndex = -1;
  const input = document.getElementById('newCategoryName');
  if (input) input.value = '';
  renderCategoryList();
  window.openModal('categoryModal');
};

window.handleAddCategory = async function (e) {
  e.preventDefault();
  const input = document.getElementById('newCategoryName');
  const name = cleanCategoryName(input?.value);
  if (!name) return;
  if (isDuplicateCategory(name)) {
    window.showToast?.(`Kategori "${name}" sudah ada`, 'error');
    return;
  }
  getCategories().push(name);
  if (input) input.value = '';
  await persistCategories();
  window.showToast?.(`Kategori "${name}" ditambahkan`, 'success');
};

window.startEditCategory = function (i) {
  editingCatIndex = i;
  renderCategoryList();
};

window.cancelEditCategory = function () {
  editingCatIndex = -1;
  renderCategoryList();
};

window.saveEditCategory = async function (i) {
  const cats = getCategories();
  const oldName = cats[i];
  if (oldName === undefined) return;

  const newName = cleanCategoryName(document.getElementById('editCategoryInput')?.value);
  if (!newName) {
    window.showToast?.('Nama kategori tidak boleh kosong', 'error');
    return;
  }
  if (newName === oldName) {
    editingCatIndex = -1;
    renderCategoryList();
    return;
  }
  if (isDuplicateCategory(newName, i)) {
    window.showToast?.(`Kategori "${newName}" sudah ada`, 'error');
    return;
  }

  // Ganti nama kategori sekaligus semua produk yang memakainya
  cats[i] = newName;
  let updated = 0;
  (appState.products || []).forEach(p => {
    if (p.category === oldName) { p.category = newName; updated++; }
  });

  editingCatIndex = -1;
  await persistCategories();
  window.showToast?.(`Kategori diubah menjadi "${newName}"` + (updated ? ` (${updated} produk ikut diperbarui)` : ''), 'success');
};

window.openDeleteCategory = function (i) {
  const cats = getCategories();
  const name = cats[i];
  if (name === undefined) return;

  if (cats.length <= 1) {
    window.showToast?.('Minimal harus ada 1 kategori', 'error');
    return;
  }

  const count = countProductsIn(name);
  document.getElementById('deleteCategoryIndex').value = i;
  document.getElementById('deleteCategoryName').innerText = `Kategori "${name}" akan dihapus.`;

  const moveBox = document.getElementById('deleteCategoryMoveBox');
  const select = document.getElementById('deleteCategoryMoveTo');
  if (count > 0) {
    document.getElementById('deleteCategoryCount').innerText = count;
    select.innerHTML = cats.map((c, idx) => idx === i ? '' : `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    moveBox.classList.remove('hidden');
  } else {
    moveBox.classList.add('hidden');
  }
  window.openModal('categoryDeleteModal');
};

window.confirmDeleteCategory = async function () {
  const i = parseInt(document.getElementById('deleteCategoryIndex')?.value, 10);
  const cats = getCategories();
  const name = cats[i];
  if (name === undefined) return;

  const count = countProductsIn(name);
  if (count > 0) {
    const target = document.getElementById('deleteCategoryMoveTo')?.value;
    if (!target || target === name || !cats.includes(target)) {
      window.showToast?.('Pilih kategori tujuan untuk produk yang dipindahkan', 'error');
      return;
    }
    (appState.products || []).forEach(p => { if (p.category === name) p.category = target; });
  }

  cats.splice(i, 1);
  editingCatIndex = -1;
  await persistCategories();
  window.closeModal('categoryDeleteModal');
  window.showToast?.(`Kategori "${name}" dihapus`, 'success');
};

// ==================== FORM SUBMISSIONS & SAVING ====================

window.handleProductSubmit = async function(e) {
  e.preventDefault();

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

 // Panggil saveState yang benar dari state.js
  await saveState();
  saveLocalStorageFallback();

  renderKatalogPage(state);
  window.closeModal('productModal');
  window.showToast?.(`Produk ${name} berhasil disimpan`, 'success');
};

window.confirmDeleteProduct = async function() {
  const docId = document.getElementById('deleteDocId')?.value;
  if (!docId || !appState.products) return;

  appState.products = appState.products.filter(p => p.docId !== docId);

 // Panggil saveState yang benar dari state.js
  await saveState();
  saveLocalStorageFallback();

  renderKatalogPage(appState);
  window.closeModal('deleteModal');
  window.showToast?.("Produk berhasil dihapus", "success");
};

window.handleTransactionSubmit = async function(e) {
  e.preventDefault();
  const docId = document.getElementById('transProductSelect')?.value;
  const type = document.querySelector('input[name="transType"]:checked')?.value;
  const product = appState.products?.find(p => p.docId === docId);
  if (!product) return;

  if (type === 'IN') {
    const qtyGood = parseInt(document.getElementById('transQtyGood')?.value, 10) || 0;
    const qtySupplierDamaged = parseInt(document.getElementById('transQtySupplierDamaged')?.value, 10) || 0;
    product.stock += qtyGood;
    product.supplierDamaged = (product.supplierDamaged || 0) + qtySupplierDamaged;
    window.showToast?.(`Kulakan Tercatat: +${qtyGood} Stok Bagus`, 'success');
  }

   // Panggil saveState yang benar dari state.js
  await saveState();
  saveLocalStorageFallback();

  renderKatalogPage(appState);
  window.closeModal('transactionModal');
};
