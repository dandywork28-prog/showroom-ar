# Showroom AR

Sistem Manajemen Piutang Penjualan pada Showroom Mobil dengan frontend statis, backend Node.js native, dan Supabase PostgreSQL. Versi publik ini adalah **demo bersama**: dosen/pengunjung tidak perlu akun, dan semua perubahan hanya berlaku pada baris contoh.

## Isi project

- `frontend/index.html`: antarmuka aplikasi.
- `frontend/css/style.css`: desain responsif.
- `frontend/js/script.js`: navigasi, CRUD, dashboard, dan laporan.
- `frontend/js/config.js`: URL API yang dipakai frontend.
- `backend/app.js`: REST API berbasis `node:http` dan `fetch` bawaan Node.js.
- `backend/database.sql`: empat tabel, trigger piutang, pemisahan data demo, dan data contoh.

## Siapkan database Supabase

1. Buka project Supabase dan pilih **SQL Editor**.
2. Buka `backend/database.sql`, salin seluruh isinya, lalu jalankan di SQL Editor.
3. Pastikan tabel `pelanggan`, `kendaraan`, `penjualan`, dan `pembayaran` tersedia beserta beberapa baris contoh.
4. Skrip menambah kolom `is_demo` secara aman. Data yang sudah ada otomatis tetap `is_demo = false`; data tersebut tidak tampil dan tidak bisa diubah lewat API demo publik.

Skrip dapat dijalankan ulang tanpa menghapus tabel atau data lama. Baris contoh menggunakan identitas dan transaksi fiktif. Trigger database juga menolak penjualan/pembayaran demo yang mencoba merujuk ke baris non-demo.

## Jalankan secara lokal

Gunakan Node.js 18 atau lebih baru. Dari root project, atur variabel di terminal PowerShell VS Code dan jalankan backend:

```powershell
$env:SUPABASE_URL="URL_PROJECT_SUPABASE"
$env:SUPABASE_SERVICE_ROLE_KEY="ISI_SENDIRI_DI_TERMINAL"
node backend/app.js
```

Jangan menempelkan service-role key ke chat, menyimpannya di file, atau melakukan commit atas perintah yang berisi secret. Nilai key tidak dicetak ke log. Backend berjalan pada port `3000` secara default.

Buka `frontend/index.html` dengan VS Code Live Server (umumnya `http://127.0.0.1:5500`). Saat `window.SHOWROOM_API_URL` kosong, frontend lokal otomatis memakai `http://localhost:3000/api`. CORS pengembangan mengizinkan Live Server pada port 5500 dan 5501.

## Deploy

Repository: [dandywork28-prog/showroom-ar](https://github.com/dandywork28-prog/showroom-ar).

GitHub Pages hanya menjalankan frontend statis, bukan backend Node.js. Workflow `.github/workflows/pages.yml` menerbitkan folder `frontend/` ke GitHub Pages setiap ada push ke branch `main`. Alamat frontend: <https://dandywork28-prog.github.io/showroom-ar/>.

Deploy backend sebagai layanan Node.js di Render:

1. Di Render, pilih **New → Blueprint**, hubungkan repository ini, lalu gunakan `render.yaml`. Service memakai runtime Node.js dan perintah `node app.js`, tanpa package atau dependency.
2. Masukkan environment variables yang diminta Render:
   - `SUPABASE_URL`: URL project Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: service-role secret baru yang diambil sendiri dari Supabase.
   - `ALLOWED_ORIGINS`: sudah disetel `render.yaml` ke origin GitHub Pages.
3. Tunggu service sehat di `/api/health`, lalu isi URL service Render yang sebenarnya di `frontend/js/config.js`:

   ```js
   window.SHOWROOM_API_URL = "https://NAMA-SERVICE.onrender.com/api";
   ```

   Commit perubahan URL API lalu push ke `main` agar Pages memakai backend production. URL API bukan key Supabase; jangan pernah menaruh key di frontend atau repository.

Sebelum deploy, revoke/rotate service-role key Supabase yang pernah ditempel di percakapan ini. Gunakan hanya key pengganti yang belum terekspos dan masukkan langsung sebagai environment variable rahasia di Render.

## Batas akses demo publik

Tidak ada form login. Pengunjung dapat melihat, menambah, mengedit, dan menghapus **data demo** bersama. Jangan masukkan data pelanggan atau informasi pribadi yang nyata.

Backend memakai service-role key hanya di sisi server dan mengunci seluruh operasi API pada `is_demo = true`. Insert baru selalu diberi tanda demo oleh backend; update/delete hanya mencari record demo; trigger SQL memastikan foreign key dari penjualan dan pembayaran tetap berada di kelompok demo yang sama. Data lama tetap `is_demo = false`. RLS tetap disarankan aktif, tetapi service-role melewatinya—pemisahan data demo ditegakkan oleh filter API dan trigger database, bukan oleh RLS.

API demo sengaja dapat digunakan publik, sehingga pengunjung dapat mengubah atau menghapus baris demo yang sama. Jangan gunakan backend ini untuk aplikasi produksi atau sebagai pengganti sistem autentikasi/otorisasi.

## Checklist pengujian

- [ ] Health: buka `/api/health`; respons JSON menyatakan API aktif.
- [ ] Akses publik: GitHub Pages terbuka tanpa email/password dan menampilkan data contoh.
- [ ] Isolasi: daftar API hanya berisi baris `is_demo = true`; operasi atas ID baris non-demo menghasilkan 404.
- [ ] Pelanggan: tambah, lihat, edit, coba KTP duplikat, hapus.
- [ ] Kendaraan: tambah, filter TERSEDIA/TERJUAL, edit, hapus kendaraan yang belum dijual.
- [ ] Penjualan: pilih pelanggan dan kendaraan demo, tambah/edit/hapus; kendaraan terkait menjadi TERJUAL lalu kembali TERSEDIA saat penjualan dihapus.
- [ ] Pembayaran: tambah/edit/hapus; saldo piutang dan status transaksi dihitung ulang.
- [ ] Batas piutang: pembayaran melebihi saldo ditolak dan transaksi tetap konsisten.
- [ ] Pelunasan: pembayaran tepat sebesar sisa piutang mengubah status menjadi LUNAS dan sisa menjadi nol.
- [ ] Relasi privat: percobaan membuat penjualan/pembayaran demo dengan ID pelanggan, kendaraan, atau penjualan non-demo ditolak.
- [ ] Dashboard/laporan: ringkasan, grafik, pencarian, filter status, serta cetak laporan sesuai data contoh.

Hapus pelanggan atau kendaraan yang masih direferensikan transaksi akan ditolak oleh foreign key, bukan menghapus transaksi secara diam-diam.
