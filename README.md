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
$env:SUPABASE_SERVICE_ROLE_KEY="ISI_SENDIRI_DI_TERMINAL"
node backend/app.js
```

Jangan menempelkan secret ke chat, menyimpannya di file, atau melakukan commit saat terminal menampilkan perintah yang berisi key. Server berjalan pada port `3000` secara default; alamat URL/key tidak dicetak ke log.

Frontend menggunakan `http://localhost:3000/api` ketika `window.SHOWROOM_API_URL` kosong. Buka `frontend/index.html` dengan VS Code Live Server (umumnya origin `http://127.0.0.1:5500`) atau server file statis lokal. Backend mengizinkan origin pengembangan `localhost`/`127.0.0.1` pada port 5500 dan 5501 secara default.

## Deploy

Repository: [dandywork28-prog/showroom-ar](https://github.com/dandywork28-prog/showroom-ar).

GitHub Pages hanya menjalankan frontend statis, bukan backend Node.js. Workflow `.github/workflows/pages.yml` menerbitkan folder `frontend/` ke GitHub Pages setiap ada push ke branch `main` dan mengaktifkan Pages otomatis. Alamat frontend: <https://dandywork28-prog.github.io/showroom-ar/>.

Deploy `backend/` sebagai layanan Node.js di Render, Railway, atau host sejenis:

1. Pilih versi Node.js 18+ dan arahkan root/build context ke folder `backend`.
2. Gunakan start command `node app.js` (tanpa build step dan tanpa dependency).
3. Atur environment variables pada dashboard hosting, bukan di GitHub:
   - `SUPABASE_URL`: URL project Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: service-role secret yang diambil sendiri dari Supabase.
   - `ALLOWED_ORIGINS`: origin Pages `https://dandywork28-prog.github.io` (tanpa path repository). Beberapa origin boleh dipisahkan koma.
   - Host akan menyediakan `PORT`; jika tidak, aplikasi menggunakan port 3000.
4. Setelah API online, ubah `frontend/js/config.js` menjadi:

   ```js
   window.SHOWROOM_API_URL = "https://URL-BACKEND-ANDA/api";
   ```

   Commit perubahan tersebut lalu push agar Pages memakai backend production. Nilai ini hanya URL API, bukan key Supabase. Untuk Live Server di `localhost`, frontend tetap otomatis memakai API lokal.

   Sebelum deploy, revoke/rotate key Supabase yang pernah ditempel di percakapan ini. Gunakan hanya key pengganti yang belum terekspos dan masukkan langsung sebagai environment variable rahasia di host backend.

**Peringatan akses:** API backend ini belum memiliki login/otorisasi pengguna. CORS hanya membatasi pemakaian dari browser dan bukan perlindungan terhadap pemanggilan langsung. Jangan gunakan deployment terbuka ini dengan data pelanggan sungguhan atau data pribadi; sebelum penggunaan publik, tambahkan autentikasi dan otorisasi (misalnya Supabase Auth dan kebijakan akses yang sesuai).

## Checklist pengujian

- [ ] Health: buka `http://localhost:3000/api/health`; respons JSON menyatakan API aktif.
- [ ] Pelanggan: tambah, muat/lihat daftar, edit, coba KTP duplikat, hapus.
- [ ] Kendaraan: tambah, cari/filter TERSEDIA atau TERJUAL, edit, hapus kendaraan yang belum dijual.
- [ ] Penjualan: pilih pelanggan dan kendaraan, tambah transaksi, edit transaksi, hapus transaksi; kendaraan terkait menjadi TERJUAL lalu kembali TERSEDIA saat penjualan dihapus.
- [ ] Pembayaran: tambah pembayaran, edit nilai/tanggal/keterangan, hapus; saldo piutang dan status transaksi harus dihitung ulang setiap kali.
- [ ] Batas piutang: pembayaran melebihi saldo ditolak dan transaksi tetap konsisten.
- [ ] Pelunasan: pembayaran tepat sebesar sisa piutang mengubah status menjadi LUNAS dan sisa menjadi nol.
- [ ] Dashboard dan laporan: nilai piutang awal, cicilan, sisa, pencarian, filter status, serta cetak laporan sesuai dengan data Supabase.

### Catatan pengujian

Hapus pelanggan atau kendaraan yang masih direferensikan transaksi seharusnya ditolak oleh foreign key, bukan menghapus transaksi secara diam-diam.
