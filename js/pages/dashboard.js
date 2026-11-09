import { formatIDR } from '../utils.js';

let outgoingChart, donutChart, categoryChart;

export function renderDashboardPage(state) {
  if (!document.getElementById('kpiTotalAssetValue')) return; // Keluar jika bukan halaman index.html

  const totalStockPcs = state.products.reduce((sum, p) => sum + Number(p.stock), 0);
  const totalAssetValue = state.products.reduce((sum, p) => sum + (Number(p.stock) * Number(p.hpp || 0)), 0);
  const totalTurnoverPotential = state.products.reduce((sum, p) => sum + (Number(p.stock) * Number(p.price || 0)), 0);
  
  const elAsset = document.getElementById('kpiTotalAssetValue');
  if (elAsset) elAsset.innerText = formatIDR(totalAssetValue);

  const elPcs = document.getElementById('kpiTotalStockPcs');
  if (elPcs) elPcs.innerText = totalStockPcs.toLocaleString('id-ID');

  renderDashboardCharts(state);
}

function renderDashboardCharts(state) {
  const ctxOut = document.getElementById('financialOutgoingChart')?.getContext('2d');
  if (!ctxOut) return;

  const sortedOut = [...state.products].sort((a, b) => (b.outgoing * (b.price || 0)) - (a.outgoing * (a.price || 0))).slice(0, 5);
  
  if (outgoingChart) outgoingChart.destroy();
  outgoingChart = new Chart(ctxOut, {
    type: 'bar',
    data: {
      labels: sortedOut.map(p => p.name),
      datasets: [{ label: 'Omset Terjual (Rp)', data: sortedOut.map(p => p.outgoing * (p.price || 0)), backgroundColor: '#10b981' }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}
