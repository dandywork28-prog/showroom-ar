# Showroom AR

Demo sistem manajemen piutang showroom mobil. Frontend di-host langsung oleh GitHub Pages dan berbicara langsung ke Supabase REST API. Tidak perlu hosting Node.js, Render, package tambahan, akun login, atau secret di GitHub.

## Jalankan untuk penilaian

1. Buka project Supabase → **SQL Editor**.
2. Jalankan seluruh isi [`backend/database.sql`](backend/database.sql). Ini menyiapkan tabel, trigger piutang, data demo, dan akses publik terbatas ke baris demo.
3. Pastikan [`frontend/js/config.js`](frontend/js/config.js) berisi URL project dan **publishable key**. Publishable key memang dipakai browser dan bukan service-role/secret key.
4. Push branch `main` ke GitHub. Workflow Pages otomatis menerbitkan folder `frontend/`.
5. Bagikan URL: <https://dandywork28-prog.github.io/showroom-ar/>.

Setelah workflow selesai, dosen dapat membuka web tanpa login. CRUD menyimpan perubahan ke Supabase dan dapat dipakai langsung dari GitHub Pages.

## Data demo

Website terbuka untuk umum. Kebijakan RLS hanya mengizinkan pengunjung membaca dan mengelola baris dengan `is_demo = true`; data lama tetap `false` dan tidak ditampilkan. Skrip menambahkan pelanggan/kendaraan/transaksi contoh fiktif dan aman dijalankan ulang tanpa menghapus tabel atau data lama.

Karena ini demo publik bersama, pengunjung lain bisa mengubah atau menghapus data demo. Jangan masukkan informasi pelanggan atau data pribadi sungguhan. Jangan pernah menaruh service-role/secret key di frontend.

## Jalankan lokal

Untuk mencoba frontend terhadap backend Node lokal, jalankan backend dengan Node.js 18+ dan environment variables di PowerShell:

```powershell
$env:SUPABASE_URL="URL_PROJECT_SUPABASE"
$env:SUPABASE_SERVICE_ROLE_KEY="ISI_SENDIRI_DI_TERMINAL"
node backend/app.js
```

Buka `frontend/index.html` dengan Live Server. Di `localhost`, frontend menggunakan backend lokal pada `http://localhost:3000/api`. Untuk deployment GitHub Pages tidak perlu menjalankan perintah ini; Pages menggunakan Supabase langsung dengan konfigurasi publishable.
