/**
 * REPORTS MODULE - Bolu Bu Eko Cashflow
 * Handles generation of Laporan Laba Rugi (Income Statement),
 * Laporan Arus Kas (Cashflow Statement), Print Preview, and CSV Export.
 */

class ReportsManager {
  constructor(dataManager) {
    this.dm = dataManager;
    this.currentPeriod = 'thisMonth';
    this.currentReportType = 'labarugi'; // 'labarugi' | 'aruskas'
    this.startDate = '';
    this.endDate = '';
    this.initDefaultDates();
  }

  initDefaultDates() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    this.startDate = toDateInputValue(start);
    this.endDate = toDateInputValue(now);
  }

  setPeriod(periodKey, customStart = '', customEnd = '') {
    this.currentPeriod = periodKey;
    const now = new Date();

    if (periodKey === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      this.startDate = toDateInputValue(start);
      this.endDate = toDateInputValue(now);
    } else if (periodKey === 'lastMonth') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      this.startDate = toDateInputValue(start);
      this.endDate = toDateInputValue(end);
    } else if (periodKey === 'thisYear') {
      const start = new Date(now.getFullYear(), 0, 1);
      this.startDate = toDateInputValue(start);
      this.endDate = toDateInputValue(now);
    } else if (periodKey === 'custom') {
      this.startDate = customStart || this.startDate;
      this.endDate = customEnd || this.endDate;
    }
  }

  /**
   * Calculate Laba Rugi (Profit & Loss Statement)
   */
  generateProfitAndLoss() {
    const transactions = this.dm.getTransactions({
      startDate: this.startDate,
      endDate: this.endDate
    });

    const products = this.dm.getProducts();
    const productCostMap = {};
    products.forEach(p => {
      productCostMap[p.id] = p.costPrice || 0;
      productCostMap[p.name] = p.costPrice || 0;
    });

    let totalRevenue = 0;
    let totalHPP = 0;
    const revenueByCategory = {};

    // Group expenses
    let totalOperatingExpense = 0;
    const expenseByCategory = {};

    transactions.forEach(t => {
      if (t.type === 'income') {
        const rev = Number(t.total || 0);
        totalRevenue += rev;
        const cat = t.category || 'Penjualan Bolu';
        revenueByCategory[cat] = (revenueByCategory[cat] || 0) + rev;

        // Calculate HPP based on product unit cost * quantity
        const qty = Number(t.quantity || 1);
        let unitCost = 0;
        if (t.productId && productCostMap[t.productId]) {
          unitCost = productCostMap[t.productId];
        } else if (t.productName && productCostMap[t.productName]) {
          unitCost = productCostMap[t.productName];
        } else {
          // If custom order without registered product, approximate HPP at 45% of price
          unitCost = (t.unitPrice || (rev / qty)) * 0.45;
        }
        totalHPP += unitCost * qty;
      } else {
        const exp = Number(t.amount || 0);
        totalOperatingExpense += exp;
        const cat = t.category || 'Lainnya';
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + exp;
      }
    });

    const grossProfit = totalRevenue - totalHPP;
    const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0;

    const netProfit = grossProfit - totalOperatingExpense;
    const netMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

    return {
      periodLabel: this.getPeriodDisplayLabel(),
      startDate: this.startDate,
      endDate: this.endDate,
      totalRevenue,
      revenueByCategory,
      totalHPP,
      grossProfit,
      grossMargin,
      totalOperatingExpense,
      expenseByCategory,
      netProfit,
      netMargin,
      transactionCount: transactions.length
    };
  }

  /**
   * Calculate Arus Kas (Cash Flow Statement)
   */
  generateCashflowStatement() {
    const transactions = this.dm.getTransactions({
      startDate: this.startDate,
      endDate: this.endDate
    });

    // Inflows by Payment Method
    const inflowByMethod = { Tunai: 0, Transfer: 0, QRIS: 0 };
    let totalInflow = 0;

    // Outflows by Payment Method & Category
    const outflowByMethod = { Tunai: 0, Transfer: 0, QRIS: 0 };
    const outflowByCategory = {};
    let totalOutflow = 0;

    transactions.forEach(t => {
      const method = t.paymentMethod || 'Tunai';
      if (t.type === 'income') {
        const amt = Number(t.total || 0);
        totalInflow += amt;
        inflowByMethod[method] = (inflowByMethod[method] || 0) + amt;
      } else {
        const amt = Number(t.amount || 0);
        totalOutflow += amt;
        outflowByMethod[method] = (outflowByMethod[method] || 0) + amt;
        const cat = t.category || 'Lainnya';
        outflowByCategory[cat] = (outflowByCategory[cat] || 0) + amt;
      }
    });

    const netCashflow = totalInflow - totalOutflow;

    return {
      periodLabel: this.getPeriodDisplayLabel(),
      startDate: this.startDate,
      endDate: this.endDate,
      totalInflow,
      inflowByMethod,
      totalOutflow,
      outflowByMethod,
      outflowByCategory,
      netCashflow,
      transactionCount: transactions.length
    };
  }

  getPeriodDisplayLabel() {
    if (this.currentPeriod === 'thisMonth') {
      const now = new Date();
      return `Bulan Ini (${Utils.getMonthName(now.getMonth())} ${now.getFullYear()})`;
    }
    if (this.currentPeriod === 'lastMonth') {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return `Bulan Lalu (${Utils.getMonthName(d.getMonth())} ${d.getFullYear()})`;
    }
    if (this.currentPeriod === 'thisYear') {
      const now = new Date();
      return `Tahun Berjalan (${now.getFullYear()})`;
    }
    return `Periode: ${Utils.formatDateIndo(this.startDate)} s/d ${Utils.formatDateIndo(this.endDate)}`;
  }

  /**
   * Render Report HTML View
   */
  renderReportView(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (this.currentReportType === 'labarugi') {
      container.innerHTML = this.buildProfitAndLossHtml();
    } else {
      container.innerHTML = this.buildCashflowHtml();
    }
  }

  buildProfitAndLossHtml() {
    const data = this.generateProfitAndLoss();
    const profile = this.dm.getProfile();

    let revenueRows = '';
    for (const [cat, amt] of Object.entries(data.revenueByCategory)) {
      revenueRows += `
        <tr>
          <td class="ps-4">Penjualan: ${cat}</td>
          <td class="text-end font-monospace">${Utils.formatRupiah(amt)}</td>
        </tr>
      `;
    }
    if (!revenueRows) {
      revenueRows = '<tr><td colspan="2" class="text-muted ps-4 py-2">Tidak ada pemasukan tercatat</td></tr>';
    }

    let expenseRows = '';
    for (const [cat, amt] of Object.entries(data.expenseByCategory)) {
      expenseRows += `
        <tr>
          <td class="ps-4">Beban ${cat}</td>
          <td class="text-end font-monospace text-danger">${Utils.formatRupiah(amt)}</td>
        </tr>
      `;
    }
    if (!expenseRows) {
      expenseRows = '<tr><td colspan="2" class="text-muted ps-4 py-2">Tidak ada beban operasional tercatat</td></tr>';
    }

    return `
      <div class="report-document" id="printableReport">
        <div class="report-header">
          <div class="report-brand">
            <h2>🍰 ${profile.name}</h2>
            <p class="tagline">${profile.tagline}</p>
            <p class="contact-info">${profile.address} | Telp: ${profile.phone}</p>
          </div>
          <div class="report-meta">
            <h3>LAPORAN LABA RUGI</h3>
            <span class="report-badge">${data.periodLabel}</span>
            <small class="d-block text-muted mt-1">Dicetak pada: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</small>
          </div>
        </div>

        <div class="report-table-wrapper">
          <table class="table-report">
            <thead>
              <tr>
                <th>Deskripsi Akun Keuangan</th>
                <th class="text-end" style="width: 220px;">Jumlah (Rupiah)</th>
              </tr>
            </thead>
            <tbody>
              <!-- PENDAPATAN USAHA -->
              <tr class="section-row">
                <td colspan="2"><strong>1. PENDAPATAN USAHA (REVENUE)</strong></td>
              </tr>
              ${revenueRows}
              <tr class="subtotal-row">
                <td><strong>Total Pendapatan Usaha (A)</strong></td>
                <td class="text-end font-monospace text-success"><strong>${Utils.formatRupiah(data.totalRevenue)}</strong></td>
              </tr>

              <!-- HPP -->
              <tr class="section-row">
                <td colspan="2"><strong>2. HARGA POKOK PENJUALAN (HPP)</strong></td>
              </tr>
              <tr>
                <td class="ps-4">Bahan Pokok & Biaya Langsung Produksi Bolu</td>
                <td class="text-end font-monospace">(${Utils.formatRupiah(data.totalHPP)})</td>
              </tr>
              <tr class="subtotal-row">
                <td><strong>Laba Kotor / Gross Profit (A - B)</strong> <small class="text-muted ms-2">(Margin: ${data.grossMargin}%)</small></td>
                <td class="text-end font-monospace ${data.grossProfit >= 0 ? 'text-success' : 'text-danger'}">
                  <strong>${Utils.formatRupiah(data.grossProfit)}</strong>
                </td>
              </tr>

              <!-- BEBAN OPERASIONAL -->
              <tr class="section-row">
                <td colspan="2"><strong>3. BEBAN OPERASIONAL TOKO & PRODUKSI</strong></td>
              </tr>
              ${expenseRows}
              <tr class="subtotal-row">
                <td><strong>Total Beban Operasional (C)</strong></td>
                <td class="text-end font-monospace text-danger"><strong>${Utils.formatRupiah(data.totalOperatingExpense)}</strong></td>
              </tr>

              <!-- LABA BERSIH -->
              <tr class="grand-total-row">
                <td>
                  <strong>LABA BERSIH USAHA (NET PROFIT)</strong>
                  <div class="small text-muted">Persentase Margin Bersih terhadap Omzet: <strong>${data.netMargin}%</strong></div>
                </td>
                <td class="text-end font-monospace ${data.netProfit >= 0 ? 'text-primary' : 'text-danger'}">
                  <strong>${Utils.formatRupiah(data.netProfit)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="report-signatures">
          <div class="signature-box">
            <p>Dibuat Oleh,</p>
            <div class="sig-line"></div>
            <p class="sig-name">Admin Keuangan</p>
          </div>
          <div class="signature-box">
            <p>Mengetahui,</p>
            <div class="sig-line"></div>
            <p class="sig-name">${profile.owner || 'Pemilik Usaha'}</p>
          </div>
        </div>
      </div>
    `;
  }

  buildCashflowHtml() {
    const data = this.generateCashflowStatement();
    const profile = this.dm.getProfile();

    let outflowRows = '';
    for (const [cat, amt] of Object.entries(data.outflowByCategory)) {
      outflowRows += `
        <tr>
          <td class="ps-4">Pengeluaran untuk: ${cat}</td>
          <td class="text-end font-monospace text-danger">(${Utils.formatRupiah(amt)})</td>
        </tr>
      `;
    }
    if (!outflowRows) {
      outflowRows = '<tr><td colspan="2" class="text-muted ps-4 py-2">Tidak ada pengeluaran kas tercatat</td></tr>';
    }

    return `
      <div class="report-document" id="printableReport">
        <div class="report-header">
          <div class="report-brand">
            <h2>🍰 ${profile.name}</h2>
            <p class="tagline">${profile.tagline}</p>
            <p class="contact-info">${profile.address} | Telp: ${profile.phone}</p>
          </div>
          <div class="report-meta">
            <h3>LAPORAN ARUS KAS (CASH FLOW)</h3>
            <span class="report-badge">${data.periodLabel}</span>
            <small class="d-block text-muted mt-1">Dicetak pada: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</small>
          </div>
        </div>

        <div class="report-table-wrapper">
          <table class="table-report">
            <thead>
              <tr>
                <th>Aktivitas Arus Kas</th>
                <th class="text-end" style="width: 220px;">Arus Kas (Rupiah)</th>
              </tr>
            </thead>
            <tbody>
              <!-- ARUS KAS MASUK -->
              <tr class="section-row">
                <td colspan="2"><strong>1. ARUS KAS MASUK DARI PENJUALAN (CASH INFLOW)</strong></td>
              </tr>
              <tr>
                <td class="ps-4">Penerimaan Kas / Tunai Langsung</td>
                <td class="text-end font-monospace text-success">${Utils.formatRupiah(data.inflowByMethod.Tunai || 0)}</td>
              </tr>
              <tr>
                <td class="ps-4">Penerimaan Rekening Bank (Transfer)</td>
                <td class="text-end font-monospace text-success">${Utils.formatRupiah(data.inflowByMethod.Transfer || 0)}</td>
              </tr>
              <tr>
                <td class="ps-4">Penerimaan Digital QRIS Toko</td>
                <td class="text-end font-monospace text-success">${Utils.formatRupiah(data.inflowByMethod.QRIS || 0)}</td>
              </tr>
              <tr class="subtotal-row">
                <td><strong>Total Arus Kas Masuk</strong></td>
                <td class="text-end font-monospace text-success"><strong>${Utils.formatRupiah(data.totalInflow)}</strong></td>
              </tr>

              <!-- ARUS KAS KELUAR -->
              <tr class="section-row">
                <td colspan="2"><strong>2. ARUS KAS KELUAR OPERASIONAL (CASH OUTFLOW)</strong></td>
              </tr>
              ${outflowRows}
              <tr class="subtotal-row">
                <td><strong>Total Arus Kas Keluar</strong></td>
                <td class="text-end font-monospace text-danger"><strong>(${Utils.formatRupiah(data.totalOutflow)})</strong></td>
              </tr>

              <!-- ARUS KAS BERSIH -->
              <tr class="grand-total-row">
                <td>
                  <strong>KENAIKAN / (PENURUNAN) BERSIH KAS</strong>
                  <div class="small text-muted">Surplus / (Defisit) Likuiditas Kas Operasional Toko</div>
                </td>
                <td class="text-end font-monospace ${data.netCashflow >= 0 ? 'text-primary' : 'text-danger'}">
                  <strong>${Utils.formatRupiah(data.netCashflow)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="report-signatures">
          <div class="signature-box">
            <p>Dibuat Oleh,</p>
            <div class="sig-line"></div>
            <p class="sig-name">Admin Keuangan</p>
          </div>
          <div class="signature-box">
            <p>Disetujui Oleh,</p>
            <div class="sig-line"></div>
            <p class="sig-name">${profile.owner || 'Pemilik Usaha'}</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Export All or Filtered Transactions to CSV
   */
  exportToCSV() {
    const list = this.dm.getTransactions({
      startDate: this.startDate,
      endDate: this.endDate
    });

    const headers = ['ID', 'Tipe', 'Tanggal', 'Kategori', 'Deskripsi/Produk', 'Jumlah/Qty', 'Harga Satuan', 'Total/Nominal', 'Metode Pembayaran', 'Keterangan'];
    const rows = list.map(t => {
      const isIncome = t.type === 'income';
      return [
        t.id,
        isIncome ? 'Pemasukan' : 'Pengeluaran',
        t.date,
        t.category || '',
        `"${(isIncome ? t.productName : t.description || '').replace(/"/g, '""')}"`,
        isIncome ? t.quantity : 1,
        isIncome ? t.unitPrice : t.amount,
        isIncome ? t.total : t.amount,
        t.paymentMethod || 'Tunai',
        `"${(t.notes || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Bolu_Bu_Eko_${this.startDate}_sd_${this.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  printReport() {
    window.print();
  }
}

window.ReportsManager = ReportsManager;
