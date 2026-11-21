import { state, saveState } from '../state.js';

let searchKeyword = '';
let selectedCategory = 'ALL';

// --- HELPER NOTIFIKASI & KEAMANAN TEKS ---
const notify = (message, type = 'success') => {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
    return;
  }
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const bgColor = type === 'error' ? 'bg-rose-600' : 'bg-slate-900';
  const icon = type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check text-emerald-400';

  const toast = document.createElement('div');
  toast.className = `${bgColor} text-white px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center space-x-2.5 transition-all duration-300`;
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};

function escapeHTML(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getCategoryStyle(category) {
  switch (category) {
    case 'Restock & Supplier':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Packing & Order':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Keuangan & Penting':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  }
}

function formatDateTime(isoString) {
  if (!isoString) return '-';
  try {
    return new Date(isoString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

// --- MODAL HANDLERS (CREATE & EDIT) ---
window.openCreateNoteModal = function () {
  const modal = document.getElementById('noteModal');
  if (!modal) return;

  document.getElementById('noteForm')?.reset();
  document.getElementById('noteId').value = '';
  document.getElementById('noteModalTitle').textContent = 'Buat Catatan Baru';

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
};

window.openEditNoteModal = function (noteId) {
  const note = (state.notes || []).find((n) => String(n.id) === String(noteId));
  if (!note) return;

  const modal = document.getElementById('noteModal');
  if (!modal) return;

  document.getElementById('noteId').value = note.id;
  document.getElementById('noteTitle').value = note.title || '';
  document.getElementById('noteCategory').value = note.category || 'Umum';
  document.getElementById('notePinned').checked = Boolean(note.pinned);
  document.getElementById('noteContent').value = note.content || '';
  document.getElementById('noteModalTitle').textContent = 'Edit Catatan';

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
};

window.closeNoteModal = function () {
  const modal = document.getElementById('noteModal');
  if (!modal) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');
  modal.style.display = 'none';
};

// --- TOGGLE PIN & HAPUS CATATAN ---
window.togglePinNote = async function (noteId) {
  state.notes = (state.notes || []).map((n) =>
    String(n.id) === String(noteId) ? { ...n, pinned: !n.pinned } : n
  );

  renderCatatanPage(state);
  await saveState();
  notify('Status sematan catatan diperbarui.');
};

window.deleteNote = async function (noteId) {
  if (!noteId) return;
  if (!confirm('Hapus catatan ini secara permanen?')) return;

  state.notes = (state.notes || []).filter((n) => String(n.id) !== String(noteId));

  renderCatatanPage(state);
  await saveState();
  notify('Catatan berhasil dihapus.');
};

// --- RENDER DAFTAR CATATAN ---
export function renderCatatanPage(currentState = state) {
  const grid = document.getElementById('notesGridContainer');
  // Guard Clause: hentikan jika sedang berada di halaman HTML selain catatan.html
  if (!grid) return;

  const allNotes = currentState.notes || [];

  // Filter lokal berdasarkan pencarian dan kategori (tanpa memakan kuota Firestore)
  const filteredNotes = allNotes
    .filter((note) => {
      const matchCategory = selectedCategory === 'ALL' || note.category === selectedCategory;
      const keyword = searchKeyword.toLowerCase();
      const matchSearch =
        !keyword ||
        (note.title || '').toLowerCase().includes(keyword) ||
        (note.content || '').toLowerCase().includes(keyword);
      return matchCategory && matchSearch;
    })
    // Urutkan catatan yang disematkan (pinned) di posisi paling atas
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));

  const countBadge = document.getElementById('notesCountBadge');
  if (countBadge) {
    countBadge.textContent = `${filteredNotes.length} Catatan`;
  }

  if (filteredNotes.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
        <div class="w-12 h-12 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto mb-3">
          <i class="fa-solid fa-note-sticky text-xl"></i>
        </div>
        <h3 class="text-sm font-bold text-slate-700">Belum ada catatan ditemukan</h3>
        <p class="text-xs text-slate-400 mt-1">Klik tombol <strong>Buat Catatan</strong> untuk menyimpan pengingat atau daftar restock baru.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filteredNotes
    .map((note) => {
      const badgeStyle = getCategoryStyle(note.category);
      const pinBtnStyle = note.pinned
        ? 'text-amber-500 bg-amber-50 border-amber-200'
        : 'text-slate-400 hover:text-amber-500 border-transparent hover:bg-slate-50';
      const cardBorder = note.pinned ? 'border-amber-300 ring-1 ring-amber-200/60' : 'border-slate-200';

      return `
        <div class="bg-white rounded-2xl p-5 border ${cardBorder} shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2 mb-3">
              <span class="text-[10px] font-bold px-2.5 py-1 rounded-full border ${badgeStyle}">
                ${escapeHTML(note.category || 'Umum')}
              </span>
              <button onclick="togglePinNote('${note.id}')" title="${note.pinned ? 'Lepas Sematan' : 'Sematkan Catatan'}" class="w-7 h-7 rounded-lg border flex items-center justify-center transition text-xs ${pinBtnStyle}">
                <i class="fa-solid fa-thumbtack"></i>
              </button>
            </div>
            <h3 class="font-bold text-slate-800 text-sm mb-2 leading-snug">${escapeHTML(note.title)}</h3>
            <p class="text-xs text-slate-600 whitespace-pre-line leading-relaxed break-words">${escapeHTML(note.content)}</p>
          </div>

          <div class="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span class="text-[10px] text-slate-400">
              <i class="fa-regular fa-clock mr-1"></i>${formatDateTime(note.updatedAt || note.createdAt)}
            </span>
            <div class="flex items-center space-x-1">
              <button onclick="openEditNoteModal('${note.id}')" title="Edit Catatan" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition">
                <i class="fa-solid fa-pen-to-square mr-1"></i>Edit
              </button>
              <button onclick="deleteNote('${note.id}')" title="Hapus Catatan" class="p-1.5 rounded-lg text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

// --- EVENT LISTENER PENCARIAN, FILTER & FORM SUBMIT ---
document.addEventListener('input', (e) => {
  if (e.target.id === 'noteSearchInput') {
    searchKeyword = e.target.value.trim();
    renderCatatanPage(state);
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'noteCategoryFilter') {
    selectedCategory = e.target.value;
    renderCatatanPage(state);
  }
});

document.addEventListener('submit', async (e) => {
  if (e.target.id === 'noteForm') {
    e.preventDefault();

    const editId = document.getElementById('noteId')?.value.trim();
    const title = document.getElementById('noteTitle')?.value.trim();
    const category = document.getElementById('noteCategory')?.value || 'Umum';
    const pinned = Boolean(document.getElementById('notePinned')?.checked);
    const content = document.getElementById('noteContent')?.value.trim();

    if (!title || !content) {
      notify('Judul dan isi catatan wajib diisi.', 'error');
      return;
    }

    const now = new Date().toISOString();

    if (editId) {
      // Mode Edit Catatan
      state.notes = (state.notes || []).map((n) =>
        String(n.id) === String(editId)
          ? { ...n, title, category, pinned, content, updatedAt: now }
          : n
      );
      notify('Perubahan catatan berhasil disimpan.');
    } else {
      // Mode Buat Catatan Baru
      const newNote = {
        id: Date.now().toString(),
        title,
        category,
        pinned,
        content,
        createdAt: now,
        updatedAt: now
      };
      state.notes = [newNote, ...(state.notes || [])];
      notify('Catatan baru berhasil ditambahkan.');
    }

    e.target.reset();
    window.closeNoteModal();
    renderCatatanPage(state);
    await saveState();
  }
});
