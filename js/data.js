/**
 * DATA MANAGEMENT MODULE - Bolu Bu Eko Cashflow
 * Handles LocalStorage persistence, sample data seeding, CRUD operations,
 * and calculations for analytics and reports.
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'bolu_bu_eko_transactions_v1',
  PRODUCTS: 'bolu_bu_eko_products_v1',
  RECURRING: 'bolu_bu_eko_recurring_v1',
  PROFILE: 'bolu_bu_eko_profile_v1',
  SETTINGS: 'bolu_bu_eko_settings_v1'
};

// Default Bakery Profile
const DEFAULT_PROFILE = {
  name: 'Bolu Bu Eko',
  tagline: 'Spesialis Bolu Lembut & Gurih Tradisional',
  address: 'Jl. Palagan Tentara Pelajar No. 45, Sleman, D.I. Yogyakarta',
  phone: '0812-3456-7890',
  owner: 'Ibu Eko Suryani',
  email: 'bolubueko.bakery@gmail.com'
};

// Default Settings
const DEFAULT_SETTINGS = {
  darkMode: false,
  unusualExpenseThreshold: 1000000, // IDR 1.000.000+ flagged as unusual or high
  currency: 'IDR'
};

// Available Product Categories
const PRODUCT_CATEGORIES = [
  'Bolu Original',
  'Bolu Coklat',
  'Bolu Keju',
  'Bolu Pandan',
  'Bolu Marble',
  'Kue Kering',
  'Roti',
  'Pesanan Khusus',
  'Lainnya'
];

// Available Expense Categories
const EXPENSE_CATEGORIES = [
  'Bahan Baku',
  'Kemasan',
  'Gaji Karyawan',
  'Listrik & Air',
  'Gas',
  'Sewa Tempat',
  'Perawatan Alat',
  'Transportasi',
  'Pajak',
  'Marketing',
  'Lainnya'
];

// Payment Methods
const PAYMENT_METHODS = ['Tunai', 'Transfer', 'QRIS'];

// Helper to format Date to YYYY-MM-DD
function toDateInputValue(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Generate relative dates from today
function relativeDate(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return toDateInputValue(d);
}

// Default Products Seed Data
function getDefaultProducts() {
  return [
    {
      id: 'prod_1',
      name: 'Bolu Gulung Pandan Keju',
      category: 'Bolu Pandan',
      price: 45000,
      costPrice: 22000,
      active: true,
      isFavorite: true
    },
    {
      id: 'prod_2',
      name: 'Bolu Tape Keju Panggang',
      category: 'Bolu Keju',
      price: 50000,
      costPrice: 24000,
      active: true,
      isFavorite: true
    },
    {
      id: 'prod_3',
      name: 'Bolu Coklat Fudge Lava',
      category: 'Bolu Coklat',
      price: 55000,
      costPrice: 26000,
      active: true,
      isFavorite: true
    },
    {
      id: 'prod_4',
      name: 'Bolu Marble Jadul Premium',
      category: 'Bolu Marble',
      price: 48000,
      costPrice: 21000,
      active: true,
      isFavorite: true
    },
    {
      id: 'prod_5',
      name: 'Bolu Pisang Keju Kismis',
      category: 'Bolu Original',
      price: 42000,
      costPrice: 19000,
      active: true,
      isFavorite: true
    },
    {
      id: 'prod_6',
      name: 'Chiffon Cake Pandan Santan',
      category: 'Bolu Pandan',
      price: 52000,
      costPrice: 23000,
      active: true,
      isFavorite: false
    },
    {
      id: 'prod_7',
      name: 'Kastengel Keju Edam Toples',
      category: 'Kue Kering',
      price: 85000,
      costPrice: 42000,
      active: true,
      isFavorite: false
    },
    {
      id: 'prod_8',
      name: 'Roti Sisir Mentega Gula (Isi 6)',
      category: 'Roti',
      price: 28000,
      costPrice: 12000,
      active: true,
      isFavorite: false
    }
  ];
}

// Default Recurring Expenses Seed Data
function getDefaultRecurringExpenses() {
  return [
    {
      id: 'rec_1',
      description: 'Sewa Tempat Dapur & Toko',
      category: 'Sewa Tempat',
      amount: 2500000,
      paymentMethod: 'Transfer',
      dayOfMonth: 1,
      notes: 'Pembayaran rutin sewa bulanan ruko'
    },
    {
      id: 'rec_2',
      description: 'Tagihan Listrik PLN & Air PDAM',
      category: 'Listrik & Air',
      amount: 650000,
      paymentMethod: 'Transfer',
      dayOfMonth: 10,
      notes: 'Perkiraan tagihan utilitas bulanan'
    },
    {
      id: 'rec_3',
      description: 'Gaji Karyawan Utama Dapur',
      category: 'Gaji Karyawan',
      amount: 2000000,
      paymentMethod: 'Transfer',
      dayOfMonth: 28,
      notes: 'Gaji bulanan kepala baker'
    },
    {
      id: 'rec_4',
      description: 'Langganan Wi-Fi & Software Kasir',
      category: 'Marketing',
      amount: 300000,
      paymentMethod: 'Transfer',
      dayOfMonth: 15,
      notes: 'Internet dan sistem operasional'
    }
  ];
}

// Default Transactions Seed Data (Spanning last 28 days)
function getDefaultTransactions() {
  return [
    // Today
    {
      id: 'trx_inc_01',
      type: 'income',
      date: relativeDate(0),
      category: 'Bolu Pandan',
      productId: 'prod_1',
      productName: 'Bolu Gulung Pandan Keju',
      quantity: 4,
      unitPrice: 45000,
      total: 180000,
      paymentMethod: 'QRIS',
      notes: 'Pelanggan langganan grab/takeaway'
    },
    {
      id: 'trx_inc_02',
      type: 'income',
      date: relativeDate(0),
      category: 'Bolu Coklat',
      productId: 'prod_3',
      productName: 'Bolu Coklat Fudge Lava',
      quantity: 3,
      unitPrice: 55000,
      total: 165000,
      paymentMethod: 'Tunai',
      notes: 'Beli langsung di outlet'
    },
    // 1 day ago
    {
      id: 'trx_inc_03',
      type: 'income',
      date: relativeDate(-1),
      category: 'Bolu Keju',
      productId: 'prod_2',
      productName: 'Bolu Tape Keju Panggang',
      quantity: 5,
      unitPrice: 50000,
      total: 250000,
      paymentMethod: 'Transfer',
      notes: 'Pesanan arisan keluarga'
    },
    {
      id: 'trx_exp_01',
      type: 'expense',
      date: relativeDate(-1),
      category: 'Bahan Baku',
      description: 'Beli Telur Ayam Segar 15 kg & Mentega Anchor 2 kg',
      amount: 495000,
      paymentMethod: 'Tunai',
      notes: 'Toko bahan kue Berkah Jaya'
    },
    // 2 days ago
    {
      id: 'trx_inc_04',
      type: 'income',
      date: relativeDate(-2),
      category: 'Bolu Marble',
      productId: 'prod_4',
      productName: 'Bolu Marble Jadul Premium',
      quantity: 6,
      unitPrice: 48000,
      total: 288000,
      paymentMethod: 'QRIS',
      notes: 'Oleh-oleh tamu luar kota'
    },
    {
      id: 'trx_exp_02',
      type: 'expense',
      date: relativeDate(-2),
      category: 'Kemasan',
      description: 'Kotak Dus Bolu Sablon Emas 300 pcs & Kantong Ramah Lingkungan',
      amount: 420000,
      paymentMethod: 'Transfer',
      notes: 'Percetakan Kemasan Jaya'
    },
    // 3 days ago
    {
      id: 'trx_inc_05',
      type: 'income',
      date: relativeDate(-3),
      category: 'Kue Kering',
      productId: 'prod_7',
      productName: 'Kastengel Keju Edam Toples',
      quantity: 4,
      unitPrice: 85000,
      total: 340000,
      paymentMethod: 'Transfer',
      notes: 'Hantaran bingkisan kantor'
    },
    // 5 days ago
    {
      id: 'trx_inc_06',
      type: 'income',
      date: relativeDate(-5),
      category: 'Bolu Original',
      productId: 'prod_5',
      productName: 'Bolu Pisang Keju Kismis',
      quantity: 7,
      unitPrice: 42000,
      total: 294000,
      paymentMethod: 'Tunai',
      notes: 'Snack box pengajian ibu-ibu'
    },
    {
      id: 'trx_exp_03',
      type: 'expense',
      date: relativeDate(-5),
      category: 'Gas',
      description: 'Isi Ulang 2 Tabung Gas Elpiji 12 kg Dapur Oven',
      amount: 430000,
      paymentMethod: 'Tunai',
      notes: 'Pangkalan Agen Gas Mandiri'
    },
    // 7 days ago
    {
      id: 'trx_inc_07',
      type: 'income',
      date: relativeDate(-7),
      category: 'Roti',
      productId: 'prod_8',
      productName: 'Roti Sisir Mentega Gula (Isi 6)',
      quantity: 10,
      unitPrice: 28000,
      total: 280000,
      paymentMethod: 'QRIS',
      notes: 'Sarapan kantor Bank Mandiri'
    },
    {
      id: 'trx_exp_04',
      type: 'expense',
      date: relativeDate(-7),
      category: 'Bahan Baku',
      description: 'Tepung Terigu Kunci Biru & Cakra Kembar (2 Sak @25kg) + Gula Pasir 20kg',
      amount: 670000,
      paymentMethod: 'Transfer',
      notes: 'Grosir Sembako Rejeki'
    },
    // 10 days ago
    {
      id: 'trx_inc_08',
      type: 'income',
      date: relativeDate(-10),
      category: 'Bolu Pandan',
      productId: 'prod_6',
      productName: 'Chiffon Cake Pandan Santan',
      quantity: 5,
      unitPrice: 52000,
      total: 260000,
      paymentMethod: 'Tunai',
      notes: 'Beli langsung untuk syukuran'
    },
    {
      id: 'trx_exp_05',
      type: 'expense',
      date: relativeDate(-10),
      category: 'Perawatan Alat',
      description: 'Ganti vanbelt mixer planetary & servis kalibrasi termostat oven',
      amount: 380000,
      paymentMethod: 'Tunai',
      notes: 'Teknisi Pak Joko Bakery Service'
    },
    // 13 days ago
    {
      id: 'trx_inc_09',
      type: 'income',
      date: relativeDate(-13),
      category: 'Bolu Coklat',
      productId: 'prod_3',
      productName: 'Bolu Coklat Fudge Lava',
      quantity: 6,
      unitPrice: 55000,
      total: 330000,
      paymentMethod: 'QRIS',
      notes: 'Pesanan ulang tahun anak'
    },
    {
      id: 'trx_exp_06',
      type: 'expense',
      date: relativeDate(-13),
      category: 'Marketing',
      description: 'Iklan Bersponsor Instagram & Facebook Ads Promo Bolu Spesial',
      amount: 250000,
      paymentMethod: 'Transfer',
      notes: 'Kampanye promosi weekend'
    },
    // 16 days ago
    {
      id: 'trx_inc_10',
      type: 'income',
      date: relativeDate(-16),
      category: 'Pesanan Khusus',
      productId: '',
      productName: 'Hampers Spesial Bolu 3 Rasa & Roll Cake Custom',
      quantity: 2,
      unitPrice: 225000,
      total: 450000,
      paymentMethod: 'Transfer',
      notes: 'Pesanan khusus hampers wisuda'
    },
    {
      id: 'trx_exp_07',
      type: 'expense',
      date: relativeDate(-16),
      category: 'Listrik & Air',
      description: 'Pembayaran Tagihan Listrik PLN Pascabayar & PDAM Produksi',
      amount: 680000,
      paymentMethod: 'Transfer',
      notes: 'Tagihan bulanan via m-Banking'
    },
    // 20 days ago
    {
      id: 'trx_inc_11',
      type: 'income',
      date: relativeDate(-20),
      category: 'Bolu Keju',
      productId: 'prod_2',
      productName: 'Bolu Tape Keju Panggang',
      quantity: 8,
      unitPrice: 50000,
      total: 400000,
      paymentMethod: 'QRIS',
      notes: 'Pesanan katering rapat dinas'
    },
    {
      id: 'trx_exp_08',
      type: 'expense',
      date: relativeDate(-20),
      category: 'Bahan Baku',
      description: 'Keju Kraft Cheddar 1 karton & Keju Edam Asli Belanda 2 roll',
      amount: 620000,
      paymentMethod: 'Transfer',
      notes: 'Suplier Bahan Keju Nusantara'
    },
    // 24 days ago
    {
      id: 'trx_inc_12',
      type: 'income',
      date: relativeDate(-24),
      category: 'Bolu Marble',
      productId: 'prod_4',
      productName: 'Bolu Marble Jadul Premium',
      quantity: 7,
      unitPrice: 48000,
      total: 336000,
      paymentMethod: 'Tunai',
      notes: 'Pesanan pelanggan baru via WhatsApp'
    },
    {
      id: 'trx_exp_09',
      type: 'expense',
      date: relativeDate(-24),
      category: 'Gaji Karyawan',
      description: 'Gaji & Bonus Bulanan Asisten Dapur & Kasir Toko',
      amount: 2200000,
      paymentMethod: 'Transfer',
      notes: 'Pengeluaran rutin bulanan 2 staf dapur'
    },
    // 27 days ago
    {
      id: 'trx_inc_13',
      type: 'income',
      date: relativeDate(-27),
      category: 'Bolu Pandan',
      productId: 'prod_1',
      productName: 'Bolu Gulung Pandan Keju',
      quantity: 9,
      unitPrice: 45000,
      total: 405000,
      paymentMethod: 'Transfer',
      notes: 'Pesanan hantaran lamaran'
    },
    {
      id: 'trx_inc_14',
      type: 'income',
      date: relativeDate(-27),
      category: 'Bolu Pisang Keju Kismis',
      productId: 'prod_5',
      productName: 'Bolu Pisang Keju Kismis',
      quantity: 5,
      unitPrice: 42000,
      total: 210000,
      paymentMethod: 'QRIS',
      notes: 'Takeaway pagi'
    },
    {
      id: 'trx_exp_10',
      type: 'expense',
      date: relativeDate(-27),
      category: 'Transportasi',
      description: 'Bensin Motor Operasional Antar Pesanan Bolu & Belanja Pasar',
      amount: 150000,
      paymentMethod: 'Tunai',
      notes: 'Uang bensin kurir internal toko'
    }
  ];
}

/**
 * DataManager Class
 * Provides unified interface to get, set, update, delete, and query data.
 */
