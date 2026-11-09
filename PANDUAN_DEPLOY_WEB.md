# 🌐 Panduan Deploy Web: Bolu Bu Eko Cashflow Manager

Aplikasi ini telah disiapkan agar siap di-upload ke layanan cloud hosting web gratis (seperti **Render.com** atau **Railway.app**). Setelah di-deploy, aplikasi bisa diakses lewat link internet resmi dari HP kasir, laptop toko, maupun smartphone Bu Eko dari mana saja.

---

## 🚀 OPSI 1: Deploy Gratis ke Render.com (Direkomendasikan)

Render.com menyediakan paket gratis selamanya (**Free Tier**) untuk menjalankan web service Python.

### Langkah 1: Buat Akun GitHub & Upload Kode
1. Buka [github.com](https://github.com) dan daftar/login akun gratis.
2. Klik tombol **New Repository** (Buat repositori baru).
   - Beri nama repository: `bolu-bu-eko-cashflow`.
   - Pilih jenis **Private** (agar data toko Anda aman & hanya Anda yang bisa melihat).
   - Klik **Create repository**.
3. Upload semua file dalam folder `cashflow Bolu Bu Eko` ke repository GitHub tersebut:
   - File utama yang wajib ter-upload:
     - `index.html`
     - `css/style.css`
     - `js/data.js`, `js/app.js`, `js/charts.js`, `js/reports.js`
     - `server.py`
     - `Procfile`
     - `requirements.txt`
     - `render.yaml`
     - `bolu_bu_eko.db` (database awal)

### Langkah 2: Deploy di Render.com
1. Buka [render.com](https://render.com) dan daftar/login menggunakan akun GitHub Anda.
2. Di halaman Dashboard, klik tombol **New +** lalu pilih **Web Service**.
3. Pilih repository GitHub Anda (`bolu-bu-eko-cashflow`) lalu klik **Connect**.
4. Isi data konfigurasi sederhana berikut:
   - **Name**: `bolu-bu-eko` (atau nama pilihan Anda)
   - **Region**: Singapore (paling dekat dan cepat untuk Indonesia)
   - **Runtime**: `Python`
   - **Build Command**: *(kosongkan)*
   - **Start Command**: `python server.py`
   - **Instance Type**: Pilih **Free**
5. Klik **Create Web Service**.
6. Tunggu sekitar 1–2 menit hingga proses build selesai.
7. Selesai! Anda akan mendapatkan link web seperti:
   ```
   https://bolu-bu-eko.onrender.com
   ```
   Link ini sudah otomatis memiliki keamanan **HTTPS (Gembok Hijau)** dan bisa langsung dibuka di browser HP maupun laptop mana pun.

---

## 📱 Cara Memasang Aplikasi di Layar Utama HP (Add to Home Screen)

Agar kasir dan Bu Eko bisa membuka aplikasi ini layaknya aplikasi Android/iPhone tanpa perlu mengetik ulang link:

### Di HP Android (Google Chrome):
1. Buka link web aplikasi Anda (contoh: `https://bolu-bu-eko.onrender.com`) di Google Chrome.
2. Ketuk ikon **titik tiga (⋮)** di pojok kanan atas browser.
3. Pilih menu **Tambahkan ke Layar Utama** (*Add to Home Screen*).
4. Beri nama **Bolu Bu Eko**.
5. Ikon aplikasi kue 🍰 akan muncul di layar menu HP Anda!

### Di iPhone / iPad (Safari):
1. Buka link web aplikasi di browser **Safari**.
2. Ketuk tombol **Share** (ikon kotak dengan tanda panah ke atas di bilah bawah).
3. Gulir ke bawah dan pilih **Add to Home Screen** (*Tambah ke Layar Utama*).
4. Ketuk **Add** di pojok kanan atas.

---

## 💾 Pencadangan (Backup) Data Berkala
Walaupun sudah online di web:
- Anda tetap dapat mencadangkan seluruh data transaksi, stok, dan resep bolu kapan saja melalui menu **Pengaturan (⚙️)** > **Backup Data (JSON)**.
- File cadangan JSON dapat disimpan di Google Drive atau komputer untuk keamanan maksimal.

