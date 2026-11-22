import { state, saveState } from '../state.js';

let searchKeyword = '';
let selectedCategory = 'ALL';
let activeViewingNote = null;

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

function showCenterModal(modal) {
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
}

function hideCenterModal(modal) {
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  modal.style.display = 'none';
}

// --- HELPER GLOBAL MODAL (Agar onclick="closeModal('deleteNoteModal')" selalu berjalan) ---
window.openModal = window.openModal || function (modalId) {
  showCenterModal(document.getElementById(modalId));
};

window.closeModal = window.closeModal || function (modalId) {
  hideCenterModal(document.getElementById(modalId));
};

// --- MODAL BACA PENUH (PREVIEW) ---
window.openViewNoteModal = function (noteId) {
  const note = (state.notes || []).find((n) => String(n.id) === String(noteId));
  if (!note) return;

  activeViewingNote = note;
  const modal = document.getElementById('viewNoteModal');
  if (!modal) return;

  const catBadge = document.getElementById('viewNoteCategory');
  if (catBadge) {
    catBadge.textContent = note.category || 'Umum';
    catBadge.className = `inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border mb-1.5 ${getCategoryStyle(note.category)}`;
  }

  document.getElementById('viewNoteTitle').textContent = note.title || '';
  document.getElementById('viewNoteContent').textContent = note.content || '';
  document.getElementById('viewNoteDate').textContent = `Diperbarui: ${formatDateTime(note.updatedAt || note.createdAt)}`;

  const editBtn = document.getElementById('viewNoteEditBtn');
  if (editBtn) {
    editBtn.onclick = () => {
      window.closeViewNoteModal();
      window.openEditNoteModal(note.id);
    };
  }

  showCenterModal(modal);
};

window.closeViewNoteModal = function () {
  activeViewingNote = null;
  hideCenterModal(document.getElementById('viewNoteModal'));
};

window.copyCurrentNote = async function () {
  if (!activeViewingNote) return;
  try {
    const textToCopy = `${activeViewingNote.title}\n\n${activeViewingNote.content}`;
    await navigator.clipboard.writeText(textToCopy);
    notify('Isi catatan disalin ke clipboard.');
  } catch {
    notify('Gagal menyalin teks.', 'error');
  }
};

// --- MODAL TAMBAH & EDIT CATATAN ---
window.openCreateNoteModal = function () {
  const modal = document.getElementById('noteModal');
  if (!modal) return;

  document.getElementById('noteForm')?.reset();
  document.getElementById('noteId').value = '';
  document.getElementById('noteModalTitle').textContent = 'Buat Catatan Baru';

  showCenterModal(modal);
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

  showCenterModal(modal);
};

window.closeNoteModal = function () {
  hideCenterModal(document.getElementById('noteModal'));
};

// --- TOGGLE PIN CATATAN ---
window.togglePinNote = async function (noteId) {
  state.notes = (state.notes || []).map((n) =>
    String(n.id) === String(noteId) ? { ...n, pinned: !n.pinned } : n
  );

  renderCatatanPage(state);
  await saveState();
  notify('Status sematan catatan diperbarui.');
};

// --- BUKA MODAL KONFIRMASI HAPUS & EKSEKUSI HAPUS ---
window.deleteNote = function (noteId) {
  if (!noteId) return;

  const note = (state.notes || []).find((n) => String(n.id) === String(noteId));
  const idInput = document.getElementById('deleteNoteId');
  const nameLabel = document.getElementById('deleteNoteName');

  if (idInput) idInput.value = noteId;
  if (nameLabel) {
    nameLabel.textContent = note?.title
      ? `Catatan "${note.title}" akan dihapus permanen.`
      : 'Catatan ini akan dihapus permanen.';
  }

  showCenterModal(document.getElementById('deleteNoteModal'));
};

window.confirmDeleteNote = async function () {
  const targetId = document.getElementById('deleteNoteId')?.value;
  if (!targetId) return;

  state.notes = (state.notes || []).filter((n) => String(n.id) !== String(targetId));

  hideCenterModal(document.getElementById('deleteNoteModal'));
  renderCatatanPage(state);
  await saveState();
  notify('Catatan berhasil dihapus.');
};

// --- RENDER DAFTAR CATATAN ---
export function renderCatatanPage(currentState = state) {
  const grid = document.getElementById('notesGridContainer');
  if (!grid) return;

  const allNotes = currentState.notes || [];

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
        <div onclick="openViewNoteModal('${note.id}')" class="h-60 bg-white rounded-2xl p-4 border ${cardBorder} shadow-sm hover:shadow-md hover:border-indigo-300 transition cursor-pointer flex flex-col justify-between overflow-hidden group">
          <div class="overflow-hidden">
            <div class="flex items-center justify-between gap-2 mb-2.5">
              <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full border truncate ${badgeStyle}">
                ${escapeHTML(note.category || 'Umum')}
              </span>
              <button onclick="event.stopPropagation(); togglePinNote('${note.id}')" title="${note.pinned ? 'Lepas Sematan' : 'Sematkan Catatan'}" class="w-7 h-7 shrink-0 rounded-lg border flex items-center justify-center transition text-xs ${pinBtnStyle}">
                <i class="fa-solid fa-thumbtack"></i>
              </button>
            </div>

            <h3 class="font-bold text-slate-800 text-sm mb-1.5 line-clamp-1 group-hover:text-indigo-600 transition">
              ${escapeHTML(note.title)}
            </h3>

            <p class="text-xs text-slate-500 whitespace-pre-line leading-relaxed break-words line-clamp-4 overflow-hidden">
              ${escapeHTML(note.content)}
            </p>
          </div>

          <div class="pt-2.5 border-t border-slate-100 flex items-center justify-between shrink-0">
            <span class="text-[10px] text-slate-400 truncate">
              <i class="fa-regular fa-clock mr-1"></i>${formatDateTime(note.updatedAt || note.createdAt)}
            </span>
            <div class="flex items-center space-x-1 shrink-0">
              <button onclick="event.stopPropagation(); openEditNoteModal('${note.id}')" title="Edit Catatan" class="px-2 py-1 rounded-lg text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 transition">
                <i class="fa-solid fa-pen-to-square mr-0.5"></i>Edit
              </button>
              <button onclick="event.stopPropagation(); deleteNote('${note.id}')" title="Hapus Catatan" class="p-1.5 rounded-lg text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition">
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
      state.notes = (state.notes || []).map((n) =>
        String(n.id) === String(editId)
          ? { ...n, title, category, pinned, content, updatedAt: now }
          : n
      );
      notify('Perubahan catatan berhasil disimpan.');
    } else {
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
