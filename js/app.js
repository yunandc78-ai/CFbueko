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
    this.ingredientFilter = { search: '', category: 'Semua', stockStatus: 'Semua' };

    // Modals & confirmation tracking
    this.editingTrxId = null;
    this.editingProdId = null;
    this.editingRecId = null;
    this._editingIngId = null;
    this.pendingConfirmCallback = null;

    // HPP Calculator state
    this._hppIngredients = [];
    this._currentHppIngredients = [];
    this._hppSellingPrice = 0;

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

    // Database connection status listener
    window.addEventListener('db-status-changed', (e) => {
      this.updateDbStatusBadge(e.detail);
    });

    // Check database connection on start
    setTimeout(() => {
      this.updateDbStatusBadge({ connected: this.dm.isUsingDb, info: this.dm.dbInfo });
    }, 200);

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
    const views = ['dashboard', 'income', 'expense', 'products', 'ingredients', 'reports', 'settings'];
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
      case 'ingredients':
        this.renderIngredientsView();
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
          <td class="text-end font-monospace text-muted">
            <span>${Utils.formatRupiah(cost)}</span>
            ${p.hppIngredients && p.hppIngredients.length > 0 ?
              `<br><span class="badge badge-light" style="font-size:0.65rem; margin-top:2px; cursor:default;" title="${p.hppIngredients.length} bahan">📦 ${p.hppIngredients.length} bahan</span>` : ''}
          </td>
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
              <button class="btn-icon" title="Kalkulator HPP" onclick="app.openHppCalcForProduct('${p.id}')" style="color: var(--color-warning);">🧮</button>
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

      // If linked to master bahan, auto-adjust stock
      const linkedIngId = document.getElementById('expenseIngredientLink') ? document.getElementById('expenseIngredientLink').value : '';

      if (payload.category === 'Bahan Baku') {
        if (linkedIngId === '__NEW__') {
          // Create as new ingredient in Master Bahan
          const newName = (document.getElementById('expenseNewIngName') ? document.getElementById('expenseNewIngName').value.trim() : '') || payload.description;
          const newCat = (document.getElementById('expenseNewIngCategory') ? document.getElementById('expenseNewIngCategory').value : '') || 'Tepung & Pati';
          const newUnit = (document.getElementById('expenseNewIngUnit') ? document.getElementById('expenseNewIngUnit').value : '') || 'kg';
          const newQty = Number(document.getElementById('expenseNewIngQty') ? document.getElementById('expenseNewIngQty').value : 0) || 1;
          const newMinStock = Number(document.getElementById('expenseNewIngMinStock') ? document.getElementById('expenseNewIngMinStock').value : 0) || 0;
          const unitPrice = newQty > 0 ? Math.round(payload.amount / newQty) : payload.amount;

          const newIng = this.dm.addIngredient({
            name: newName,
            category: newCat,
            unit: newUnit,
            lastPrice: unitPrice,
            stock: 0,
            minStock: newMinStock,
            active: true
          });

          this.dm.adjustStock(newIng.id, 'in', newQty, unitPrice, payload.date, '', `Pembelian baru: ${payload.description}`);
          this.showToast(`Bahan "${newName}" ditambahkan ke Master Bahan & stok +${newQty} ${newUnit}!`, 'success');
        } else if (linkedIngId) {
          const linkedQty = Number(document.getElementById('expenseIngredientQty') ? document.getElementById('expenseIngredientQty').value : 0);
          if (linkedQty > 0) {
            const ing = this.dm.getIngredientById(linkedIngId);
            if (ing) {
              const unitPrice = linkedQty > 0 ? Math.round(payload.amount / linkedQty) : 0;
              this.dm.adjustStock(linkedIngId, 'in', linkedQty, unitPrice, payload.date, '', `Dari pengeluaran: ${payload.description}`);
              this.showToast(`Stok ${ing.name} bertambah +${linkedQty} ${ing.unit}`, 'success');
            }
          }
        } else {
          this.showToast('Transaksi pengeluaran berhasil ditambahkan!', 'success');
        }
      } else {
        this.showToast('Transaksi pengeluaran berhasil ditambahkan!', 'success');
      }
    }

    this.hideModal('modalExpense');
    this.renderCurrentView();
  }

  // --- Product Modal Operations ---
  openProductModal() {
    this.editingProdId = null;
    this._currentHppIngredients = [];
    this._hppIngredients = [];

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
    this._currentHppIngredients = prod.hppIngredients ? JSON.parse(JSON.stringify(prod.hppIngredients)) : [];

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
      hppIngredients: this._currentHppIngredients || [],
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

    this._currentHppIngredients = [];
    this.populateIncomeProductOptions();
    this.hideModal('modalProduct');
    this.renderCurrentView();
  }

  // ==========================================
  // MASTER BAHAN & STOCK MANAGEMENT
  // ==========================================

  renderIngredientsView() {
    this.renderIngredientsCategoryFilter();
    this.renderIngredientsTable();
    this.renderLowStockAlert();
    this.renderStockLog();
    this.renderIngredientStats();
  }

  renderIngredientStats() {
    const ingredients = this.dm.getIngredients(true);
    const totalValue = this.dm.getInventoryValue();
    const lowStock = this.dm.getLowStockIngredients();

    this.updateElementText('ingTotalCount', ingredients.length.toString());
    this.updateElementText('ingTotalValue', Utils.formatRupiah(totalValue));
    this.updateElementText('ingLowStockCount', lowStock.length.toString());
  }

  renderIngredientsCategoryFilter() {
    const select = document.getElementById('ingredientCategoryFilter');
    if (!select || select.options.length > 1) return;

    INGREDIENT_CATEGORIES.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
  }

  renderLowStockAlert() {
    const alertBox = document.getElementById('lowStockAlertBox');
    if (!alertBox) return;

    const lowStock = this.dm.getLowStockIngredients();
    if (lowStock.length === 0) {
      alertBox.style.display = 'none';
      return;
    }

    const tags = lowStock.map(i => {
      const statusIcon = i.stock <= 0 ? '🔴' : '⚠️';
      return `<span class="low-stock-tag">${statusIcon} ${i.name} (${i.stock} ${i.unit})</span>`;
    }).join(' ');

    alertBox.innerHTML = `
      <div class="low-stock-alert">
        <span class="low-stock-alert-icon">⚠️</span>
        <div class="low-stock-alert-content">
          <div class="low-stock-alert-title">${lowStock.length} Bahan dengan Stok Menipis / Habis</div>
          <div>${tags}</div>
        </div>
      </div>
    `;
    alertBox.style.display = 'block';
  }

  renderIngredientsTable() {
    const container = document.getElementById('ingredientsTableBody');
    if (!container) return;

    let ingredients = this.dm.getIngredients();

    // Apply filters
    if (this.ingredientFilter.category && this.ingredientFilter.category !== 'Semua') {
      ingredients = ingredients.filter(i => i.category === this.ingredientFilter.category);
    }
    if (this.ingredientFilter.search) {
      const q = this.ingredientFilter.search.toLowerCase().trim();
      ingredients = ingredients.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    }
    if (this.ingredientFilter.stockStatus && this.ingredientFilter.stockStatus !== 'Semua') {
      if (this.ingredientFilter.stockStatus === 'low') {
        ingredients = ingredients.filter(i => i.stock > 0 && i.stock <= i.minStock);
      } else if (this.ingredientFilter.stockStatus === 'empty') {
        ingredients = ingredients.filter(i => i.stock <= 0);
      } else if (this.ingredientFilter.stockStatus === 'ok') {
        ingredients = ingredients.filter(i => i.stock > i.minStock);
      }
    }

    if (ingredients.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-5 text-muted">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">📦</div>
            <div>Belum ada bahan yang cocok dengan pencarian.</div>
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = '';
    ingredients.forEach((ing, idx) => {
      const stock = ing.stock || 0;
      const minStock = ing.minStock || 0;
      let stockClass, stockBadgeClass, stockLabel;

      if (stock <= 0) {
        stockClass = 'stock-value-empty';
        stockBadgeClass = 'stock-badge-empty';
        stockLabel = '🔴 Habis';
      } else if (stock <= minStock) {
        stockClass = 'stock-value-low';
        stockBadgeClass = 'stock-badge-low';
        stockLabel = '⚠️ Menipis';
      } else {
        stockClass = 'stock-value-ok';
        stockBadgeClass = 'stock-badge-ok';
        stockLabel = '✅ Aman';
      }

      rowsHtml += `
        <tr>
          <td class="text-center text-muted" style="font-size: 0.8rem;">${idx + 1}</td>
          <td>
            <div class="fw-bold">${ing.name}</div>
          </td>
          <td><span class="badge badge-category">${ing.category}</span></td>
          <td class="text-center"><span class="badge badge-light">${ing.unit}</span></td>
          <td class="text-end font-monospace">${Utils.formatRupiah(ing.lastPrice || 0)}<span class="small text-muted">/${ing.unit}</span></td>
          <td class="text-center"><span class="stock-value ${stockClass}">${stock}</span> <span class="small text-muted">${ing.unit}</span></td>
          <td class="text-center font-monospace text-muted">${minStock}</td>
          <td class="text-center"><span class="stock-badge ${stockBadgeClass}">${stockLabel}</span></td>
          <td class="text-center">
            <div class="table-actions">
              <button class="btn-icon" title="Stok Masuk" onclick="app.openStockInForIngredient('${ing.id}')" style="color: var(--color-income);">📥</button>
              <button class="btn-icon" title="Stok Keluar" onclick="app.openStockOutForIngredient('${ing.id}')" style="color: var(--color-expense);">📤</button>
              <button class="btn-icon text-primary" title="Edit" onclick="app.editIngredient('${ing.id}')">✏️</button>
              <button class="btn-icon text-danger" title="Hapus" onclick="app.confirmDeleteIngredient('${ing.id}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    });
    container.innerHTML = rowsHtml;
  }

  renderStockLog() {
    const container = document.getElementById('stockLogTableBody');
    if (!container) return;

    const filterEl = document.getElementById('stockLogFilter');
    const typeFilter = filterEl ? filterEl.value : 'all';

    let log = this.dm.getStockLog();
    if (typeFilter === 'in') log = log.filter(l => l.type === 'in');
    if (typeFilter === 'out') log = log.filter(l => l.type === 'out');

    // Show latest 50 entries
    log = log.slice(0, 50);

    if (log.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-3 text-muted">
            Belum ada riwayat pergerakan stok.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    log.forEach(entry => {
      const typeClass = entry.type === 'in' ? 'stock-log-type-in' : 'stock-log-type-out';
      const typeLabel = entry.type === 'in' ? '📥 Masuk' : '📤 Keluar';
      const qtyDisplay = entry.type === 'in' ? `+${entry.qty}` : `-${entry.qty}`;

      html += `
        <tr>
          <td>${Utils.formatDateIndo(entry.date)}</td>
          <td class="fw-bold">${entry.ingredientName}</td>
          <td class="text-center"><span class="${typeClass}">${typeLabel}</span></td>
          <td class="text-end font-monospace fw-bold">${qtyDisplay} ${entry.unit}</td>
          <td class="text-end font-monospace">${Utils.formatRupiah(entry.unitPrice || 0)}</td>
          <td class="text-end font-monospace fw-semibold">${Utils.formatRupiah(entry.totalPrice || 0)}</td>
          <td class="text-muted small">${entry.notes || '-'}</td>
        </tr>
      `;
    });
    container.innerHTML = html;
  }

  // --- Ingredient CRUD Modal Operations ---

  openIngredientModal() {
    this._editingIngId = null;
    document.getElementById('ingredientModalTitle').textContent = 'Tambah Bahan Baru';
    document.getElementById('ingredientForm').reset();
    this.showModal('modalIngredient');
  }

  editIngredient(id) {
    const ing = this.dm.getIngredientById(id);
    if (!ing) return;

    this._editingIngId = id;
    document.getElementById('ingredientModalTitle').textContent = 'Edit Bahan';
    document.getElementById('ingNameInput').value = ing.name;
    document.getElementById('ingCategoryInput').value = ing.category;
    document.getElementById('ingUnitInput').value = ing.unit;
    document.getElementById('ingPriceInput').value = ing.lastPrice || 0;
    document.getElementById('ingStockInput').value = ing.stock || 0;
    document.getElementById('ingMinStockInput').value = ing.minStock || 0;

    this.showModal('modalIngredient');
  }

  saveIngredientForm(e) {
    e.preventDefault();

    const name = document.getElementById('ingNameInput').value.trim();
    const category = document.getElementById('ingCategoryInput').value;
    const unit = document.getElementById('ingUnitInput').value;
    const lastPrice = Number(document.getElementById('ingPriceInput').value) || 0;
    const stock = Number(document.getElementById('ingStockInput').value) || 0;
    const minStock = Number(document.getElementById('ingMinStockInput').value) || 0;

    if (!name) {
      this.showToast('Harap masukkan nama bahan', 'warning');
      return;
    }

    const payload = { name, category, unit, lastPrice, stock, minStock, active: true };

    if (this._editingIngId) {
      this.dm.updateIngredient(this._editingIngId, payload);
      this.showToast('Data bahan berhasil diperbarui!', 'success');
    } else {
      this.dm.addIngredient(payload);
      this.showToast('Bahan baru berhasil ditambahkan!', 'success');
    }

    this.hideModal('modalIngredient');
    this.renderCurrentView();
  }

  confirmDeleteIngredient(id) {
    const ing = this.dm.getIngredientById(id);
    if (!ing) return;

    this.showConfirmDialog(
      'Hapus Bahan?',
      `Apakah Anda yakin ingin menghapus bahan "${ing.name}" dari master bahan?`,
      () => {
        this.dm.deleteIngredient(id);
        this.showToast('Bahan berhasil dihapus', 'success');
        this.renderCurrentView();
      }
    );
  }

  // --- Stock In Modal (Purchase) ---

  openStockInModal() {
    document.getElementById('stockInForm').reset();
    document.getElementById('stockInDate').value = new Date().toISOString().split('T')[0];
    this._populateStockIngredientSelect('stockInIngredient');
    document.getElementById('stockInUnit').value = '';
    document.getElementById('stockInTotal').value = '';
    this.showModal('modalStockIn');
  }

  openStockInForIngredient(ingId) {
    this.openStockInModal();
    document.getElementById('stockInIngredient').value = ingId;
    this.onStockInIngredientChanged();
  }

  onStockInIngredientChanged() {
    const ingId = document.getElementById('stockInIngredient').value;
    const ing = this.dm.getIngredientById(ingId);
    if (ing) {
      document.getElementById('stockInUnit').value = ing.unit;
      document.getElementById('stockInUnitPrice').value = ing.lastPrice || 0;
      this.calcStockInTotal();
    } else {
      document.getElementById('stockInUnit').value = '';
      document.getElementById('stockInUnitPrice').value = '';
      document.getElementById('stockInTotal').value = '';
    }
  }

  calcStockInTotal() {
    const qty = Number(document.getElementById('stockInQty').value) || 0;
    const price = Number(document.getElementById('stockInUnitPrice').value) || 0;
    document.getElementById('stockInTotal').value = qty * price;
  }

  saveStockInForm(e) {
    e.preventDefault();

    const date = document.getElementById('stockInDate').value;
    const ingId = document.getElementById('stockInIngredient').value;
    const qty = Number(document.getElementById('stockInQty').value) || 0;
    const unitPrice = Number(document.getElementById('stockInUnitPrice').value) || 0;
    const paymentMethod = document.getElementById('stockInPayment').value;
    const notes = document.getElementById('stockInNotes').value.trim();

    if (!ingId || qty <= 0) {
      this.showToast('Pilih bahan dan masukkan jumlah yang valid', 'warning');
      return;
    }

    const ing = this.dm.getIngredientById(ingId);
    if (!ing) return;

    // 1. Adjust stock (adds stock + logs)
    this.dm.adjustStock(ingId, 'in', qty, unitPrice, date, '', notes || `Pembelian ${ing.name}`);

    // 2. Auto-create expense transaction for "Bahan Baku"
    const totalPrice = qty * unitPrice;
    this.dm.addTransaction({
      type: 'expense',
      date: date,
      category: 'Bahan Baku',
      description: `Beli ${ing.name} (${qty} ${ing.unit})`,
      amount: totalPrice,
      paymentMethod: paymentMethod,
      notes: notes || `Stok masuk via Master Bahan`,
      linkedIngredientId: ingId
    });

    this.hideModal('modalStockIn');
    this.showToast(`Stok ${ing.name} bertambah +${qty} ${ing.unit} & tercatat sebagai pengeluaran Rp ${Utils.formatRupiah(totalPrice)}`, 'success');
    this.renderCurrentView();
  }

  // --- Stock Out Modal (Production Usage) ---

  openStockOutModal() {
    document.getElementById('stockOutForm').reset();
    document.getElementById('stockOutDate').value = new Date().toISOString().split('T')[0];
    this._populateStockIngredientSelect('stockOutIngredient');
    document.getElementById('stockOutRemaining').value = '';
    this.showModal('modalStockOut');
  }

  openStockOutForIngredient(ingId) {
    this.openStockOutModal();
    document.getElementById('stockOutIngredient').value = ingId;
    this.onStockOutIngredientChanged();
  }

  onStockOutIngredientChanged() {
    const ingId = document.getElementById('stockOutIngredient').value;
    const ing = this.dm.getIngredientById(ingId);
    if (ing) {
      document.getElementById('stockOutRemaining').value = `${ing.stock || 0} ${ing.unit} tersisa`;
    } else {
      document.getElementById('stockOutRemaining').value = '';
    }
  }

  saveStockOutForm(e) {
    e.preventDefault();

    const date = document.getElementById('stockOutDate').value;
    const ingId = document.getElementById('stockOutIngredient').value;
    const qty = Number(document.getElementById('stockOutQty').value) || 0;
    const notes = document.getElementById('stockOutNotes').value.trim();

    if (!ingId || qty <= 0) {
      this.showToast('Pilih bahan dan masukkan jumlah yang valid', 'warning');
      return;
    }

    const ing = this.dm.getIngredientById(ingId);
    if (!ing) return;

    if (qty > ing.stock) {
      this.showToast(`Stok ${ing.name} tidak cukup! Tersisa ${ing.stock} ${ing.unit}`, 'warning');
      return;
    }

    this.dm.adjustStock(ingId, 'out', qty, ing.lastPrice, date, '', notes || `Pemakaian produksi`);

    this.hideModal('modalStockOut');
    this.showToast(`Stok ${ing.name} berkurang -${qty} ${ing.unit}`, 'success');
    this.renderCurrentView();
  }

  // --- Helper: Populate ingredient select dropdown ---
  _populateStockIngredientSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = '<option value="">-- Pilih Bahan --</option>';
    const ingredients = this.dm.getIngredients(true);

    // Group by category
    const grouped = {};
    ingredients.forEach(ing => {
      if (!grouped[ing.category]) grouped[ing.category] = [];
      grouped[ing.category].push(ing);
    });

    Object.keys(grouped).sort().forEach(cat => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = cat;
      grouped[cat].forEach(ing => {
        const opt = document.createElement('option');
        opt.value = ing.id;
        opt.textContent = `${ing.name} (stok: ${ing.stock || 0} ${ing.unit})`;
        optgroup.appendChild(opt);
      });
      select.appendChild(optgroup);
    });
  }

  // --- Expense ↔ Master Bahan Integration ---

  /**
   * Called when expense category changes - show/hide ingredient link section
   */
  onExpenseCategoryChanged() {
    const category = document.getElementById('expenseCategory').value;
    const linkGroup = document.getElementById('expenseIngredientLinkGroup');
    if (!linkGroup) return;

    if (category === 'Bahan Baku') {
      linkGroup.style.display = 'block';
      this._populateExpenseIngredientSelect();
    } else {
      linkGroup.style.display = 'none';
      const linkSelect = document.getElementById('expenseIngredientLink');
      if (linkSelect) linkSelect.value = '';
    }
  }

  _populateExpenseIngredientSelect() {
    const select = document.getElementById('expenseIngredientLink');
    if (!select) return;

    select.innerHTML = `
      <option value="">-- Tidak ditautkan --</option>
      <option value="__NEW__">➕ Tambah Sebagai Bahan Baru di Master Bahan...</option>
    `;
    const ingredients = this.dm.getIngredients(true);

    ingredients.forEach(ing => {
      const opt = document.createElement('option');
      opt.value = ing.id;
      opt.textContent = `${ing.name} (stok: ${ing.stock || 0} ${ing.unit})`;
      select.appendChild(opt);
    });

    // Populate category and unit selects for new ingredient
    const catSelect = document.getElementById('expenseNewIngCategory');
    if (catSelect && catSelect.children.length === 0) {
      catSelect.innerHTML = INGREDIENT_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    const unitSelect = document.getElementById('expenseNewIngUnit');
    if (unitSelect && unitSelect.children.length === 0) {
      unitSelect.innerHTML = HPP_UNIT_OPTIONS.map(u => `<option value="${u}">${u}</option>`).join('');
    }
  }

  onExpenseIngredientLinkChanged() {
    const ingId = document.getElementById('expenseIngredientLink').value;
    const qtyGroup = document.getElementById('expenseIngredientQtyGroup');
    const newGroup = document.getElementById('expenseNewIngredientGroup');
    if (!qtyGroup) return;

    if (ingId === '__NEW__') {
      qtyGroup.style.display = 'none';
      if (newGroup) {
        newGroup.style.display = 'block';
        const descInput = document.getElementById('expenseDescription');
        const nameInput = document.getElementById('expenseNewIngName');
        if (descInput && nameInput && !nameInput.value.trim()) {
          nameInput.value = descInput.value.trim();
        }
      }
    } else if (ingId) {
      if (newGroup) newGroup.style.display = 'none';
      qtyGroup.style.display = 'grid';
      const ing = this.dm.getIngredientById(ingId);
      if (ing) {
        document.getElementById('expenseIngredientUnit').value = ing.unit;
      }
    } else {
      qtyGroup.style.display = 'none';
      if (newGroup) newGroup.style.display = 'none';
    }
  }

  // ==========================================
  // HPP CALCULATOR
  // ==========================================

  /**
   * Opens the HPP Calculator modal.
   * If editing a product, loads its existing ingredients.
   * Otherwise starts fresh or from a template.
   */
  openHppCalculator() {
    // Read current product form context
    const prodName = document.getElementById('prodNameInput').value.trim() || 'Produk Baru';
    const prodCategory = document.getElementById('prodCategoryInput').value;
    const prodPrice = Number(document.getElementById('prodPriceInput').value) || 0;

    // Display product info in the calculator banner
    this.updateElementText('hppCalcProductName', prodName);
    this.updateElementText('hppCalcCategory', prodCategory);
    this.updateElementText('hppCalcSellingPrice', Utils.formatRupiah(prodPrice));

    // Populate template dropdown
    this._populateHppTemplateOptions();

    // Load existing ingredients if editing, or use cached ones from this session
    let ingredients = [];

    if (this.editingProdId) {
      const prod = this.dm.getProductById(this.editingProdId);
      if (prod && prod.hppIngredients && prod.hppIngredients.length > 0) {
        ingredients = JSON.parse(JSON.stringify(prod.hppIngredients)); // deep clone
      }
    }

    // If we have cached ingredients from this session (user already opened calc), prefer those
    if (this._currentHppIngredients && this._currentHppIngredients.length > 0) {
      ingredients = JSON.parse(JSON.stringify(this._currentHppIngredients));
    }

    // If still empty, check if the category has a template
    if (ingredients.length === 0 && DEFAULT_HPP_TEMPLATES[prodCategory]) {
      ingredients = JSON.parse(JSON.stringify(DEFAULT_HPP_TEMPLATES[prodCategory]));
    }

    this._hppIngredients = ingredients;
    this._hppSellingPrice = prodPrice;

    this.renderHppIngredientsTable();
    this.updateHppSummary();
    this.showModal('modalHppCalc');
  }

  /**
   * Populate HPP template dropdown with available categories
   */
  _populateHppTemplateOptions() {
    const select = document.getElementById('hppTemplateSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- Pilih Template Resep --</option>';
    Object.keys(DEFAULT_HPP_TEMPLATES).forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat + ` (${DEFAULT_HPP_TEMPLATES[cat].length} bahan)`;
      select.appendChild(opt);
    });

    // Pre-select current category
    const currentCat = document.getElementById('prodCategoryInput').value;
    if (DEFAULT_HPP_TEMPLATES[currentCat]) {
      select.value = currentCat;
    }
  }

  /**
   * Load ingredient rows from a template category
   */
  loadHppTemplate(templateKey) {
    if (!templateKey || !DEFAULT_HPP_TEMPLATES[templateKey]) {
      this.showToast('Pilih template resep terlebih dahulu', 'warning');
      return;
    }

    // Ask confirmation if there are already ingredients
    if (this._hppIngredients.length > 0) {
      if (!confirm('Memuat template akan mengganti daftar bahan saat ini. Lanjutkan?')) return;
    }

    this._hppIngredients = JSON.parse(JSON.stringify(DEFAULT_HPP_TEMPLATES[templateKey]));
    this.renderHppIngredientsTable();
    this.updateHppSummary();
    this.showToast(`Template "${templateKey}" berhasil dimuat (${this._hppIngredients.length} bahan)`, 'success');
  }

  /**
   * Add an empty ingredient row
   */
  addHppIngredientRow() {
    this._hppIngredients.push({
      name: '',
      qty: 1,
      unit: 'gram',
      unitPrice: 0
    });
    this.renderHppIngredientsTable();

    // Focus the new row's name input
    setTimeout(() => {
      const tbody = document.getElementById('hppIngredientsBody');
      if (tbody) {
        const lastRow = tbody.lastElementChild;
        if (lastRow) {
          const nameInput = lastRow.querySelector('.hpp-input-name');
          if (nameInput) nameInput.focus();
        }
      }
    }, 50);
  }

  /**
   * Remove an ingredient row by index
   */
  removeHppIngredient(index) {
    this._hppIngredients.splice(index, 1);
    this.renderHppIngredientsTable();
    this.updateHppSummary();
  }

  /**
   * Render all ingredient rows in the HPP calculator table
   */
  renderHppIngredientsTable() {
    const tbody = document.getElementById('hppIngredientsBody');
    if (!tbody) return;

    // Build datalist for ingredient auto-suggest from Master Bahan
    let datalistEl = document.getElementById('hppBahanSuggest');
    if (!datalistEl) {
      datalistEl = document.createElement('datalist');
      datalistEl.id = 'hppBahanSuggest';
      document.body.appendChild(datalistEl);
    }
    const masterIngredients = this.dm.getIngredients(true);
    datalistEl.innerHTML = masterIngredients.map(ing =>
      `<option value="${this._escHtml(ing.name)}" data-id="${ing.id}">`
    ).join('');

    if (this._hppIngredients.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="hpp-empty-state">
              <div class="hpp-empty-icon">📦</div>
              <p><strong>Belum ada bahan</strong></p>
              <p class="small">Klik "➕ Tambah Bahan" atau muat template resep untuk memulai</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    // Build unit options HTML
    const unitOptionsHtml = HPP_UNIT_OPTIONS.map(u => `<option value="${u}">${u}</option>`).join('');

    let html = '';
    this._hppIngredients.forEach((ing, i) => {
      const subtotal = (ing.qty || 0) * (ing.unitPrice || 0);
      const masterIng = ing.name ? this.dm.findIngredientByName(ing.name.trim()) : null;

      let masterBadgeHtml = '';
      if (masterIng) {
        const isLow = masterIng.stock <= masterIng.minStock;
        const isEmpty = masterIng.stock <= 0;
        const badgeClass = isEmpty ? 'stock-badge-empty' : (isLow ? 'stock-badge-low' : 'stock-badge-ok');
        const badgeIcon = isEmpty ? '🔴' : (isLow ? '⚠️' : '✅');
        masterBadgeHtml = `
          <div style="font-size: 0.72rem; margin-top: 3px; display: flex; align-items: center; gap: 4px;">
            <span class="stock-badge ${badgeClass}" style="padding: 1px 6px; font-size: 0.68rem;" title="Bahan terdaftar di Master Bahan">
              ${badgeIcon} Stok: ${masterIng.stock} ${masterIng.unit}
            </span>
          </div>
        `;
      } else if (ing.name && ing.name.trim()) {
        masterBadgeHtml = `
          <div style="font-size: 0.72rem; margin-top: 3px; display: flex; align-items: center; gap: 4px; color: var(--color-text-secondary);">
            <span>Belum di Master</span>
            <button type="button" class="btn btn-xs btn-outline-primary" style="padding: 1px 5px; font-size: 0.65rem;" onclick="app.quickAddHppIngToMaster(${i})" title="Daftarkan bahan ini ke Master Bahan">
              + Simpan ke Master
            </button>
          </div>
        `;
      }

      html += `
        <tr>
          <td class="hpp-row-num">${i + 1}</td>
          <td>
            <input type="text" class="hpp-input hpp-input-name" value="${this._escHtml(ing.name)}"
              placeholder="Nama bahan..." data-idx="${i}" data-field="name" list="hppBahanSuggest"
              onchange="app.onHppIngredientNameChanged(${i}, this.value)">
            ${masterBadgeHtml}
          </td>
          <td>
            <input type="number" class="hpp-input hpp-input-qty" value="${ing.qty}"
              min="0" step="0.01" data-idx="${i}" data-field="qty"
              oninput="app.updateHppIngredient(${i}, 'qty', this.value)">
          </td>
          <td>
            <select class="hpp-select" data-idx="${i}" data-field="unit"
              onchange="app.updateHppIngredient(${i}, 'unit', this.value)">
              ${HPP_UNIT_OPTIONS.map(u =>
                `<option value="${u}" ${u === ing.unit ? 'selected' : ''}>${u}</option>`
              ).join('')}
            </select>
          </td>
          <td>
            <input type="number" class="hpp-input hpp-input-number" value="${ing.unitPrice}"
              min="0" step="100" data-idx="${i}" data-field="unitPrice"
              oninput="app.updateHppIngredient(${i}, 'unitPrice', this.value)">
          </td>
          <td class="hpp-subtotal">${Utils.formatRupiah(subtotal)}</td>
          <td class="text-center">
            <button type="button" class="btn-remove-ingredient" title="Hapus bahan"
              onclick="app.removeHppIngredient(${i})">✕</button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  /**
   * Quick add an ingredient from HPP calculator to Master Bahan
   */
  quickAddHppIngToMaster(index) {
    const ing = this._hppIngredients[index];
    if (!ing || !ing.name || !ing.name.trim()) return;

    const nameTrim = ing.name.trim();
    const nameLower = nameTrim.toLowerCase();
    let cat = 'Lainnya';
    if (nameLower.includes('tepung') || nameLower.includes('maizena')) cat = 'Tepung & Pati';
    else if (nameLower.includes('telur') || nameLower.includes('susu')) cat = 'Telur & Susu';
    else if (nameLower.includes('gula') || nameLower.includes('pemanis')) cat = 'Gula & Pemanis';
    else if (nameLower.includes('mentega') || nameLower.includes('margarin') || nameLower.includes('minyak')) cat = 'Lemak & Minyak';
    else if (nameLower.includes('coklat') || nameLower.includes('chocolate') || nameLower.includes('kakao')) cat = 'Coklat & Kakao';
    else if (nameLower.includes('keju') || nameLower.includes('santan') || nameLower.includes('dairy')) cat = 'Keju & Dairy';
    else if (nameLower.includes('baking') || nameLower.includes('ragi') || nameLower.includes('pengembang')) cat = 'Pengembang & Pengemulsi';
    else if (nameLower.includes('vanili') || nameLower.includes('pandan') || nameLower.includes('perisa') || nameLower.includes('garam')) cat = 'Perisa & Pewarna';
    else if (nameLower.includes('box') || nameLower.includes('kemasan') || nameLower.includes('plastik') || nameLower.includes('toples') || nameLower.includes('label')) cat = 'Kemasan';
    else if (nameLower.includes('gas') || nameLower.includes('elpiji')) cat = 'Bahan Bakar';

    const newIng = this.dm.addIngredient({
      name: nameTrim,
      category: cat,
      unit: ing.unit || 'gram',
      lastPrice: ing.unitPrice || 0,
      stock: 0,
      minStock: 0,
      active: true
    });

    this.renderHppIngredientsTable();
    this.showToast(`Bahan "${newIng.name}" berhasil ditambahkan ke Master Bahan!`, 'success');
  }

  /**
   * Save all ingredients in the current HPP recipe that are not yet in Master Bahan
   */
  saveAllHppIngredientsToMaster() {
    if (!this._hppIngredients || this._hppIngredients.length === 0) {
      this.showToast('Tidak ada bahan untuk disimpan', 'warning');
      return;
    }

    let addedCount = 0;
    this._hppIngredients.forEach(ing => {
      if (!ing.name || !ing.name.trim()) return;
      const nameTrim = ing.name.trim();
      const existing = this.dm.findIngredientByName(nameTrim);
      if (!existing) {
        const nameLower = nameTrim.toLowerCase();
        let cat = 'Lainnya';
        if (nameLower.includes('tepung') || nameLower.includes('maizena')) cat = 'Tepung & Pati';
        else if (nameLower.includes('telur') || nameLower.includes('susu')) cat = 'Telur & Susu';
        else if (nameLower.includes('gula')) cat = 'Gula & Pemanis';
        else if (nameLower.includes('mentega') || nameLower.includes('margarin') || nameLower.includes('minyak')) cat = 'Lemak & Minyak';
        else if (nameLower.includes('coklat') || nameLower.includes('chocolate')) cat = 'Coklat & Kakao';
        else if (nameLower.includes('keju') || nameLower.includes('santan')) cat = 'Keju & Dairy';
        else if (nameLower.includes('baking') || nameLower.includes('ragi')) cat = 'Pengembang & Pengemulsi';
        else if (nameLower.includes('vanili') || nameLower.includes('pandan') || nameLower.includes('garam')) cat = 'Perisa & Pewarna';
        else if (nameLower.includes('box') || nameLower.includes('kemasan') || nameLower.includes('plastik') || nameLower.includes('toples') || nameLower.includes('label')) cat = 'Kemasan';
        else if (nameLower.includes('gas') || nameLower.includes('elpiji')) cat = 'Bahan Bakar';

        this.dm.addIngredient({
          name: nameTrim,
          category: cat,
          unit: ing.unit || 'gram',
          lastPrice: ing.unitPrice || 0,
          stock: 0,
          minStock: 0,
          active: true
        });
        addedCount++;
      }
    });

    this.renderHppIngredientsTable();
    if (addedCount > 0) {
      this.showToast(`${addedCount} bahan baru berhasil didaftarkan ke Master Bahan!`, 'success');
    } else {
      this.showToast('Semua bahan dalam resep ini sudah terdaftar di Master Bahan', 'info');
    }
  }

  /**
   * When an HPP ingredient name is changed, check if it matches a master bahan
   * and auto-fill the unit price from master data.
   */
  onHppIngredientNameChanged(index, name) {
    this.updateHppIngredient(index, 'name', name);

    // Try to find matching ingredient in master bahan
    const masterIng = this.dm.findIngredientByName(name);
    if (masterIng) {
      // Auto-fill unit price and unit from master data
      this._hppIngredients[index].unitPrice = masterIng.lastPrice;
      this._hppIngredients[index].unit = masterIng.unit;
      // Re-render to show updated values
      this.renderHppIngredientsTable();
      this.updateHppSummary();
      this.showToast(`Harga ${masterIng.name} dimuat dari Master Bahan: ${Utils.formatRupiah(masterIng.lastPrice)}/${masterIng.unit}`, 'info');
    }
  }

  /**
   * Helper to escape HTML in template literals
   */
  _escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /**
   * Update a single ingredient field and recalculate
   */
  updateHppIngredient(index, field, value) {
    if (!this._hppIngredients[index]) return;

    if (field === 'qty' || field === 'unitPrice') {
      this._hppIngredients[index][field] = Number(value) || 0;
    } else {
      this._hppIngredients[index][field] = value;
    }

    // Update the subtotal for this row visually
    const tbody = document.getElementById('hppIngredientsBody');
    if (tbody) {
      const row = tbody.children[index];
      if (row) {
        const subtotalCell = row.querySelector('.hpp-subtotal');
        if (subtotalCell) {
          const ing = this._hppIngredients[index];
          const subtotal = (ing.qty || 0) * (ing.unitPrice || 0);
          subtotalCell.textContent = Utils.formatRupiah(subtotal);
        }
      }
    }

    this.updateHppSummary();
  }

  /**
   * Recalculate and display HPP summary (total cost, margin estimate, item count)
   */
  updateHppSummary() {
    const totalCost = this._hppIngredients.reduce((sum, ing) => {
      return sum + ((ing.qty || 0) * (ing.unitPrice || 0));
    }, 0);

    const itemCount = this._hppIngredients.filter(ing => ing.name && ing.name.trim()).length;
    const sellingPrice = this._hppSellingPrice || 0;
    const margin = sellingPrice - totalCost;
    const marginPct = sellingPrice > 0 ? ((margin / sellingPrice) * 100).toFixed(1) : 0;

    this.updateElementText('hppTotalItems', `${itemCount} item`);
    this.updateElementText('hppTotalCost', Utils.formatRupiah(totalCost));

    const marginEl = document.getElementById('hppMarginEstimate');
    if (marginEl) {
      marginEl.textContent = `${Utils.formatRupiah(margin)} (${marginPct}%)`;
      marginEl.style.color = margin >= 0 ? 'var(--color-income)' : 'var(--color-expense)';
    }
  }

  /**
   * Apply the calculated HPP total back to the product form
   */
  applyHppResult() {
    const totalCost = this._hppIngredients.reduce((sum, ing) => {
      return sum + ((ing.qty || 0) * (ing.unitPrice || 0));
    }, 0);

    // Round to nearest whole number
    const roundedCost = Math.round(totalCost);

    // Set the costPrice input
    const costInput = document.getElementById('prodCostInput');
    if (costInput) {
      costInput.value = roundedCost;
      // Trigger input event for margin recalculation
      costInput.dispatchEvent(new Event('input'));
    }

    // Cache the ingredients for saving with the product
    this._currentHppIngredients = JSON.parse(JSON.stringify(this._hppIngredients));

    this.hideModal('modalHppCalc');
    this.showToast(`HPP dihitung: ${Utils.formatRupiah(roundedCost)} dari ${this._hppIngredients.length} bahan`, 'success');
  }

  /**
   * Clear all ingredients in the HPP calculator
   */
  clearAllHppIngredients() {
    if (this._hppIngredients.length === 0) return;
    if (!confirm('Hapus semua bahan dari daftar?')) return;

    this._hppIngredients = [];
    this.renderHppIngredientsTable();
    this.updateHppSummary();
  }

  /**
   * Open HPP calculator directly from the products table for a specific product
   */
  openHppCalcForProduct(prodId) {
    const prod = this.dm.getProductById(prodId);
    if (!prod) return;

    // Pre-fill the product modal first, then open HPP calc
    this.editProduct(prodId);

    // Small delay to let the modal render, then open HPP calc on top
    setTimeout(() => {
      this.openHppCalculator();
    }, 150);
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

    // Ingredient form submit
    const ingredientForm = document.getElementById('ingredientForm');
    if (ingredientForm) ingredientForm.addEventListener('submit', e => this.saveIngredientForm(e));

    // Stock In form submit
    const stockInForm = document.getElementById('stockInForm');
    if (stockInForm) stockInForm.addEventListener('submit', e => this.saveStockInForm(e));

    // Stock Out form submit
    const stockOutForm = document.getElementById('stockOutForm');
    if (stockOutForm) stockOutForm.addEventListener('submit', e => this.saveStockOutForm(e));

    // Expense category change → show/hide ingredient link
    const expenseCat = document.getElementById('expenseCategory');
    if (expenseCat) expenseCat.addEventListener('change', () => this.onExpenseCategoryChanged());

    // Expense ingredient link change → show/hide qty fields
    const expenseIngLink = document.getElementById('expenseIngredientLink');
    if (expenseIngLink) expenseIngLink.addEventListener('change', () => this.onExpenseIngredientLinkChanged());

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

    // Ingredient filter listeners
    const ingSearch = document.getElementById('ingredientSearchInput');
    if (ingSearch) {
      ingSearch.addEventListener('input', () => {
        this.ingredientFilter.search = ingSearch.value;
        this.renderIngredientsTable();
      });
    }

    const ingCatFilter = document.getElementById('ingredientCategoryFilter');
    if (ingCatFilter) {
      ingCatFilter.addEventListener('change', () => {
        this.ingredientFilter.category = ingCatFilter.value;
        this.renderIngredientsTable();
      });
    }

    const ingStockFilter = document.getElementById('ingredientStockFilter');
    if (ingStockFilter) {
      ingStockFilter.addEventListener('change', () => {
        this.ingredientFilter.stockStatus = ingStockFilter.value;
        this.renderIngredientsTable();
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

  // ==========================================
  // SQLITE DATABASE STATUS & MANAGEMENT
  // ==========================================

  updateDbStatusBadge(detail) {
    const dot = document.getElementById('dbStatusDot');
    const text = document.getElementById('dbStatusText');
    const badge = document.getElementById('dbStatusBadge');
    if (!dot || !text) return;

    if (detail && detail.connected) {
      dot.className = 'db-dot online';
      text.textContent = 'SQLite Aktif';
      if (badge) {
        badge.title = 'Terhubung ke database SQLite (bolu_bu_eko.db). Semua transaksi tersimpan di database file.';
        badge.style.borderColor = 'var(--color-income)';
      }
    } else {
      dot.className = 'db-dot offline';
      text.textContent = 'Mode Offline';
      if (badge) {
        badge.title = 'Mode offline lokal browser. Jalankan start_server.bat untuk menyimpan ke file database SQLite.';
        badge.style.borderColor = 'var(--color-warning)';
      }
    }
  }

  async showDbInfoModal() {
    const container = document.getElementById('dbModalContent');
    if (!container) return;

    const isConnected = this.dm.isUsingDb;
    const info = this.dm.dbInfo;

    if (isConnected && info) {
      const counts = info.counts || {};
      const sizeKb = info.sizeBytes ? (info.sizeBytes / 1024).toFixed(1) : 0;

      container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem; background: var(--color-income-soft); border-radius: var(--radius-md); margin-bottom: 1rem;">
          <span style="font-size: 1.8rem;">🟢</span>
          <div>
            <div style="font-weight: 700; color: var(--color-income); font-size: 1rem;">Database SQLite Terhubung</div>
            <div class="small text-muted">File: <code>${info.file}</code> (${sizeKb} KB)</div>
          </div>
        </div>

        <div class="small text-muted" style="line-height: 1.5; margin-bottom: 0.5rem;">
          Semua transaksi pemasukan, pengeluaran, katalog bolu, master bahan baku, dan riwayat mutasi stok tersimpan langsung ke file database SQLite <strong>${info.file}</strong> di komputer toko Anda.
        </div>

        <div class="db-info-grid">
          <div class="db-info-card">
            <div class="db-info-num">${counts.transactions || 0}</div>
            <div class="db-info-title">Transaksi Kas</div>
          </div>
          <div class="db-info-card">
            <div class="db-info-num">${counts.products || 0}</div>
            <div class="db-info-title">Produk Bolu</div>
          </div>
          <div class="db-info-card">
            <div class="db-info-num">${counts.ingredients || 0}</div>
            <div class="db-info-title">Master Bahan</div>
          </div>
          <div class="db-info-card">
            <div class="db-info-num">${counts.stock_log || 0}</div>
            <div class="db-info-title">Mutasi Stok</div>
          </div>
        </div>

        <div style="margin-top: 1rem; padding: 0.75rem; background: var(--color-bg); border-radius: var(--radius-sm); border: 1px solid var(--color-border); font-size: 0.78rem;">
          <strong>💡 Tips Multi-User:</strong> Perangkat lain (HP / tablet kasir / laptop) di jaringan WiFi toko dapat mengakses aplikasi ini dengan membuka alamat: <code>http://[IP-Komputer-Ini]:5000</code>.
        </div>
      `;
    } else {
      container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem; background: var(--color-warning-soft); border-radius: var(--radius-md); margin-bottom: 1rem;">
          <span style="font-size: 1.8rem;">📁</span>
          <div>
            <div style="font-weight: 700; color: var(--color-warning); font-size: 1rem;">Mode Offline (Browser Storage)</div>
            <div class="small text-muted">Aplikasi dibuka langsung via file browser</div>
          </div>
        </div>

        <p class="small text-muted" style="line-height: 1.6;">
          Saat ini aplikasi sedang berjalan dalam mode offline (data tersimpan di memori browser). Untuk mengaktifkan penyimpanan ke <strong>file database SQLite (bolu_bu_eko.db)</strong>:
        </p>

        <ol class="small" style="padding-left: 1.25rem; line-height: 1.8; color: var(--color-text);">
          <li>Buka folder proyek <code>cashflow Bolu Bu Eko</code>.</li>
          <li>Double-click file <strong><code>start_server.bat</code></strong>.</li>
          <li>Aplikasi akan otomatis terbuka di browser pada <code>http://localhost:5000</code> dan terhubung ke database SQLite.</li>
        </ol>

        <div style="margin-top: 0.75rem; text-align: center;">
          <button type="button" class="btn btn-primary btn-sm" onclick="app.refreshDbStatus()">
            🔄 Coba Hubungkan ke Server SQLite
          </button>
        </div>
      `;
    }

    this.showModal('modalDbInfo');
  }

  async refreshDbStatus() {
    this.showToast('Memeriksa koneksi database SQLite...', 'info');
    const connected = await this.dm.checkDatabaseConnection();
    if (connected) {
      this.showToast('✅ Berhasil terhubung ke database SQLite (bolu_bu_eko.db)!', 'success');
      this.renderCurrentView();
      if (document.getElementById('modalDbInfo').classList.contains('show')) {
        this.showDbInfoModal();
      }
    } else {
      this.showToast('Server lokal belum berjalan. Buka start_server.bat untuk mengaktifkannya.', 'warning');
    }
  }
}
