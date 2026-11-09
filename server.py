"""
BOLU BU EKO CASHFLOW MANAGER - SQLITE SERVER
Backend server with REST API and SQLite Database (bolu_bu_eko.db)
Uses standard Python library only (no external pip dependencies required).
"""

import http.server
import socketserver
import sqlite3
import json
import os
import sys
import urllib.parse
from datetime import datetime

PORT = int(os.environ.get("PORT", 5000))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.environ.get("DATABASE_PATH", os.path.join(BASE_DIR, "bolu_bu_eko.db"))

# -------------------------------------------------------------
# DATABASE INITIALIZATION & SCHEMA
# -------------------------------------------------------------
def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        date TEXT NOT NULL,
        category TEXT,
        description TEXT,
        amount REAL DEFAULT 0,
        paymentMethod TEXT,
        notes TEXT,
        productId TEXT,
        productName TEXT,
        quantity REAL DEFAULT 0,
        unitPrice REAL DEFAULT 0,
        total REAL DEFAULT 0,
        linkedIngredientId TEXT,
        createdAt TEXT,
        updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        price REAL DEFAULT 0,
        costPrice REAL DEFAULT 0,
        hppIngredients TEXT,
        active INTEGER DEFAULT 1,
        isFavorite INTEGER DEFAULT 0,
        createdAt TEXT,
        updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS ingredients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        unit TEXT,
        lastPrice REAL DEFAULT 0,
        stock REAL DEFAULT 0,
        minStock REAL DEFAULT 0,
        active INTEGER DEFAULT 1,
        createdAt TEXT,
        updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_log (
        id TEXT PRIMARY KEY,
        ingredientId TEXT,
        ingredientName TEXT,
        type TEXT,
        qty REAL DEFAULT 0,
        unit TEXT,
        unitPrice REAL DEFAULT 0,
        totalPrice REAL DEFAULT 0,
        date TEXT,
        reference TEXT,
        notes TEXT,
        createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS recurring (
        id TEXT PRIMARY KEY,
        description TEXT,
        category TEXT,
        amount REAL DEFAULT 0,
        paymentMethod TEXT,
        dayOfMonth INTEGER DEFAULT 1,
        notes TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    """)
    conn.commit()

    # Check if empty, seed default bakery data if needed
    cursor.execute("SELECT COUNT(*) FROM products")
    if cursor.fetchone()[0] == 0:
        seed_default_data(conn)

    conn.close()
    print(f"[Database] SQLite database initialized at: {DB_FILE}")

def seed_default_data(conn):
    cursor = conn.cursor()
    now_iso = datetime.now().isoformat()

    # 1. Profile
    profile = {
        "name": "Bolu Bu Eko",
        "tagline": "Spesialis Bolu Lembut & Gurih Tradisional",
        "address": "Jl. Palagan Tentara Pelajar No. 45, Sleman, D.I. Yogyakarta",
        "phone": "0812-3456-7890",
        "owner": "Ibu Eko Suryani",
        "email": "bolubueko.bakery@gmail.com"
    }
    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('profile', ?)", (json.dumps(profile),))

    # 2. General Settings
    settings = {
        "darkMode": False,
        "unusualExpenseThreshold": 1000000,
        "currency": "IDR"
    }
    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('settings', ?)", (json.dumps(settings),))

    # 3. Default Master Bahan
    ingredients = [
        ('ing_1', 'Tepung Terigu Segitiga Biru', 'Tepung & Pati', 'kg', 14000, 25, 5, 1),
        ('ing_2', 'Tepung Terigu Cakra Kembar', 'Tepung & Pati', 'kg', 16000, 15, 5, 1),
        ('ing_3', 'Maizena', 'Tepung & Pati', 'kg', 20000, 3, 1, 1),
        ('ing_4', 'Telur Ayam', 'Telur & Susu', 'butir', 2500, 120, 30, 1),
        ('ing_5', 'Susu Cair UHT', 'Telur & Susu', 'liter', 18000, 8, 3, 1),
        ('ing_6', 'Susu Bubuk', 'Telur & Susu', 'kg', 60000, 2, 1, 1),
        ('ing_7', 'Gula Pasir', 'Gula & Pemanis', 'kg', 16000, 20, 5, 1),
        ('ing_8', 'Gula Halus', 'Gula & Pemanis', 'kg', 22000, 5, 2, 1),
        ('ing_9', 'Mentega / Margarin', 'Lemak & Minyak', 'kg', 30000, 10, 3, 1),
        ('ing_10', 'Mentega Wisman', 'Lemak & Minyak', 'kg', 40000, 5, 2, 1),
        ('ing_11', 'Minyak Goreng', 'Lemak & Minyak', 'liter', 18000, 5, 2, 1),
        ('ing_12', 'Coklat Bubuk', 'Coklat & Kakao', 'kg', 80000, 3, 1, 1),
        ('ing_13', 'Dark Cooking Chocolate', 'Coklat & Kakao', 'kg', 60000, 4, 1, 1),
        ('ing_14', 'Keju Cheddar', 'Keju & Dairy', 'kg', 80000, 3, 1, 1),
        ('ing_15', 'Keju Edam', 'Keju & Dairy', 'kg', 120000, 2, 1, 1),
        ('ing_16', 'Santan Kelapa', 'Keju & Dairy', 'liter', 20000, 5, 2, 1),
        ('ing_17', 'Cream of Tartar', 'Pengembang & Pengemulsi', 'gram', 200, 200, 50, 1),
        ('ing_18', 'Baking Powder', 'Pengembang & Pengemulsi', 'gram', 60, 500, 100, 1),
        ('ing_19', 'Ragi Instan', 'Pengembang & Pengemulsi', 'gram', 100, 200, 50, 1),
        ('ing_20', 'Vanili Bubuk', 'Perisa & Pewarna', 'gram', 50, 100, 30, 1),
        ('ing_21', 'Pasta Pandan', 'Perisa & Pewarna', 'ml', 30, 200, 50, 1),
        ('ing_22', 'Pisang Raja', 'Buah & Kacang', 'buah', 1500, 30, 10, 1),
        ('ing_23', 'Kismis', 'Buah & Kacang', 'gram', 60, 500, 100, 1),
        ('ing_24', 'Tape Singkong', 'Buah & Kacang', 'kg', 15000, 5, 2, 1),
        ('ing_25', 'Kemasan Box Bolu', 'Kemasan', 'pcs', 3000, 100, 30, 1),
        ('ing_26', 'Toples Kue Kering', 'Kemasan', 'pcs', 5000, 50, 15, 1),
        ('ing_27', 'Kemasan Plastik Roti', 'Kemasan', 'pcs', 1000, 200, 50, 1),
        ('ing_28', 'Label Stiker', 'Kemasan', 'pcs', 500, 300, 50, 1),
        ('ing_29', 'Gas Elpiji 3kg', 'Bahan Bakar', 'tabung', 22000, 5, 2, 1),
        ('ing_30', 'Garam', 'Perisa & Pewarna', 'gram', 4, 1000, 200, 1)
    ]
    cursor.executemany("""
    INSERT INTO ingredients (id, name, category, unit, lastPrice, stock, minStock, active, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    """, ingredients)

    # 4. Default Products with HPP Ingredients
    products = [
        ('prod_1', 'Bolu Gulung Pandan Keju', 'Bolu Pandan', 45000, 22000, json.dumps([
            {'name': 'Tepung Terigu', 'qty': 0.4, 'unit': 'kg', 'unitPrice': 14000},
            {'name': 'Telur Ayam', 'qty': 5, 'unit': 'butir', 'unitPrice': 2500},
            {'name': 'Gula Pasir', 'qty': 0.15, 'unit': 'kg', 'unitPrice': 16000},
            {'name': 'Santan Kelapa', 'qty': 0.15, 'unit': 'liter', 'unitPrice': 20000},
            {'name': 'Pasta Pandan', 'qty': 1, 'unit': 'sdt', 'unitPrice': 1500},
            {'name': 'Keju Parut (isian)', 'qty': 0.05, 'unit': 'kg', 'unitPrice': 80000},
            {'name': 'Kemasan & Label', 'qty': 1, 'unit': 'pcs', 'unitPrice': 2500},
            {'name': 'Gas Oven', 'qty': 1, 'unit': 'porsi', 'unitPrice': 2000}
        ]), 1, 1),
        ('prod_2', 'Bolu Tape Keju Panggang', 'Bolu Keju', 50000, 24000, json.dumps([
            {'name': 'Tepung Terigu', 'qty': 0.45, 'unit': 'kg', 'unitPrice': 14000},
            {'name': 'Telur Ayam', 'qty': 5, 'unit': 'butir', 'unitPrice': 2500},
            {'name': 'Tape Singkong', 'qty': 0.2, 'unit': 'kg', 'unitPrice': 15000},
            {'name': 'Keju Cheddar', 'qty': 0.1, 'unit': 'kg', 'unitPrice': 80000},
            {'name': 'Gula Pasir', 'qty': 0.15, 'unit': 'kg', 'unitPrice': 16000},
            {'name': 'Mentega', 'qty': 0.1, 'unit': 'kg', 'unitPrice': 30000},
            {'name': 'Kemasan & Label', 'qty': 1, 'unit': 'pcs', 'unitPrice': 3000},
            {'name': 'Gas Oven', 'qty': 1, 'unit': 'porsi', 'unitPrice': 2000}
        ]), 1, 1),
        ('prod_3', 'Bolu Coklat Fudge Lava', 'Bolu Coklat', 55000, 26000, json.dumps([
            {'name': 'Tepung Terigu', 'qty': 0.4, 'unit': 'kg', 'unitPrice': 14000},
            {'name': 'Telur Ayam', 'qty': 6, 'unit': 'butir', 'unitPrice': 2500},
            {'name': 'Dark Cooking Chocolate', 'qty': 0.1, 'unit': 'kg', 'unitPrice': 60000},
            {'name': 'Coklat Bubuk', 'qty': 0.04, 'unit': 'kg', 'unitPrice': 80000},
            {'name': 'Gula Pasir', 'qty': 0.2, 'unit': 'kg', 'unitPrice': 16000},
            {'name': 'Mentega', 'qty': 0.15, 'unit': 'kg', 'unitPrice': 30000},
            {'name': 'Kemasan & Label', 'qty': 1, 'unit': 'pcs', 'unitPrice': 3000},
            {'name': 'Gas Oven', 'qty': 1, 'unit': 'porsi', 'unitPrice': 2000}
        ]), 1, 1),
        ('prod_4', 'Bolu Marble Jadul Premium', 'Bolu Marble', 48000, 21000, json.dumps([
            {'name': 'Tepung Terigu', 'qty': 0.45, 'unit': 'kg', 'unitPrice': 14000},
            {'name': 'Telur Ayam', 'qty': 5, 'unit': 'butir', 'unitPrice': 2500},
            {'name': 'Gula Pasir', 'qty': 0.2, 'unit': 'kg', 'unitPrice': 16000},
            {'name': 'Mentega', 'qty': 0.15, 'unit': 'kg', 'unitPrice': 30000},
            {'name': 'Coklat Bubuk', 'qty': 0.02, 'unit': 'kg', 'unitPrice': 80000},
            {'name': 'Vanili', 'qty': 1, 'unit': 'sdt', 'unitPrice': 500},
            {'name': 'Kemasan & Label', 'qty': 1, 'unit': 'pcs', 'unitPrice': 2500},
            {'name': 'Gas Oven', 'qty': 1, 'unit': 'porsi', 'unitPrice': 2000}
        ]), 1, 1),
        ('prod_5', 'Bolu Pisang Keju Kismis', 'Bolu Original', 42000, 19000, json.dumps([
            {'name': 'Tepung Terigu', 'qty': 0.4, 'unit': 'kg', 'unitPrice': 14000},
            {'name': 'Pisang Raja', 'qty': 4, 'unit': 'buah', 'unitPrice': 1500},
            {'name': 'Telur Ayam', 'qty': 4, 'unit': 'butir', 'unitPrice': 2500},
            {'name': 'Gula Pasir', 'qty': 0.1, 'unit': 'kg', 'unitPrice': 16000},
            {'name': 'Keju Parut', 'qty': 0.03, 'unit': 'kg', 'unitPrice': 80000},
            {'name': 'Kismis', 'qty': 0.02, 'unit': 'kg', 'unitPrice': 60000},
            {'name': 'Kemasan & Label', 'qty': 1, 'unit': 'pcs', 'unitPrice': 2500},
            {'name': 'Gas Oven', 'qty': 1, 'unit': 'porsi', 'unitPrice': 2000}
        ]), 1, 1),
        ('prod_6', 'Chiffon Cake Pandan Santan', 'Bolu Pandan', 52000, 23000, json.dumps([
            {'name': 'Tepung Terigu', 'qty': 0.4, 'unit': 'kg', 'unitPrice': 14000},
            {'name': 'Telur Ayam', 'qty': 6, 'unit': 'butir', 'unitPrice': 2500},
            {'name': 'Gula Pasir', 'qty': 0.2, 'unit': 'kg', 'unitPrice': 16000},
            {'name': 'Santan Kelapa', 'qty': 0.2, 'unit': 'liter', 'unitPrice': 20000},
            {'name': 'Pasta Pandan', 'qty': 1, 'unit': 'sdt', 'unitPrice': 1500},
            {'name': 'Minyak Goreng', 'qty': 0.08, 'unit': 'liter', 'unitPrice': 18000},
            {'name': 'Cream of Tartar', 'qty': 0.5, 'unit': 'sdt', 'unitPrice': 2000},
            {'name': 'Kemasan & Label', 'qty': 1, 'unit': 'pcs', 'unitPrice': 3000},
            {'name': 'Gas Oven', 'qty': 1, 'unit': 'porsi', 'unitPrice': 2000}
        ]), 1, 0),
        ('prod_7', 'Kastengel Keju Edam Toples', 'Kue Kering', 85000, 42000, json.dumps([
            {'name': 'Tepung Terigu', 'qty': 0.5, 'unit': 'kg', 'unitPrice': 14000},
            {'name': 'Mentega Wisman', 'qty': 0.25, 'unit': 'kg', 'unitPrice': 40000},
            {'name': 'Keju Edam', 'qty': 0.2, 'unit': 'kg', 'unitPrice': 120000},
            {'name': 'Telur Ayam', 'qty': 3, 'unit': 'butir', 'unitPrice': 2500},
            {'name': 'Maizena', 'qty': 0.05, 'unit': 'kg', 'unitPrice': 20000},
            {'name': 'Toples Kemasan', 'qty': 1, 'unit': 'pcs', 'unitPrice': 5000},
            {'name': 'Gas Oven', 'qty': 1, 'unit': 'porsi', 'unitPrice': 2500}
        ]), 1, 0),
        ('prod_8', 'Roti Sisir Mentega Gula (Isi 6)', 'Roti', 28000, 12000, json.dumps([
            {'name': 'Tepung Terigu Cakra', 'qty': 0.4, 'unit': 'kg', 'unitPrice': 16000},
            {'name': 'Ragi Instan', 'qty': 1, 'unit': 'sdt', 'unitPrice': 1000},
            {'name': 'Telur Ayam', 'qty': 1, 'unit': 'butir', 'unitPrice': 2500},
            {'name': 'Mentega', 'qty': 0.05, 'unit': 'kg', 'unitPrice': 30000},
            {'name': 'Gula Pasir', 'qty': 0.03, 'unit': 'kg', 'unitPrice': 16000},
            {'name': 'Susu Bubuk', 'qty': 0.01, 'unit': 'kg', 'unitPrice': 60000},
            {'name': 'Kemasan Plastik', 'qty': 1, 'unit': 'pcs', 'unitPrice': 1000},
            {'name': 'Gas Oven', 'qty': 1, 'unit': 'porsi', 'unitPrice': 1500}
        ]), 1, 0)
    ]
    cursor.executemany("""
    INSERT INTO products (id, name, category, price, costPrice, hppIngredients, active, isFavorite, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    """, products)

    # 5. Default Recurring Expenses
    recurring = [
        ('rec_1', 'Sewa Tempat Dapur & Toko', 'Sewa Tempat', 2500000, 'Transfer', 1, 'Pembayaran rutin sewa bulanan ruko'),
        ('rec_2', 'Tagihan Listrik PLN Toko & Oven', 'Listrik & Air', 850000, 'Transfer', 5, 'Listrik pascabayar PLN daya 3500VA'),
        ('rec_3', 'Tagihan PDAM Air Bersih', 'Listrik & Air', 150000, 'Transfer', 5, 'Air bersih untuk produksi & sanitasi dapur'),
        ('rec_4', 'Gaji Asisten Pembuat Bolu (Pak Joko)', 'Gaji Karyawan', 2200000, 'Transfer', 25, 'Gaji bulanan baker utama'),
        ('rec_5', 'Gaji Kasir & Penjaga Toko (Mbak Siti)', 'Gaji Karyawan', 1800000, 'Transfer', 25, 'Gaji bulanan pelayanan kasir')
    ]
    cursor.executemany("""
    INSERT INTO recurring (id, description, category, amount, paymentMethod, dayOfMonth, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, recurring)

    # 6. Sample Initial Stock Log
    cursor.execute("""
    INSERT INTO stock_log (id, ingredientId, ingredientName, type, qty, unit, unitPrice, totalPrice, date, reference, notes, createdAt)
    VALUES ('slog_init', 'all', 'Semua Bahan', 'in', 0, '-', 0, 0, date('now'), 'initial', 'Stok awal sistem', datetime('now'))
    """)

    # 7. Sample Initial Transactions (Recent 30 days)
    today = datetime.now().strftime("%Y-%m-%d")
    sample_trxs = [
        ('trx_init_1', 'income', today, 'Bolu Pandan', 'Penjualan Bolu Gulung Pandan Keju', 450000, 'QRIS', 'Pesanan arisan keluarga (10 box)', 'prod_1', 'Bolu Gulung Pandan Keju', 10, 45000, 450000, None, now_iso, now_iso),
        ('trx_init_2', 'income', today, 'Bolu Keju', 'Penjualan Bolu Tape Keju Panggang', 250000, 'Tunai', 'Beli langsung di outlet (5 loyang)', 'prod_2', 'Bolu Tape Keju Panggang', 5, 50000, 250000, None, now_iso, now_iso),
        ('trx_init_3', 'expense', today, 'Bahan Baku', 'Beli Telur Ayam (100 butir)', 250000, 'Tunai', 'Restock telur dari peternak lokal', None, None, 0, 0, 0, 'ing_4', now_iso, now_iso),
        ('trx_init_4', 'expense', today, 'Kemasan', 'Beli Box Bolu Cetak Custom (100 pcs)', 300000, 'Transfer', 'Kemasan dus bolu premium', None, None, 0, 0, 0, 'ing_25', now_iso, now_iso),
        ('trx_init_5', 'income', today, 'Bolu Coklat', 'Penjualan Bolu Coklat Fudge Lava', 330000, 'Transfer', 'Pesanan kantor dinas (6 loyang)', 'prod_3', 'Bolu Coklat Fudge Lava', 6, 55000, 330000, None, now_iso, now_iso)
    ]
    cursor.executemany("""
    INSERT INTO transactions (id, type, date, category, description, amount, paymentMethod, notes, productId, productName, quantity, unitPrice, total, linkedIngredientId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, sample_trxs)

    conn.commit()
    print("[Database] Default seed data inserted successfully.")

# -------------------------------------------------------------
# HTTP REQUEST HANDLER
# -------------------------------------------------------------
class BakeryRequestHandler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        # Enable CORS for local cross-origin development if needed
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/"):
            self.handle_api_get(path, urllib.parse.parse_qs(parsed.query))
        else:
            # Serve static files (HTML, CSS, JS)
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/"):
            data = self.read_json_body()
            self.handle_api_post(path, data)
        else:
            self.send_error(404, "Not Found")

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/"):
            data = self.read_json_body()
            self.handle_api_put(path, data)
        else:
            self.send_error(404, "Not Found")

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/"):
            self.handle_api_delete(path)
        else:
            self.send_error(404, "Not Found")

    def read_json_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                return json.loads(body)
            except Exception as e:
                return {}
        return {}

    def send_json(self, data, status_code=200):
        response_bytes = json.dumps(data, ensure_ascii=False, default=str).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)

    # ---------------------------------------------------------
    # API HANDLERS
    # ---------------------------------------------------------
    def handle_api_get(self, path, query):
        conn = get_db()
        cursor = conn.cursor()

        try:
            # 1. Status & Health Check
            if path == "/api/status":
                counts = {}
                for tbl in ['transactions', 'products', 'ingredients', 'stock_log', 'recurring']:
                    cursor.execute(f"SELECT COUNT(*) FROM {tbl}")
                    counts[tbl] = cursor.fetchone()[0]

                db_size = os.path.getsize(DB_FILE) if os.path.exists(DB_FILE) else 0

                self.send_json({
                    "status": "ok",
                    "database": "SQLite",
                    "file": os.path.basename(DB_FILE),
                    "fullPath": DB_FILE,
                    "sizeBytes": db_size,
                    "counts": counts,
                    "serverTime": datetime.now().isoformat()
                })

            # 2. Transactions
            elif path == "/api/transactions":
                cursor.execute("SELECT * FROM transactions ORDER BY date DESC, createdAt DESC")
                rows = [dict(r) for r in cursor.fetchall()]
                self.send_json(rows)

            # 3. Products
            elif path == "/api/products":
                cursor.execute("SELECT * FROM products ORDER BY name ASC")
                rows = []
                for r in cursor.fetchall():
                    d = dict(r)
                    d['active'] = bool(d['active'])
                    d['isFavorite'] = bool(d['isFavorite'])
                    if d.get('hppIngredients'):
                        try:
                            d['hppIngredients'] = json.loads(d['hppIngredients'])
                        except:
                            d['hppIngredients'] = []
                    else:
                        d['hppIngredients'] = []
                    rows.append(d)
                self.send_json(rows)

            # 4. Master Bahan (Ingredients)
            elif path == "/api/ingredients":
                cursor.execute("SELECT * FROM ingredients ORDER BY name ASC")
                rows = []
                for r in cursor.fetchall():
                    d = dict(r)
                    d['active'] = bool(d['active'])
                    rows.append(d)
                self.send_json(rows)

            # 5. Stock Log
            elif path == "/api/stock_log":
                cursor.execute("SELECT * FROM stock_log ORDER BY date DESC, createdAt DESC LIMIT 200")
                rows = [dict(r) for r in cursor.fetchall()]
                self.send_json(rows)

            # 6. Recurring Expenses
            elif path == "/api/recurring":
                cursor.execute("SELECT * FROM recurring ORDER BY dayOfMonth ASC")
                rows = [dict(r) for r in cursor.fetchall()]
                self.send_json(rows)

            # 7. Profile
            elif path == "/api/profile":
                cursor.execute("SELECT value FROM settings WHERE key = 'profile'")
                row = cursor.fetchone()
                profile = json.loads(row['value']) if row else {}
                self.send_json(profile)

            # 8. Settings
            elif path == "/api/settings":
                cursor.execute("SELECT value FROM settings WHERE key = 'settings'")
                row = cursor.fetchone()
                settings = json.loads(row['value']) if row else {}
                self.send_json(settings)

            # 9. Full Backup / Export
            elif path == "/api/export":
                export_data = {
                    "version": 1,
                    "exportedAt": datetime.now().isoformat(),
                    "database": "SQLite (bolu_bu_eko.db)",
                    "transactions": [dict(r) for r in cursor.execute("SELECT * FROM transactions").fetchall()],
                    "products": [dict(r) for r in cursor.execute("SELECT * FROM products").fetchall()],
                    "ingredients": [dict(r) for r in cursor.execute("SELECT * FROM ingredients").fetchall()],
                    "stockLog": [dict(r) for r in cursor.execute("SELECT * FROM stock_log").fetchall()],
                    "recurring": [dict(r) for r in cursor.execute("SELECT * FROM recurring").fetchall()],
                    "settings": {r['key']: json.loads(r['value']) for r in cursor.execute("SELECT * FROM settings").fetchall()}
                }
                self.send_json(export_data)

            else:
                self.send_error(404, "API endpoint not found")

        finally:
            conn.close()

    def handle_api_post(self, path, data):
        conn = get_db()
        cursor = conn.cursor()
        now_iso = datetime.now().isoformat()

        try:
            # 1. Add Transaction
            if path == "/api/transactions":
                trx_id = data.get("id") or f"trx_{int(datetime.now().timestamp()*1000)}"
                cursor.execute("""
                INSERT INTO transactions (
                    id, type, date, category, description, amount, paymentMethod,
                    notes, productId, productName, quantity, unitPrice, total,
                    linkedIngredientId, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    trx_id,
                    data.get("type", "income"),
                    data.get("date", datetime.now().strftime("%Y-%m-%d")),
                    data.get("category", ""),
                    data.get("description", ""),
                    float(data.get("amount", 0)),
                    data.get("paymentMethod", "Tunai"),
                    data.get("notes", ""),
                    data.get("productId", ""),
                    data.get("productName", ""),
                    float(data.get("quantity", 0)),
                    float(data.get("unitPrice", 0)),
                    float(data.get("total", 0)),
                    data.get("linkedIngredientId"),
                    now_iso, now_iso
                ))
                conn.commit()
                self.send_json({"success": True, "id": trx_id})

            # 2. Add Product
            elif path == "/api/products":
                prod_id = data.get("id") or f"prod_{int(datetime.now().timestamp()*1000)}"
                hpp_json = json.dumps(data.get("hppIngredients", []))
                cursor.execute("""
                INSERT INTO products (
                    id, name, category, price, costPrice, hppIngredients,
                    active, isFavorite, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    prod_id,
                    data.get("name", "Produk Baru"),
                    data.get("category", "Bolu Original"),
                    float(data.get("price", 0)),
                    float(data.get("costPrice", 0)),
                    hpp_json,
                    1 if data.get("active", True) else 0,
                    1 if data.get("isFavorite", False) else 0,
                    now_iso, now_iso
                ))
                conn.commit()
                self.send_json({"success": True, "id": prod_id})

            # 3. Add Ingredient (Master Bahan)
            elif path == "/api/ingredients":
                ing_id = data.get("id") or f"ing_{int(datetime.now().timestamp()*1000)}"
                cursor.execute("""
                INSERT INTO ingredients (
                    id, name, category, unit, lastPrice, stock, minStock, active, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    ing_id,
                    data.get("name", "Bahan Baru"),
                    data.get("category", "Lainnya"),
                    data.get("unit", "kg"),
                    float(data.get("lastPrice", 0)),
                    float(data.get("stock", 0)),
                    float(data.get("minStock", 0)),
                    1 if data.get("active", True) else 0,
                    now_iso, now_iso
                ))
                conn.commit()
                self.send_json({"success": True, "id": ing_id})

            # 4. Adjust Stock (Transaction-safe Stock In/Out + Log)
            elif path == "/api/adjust_stock":
                ing_id = data.get("ingredientId")
                adjust_type = data.get("type", "in") # 'in' or 'out'
                qty = float(data.get("qty", 0))
                unit_price = float(data.get("unitPrice", 0))
                date_val = data.get("date") or datetime.now().strftime("%Y-%m-%d")
                reference = data.get("reference", "")
                notes = data.get("notes", "")

                cursor.execute("SELECT * FROM ingredients WHERE id = ?", (ing_id,))
                ing = cursor.fetchone()
                if not ing:
                    self.send_json({"success": False, "error": "Bahan tidak ditemukan"}, 404)
                    return

                current_stock = ing['stock']
                if adjust_type == 'in':
                    new_stock = current_stock + qty
                    new_price = unit_price if unit_price > 0 else ing['lastPrice']
                    cursor.execute("""
                    UPDATE ingredients SET stock = ?, lastPrice = ?, updatedAt = ? WHERE id = ?
                    """, (new_stock, new_price, now_iso, ing_id))
                else:
                    new_stock = max(0, current_stock - qty)
                    cursor.execute("""
                    UPDATE ingredients SET stock = ?, updatedAt = ? WHERE id = ?
                    """, (new_stock, now_iso, ing_id))

                log_id = f"slog_{int(datetime.now().timestamp()*1000)}"
                total_price = qty * (unit_price if unit_price > 0 else ing['lastPrice'])
                cursor.execute("""
                INSERT INTO stock_log (
                    id, ingredientId, ingredientName, type, qty, unit, unitPrice,
                    totalPrice, date, reference, notes, createdAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    log_id, ing_id, ing['name'], adjust_type, qty, ing['unit'],
                    unit_price if unit_price > 0 else ing['lastPrice'],
                    total_price, date_val, reference, notes, now_iso
                ))

                conn.commit()
                self.send_json({
                    "success": True,
                    "newStock": new_stock,
                    "logId": log_id
                })

            # 5. Add Recurring
            elif path == "/api/recurring":
                rec_id = data.get("id") or f"rec_{int(datetime.now().timestamp()*1000)}"
                cursor.execute("""
                INSERT INTO recurring (id, description, category, amount, paymentMethod, dayOfMonth, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    rec_id,
                    data.get("description", ""),
                    data.get("category", "Lainnya"),
                    float(data.get("amount", 0)),
                    data.get("paymentMethod", "Transfer"),
                    int(data.get("dayOfMonth", 1)),
                    data.get("notes", "")
                ))
                conn.commit()
                self.send_json({"success": True, "id": rec_id})

            # 6. Save Profile
            elif path == "/api/profile":
                cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('profile', ?)", (json.dumps(data),))
                conn.commit()
                self.send_json({"success": True})

            # 7. Save Settings
            elif path == "/api/settings":
                cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('settings', ?)", (json.dumps(data),))
                conn.commit()
                self.send_json({"success": True})

            # 8. Reset to Defaults
            elif path == "/api/reset":
                cursor.executescript("""
                DELETE FROM transactions;
                DELETE FROM products;
                DELETE FROM ingredients;
                DELETE FROM stock_log;
                DELETE FROM recurring;
                DELETE FROM settings;
                """)
                seed_default_data(conn)
                self.send_json({"success": True, "message": "Database berhasil di-reset ke data default"})

            # 9. Import Data
            elif path == "/api/import":
                if "transactions" in data:
                    cursor.execute("DELETE FROM transactions")
                    for t in data["transactions"]:
                        cursor.execute("""
                        INSERT OR REPLACE INTO transactions (id, type, date, category, description, amount, paymentMethod, notes, productId, productName, quantity, unitPrice, total, linkedIngredientId, createdAt, updatedAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (t.get('id'), t.get('type'), t.get('date'), t.get('category'), t.get('description'), t.get('amount', 0), t.get('paymentMethod'), t.get('notes'), t.get('productId'), t.get('productName'), t.get('quantity', 0), t.get('unitPrice', 0), t.get('total', 0), t.get('linkedIngredientId'), t.get('createdAt', now_iso), t.get('updatedAt', now_iso)))

                if "products" in data:
                    cursor.execute("DELETE FROM products")
                    for p in data["products"]:
                        hpp = p.get('hppIngredients', [])
                        if isinstance(hpp, (list, dict)):
                            hpp = json.dumps(hpp)
                        cursor.execute("""
                        INSERT OR REPLACE INTO products (id, name, category, price, costPrice, hppIngredients, active, isFavorite, createdAt, updatedAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (p.get('id'), p.get('name'), p.get('category'), p.get('price', 0), p.get('costPrice', 0), hpp, 1 if p.get('active', True) else 0, 1 if p.get('isFavorite', False) else 0, p.get('createdAt', now_iso), p.get('updatedAt', now_iso)))

                if "ingredients" in data:
                    cursor.execute("DELETE FROM ingredients")
                    for i in data["ingredients"]:
                        cursor.execute("""
                        INSERT OR REPLACE INTO ingredients (id, name, category, unit, lastPrice, stock, minStock, active, createdAt, updatedAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (i.get('id'), i.get('name'), i.get('category'), i.get('unit'), i.get('lastPrice', 0), i.get('stock', 0), i.get('minStock', 0), 1 if i.get('active', True) else 0, i.get('createdAt', now_iso), i.get('updatedAt', now_iso)))

                conn.commit()
                self.send_json({"success": True, "message": "Data berhasil diimpor ke database SQLite"})

            else:
                self.send_error(404, "Endpoint not found")

        finally:
            conn.close()

    def handle_api_put(self, path, data):
        conn = get_db()
        cursor = conn.cursor()
        now_iso = datetime.now().isoformat()

        try:
            parts = path.strip("/").split("/")
            # e.g. /api/transactions/<id>
            if len(parts) == 3:
                resource = parts[1]
                item_id = parts[2]

                if resource == "transactions":
                    cursor.execute("""
                    UPDATE transactions SET
                        type = ?, date = ?, category = ?, description = ?,
                        amount = ?, paymentMethod = ?, notes = ?, productId = ?,
                        productName = ?, quantity = ?, unitPrice = ?, total = ?,
                        linkedIngredientId = ?, updatedAt = ?
                    WHERE id = ?
                    """, (
                        data.get("type", "income"),
                        data.get("date"),
                        data.get("category"),
                        data.get("description"),
                        float(data.get("amount", 0)),
                        data.get("paymentMethod"),
                        data.get("notes"),
                        data.get("productId"),
                        data.get("productName"),
                        float(data.get("quantity", 0)),
                        float(data.get("unitPrice", 0)),
                        float(data.get("total", 0)),
                        data.get("linkedIngredientId"),
                        now_iso,
                        item_id
                    ))
                    conn.commit()
                    self.send_json({"success": True})

                elif resource == "products":
                    hpp_json = json.dumps(data.get("hppIngredients", []))
                    cursor.execute("""
                    UPDATE products SET
                        name = ?, category = ?, price = ?, costPrice = ?,
                        hppIngredients = ?, active = ?, isFavorite = ?, updatedAt = ?
                    WHERE id = ?
                    """, (
                        data.get("name"),
                        data.get("category"),
                        float(data.get("price", 0)),
                        float(data.get("costPrice", 0)),
                        hpp_json,
                        1 if data.get("active", True) else 0,
                        1 if data.get("isFavorite", False) else 0,
                        now_iso,
                        item_id
                    ))
                    conn.commit()
                    self.send_json({"success": True})

                elif resource == "ingredients":
                    cursor.execute("""
                    UPDATE ingredients SET
                        name = ?, category = ?, unit = ?, lastPrice = ?,
                        stock = ?, minStock = ?, active = ?, updatedAt = ?
                    WHERE id = ?
                    """, (
                        data.get("name"),
                        data.get("category"),
                        data.get("unit"),
                        float(data.get("lastPrice", 0)),
                        float(data.get("stock", 0)),
                        float(data.get("minStock", 0)),
                        1 if data.get("active", True) else 0,
                        now_iso,
                        item_id
                    ))
                    conn.commit()
                    self.send_json({"success": True})

                elif resource == "recurring":
                    cursor.execute("""
                    UPDATE recurring SET
                        description = ?, category = ?, amount = ?, paymentMethod = ?, dayOfMonth = ?, notes = ?
                    WHERE id = ?
                    """, (
                        data.get("description"),
                        data.get("category"),
                        float(data.get("amount", 0)),
                        data.get("paymentMethod"),
                        int(data.get("dayOfMonth", 1)),
                        data.get("notes"),
                        item_id
                    ))
                    conn.commit()
                    self.send_json({"success": True})

                else:
                    self.send_error(404, "Resource not found")
            else:
                self.send_error(400, "Bad Request")

        finally:
            conn.close()

    def handle_api_delete(self, path):
        conn = get_db()
        cursor = conn.cursor()

        try:
            parts = path.strip("/").split("/")
            if len(parts) == 3:
                resource = parts[1]
                item_id = parts[2]

                table_map = {
                    "transactions": "transactions",
                    "products": "products",
                    "ingredients": "ingredients",
                    "recurring": "recurring"
                }

                if resource in table_map:
                    table = table_map[resource]
                    cursor.execute(f"DELETE FROM {table} WHERE id = ?", (item_id,))
                    conn.commit()
                    self.send_json({"success": True, "deleted": item_id})
                else:
                    self.send_error(404, "Resource not found")
            else:
                self.send_error(400, "Bad Request")

        finally:
            conn.close()


def run_server():
    init_db()

    # Allow dual-stack IPv4/IPv6 socket binding to 0.0.0.0
    socketserver.TCPServer.allow_reuse_address = True
    server_address = ('', PORT)

    with socketserver.ThreadingTCPServer(server_address, BakeryRequestHandler) as httpd:
        print("=" * 65)
        print("🍰 BOLU BU EKO - CASHFLOW MANAGER & SQLITE SERVER")
        print("=" * 65)
        print(f"[*] Database file : {DB_FILE}")
        print(f"[*] Server lokal  : http://localhost:{PORT}")
        print(f"[*] API Endpoint  : http://localhost:{PORT}/api/status")
        print("[*] Status        : Siap menerima transaksi dan mutasi stok!")
        print("=" * 65)
        print("Tekan Ctrl+C untuk menghentikan server.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[Server] Menghentikan server...")
            httpd.server_close()
            print("[Server] Server berhenti dengan aman.")

if __name__ == '__main__':
    run_server()