class DataManager {
  constructor() {
    this.init();
  }

  init() {
    if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
      this.saveProducts(getDefaultProducts());
    }
    if (!localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) {
      this.saveTransactions(getDefaultTransactions());
    }
    if (!localStorage.getItem(STORAGE_KEYS.RECURRING)) {
      this.saveRecurring(getDefaultRecurringExpenses());
    }
    if (!localStorage.getItem(STORAGE_KEYS.PROFILE)) {
      this.saveProfile(DEFAULT_PROFILE);
    }
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      this.saveSettings(DEFAULT_SETTINGS);
    }
  }

  // --- Transactions ---
  getTransactions(filter = {}) {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      let list = raw ? JSON.parse(raw) : [];

      if (filter.type) {
        list = list.filter(t => t.type === filter.type);
      }
      if (filter.category && filter.category !== 'Semua') {
        list = list.filter(t => t.category === filter.category);
      }
      if (filter.paymentMethod && filter.paymentMethod !== 'Semua') {
        list = list.filter(t => t.paymentMethod === filter.paymentMethod);
      }
      if (filter.startDate) {
        list = list.filter(t => t.date >= filter.startDate);
      }
      if (filter.endDate) {
        list = list.filter(t => t.date <= filter.endDate);
      }
      if (filter.search) {
        const q = filter.search.toLowerCase().trim();
        list = list.filter(t => {
          const name = (t.productName || t.description || '').toLowerCase();
          const notes = (t.notes || '').toLowerCase();
          const cat = (t.category || '').toLowerCase();
          return name.includes(q) || notes.includes(q) || cat.includes(q);
        });
      }

      // Sort by date descending by default
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      return list;
    } catch (e) {
      console.error('Error getting transactions:', e);
      return [];
    }
  }

  getTransactionById(id) {
    const list = this.getTransactions();
    return list.find(t => t.id === id) || null;
  }

  saveTransactions(transactions) {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }

  addTransaction(data) {
    const list = this.getTransactions();
    const newTrx = {
      id: 'trx_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      createdAt: new Date().toISOString(),
      ...data
    };
    list.unshift(newTrx);
    this.saveTransactions(list);
    return newTrx;
  }

  updateTransaction(id, updatedData) {
    const list = this.getTransactions();
    const idx = list.findIndex(t => t.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updatedData, updatedAt: new Date().toISOString() };
      this.saveTransactions(list);
      return list[idx];
    }
    return null;
  }

  deleteTransaction(id) {
    let list = this.getTransactions();
    const beforeLen = list.length;
    list = list.filter(t => t.id !== id);
    this.saveTransactions(list);
    return list.length < beforeLen;
  }

  // --- Products ---
  getProducts(onlyActive = false) {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      let list = raw ? JSON.parse(raw) : [];
      if (onlyActive) {
        list = list.filter(p => p.active !== false);
      }
      return list;
    } catch (e) {
      console.error('Error getting products:', e);
      return [];
    }
  }

  getProductById(id) {
    const list = this.getProducts();
    return list.find(p => p.id === id) || null;
  }

  saveProducts(products) {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }

  addProduct(data) {
    const list = this.getProducts();
    const newProd = {
      id: 'prod_' + Date.now(),
      active: true,
      isFavorite: false,
      ...data
    };
    list.push(newProd);
    this.saveProducts(list);
    return newProd;
  }

  updateProduct(id, updatedData) {
    const list = this.getProducts();
    const idx = list.findIndex(p => p.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updatedData };
      this.saveProducts(list);
      return list[idx];
    }
    return null;
  }

  deleteProduct(id) {
    let list = this.getProducts();
    const beforeLen = list.length;
    list = list.filter(p => p.id !== id);
    this.saveProducts(list);
    return list.length < beforeLen;
  }

  toggleProductFavorite(id) {
    const prod = this.getProductById(id);
    if (prod) {
      return this.updateProduct(id, { isFavorite: !prod.isFavorite });
    }
    return null;
  }

  // --- Recurring Expenses ---
  getRecurring() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.RECURRING);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  saveRecurring(list) {
    localStorage.setItem(STORAGE_KEYS.RECURRING, JSON.stringify(list));
  }

  addRecurring(data) {
    const list = this.getRecurring();
    const item = {
      id: 'rec_' + Date.now(),
      ...data
    };
    list.push(item);
    this.saveRecurring(list);
    return item;
  }

  updateRecurring(id, data) {
    const list = this.getRecurring();
    const idx = list.findIndex(r => r.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...data };
      this.saveRecurring(list);
      return list[idx];
    }
    return null;
  }

  deleteRecurring(id) {
    let list = this.getRecurring();
    list = list.filter(r => r.id !== id);
    this.saveRecurring(list);
  }

  // Quick Apply Recurring Expenses to Current Month Transactions
  applyRecurringExpense(recurringId) {
    const rec = this.getRecurring().find(r => r.id === recurringId);
    if (!rec) return null;

    const today = new Date();
    const trxDate = toDateInputValue(today);

    return this.addTransaction({
      type: 'expense',
      date: trxDate,
      category: rec.category,
      description: `[Rutin Bulanan] ${rec.description}`,
      amount: Number(rec.amount),
      paymentMethod: rec.paymentMethod || 'Transfer',
      notes: rec.notes || 'Dicatat dari template pengeluaran rutin'
    });
  }

  // --- Profile & Settings ---
  getProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
      return raw ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) } : { ...DEFAULT_PROFILE };
    } catch (e) {
      return { ...DEFAULT_PROFILE };
    }
  }

  saveProfile(profile) {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  }

  getSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  // --- Analytical Calculations ---
  getFinancialSummary(period = 'thisMonth') {
    const all = this.getTransactions();
    const now = new Date();
    let startDate = '';
    let endDate = toDateInputValue(now);

    if (period === 'today') {
      startDate = toDateInputValue(now);
      endDate = startDate;
    } else if (period === 'thisWeek') {
      const day = now.getDay();
      // Monday as first day of week
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(now);
      startOfWeek.setDate(diff);
      startDate = toDateInputValue(startOfWeek);
    } else if (period === 'thisMonth') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = toDateInputValue(startOfMonth);
    } else if (period === 'lastMonth') {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      startDate = toDateInputValue(startOfLastMonth);
      endDate = toDateInputValue(endOfLastMonth);
    } else if (period === 'thisYear') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      startDate = toDateInputValue(startOfYear);
    }

    const filtered = all.filter(t => (!startDate || t.date >= startDate) && (!endDate || t.date <= endDate));

    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    filtered.forEach(t => {
      const val = Number(t.total || t.amount || 0);
      if (t.type === 'income') {
        income += val;
        incomeCount++;
      } else {
        expense += val;
        expenseCount++;
      }
    });

    return {
      period,
      startDate,
      endDate,
      totalIncome: income,
      totalExpense: expense,
      netProfit: income - expense,
      incomeCount,
      expenseCount,
      totalTransactions: filtered.length
    };
  }

  // Monthly breakdown for charting (last 6 or 12 months)
  getMonthlyTrends(monthsCount = 6) {
    const transactions = this.getTransactions();
    const months = [];
    const now = new Date();

    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthNum = d.getMonth() + 1;
      const monthKey = `${year}-${String(monthNum).padStart(2, '0')}`;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const label = `${monthNames[monthNum - 1]} ${year}`;

      months.push({
        key: monthKey,
        label,
        income: 0,
        expense: 0,
        profit: 0
      });
    }

    transactions.forEach(t => {
      const key = t.date.substring(0, 7);
      const match = months.find(m => m.key === key);
      if (match) {
        const val = Number(t.total || t.amount || 0);
        if (t.type === 'income') {
          match.income += val;
        } else {
          match.expense += val;
        }
      }
    });

    months.forEach(m => {
      m.profit = m.income - m.expense;
    });

    return months;
  }

  // Top Selling Products (by quantity and revenue)
  getTopProducts(limit = 5) {
    const transactions = this.getTransactions({ type: 'income' });
    const productMap = {};

    transactions.forEach(t => {
      const name = t.productName || 'Lainnya';
      const qty = Number(t.quantity || 1);
      const rev = Number(t.total || 0);

      if (!productMap[name]) {
        productMap[name] = {
          name,
          category: t.category || 'Bolu',
          totalQuantity: 0,
          totalRevenue: 0,
          transactionCount: 0
        };
      }
      productMap[name].totalQuantity += qty;
      productMap[name].totalRevenue += rev;
      productMap[name].transactionCount += 1;
    });

    const list = Object.values(productMap);
    list.sort((a, b) => b.totalQuantity - a.totalQuantity);
    return list.slice(0, limit);
  }

  // Expense by category breakdown
  getExpenseByCategory(startDate, endDate) {
    const expenses = this.getTransactions({ type: 'expense', startDate, endDate });
    const catMap = {};
    let totalAll = 0;

    expenses.forEach(t => {
      const cat = t.category || 'Lainnya';
      const amt = Number(t.amount || 0);
      catMap[cat] = (catMap[cat] || 0) + amt;
      totalAll += amt;
    });

    const result = Object.keys(catMap).map(cat => ({
      category: cat,
      amount: catMap[cat],
      percentage: totalAll > 0 ? ((catMap[cat] / totalAll) * 100).toFixed(1) : 0
    }));

    result.sort((a, b) => b.amount - a.amount);
    return { list: result, total: totalAll };
  }

  // Detect Unusual Expenses
  detectUnusualExpenses() {
    const expenses = this.getTransactions({ type: 'expense' });
    if (expenses.length === 0) return [];

    const amounts = expenses.map(e => Number(e.amount || 0)).filter(a => a > 0);
    if (amounts.length === 0) return [];

    const average = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const settings = this.getSettings();
    const threshold = Math.max(average * 2.2, settings.unusualExpenseThreshold || 1000000);

    // Look at expenses in the last 30 days
    const recentDate = relativeDate(-30);
    const unusual = expenses
      .filter(e => e.date >= recentDate && Number(e.amount || 0) >= threshold)
      .map(e => ({
        ...e,
        ratio: (Number(e.amount) / average).toFixed(1),
        averageAmount: Math.round(average)
      }));

    return unusual;
  }

  // Export / Import / Reset
  exportAllData() {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      profile: this.getProfile(),
      settings: this.getSettings(),
      products: this.getProducts(),
      transactions: this.getTransactions(),
      recurring: this.getRecurring()
    };
  }

  importAllData(importedData) {
    if (!importedData || typeof importedData !== 'object') {
      throw new Error('Format data JSON tidak valid');
    }
    if (!Array.isArray(importedData.transactions) || !Array.isArray(importedData.products)) {
      throw new Error('Data transaksi atau produk tidak ditemukan dalam file');
    }

    if (importedData.profile) this.saveProfile(importedData.profile);
    if (importedData.settings) this.saveSettings(importedData.settings);
    if (importedData.products) this.saveProducts(importedData.products);
    if (importedData.transactions) this.saveTransactions(importedData.transactions);
    if (importedData.recurring) this.saveRecurring(importedData.recurring);

    return true;
  }

  resetToSampleData() {
    this.saveProducts(getDefaultProducts());
    this.saveTransactions(getDefaultTransactions());
    this.saveRecurring(getDefaultRecurringExpenses());
    this.saveProfile(DEFAULT_PROFILE);
    this.saveSettings(DEFAULT_SETTINGS);
  }

  clearAllData() {
    this.saveProducts([]);
    this.saveTransactions([]);
    this.saveRecurring([]);
  }
}

