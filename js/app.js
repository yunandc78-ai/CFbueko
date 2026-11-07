/**
 * MAIN APPLICATION LOGIC - Bolu Bu Eko Cashflow Manager
 * Handles UI interactions, view routing, modals, table rendering,
 * form submission, search & filters, toast notifications, and dark mode.
 */

function initApp() {
  if (!window.app) {
    window.app = new CashflowApp();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

class CashflowApp {
  constructor() {
    this.dm = window.dataManager;
    this.reports = new ReportsManager(this.dm);

    // Active state
    this.currentView = 'dashboard';
    this.incomeFilter = { search: '', category: 'Semua', paymentMethod: 'Semua', period: 'all' };
    this.expenseFilter = { search: '', category: 'Semua', paymentMethod: 'Semua', period: 'all' };
    this.productFilter = { search: '', category: 'Semua' };

    // Modals & confirmation tracking
    this.editingTrxId = null;
    this.editingProdId = null;
    this.editingRecId = null;
    this.pendingConfirmCallback = null;

    this.init();
  }

  init() {
    this.initTheme();
    this.initNavigation();
    this.initDatePickers();
    this.initModals();
    this.initEventListeners();

    // Render current route or default dashboard
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    this.navigate(hash);

    // Refresh charts on window resize
    window.addEventListener('resize', () => {
      if (this.currentView === 'dashboard') {
        this.renderDashboardCharts();
      } else if (this.currentView === 'reports') {
        this.renderReportsChart();
      }
    });
  }

  // ==========================================
  // THEME & DARK MODE
  // ==========================================
  initTheme() {
    const settings = this.dm.getSettings();
    if (settings.darkMode) {
      document.body.classList.add('dark-theme');
    }

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-theme');
        settings.darkMode = isDark;
        this.dm.saveSettings(settings);
        this.updateThemeIcons(isDark);
        // Redraw charts with new theme colors
        if (this.currentView === 'dashboard') this.renderDashboardCharts();
        if (this.currentView === 'reports') this.renderReportsChart();
        this.showToast(isDark ? 'Mode Gelap diaktifkan' : 'Mode Terang diaktifkan', 'info');
      });
      this.updateThemeIcons(settings.darkMode);
    }
  }

  updateThemeIcons(isDark) {
    const icon = document.getElementById('themeToggleIcon');
    const label = document.getElementById('themeToggleLabel');
    if (icon) icon.textContent = isDark ? '☀️' : '🌙';
    if (label) label.textContent = isDark ? 'Mode Terang' : 'Mode Gelap';
  }

  // ==========================================
  // NAVIGATION & ROUTING
  // ==========================================
  initNavigation() {
    const navLinks = document.querySelectorAll('.nav-item[data-view]');
    navLinks.forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const targetView = link.getAttribute('data-view');
        this.navigate(targetView);

        // Auto close mobile drawer if open
        const sidebar = document.getElementById('appSidebar');
        if (sidebar && sidebar.classList.contains('mobile-open')) {
          sidebar.classList.remove('mobile-open');
        }
      });
    });

    // Mobile sidebar toggle button
    const mobileMenuBtn = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('appSidebar');
    if (mobileMenuBtn && sidebar) {
      mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
    }

    // Hash change listener
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      if (hash !== this.currentView) {
        this.navigate(hash);
      }
    });
  }

  navigate(viewName) {
    const views = ['dashboard', 'income', 'expense', 'products', 'reports', 'settings'];
    if (!views.includes(viewName)) viewName = 'dashboard';

    this.currentView = viewName;
    window.location.hash = viewName;

    // Update active nav link
    document.querySelectorAll('.nav-item').forEach(link => {
      if (link.getAttribute('data-view') === viewName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update view panels
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    const activePanel = document.getElementById(`view-${viewName}`);
    if (activePanel) {
      activePanel.classList.add('active');
    }

    // Render corresponding view data
    this.renderCurrentView();
  }

  renderCurrentView() {
    switch (this.currentView) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'income':
        this.renderIncomeView();
        break;
      case 'expense':
        this.renderExpenseView();
        break;
      case 'products':
        this.renderProductsView();
        break;
      case 'reports':
        this.renderReportsView();
        break;
      case 'settings':
        this.renderSettingsView();
        break;
    }
  }

  initDatePickers() {
    const today = toDateInputValue(new Date());
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
      if (!input.value && !input.hasAttribute('data-no-default')) {
        input.value = today;
      }
    });
  }

  // ==========================================
  // DASHBOARD VIEW
  // ==========================================
  renderDashboard() {
    // 1. Summaries for Today, This Week, This Month
    const sumToday = this.dm.getFinancialSummary('today');
    const sumWeek = this.dm.getFinancialSummary('thisWeek');
    const sumMonth = this.dm.getFinancialSummary('thisMonth');

    // Update Top Summary Cards (This Month primary)
    this.updateElementText('dashTotalIncome', Utils.formatRupiah(sumMonth.totalIncome));
    this.updateElementText('dashTotalExpense', Utils.formatRupiah(sumMonth.totalExpense));
    this.updateElementText('dashNetProfit', Utils.formatRupiah(sumMonth.netProfit));

    // Profit indicator style
    const profitEl = document.getElementById('dashNetProfit');
    if (profitEl) {
      profitEl.className = 'summary-value ' + (sumMonth.netProfit >= 0 ? 'text-profit' : 'text-danger');
    }

    // Mini sub-stats for Today & Week
    this.updateElementText('dashTodayIncome', Utils.formatRupiah(sumToday.totalIncome));
    this.updateElementText('dashTodayExpense', Utils.formatRupiah(sumToday.totalExpense));
    this.updateElementText('dashTodayProfit', Utils.formatRupiah(sumToday.netProfit));

    this.updateElementText('dashWeekIncome', Utils.formatRupiah(sumWeek.totalIncome));
    this.updateElementText('dashWeekExpense', Utils.formatRupiah(sumWeek.totalExpense));
    this.updateElementText('dashWeekProfit', Utils.formatRupiah(sumWeek.netProfit));

    // 2. Unusual Expense Alert
    this.renderUnusualExpenseAlert();

    // 3. Render Charts
    this.renderDashboardCharts();

    // 4. Top Selling Products
    this.renderTopProductsList();

    // 5. Recent Activity List
    this.renderRecentActivities();
  }

  renderUnusualExpenseAlert() {
    const container = document.getElementById('unusualExpenseAlertBox');
    if (!container) return;

    const unusual = this.dm.detectUnusualExpenses();
    if (unusual.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    let itemsHtml = '';
    unusual.slice(0, 3).forEach(item => {
      itemsHtml += `
        <div class="unusual-item">
          <span>⚠️ <strong>${item.description}</strong> (${item.category}) - ${Utils.formatRupiah(item.amount)} pada ${Utils.formatDateIndo(item.date)}</span>
          <span class="badge badge-warning">${item.ratio}x di atas rata-rata</span>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="alert-box alert-warning animate-fade">
        <div class="alert-header">
          <span class="alert-title">🔍 Peringatan Pengeluaran Tidak Biasa / Bernilai Besar</span>
          <button type="button" class="btn-close-alert" onclick="document.getElementById('unusualExpenseAlertBox').style.display='none'">&times;</button>
        </div>
        <p class="alert-desc">Sistem mendeteksi transaksi pengeluaran terbaru yang jauh melebihi rata-rata pengeluaran bakery Anda:</p>
        <div class="unusual-list">${itemsHtml}</div>
      </div>
    `;
  }

  renderDashboardCharts() {
    requestAnimationFrame(() => {
      // Monthly Cashflow Bar Chart
      const monthlyData = this.dm.getMonthlyTrends(6);
      BakeryCharts.renderCashflowBarChart('cashflowCanvas', monthlyData);

      // Expense Donut Chart for this month
      const now = new Date();
      const startOfMonth = toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
      const endOfMonth = toDateInputValue(now);
      const catData = this.dm.getExpenseByCategory(startOfMonth, endOfMonth);
      BakeryCharts.renderExpenseDonutChart('expenseDonutCanvas', 'expenseDonutLegend', catData);
    });
  }

  renderTopProductsList() {
    const container = document.getElementById('topProductsContainer');
    if (!container) return;

    const topList = this.dm.getTopProducts(5);
    if (topList.length === 0) {
      container.innerHTML = '<p class="text-muted text-center py-4">Belum ada data penjualan produk</p>';
      return;
    }

    const maxQty = Math.max(...topList.map(p => p.totalQuantity), 1);

    let html = '<div class="top-products-list">';
    topList.forEach((prod, idx) => {
      const percentage = Math.round((prod.totalQuantity / maxQty) * 100);
      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

      html += `
        <div class="top-product-item">
          <div class="top-product-rank">${medals[idx] || (idx + 1)}</div>
          <div class="top-product-details">
            <div class="top-product-header">
              <span class="top-product-name">${prod.name}</span>
              <span class="top-product-qty"><strong>${prod.totalQuantity}</strong> box</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${percentage}%"></div>
            </div>
            <div class="top-product-footer">
              <small class="text-muted">${prod.category}</small>
              <span class="top-product-rev text-success">${Utils.formatRupiah(prod.totalRevenue)}</span>
            </div>
          </div>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
  }

  renderRecentActivities() {
    const container = document.getElementById('recentActivityList');
    if (!container) return;

    const all = this.dm.getTransactions();
    const recent = all.slice(0, 5);

    if (recent.length === 0) {
      container.innerHTML = '<p class="text-muted text-center py-4">Belum ada transaksi</p>';
      return;
    }

    let html = '<div class="activity-timeline">';
    recent.forEach(t => {
      const isIncome = t.type === 'income';
      const icon = isIncome ? '💰' : '💸';
      const title = isIncome ? (t.productName || 'Penjualan') : (t.description || 'Pengeluaran');
      const amt = isIncome ? t.total : t.amount;
      const amtClass = isIncome ? 'text-success' : 'text-danger';
      const prefix = isIncome ? '+' : '-';

      html += `
        <div class="activity-item">
          <div class="activity-icon ${isIncome ? 'income' : 'expense'}">${icon}</div>
          <div class="activity-info">
            <div class="activity-title">${title}</div>
            <div class="activity-meta">
              <span>${Utils.formatDateIndo(t.date)}</span> &bull; 
              <span class="badge badge-light">${t.category}</span> &bull;
              <span>${t.paymentMethod}</span>
            </div>
          </div>
          <div class="activity-amount ${amtClass}">${prefix} ${Utils.formatRupiah(amt)}</div>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
  }

  // ==========================================
  // INCOME VIEW
  // ==========================================
  renderIncomeView() {
    this.renderQuickAddButtons();
    this.renderIncomeCategoryFilter();
    this.renderIncomeTable();
  }

  renderQuickAddButtons() {
    const container = document.getElementById('quickAddProductsContainer');
    if (!container) return;

    const products = this.dm.getProducts(true).filter(p => p.isFavorite || true).slice(0, 6);
    if (products.length === 0) {
      container.innerHTML = '<span class="text-muted small">Tambahkan produk favorit di menu Produk untuk akses cepat</span>';
      return;
    }

    let html = '';
    products.forEach(p => {
      html += `
        <button type="button" class="btn btn-quick-add" onclick="app.quickAddIncome('${p.id}')">
          <span class="quick-icon">🧁</span>
          <span class="quick-title">${p.name}</span>
          <span class="quick-price">${Utils.formatRupiah(p.price)}</span>
        </button>
      `;
    });
    container.innerHTML = html;
  }

  quickAddIncome(productId) {
    const prod = this.dm.getProductById(productId);
    if (!prod) return;

    this.openIncomeModal();
    // Pre-fill form
    const prodSelect = document.getElementById('incomeProductSelect');
    if (prodSelect) {
      prodSelect.value = prod.id;
      this.onIncomeProductChanged(prod.id);
    }
  }

  renderIncomeCategoryFilter() {
    const select = document.getElementById('incomeCategoryFilter');
    if (!select || select.options.length > 1) return;

    PRODUCT_CATEGORIES.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
  }

  renderIncomeTable() {
    const tbody = document.getElementById('incomeTableBody');
    if (!tbody) return;

    const filter = {
      type: 'income',
      search: this.incomeFilter.search,
      category: this.incomeFilter.category,
      paymentMethod: this.incomeFilter.paymentMethod
    };

    // Apply Period Filter
    this.applyPeriodFilter(filter, this.incomeFilter.period);

    const list = this.dm.getTransactions(filter);

    // Update total badge
    const totalSum = list.reduce((sum, item) => sum + Number(item.total || 0), 0);
    this.updateElementText('incomeFilteredTotal', Utils.formatRupiah(totalSum));
    this.updateElementText('incomeFilteredCount', `${list.length} Transaksi`);

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-5 text-muted">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">🍰</div>
            <div>Tidak ada data pemasukan yang cocok dengan filter.</div>
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = '';
    list.forEach(t => {
      rowsHtml += `
        <tr>
          <td><span class="font-monospace text-muted small">${t.id}</span></td>
          <td><strong>${Utils.formatDateIndo(t.date)}</strong></td>
          <td>
            <div class="fw-semibold text-primary-dark">${t.productName || '-'}</div>
            ${t.notes ? `<small class="text-muted">${t.notes}</small>` : ''}
          </td>
          <td><span class="badge badge-category">${t.category}</span></td>
          <td class="text-center font-monospace">${t.quantity || 1}</td>
          <td class="text-end font-monospace">${Utils.formatRupiah(t.unitPrice || t.total)}</td>
          <td class="text-end font-monospace fw-bold text-success">${Utils.formatRupiah(t.total)}</td>
          <td class="text-center"><span class="badge badge-method method-${(t.paymentMethod || 'tunai').toLowerCase()}">${t.paymentMethod}</span></td>
          <td class="text-center">
            <div class="table-actions">
              <button class="btn-icon text-primary" title="Edit" onclick="app.editIncome('${t.id}')">✏️</button>
              <button class="btn-icon text-danger" title="Hapus" onclick="app.confirmDeleteTransaction('${t.id}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = rowsHtml;
  }

  // ==========================================
  // EXPENSE VIEW
  // ==========================================
  renderExpenseView() {
    this.renderExpenseCategoryFilter();
    this.renderRecurringPrompt();
    this.renderExpenseTable();
  }

  renderExpenseCategoryFilter() {
    const select = document.getElementById('expenseCategoryFilter');
    if (!select || select.options.length > 1) return;

    EXPENSE_CATEGORIES.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
  }

  renderRecurringPrompt() {
    const container = document.getElementById('recurringPromptContainer');
    if (!container) return;

    const recurring = this.dm.getRecurring();
    if (recurring.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    const totalRecurring = recurring.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    container.innerHTML = `
      <div class="recurring-banner">
        <div class="recurring-banner-content">
          <span class="recurring-icon">🔄</span>
          <div>
            <strong>Pengeluaran Rutin Bulanan (${recurring.length} item)</strong>
            <div class="small text-muted">Estimasi total rutin: ${Utils.formatRupiah(totalRecurring)} / bulan</div>
          </div>
        </div>
        <div class="recurring-banner-actions">
          <button type="button" class="btn btn-outline-secondary btn-sm" onclick="app.openRecurringManagerModal()">
            ⚙️ Kelola Rutin
          </button>
          <button type="button" class="btn btn-primary btn-sm" onclick="app.applyAllRecurringThisMonth()">
            ⚡ Terapkan ke Bulan Ini
          </button>
        </div>
      </div>
    `;
  }

  renderExpenseTable() {
    const tbody = document.getElementById('expenseTableBody');
    if (!tbody) return;

    const filter = {
      type: 'expense',
      search: this.expenseFilter.search,
      category: this.expenseFilter.category,
      paymentMethod: this.expenseFilter.paymentMethod
    };

    this.applyPeriodFilter(filter, this.expenseFilter.period);

    const list = this.dm.getTransactions(filter);

    const totalSum = list.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    this.updateElementText('expenseFilteredTotal', Utils.formatRupiah(totalSum));
    this.updateElementText('expenseFilteredCount', `${list.length} Transaksi`);

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-5 text-muted">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">💸</div>
            <div>Tidak ada data pengeluaran yang cocok dengan filter.</div>
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = '';
    list.forEach(t => {
      rowsHtml += `
        <tr>
          <td><span class="font-monospace text-muted small">${t.id}</span></td>
          <td><strong>${Utils.formatDateIndo(t.date)}</strong></td>
          <td>
            <div class="fw-semibold">${t.description}</div>
            ${t.notes ? `<small class="text-muted">${t.notes}</small>` : ''}
          </td>
          <td><span class="badge badge-category-expense">${t.category}</span></td>
          <td class="text-end font-monospace fw-bold text-danger">${Utils.formatRupiah(t.amount)}</td>
          <td class="text-center"><span class="badge badge-method method-${(t.paymentMethod || 'tunai').toLowerCase()}">${t.paymentMethod}</span></td>
          <td class="text-center">
            <div class="table-actions">
              <button class="btn-icon text-primary" title="Edit" onclick="app.editExpense('${t.id}')">✏️</button>
              <button class="btn-icon text-danger" title="Hapus" onclick="app.confirmDeleteTransaction('${t.id}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = rowsHtml;
  }

  applyPeriodFilter(filterObj, period) {
    const now = new Date();
    if (period === 'today') {
      filterObj.startDate = toDateInputValue(now);
      filterObj.endDate = toDateInputValue(now);
    } else if (period === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      filterObj.startDate = toDateInputValue(d);
      filterObj.endDate = toDateInputValue(now);
    } else if (period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      filterObj.startDate = toDateInputValue(start);
      filterObj.endDate = toDateInputValue(now);
    } else if (period === 'lastMonth') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      filterObj.startDate = toDateInputValue(start);
      filterObj.endDate = toDateInputValue(end);
    }
  }

  // ==========================================
  // PRODUCTS & PRICES VIEW
  // ==========================================
  renderProductsView() {
    this.renderProductsCategoryFilter();
    this.renderProductsGrid();
  }

  renderProductsCategoryFilter() {
    const select = document.getElementById('productCategoryFilter');
    if (!select || select.options.length > 1) return;

    PRODUCT_CATEGORIES.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
  }

  renderProductsGrid() {
    const container = document.getElementById('productsTableBody');
    if (!container) return;

    let products = this.dm.getProducts();

    if (this.productFilter.category && this.productFilter.category !== 'Semua') {
      products = products.filter(p => p.category === this.productFilter.category);
    }
    if (this.productFilter.search) {
      const q = this.productFilter.search.toLowerCase().trim();
      products = products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }

    // Stats
    const totalActive = products.filter(p => p.active !== false).length;
    let totalMarginPercent = 0;
    products.forEach(p => {
      const margin = p.price - (p.costPrice || 0);
      const pct = p.price > 0 ? (margin / p.price) * 100 : 0;
      totalMarginPercent += pct;
    });
    const avgMargin = products.length > 0 ? (totalMarginPercent / products.length).toFixed(1) : 0;

    this.updateElementText('prodTotalCount', `${products.length} Produk (${totalActive} Aktif)`);
    this.updateElementText('prodAvgMargin', `Rata-rata Margin: ${avgMargin}%`);

    if (products.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-5 text-muted">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">🧁</div>
            <div>Belum ada produk yang cocok dengan pencarian.</div>
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = '';
    products.forEach(p => {
      const cost = p.costPrice || 0;
      const marginRp = p.price - cost;
      const marginPct = p.price > 0 ? ((marginRp / p.price) * 100).toFixed(1) : 0;
      const isActive = p.active !== false;
      const isFav = p.isFavorite === true;

      rowsHtml += `
        <tr class="${isActive ? '' : 'row-inactive'}">
          <td class="text-center">
            <button class="btn-star ${isFav ? 'starred' : ''}" title="Tandai Favorit" onclick="app.toggleProductFav('${p.id}')">
              ${isFav ? '★' : '☆'}
            </button>
          </td>
          <td>
            <div class="fw-bold product-name-cell">${p.name}</div>
          </td>
          <td><span class="badge badge-category">${p.category}</span></td>
          <td class="text-end font-monospace fw-semibold">${Utils.formatRupiah(p.price)}</td>
          <td class="text-end font-monospace text-muted">${Utils.formatRupiah(cost)}</td>
          <td class="text-end font-monospace">
            <span class="text-success fw-bold">${Utils.formatRupiah(marginRp)}</span>
            <span class="badge badge-light ms-1">${marginPct}%</span>
          </td>
          <td class="text-center">
            <span class="badge ${isActive ? 'badge-success' : 'badge-secondary'}">
              ${isActive ? 'Aktif' : 'Non-aktif'}
            </span>
          </td>
          <td class="text-center">
            <div class="table-actions">
              <button class="btn-icon text-primary" title="Edit" onclick="app.editProduct('${p.id}')">✏️</button>
              <button class="btn-icon text-danger" title="Hapus" onclick="app.confirmDeleteProduct('${p.id}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    });
    container.innerHTML = rowsHtml;
  }

  toggleProductFav(id) {
    this.dm.toggleProductFavorite(id);
    this.renderProductsView();
    this.renderQuickAddButtons();
  }

  // ==========================================
  // REPORTS VIEW
  // ==========================================
  renderReportsView() {
    this.reports.renderReportView('reportDocumentContainer');
    this.renderReportsChart();
  }

  renderReportsChart() {
    requestAnimationFrame(() => {
      const monthlyData = this.dm.getMonthlyTrends(6);
      BakeryCharts.renderComparisonLineChart('reportComparisonCanvas', monthlyData);
    });
  }

  switchReportType(type) {
    this.reports.currentReportType = type;
    document.querySelectorAll('.report-type-btn').forEach(btn => {
      if (btn.getAttribute('data-type') === type) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    this.renderReportsView();
  }

  setReportPeriod(periodKey) {
    const customContainer = document.getElementById('reportCustomDateRange');
    if (periodKey === 'custom') {
      if (customContainer) customContainer.style.display = 'flex';
      const start = document.getElementById('reportStartDate')?.value;
      const end = document.getElementById('reportEndDate')?.value;
      this.reports.setPeriod('custom', start, end);
    } else {
      if (customContainer) customContainer.style.display = 'none';
      this.reports.setPeriod(periodKey);
    }

    document.querySelectorAll('.report-period-btn').forEach(btn => {
      if (btn.getAttribute('data-period') === periodKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.renderReportsView();
  }

  // ==========================================
  // SETTINGS VIEW
  // ==========================================
  renderSettingsView() {
    const profile = this.dm.getProfile();
    const settings = this.dm.getSettings();

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setVal('settingsStoreName', profile.name);
    setVal('settingsTagline', profile.tagline);
    setVal('settingsAddress', profile.address);
    setVal('settingsPhone', profile.phone);
    setVal('settingsOwner', profile.owner);
    setVal('settingsEmail', profile.email);

    setVal('settingsThreshold', settings.unusualExpenseThreshold || 1000000);

    const darkCheck = document.getElementById('settingsDarkMode');
    if (darkCheck) {
      darkCheck.checked = !!settings.darkMode;
    }
  }

  saveSettingsProfile() {
    const profile = {
      name: document.getElementById('settingsStoreName')?.value.trim() || 'Bolu Bu Eko',
      tagline: document.getElementById('settingsTagline')?.value.trim() || '',
      address: document.getElementById('settingsAddress')?.value.trim() || '',
      phone: document.getElementById('settingsPhone')?.value.trim() || '',
      owner: document.getElementById('settingsOwner')?.value.trim() || '',
      email: document.getElementById('settingsEmail')?.value.trim() || ''
    };

    const threshold = Number(document.getElementById('settingsThreshold')?.value) || 1000000;
    const isDark = document.getElementById('settingsDarkMode')?.checked || false;

    this.dm.saveProfile(profile);
    const settings = this.dm.getSettings();
    settings.unusualExpenseThreshold = threshold;
    settings.darkMode = isDark;
    this.dm.saveSettings(settings);

    // Update Header Brand
    this.updateHeaderBrand();

    // Toggle theme
    if (isDark !== document.body.classList.contains('dark-theme')) {
      document.body.classList.toggle('dark-theme', isDark);
      this.updateThemeIcons(isDark);
    }

    this.showToast('Pengaturan profil toko berhasil disimpan!', 'success');
  }

  updateHeaderBrand() {
    const profile = this.dm.getProfile();
    const brandTitle = document.getElementById('brandHeaderTitle');
    if (brandTitle) {
      brandTitle.innerHTML = `🍰 ${profile.name} <small class="text-muted d-none d-md-inline" style="font-size:0.85rem; font-weight:normal;">- Cashflow Manager</small>`;
    }
  }

  exportDataBackup() {
    const data = this.dm.exportAllData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = toDateInputValue(new Date());
    link.href = url;
    link.download = `backup_bolu_bu_eko_${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.showToast('Backup data berhasil diunduh!', 'success');
  }

  importDataRestore(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const json = JSON.parse(e.target.result);
        this.dm.importAllData(json);
        this.showToast('Data berhasil dipulihkan dari file backup!', 'success');
        this.renderCurrentView();
        this.updateHeaderBrand();
      } catch (err) {
        this.showToast('Gagal memulihkan data: format file tidak sesuai', 'error');
      }
    };
    reader.readAsText(file);
  }

  confirmResetSample() {
    this.showConfirmDialog(
      'Reset Data ke Data Awal?',
      'Semua perubahan data transaksi Anda saat ini akan ditimpa dengan data contoh bakery awal. Tindakan ini tidak dapat dibatalkan.',
      () => {
        this.dm.resetToSampleData();
        this.showToast('Data berhasil direset ke data contoh awal', 'info');
        this.renderCurrentView();
        this.updateHeaderBrand();
      }
    );
  }

  confirmClearAll() {
    this.showConfirmDialog(
      'Kosongkan Seluruh Data?',
      'PERINGATAN: Semua transaksi dan daftar produk akan dihapus bersih (0 transaksi). Pastikan Anda telah membuat backup data terlebih dahulu!',
      () => {
        this.dm.clearAllData();
        this.showToast('Semua data berhasil dikosongkan', 'warning');
        this.renderCurrentView();
      }
    );
  }

  // ==========================================
  // MODALS & FORMS
  // ==========================================
  initModals() {
    // Populate product dropdown in income form
    this.populateIncomeProductOptions();

    // Live calculation for Income Form
    const qtyInput = document.getElementById('incomeQuantity');
    const priceInput = document.getElementById('incomeUnitPrice');
    const totalInput = document.getElementById('incomeTotal');

    const recalculateTotal = () => {
      const q = Number(qtyInput.value) || 0;
      const p = Number(priceInput.value) || 0;
      totalInput.value = q * p;
    };

    if (qtyInput) qtyInput.addEventListener('input', recalculateTotal);
    if (priceInput) priceInput.addEventListener('input', recalculateTotal);

    // Product selection change handler
    const prodSelect = document.getElementById('incomeProductSelect');
    if (prodSelect) {
      prodSelect.addEventListener('change', e => {
        this.onIncomeProductChanged(e.target.value);
      });
    }

    // Live margin calculation for Product Form
    const prodPrice = document.getElementById('prodPriceInput');
    const prodCost = document.getElementById('prodCostInput');
    const marginBadge = document.getElementById('prodMarginPreview');

    const updateProductMarginPreview = () => {
      if (!marginBadge) return;
      const p = Number(prodPrice.value) || 0;
      const c = Number(prodCost.value) || 0;
      const margin = p - c;
      const pct = p > 0 ? ((margin / p) * 100).toFixed(1) : 0;
      marginBadge.textContent = `Margin: ${Utils.formatRupiah(margin)} (${pct}%)`;
      marginBadge.className = 'badge ' + (margin >= 0 ? 'badge-success' : 'badge-danger');
    };

    if (prodPrice) prodPrice.addEventListener('input', updateProductMarginPreview);
    if (prodCost) prodCost.addEventListener('input', updateProductMarginPreview);
  }

  populateIncomeProductOptions() {
    const select = document.getElementById('incomeProductSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- Pilih Produk Bolu / Roti --</option>';
    const products = this.dm.getProducts(true);

    products.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${Utils.formatRupiah(p.price)})`;
      select.appendChild(opt);
    });

    const optCustom = document.createElement('option');
    optCustom.value = 'CUSTOM';
    optCustom.textContent = '+ Input Produk Baru / Pesanan Khusus...';
    select.appendChild(optCustom);
  }

  onIncomeProductChanged(productId) {
    const nameInput = document.getElementById('incomeProductName');
    const catSelect = document.getElementById('incomeCategory');
    const priceInput = document.getElementById('incomeUnitPrice');
    const qtyInput = document.getElementById('incomeQuantity');
    const totalInput = document.getElementById('incomeTotal');

    if (!productId) {
      if (nameInput) nameInput.value = '';
      if (priceInput) priceInput.value = 0;
      if (totalInput) totalInput.value = 0;
      return;
    }

    if (productId === 'CUSTOM') {
      if (nameInput) {
        nameInput.value = '';
        nameInput.focus();
      }
      return;
    }

    const prod = this.dm.getProductById(productId);
    if (prod) {
      if (nameInput) nameInput.value = prod.name;
      if (catSelect) catSelect.value = prod.category;
      if (priceInput) priceInput.value = prod.price;
      const qty = Number(qtyInput?.value) || 1;
      if (totalInput) totalInput.value = qty * prod.price;
    }
  }

  // --- Income Modal Operations ---
  openIncomeModal() {
    this.editingTrxId = null;
    this.populateIncomeProductOptions();

    document.getElementById('incomeModalTitle').textContent = 'Tambah Pemasukan Baru';
    document.getElementById('incomeForm').reset();
    document.getElementById('incomeDate').value = toDateInputValue(new Date());
    document.getElementById('incomeQuantity').value = 1;
    document.getElementById('incomePaymentMethod').value = 'Tunai';

    this.showModal('modalIncome');
  }

  editIncome(id) {
    const trx = this.dm.getTransactionById(id);
    if (!trx) return;

    this.editingTrxId = id;
    this.populateIncomeProductOptions();

    document.getElementById('incomeModalTitle').textContent = 'Edit Data Pemasukan';
    document.getElementById('incomeDate').value = trx.date;
    document.getElementById('incomeProductSelect').value = trx.productId || 'CUSTOM';
    document.getElementById('incomeProductName').value = trx.productName || '';
    document.getElementById('incomeCategory').value = trx.category || 'Bolu Original';
    document.getElementById('incomeQuantity').value = trx.quantity || 1;
    document.getElementById('incomeUnitPrice').value = trx.unitPrice || 0;
    document.getElementById('incomeTotal').value = trx.total || 0;
    document.getElementById('incomePaymentMethod').value = trx.paymentMethod || 'Tunai';
    document.getElementById('incomeNotes').value = trx.notes || '';

    this.showModal('modalIncome');
  }

  saveIncomeForm(e) {
    e.preventDefault();

    const date = document.getElementById('incomeDate').value;
    const productId = document.getElementById('incomeProductSelect').value;
    const productName = document.getElementById('incomeProductName').value.trim();
    const category = document.getElementById('incomeCategory').value;
    const quantity = Number(document.getElementById('incomeQuantity').value) || 1;
    const unitPrice = Number(document.getElementById('incomeUnitPrice').value) || 0;
    const total = Number(document.getElementById('incomeTotal').value) || (quantity * unitPrice);
    const paymentMethod = document.getElementById('incomePaymentMethod').value;
    const notes = document.getElementById('incomeNotes').value.trim();

    if (!date || !productName || total <= 0) {
      this.showToast('Harap lengkapi nama produk, tanggal, dan nominal yang valid', 'warning');
      return;
    }

    const payload = {
      type: 'income',
      date,
      productId: productId === 'CUSTOM' ? '' : productId,
      productName,
      category,
      quantity,
      unitPrice,
      total,
      paymentMethod,
      notes
    };

    if (this.editingTrxId) {
      this.dm.updateTransaction(this.editingTrxId, payload);
      this.showToast('Transaksi pemasukan berhasil diperbarui!', 'success');
    } else {
      this.dm.addTransaction(payload);
      this.showToast('Transaksi pemasukan berhasil ditambahkan!', 'success');
    }

    this.hideModal('modalIncome');
    this.renderCurrentView();
  }

  // --- Expense Modal Operations ---
  openExpenseModal() {
    this.editingTrxId = null;

    document.getElementById('expenseModalTitle').textContent = 'Tambah Pengeluaran Baru';
    document.getElementById('expenseForm').reset();
    document.getElementById('expenseDate').value = toDateInputValue(new Date());
    document.getElementById('expensePaymentMethod').value = 'Tunai';

    this.showModal('modalExpense');
  }

  editExpense(id) {
    const trx = this.dm.getTransactionById(id);
    if (!trx) return;

    this.editingTrxId = id;

    document.getElementById('expenseModalTitle').textContent = 'Edit Data Pengeluaran';
    document.getElementById('expenseDate').value = trx.date;
    document.getElementById('expenseCategory').value = trx.category || 'Bahan Baku';
    document.getElementById('expenseDescription').value = trx.description || '';
    document.getElementById('expenseAmount').value = trx.amount || 0;
    document.getElementById('expensePaymentMethod').value = trx.paymentMethod || 'Tunai';
    document.getElementById('expenseNotes').value = trx.notes || '';

    this.showModal('modalExpense');
  }

  saveExpenseForm(e) {
    e.preventDefault();

    const date = document.getElementById('expenseDate').value;
    const category = document.getElementById('expenseCategory').value;
    const description = document.getElementById('expenseDescription').value.trim();
    const amount = Number(document.getElementById('expenseAmount').value) || 0;
    const paymentMethod = document.getElementById('expensePaymentMethod').value;
    const notes = document.getElementById('expenseNotes').value.trim();

    if (!date || !description || amount <= 0) {
      this.showToast('Harap lengkapi deskripsi pengeluaran, tanggal, dan jumlah valid', 'warning');
      return;
    }

    const payload = {
      type: 'expense',
      date,
      category,
      description,
      amount,
      paymentMethod,
      notes
    };

    if (this.editingTrxId) {
      this.dm.updateTransaction(this.editingTrxId, payload);
      this.showToast('Transaksi pengeluaran berhasil diperbarui!', 'success');
    } else {
      this.dm.addTransaction(payload);
      this.showToast('Transaksi pengeluaran berhasil ditambahkan!', 'success');
    }

    this.hideModal('modalExpense');
    this.renderCurrentView();
  }

  // --- Product Modal Operations ---
  openProductModal() {
    this.editingProdId = null;

    document.getElementById('productModalTitle').textContent = 'Tambah Produk Baru';
    document.getElementById('productForm').reset();
    document.getElementById('prodActiveInput').checked = true;
    document.getElementById('prodFavInput').checked = false;
    document.getElementById('prodMarginPreview').textContent = 'Margin: Rp 0 (0%)';

    this.showModal('modalProduct');
  }

  editProduct(id) {
    const prod = this.dm.getProductById(id);
    if (!prod) return;

    this.editingProdId = id;

    document.getElementById('productModalTitle').textContent = 'Edit Produk';
    document.getElementById('prodNameInput').value = prod.name;
    document.getElementById('prodCategoryInput').value = prod.category;
    document.getElementById('prodPriceInput').value = prod.price;
    document.getElementById('prodCostInput').value = prod.costPrice || 0;
    document.getElementById('prodActiveInput').checked = prod.active !== false;
    document.getElementById('prodFavInput').checked = !!prod.isFavorite;

    // Trigger margin preview
    const margin = prod.price - (prod.costPrice || 0);
    const pct = prod.price > 0 ? ((margin / prod.price) * 100).toFixed(1) : 0;
    const badge = document.getElementById('prodMarginPreview');
    if (badge) {
      badge.textContent = `Margin: ${Utils.formatRupiah(margin)} (${pct}%)`;
      badge.className = 'badge ' + (margin >= 0 ? 'badge-success' : 'badge-danger');
    }

    this.showModal('modalProduct');
  }

  saveProductForm(e) {
    e.preventDefault();

    const name = document.getElementById('prodNameInput').value.trim();
    const category = document.getElementById('prodCategoryInput').value;
    const price = Number(document.getElementById('prodPriceInput').value) || 0;
    const costPrice = Number(document.getElementById('prodCostInput').value) || 0;
    const active = document.getElementById('prodActiveInput').checked;
    const isFavorite = document.getElementById('prodFavInput').checked;

    if (!name || price <= 0) {
      this.showToast('Harap masukkan nama produk dan harga jual yang valid', 'warning');
      return;
    }

    const payload = {
      name,
      category,
      price,
      costPrice,
      active,
      isFavorite
    };

    if (this.editingProdId) {
      this.dm.updateProduct(this.editingProdId, payload);
      this.showToast('Data produk berhasil diperbarui!', 'success');
    } else {
      this.dm.addProduct(payload);
      this.showToast('Produk baru berhasil ditambahkan!', 'success');
    }

    this.populateIncomeProductOptions();
    this.hideModal('modalProduct');
    this.renderCurrentView();
  }

  // --- Recurring Expenses Manager Modal ---
  openRecurringManagerModal() {
    this.renderRecurringList();
    this.showModal('modalRecurring');
  }

  renderRecurringList() {
    const container = document.getElementById('recurringListTableBody');
    if (!container) return;

    const list = this.dm.getRecurring();
    if (list.length === 0) {
      container.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">Belum ada daftar pengeluaran rutin</td></tr>';
      return;
    }

    let html = '';
    list.forEach(r => {
      html += `
        <tr>
          <td><strong>${r.description}</strong><br><small class="text-muted">${r.notes || ''}</small></td>
          <td><span class="badge badge-category-expense">${r.category}</span></td>
          <td class="text-end font-monospace fw-bold text-danger">${Utils.formatRupiah(r.amount)}</td>
          <td class="text-center">${r.dayOfMonth ? 'Tgl ' + r.dayOfMonth : 'Bulanan'}</td>
          <td class="text-center">${r.paymentMethod || 'Transfer'}</td>
          <td class="text-center">
            <div class="table-actions">
              <button class="btn btn-outline-success btn-xs" title="Terapkan Sekarang" onclick="app.applySingleRecurring('${r.id}')">⚡ Catat</button>
              <button class="btn-icon text-danger" title="Hapus" onclick="app.deleteRecurringItem('${r.id}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    });
    container.innerHTML = html;
  }

  addRecurringItem(e) {
    e.preventDefault();
    const desc = document.getElementById('recDescInput').value.trim();
    const cat = document.getElementById('recCategoryInput').value;
    const amount = Number(document.getElementById('recAmountInput').value) || 0;
    const day = Number(document.getElementById('recDayInput').value) || 1;
    const method = document.getElementById('recMethodInput').value;

    if (!desc || amount <= 0) {
      this.showToast('Harap lengkapi deskripsi dan nominal', 'warning');
      return;
    }

    this.dm.addRecurring({
      description: desc,
      category: cat,
      amount,
      dayOfMonth: day,
      paymentMethod: method
    });

    document.getElementById('recDescInput').value = '';
    document.getElementById('recAmountInput').value = '';
    this.showToast('Pengeluaran rutin baru berhasil disimpan!', 'success');
    this.renderRecurringList();
    this.renderRecurringPrompt();
  }

  applySingleRecurring(id) {
    const res = this.dm.applyRecurringExpense(id);
    if (res) {
      this.showToast(`Berhasil mencatat pengeluaran: ${res.description}`, 'success');
      this.renderCurrentView();
    }
  }

  applyAllRecurringThisMonth() {
    const list = this.dm.getRecurring();
    if (list.length === 0) {
      this.showToast('Tidak ada pengeluaran rutin terdaftar', 'info');
      return;
    }

    this.showConfirmDialog(
      'Terapkan Semua Pengeluaran Rutin?',
      `Sistem akan otomatis mencatat ${list.length} pengeluaran rutin ke transaksi pengeluaran hari ini. Lanjutkan?`,
      () => {
        let count = 0;
        list.forEach(r => {
          this.dm.applyRecurringExpense(r.id);
          count++;
        });
        this.showToast(`Berhasil menerapkan ${count} pengeluaran rutin!`, 'success');
        this.renderCurrentView();
      }
    );
  }

  deleteRecurringItem(id) {
    this.dm.deleteRecurring(id);
    this.showToast('Item pengeluaran rutin dihapus', 'info');
    this.renderRecurringList();
    this.renderRecurringPrompt();
  }

  // --- Deletion Confirmations ---
  confirmDeleteTransaction(id) {
    const trx = this.dm.getTransactionById(id);
    const desc = trx ? (trx.productName || trx.description) : id;
    this.showConfirmDialog(
      'Hapus Transaksi?',
      `Apakah Anda yakin ingin menghapus transaksi "${desc}" (${trx ? Utils.formatRupiah(trx.total || trx.amount) : ''})? Data ini tidak dapat dikembalikan.`,
      () => {
        this.dm.deleteTransaction(id);
        this.showToast('Transaksi berhasil dihapus!', 'info');
        this.renderCurrentView();
      }
    );
  }

  confirmDeleteProduct(id) {
    const prod = this.dm.getProductById(id);
    this.showConfirmDialog(
      'Hapus Produk Bakery?',
      `Apakah Anda yakin ingin menghapus produk "${prod ? prod.name : id}" dari daftar produk?`,
      () => {
        this.dm.deleteProduct(id);
        this.populateIncomeProductOptions();
        this.showToast('Produk berhasil dihapus!', 'info');
        this.renderCurrentView();
      }
    );
  }

  // ==========================================
  // EVENT LISTENERS INITIALIZATION
  // ==========================================
  initEventListeners() {
    // Income Form Submit
    const incomeForm = document.getElementById('incomeForm');
    if (incomeForm) incomeForm.addEventListener('submit', e => this.saveIncomeForm(e));

    // Expense Form Submit
    const expenseForm = document.getElementById('expenseForm');
    if (expenseForm) expenseForm.addEventListener('submit', e => this.saveExpenseForm(e));

    // Product Form Submit
    const productForm = document.getElementById('productForm');
    if (productForm) productForm.addEventListener('submit', e => this.saveProductForm(e));

    // Recurring Form Submit
    const recurringForm = document.getElementById('addRecurringForm');
    if (recurringForm) recurringForm.addEventListener('submit', e => this.addRecurringItem(e));

    // Profile Settings Form Submit
    const settingsForm = document.getElementById('settingsProfileForm');
    if (settingsForm) {
      settingsForm.addEventListener('submit', e => {
        e.preventDefault();
        this.saveSettingsProfile();
      });
    }

    // Backup & Restore
    const btnExport = document.getElementById('btnExportBackup');
    if (btnExport) btnExport.addEventListener('click', () => this.exportDataBackup());

    const btnImport = document.getElementById('btnImportBackup');
    const fileImport = document.getElementById('inputImportFile');
    if (btnImport && fileImport) {
      btnImport.addEventListener('click', () => fileImport.click());
      fileImport.addEventListener('change', e => {
        if (e.target.files && e.target.files[0]) {
          this.importDataRestore(e.target.files[0]);
          e.target.value = '';
        }
      });
    }

    // Reset Buttons
    const btnResetSample = document.getElementById('btnResetSample');
    if (btnResetSample) btnResetSample.addEventListener('click', () => this.confirmResetSample());

    const btnClearAll = document.getElementById('btnClearAll');
    if (btnClearAll) btnClearAll.addEventListener('click', () => this.confirmClearAll());

    // Income Filter Listeners
    const incomeSearch = document.getElementById('incomeSearchInput');
    if (incomeSearch) {
      incomeSearch.addEventListener('input', e => {
        this.incomeFilter.search = e.target.value;
        this.renderIncomeTable();
      });
    }

    const incomeCatFilter = document.getElementById('incomeCategoryFilter');
    if (incomeCatFilter) {
      incomeCatFilter.addEventListener('change', e => {
        this.incomeFilter.category = e.target.value;
        this.renderIncomeTable();
      });
    }

    const incomeMethodFilter = document.getElementById('incomePaymentMethodFilter');
    if (incomeMethodFilter) {
      incomeMethodFilter.addEventListener('change', e => {
        this.incomeFilter.paymentMethod = e.target.value;
        this.renderIncomeTable();
      });
    }

    const incomePeriodFilter = document.getElementById('incomePeriodFilter');
    if (incomePeriodFilter) {
      incomePeriodFilter.addEventListener('change', e => {
        this.incomeFilter.period = e.target.value;
        this.renderIncomeTable();
      });
    }

    // Expense Filter Listeners
    const expSearch = document.getElementById('expenseSearchInput');
    if (expSearch) {
      expSearch.addEventListener('input', e => {
        this.expenseFilter.search = e.target.value;
        this.renderExpenseTable();
      });
    }

    const expCatFilter = document.getElementById('expenseCategoryFilter');
    if (expCatFilter) {
      expCatFilter.addEventListener('change', e => {
        this.expenseFilter.category = e.target.value;
        this.renderExpenseTable();
      });
    }

    const expMethodFilter = document.getElementById('expensePaymentMethodFilter');
    if (expMethodFilter) {
      expMethodFilter.addEventListener('change', e => {
        this.expenseFilter.paymentMethod = e.target.value;
        this.renderExpenseTable();
      });
    }

    const expPeriodFilter = document.getElementById('expensePeriodFilter');
    if (expPeriodFilter) {
      expPeriodFilter.addEventListener('change', e => {
        this.expenseFilter.period = e.target.value;
        this.renderExpenseTable();
      });
    }

    // Product Filter Listeners
    const prodSearch = document.getElementById('productSearchInput');
    if (prodSearch) {
      prodSearch.addEventListener('input', e => {
        this.productFilter.search = e.target.value;
        this.renderProductsGrid();
      });
    }

    const prodCatFilter = document.getElementById('productCategoryFilter');
    if (prodCatFilter) {
      prodCatFilter.addEventListener('change', e => {
        this.productFilter.category = e.target.value;
        this.renderProductsGrid();
      });
    }

    // Close Modal buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        this.hideModal(modalId);
      });
    });

    // Close modal on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', e => {
        if (e.target === modal) {
          modal.classList.remove('show');
        }
      });
    });

    // Confirmation dialog actions
    const btnConfirmYes = document.getElementById('btnConfirmAction');
    if (btnConfirmYes) {
      btnConfirmYes.addEventListener('click', () => {
        if (typeof this.pendingConfirmCallback === 'function') {
          this.pendingConfirmCallback();
        }
        this.hideModal('modalConfirm');
      });
    }
  }

  // ==========================================
  // MODAL & DIALOG HELPERS
  // ==========================================
  showModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('show');
  }

  hideModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('show');
  }

  showConfirmDialog(title, message, onConfirm) {
    this.pendingConfirmCallback = onConfirm;
    const titleEl = document.getElementById('confirmModalTitle');
    const msgEl = document.getElementById('confirmModalMessage');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    this.showModal('modalConfirm');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type} animate-slide-in`;

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <span class="toast-message">${message}</span>
      <button type="button" class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('animate-slide-out');
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  updateElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
}
