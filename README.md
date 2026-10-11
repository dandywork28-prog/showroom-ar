# Showroom AR

Sistem Manajemen Piutang Penjualan pada Showroom Mobil dengan frontend statis, backend Node.js native, dan Supabase PostgreSQL.

## Isi project

- `frontend/index.html`: antarmuka aplikasi.
- `frontend/css/style.css`: desain responsif.
- `frontend/js/script.js`: navigasi, CRUD, dashboard, dan laporan.
- `frontend/js/config.js`: URL API yang dipakai frontend.
- `backend/app.js`: REST API berbasis `node:http` dan `fetch` bawaan Node.js.
- `backend/database.sql`: empat tabel dan trigger untuk saldo piutang serta status kendaraan.

## Siapkan database Supabase

1. Buka project Supabase dan pilih **SQL Editor**.
2. Buka `backend/database.sql`, salin seluruh isinya, lalu jalankan di SQL Editor.
3. Pastikan tabel `pelanggan`, `kendaraan`, `penjualan`, dan `pembayaran` tersedia.
4. Backend menggunakan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`. Key `sb_publishable_...` bukan service-role key. Ambil service-role secret dari pengaturan API project Supabase dan simpan hanya pada environment backend.

Skrip database dapat dijalankan ulang tanpa menghapus tabel atau data.

## Jalankan secara lokal

Gunakan Node.js 18 atau lebih baru. Dari root project, atur variabel di terminal PowerShell VS Code dan jalankan backend:

```powershell
$env:SUPABASE_URL="URL_PROJECT_SUPABASE"
$env:SUPABASE_PUBLISHABLE_KEY="PUBLISHABLE_KEY_PROJECT"
$env:SUPABASE_SERVICE_ROLE_KEY="ISI_SENDIRI_DI_TERMINAL"
$env:ADMIN_EMAIL="EMAIL_ADMIN_SUPABASE_AUTH"
node backend/app.js
```

Di Supabase **Authentication → Users**, buat/undang satu akun admin dengan email yang sama seperti `ADMIN_EMAIL` dan aktifkan login email/password. Hanya email admin itu yang dapat memakai API. Jangan menempelkan service-role key atau password ke chat, menyimpannya di file, atau melakukan commit saat terminal menampilkan perintah yang berisi secret. `SUPABASE_PUBLISHABLE_KEY` bukan secret, tetapi hanya backend yang membutuhkannya dalam setup ini. Server berjalan pada port `3000` secara default; nilai key tidak dicetak ke log.

Frontend menampilkan form login dan memakai `http://localhost:3000/api` ketika `window.SHOWROOM_API_URL` kosong pada Live Server. Buka `frontend/index.html` dengan VS Code Live Server (umumnya origin `http://127.0.0.1:5500`). Backend mengizinkan origin pengembangan `localhost`/`127.0.0.1` pada port 5500 dan 5501 secara default.

## Deploy

Repository: [dandywork28-prog/showroom-ar](https://github.com/dandywork28-prog/showroom-ar).

GitHub Pages hanya menjalankan frontend statis, bukan backend Node.js. Workflow `.github/workflows/pages.yml` menerbitkan folder `frontend/` ke GitHub Pages setiap ada push ke branch `main` dan mengaktifkan Pages otomatis. Alamat frontend: <https://dandywork28-prog.github.io/showroom-ar/>.

Deploy `backend/` sebagai layanan Node.js di Render:

1. Di Render, pilih **New → Blueprint**, hubungkan repository ini, lalu gunakan `render.yaml`. Service memakai runtime Node.js dan perintah `node app.js`, tanpa package atau dependency.
2. Isi environment variables yang diminta Render pada dashboard:
   - `SUPABASE_URL`: URL project Supabase.
   - `SUPABASE_PUBLISHABLE_KEY`: publishable key project Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: service-role secret yang diambil sendiri dari Supabase.
   - `ADMIN_EMAIL`: email akun admin yang dibuat di Supabase Authentication.
   - `ALLOWED_ORIGINS`: sudah disetel oleh `render.yaml` ke origin Pages.
   Jangan taruh service-role secret di repository GitHub atau GitHub Actions secrets.
3. Tunggu service sehat di `/api/health`, lalu isi URL service Render yang sebenarnya di `frontend/js/config.js`:

   ```js
   window.SHOWROOM_API_URL = "https://NAMA-SERVICE.onrender.com/api";
   ```

   Commit perubahan tersebut lalu push agar Pages memakai backend production. Nilai ini hanya URL API, bukan key Supabase. Untuk Live Server di `localhost`, frontend tetap otomatis memakai API lokal.

   Sebelum deploy, revoke/rotate service-role key Supabase yang pernah ditempel di percakapan ini. Gunakan hanya key pengganti yang belum terekspos dan masukkan langsung sebagai environment variable rahasia di Render.

**Keamanan:** semua endpoint data memerlukan access token Supabase Auth dan hanya akun dengan email `ADMIN_EMAIL` yang diizinkan. `SUPABASE_SERVICE_ROLE_KEY` tetap berada di backend saja. RLS tetap disarankan aktif karena service-role melewatinya.

## Checklist pengujian

- [ ] Health: buka `http://localhost:3000/api/health`; respons JSON menyatakan API aktif.
- [ ] Login: admin yang emailnya sesuai `ADMIN_EMAIL` dapat masuk; email lain, password salah, dan request CRUD tanpa token ditolak; tombol Keluar mengakhiri sesi.
- [ ] Pelanggan: tambah, muat/lihat daftar, edit, coba KTP duplikat, hapus.
- [ ] Kendaraan: tambah, cari/filter TERSEDIA atau TERJUAL, edit, hapus kendaraan yang belum dijual.
- [ ] Penjualan: pilih pelanggan dan kendaraan, tambah transaksi, edit transaksi, hapus transaksi; kendaraan terkait menjadi TERJUAL lalu kembali TERSEDIA saat penjualan dihapus.
- [ ] Pembayaran: tambah pembayaran, edit nilai/tanggal/keterangan, hapus; saldo piutang dan status transaksi harus dihitung ulang setiap kali.
- [ ] Batas piutang: pembayaran melebihi saldo ditolak dan transaksi tetap konsisten.
- [ ] Pelunasan: pembayaran tepat sebesar sisa piutang mengubah status menjadi LUNAS dan sisa menjadi nol.
- [ ] Dashboard dan laporan: nilai piutang awal, cicilan, sisa, pencarian, filter status, serta cetak laporan sesuai dengan data Supabase.

### Catatan pengujian

Hapus pelanggan atau kendaraan yang masih direferensikan transaksi seharusnya ditolak oleh foreign key, bukan menghapus transaksi secara diam-diam.