// Global Indonesian Formatters
const Utils = {
  formatRupiah(number, withPrefix = true) {
    const num = Math.round(Number(number) || 0);
    const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return withPrefix ? `Rp ${formatted}` : formatted;
  },

  parseRupiah(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    const clean = str.toString().replace(/[^\d]/g, '');
    return Number(clean) || 0;
  },

  formatDateIndo(dateStr, includeDay = false) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;

    const year = parseInt(parts[0], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    if (includeDay) {
      const d = new Date(year, monthIdx, day);
      const dayName = dayNames[d.getDay()];
      return `${dayName}, ${day} ${monthNames[monthIdx]} ${year}`;
    }

    return `${String(day).padStart(2, '0')}/${String(monthIdx + 1).padStart(2, '0')}/${year}`;
  },

  formatDateLongIndo(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${day} ${monthNames[monthIdx]} ${year}`;
  },

  getMonthName(monthIndex) {
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return monthNames[monthIndex] || '';
  }
};

// Initialize Singleton Data Manager
window.dataManager = new DataManager();
window.Utils = Utils;
window.PRODUCT_CATEGORIES = PRODUCT_CATEGORIES;
window.EXPENSE_CATEGORIES = EXPENSE_CATEGORIES;
window.PAYMENT_METHODS = PAYMENT_METHODS;
