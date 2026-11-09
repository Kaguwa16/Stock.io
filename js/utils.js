export function formatIDR(amount) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount || 0);
}

export function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  const iconClass = type === 'error' ? 'fa-circle-xmark text-rose-500' : (type === 'warning' ? 'fa-triangle-exclamation text-amber-500' : 'fa-circle-check text-emerald-500');
  const borderClass = type === 'error' ? 'border-rose-200' : (type === 'warning' ? 'border-amber-200' : 'border-emerald-200');

  toast.className = `pointer-events-auto flex items-center space-x-3 bg-white border ${borderClass} px-4 py-3 rounded-xl shadow-lg transform transition-all duration-300 translate-y-2 opacity-0 max-w-sm`;
  toast.innerHTML = `<i class="fa-solid ${iconClass} text-lg"></i><p class="text-xs font-semibold text-slate-700 leading-tight">${message}</p>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

export function initRealtimeClock() {
  const clockEl = document.getElementById('realtimeClock');
  if (!clockEl) return;
  const update = () => {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    clockEl.innerHTML = `<i class="fa-regular fa-clock text-indigo-500"></i> ${now.toLocaleDateString('id-ID', options)} WIB`;
  };
  update();
  setInterval(update, 1000);
}
