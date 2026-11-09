import { formatIDR } from '../utils.js';

let currentPage = 1;
const itemsPerPage = 10;

export function renderKatalogPage(state) {
  const tbody = document.getElementById('masterTableBody');
  if (!tbody) return; // Keluar jika bukan halaman katalog.html

  const startIdx = (currentPage - 1) * itemsPerPage;
  const pageItems = state.products.slice(startIdx, startIdx + itemsPerPage);

  tbody.innerHTML = pageItems.map(item => `
    <tr class="hover:bg-slate-50 transition border-b border-slate-100 text-xs">
      <td class="py-3 px-4 font-mono font-semibold text-indigo-600">${item.id}</td>
      <td class="py-3 px-4 font-bold text-slate-800">${item.name}</td>
      <td class="py-3 px-4">${item.category}</td>
      <td class="py-3 px-4 text-right font-extrabold">${item.stock} Pcs</td>
      <td class="py-3 px-4 text-right">${formatIDR(item.hpp)}</td>
      <td class="py-3 px-4 text-right text-emerald-600 font-semibold">${formatIDR(item.price)}</td>
      <td class="py-3 px-4 text-right font-bold">${formatIDR(item.stock * item.hpp)}</td>
      <td class="py-3 px-4 text-center">
        <button onclick="editProduct('${item.docId}')" class="p-1 text-indigo-600"><i class="fa-solid fa-pen"></i></button>
      </td>
    </tr>
  `).join('');
}
