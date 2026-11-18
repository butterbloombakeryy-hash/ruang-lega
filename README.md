# RUANG LEGA — Smart Storage Assistant

Aplikasi pendamping untuk meninjau file besar/duplikat secara lokal dan memandu pengguna mengelola penyimpanan digital dengan aman. Proyek KKA — Aris Sahwan.

## Hasil aplikasi
- **PWA HTTPS** — folder `site/`, dipublikasikan otomatis ke GitHub Pages.
- **Android APK** — proyek native WebView di `android/`; GitHub Actions membangun APK debug dan menyimpannya sebagai artifact.
- **Offline web** — service worker menyimpan shell aplikasi setelah kunjungan pertama.

## Publikasi PWA
Workflow **Publish RUANG LEGA PWA** deploy folder `site/` ke GitHub Pages. URL proyek yang diharapkan:
`https://butterbloombakeryy-hash.github.io/ruang-lega/`

Jika deployment belum berjalan, buka **Actions**, pilih workflow tersebut, lalu **Run workflow**. Pastikan **Settings → Pages** mengizinkan publikasi melalui GitHub Actions bila diminta.

## Build APK Android
Workflow **Build RUANG LEGA Android APK** berjalan otomatis saat file Android berubah. Untuk menjalankan ulang:
1. Buka **Actions**.
2. Pilih **Build RUANG LEGA Android APK**.
3. Tekan **Run workflow** pada branch `main`.
4. Setelah status hijau, unduh artifact `ruang-lega-android-debug-apk`.
5. Ekstrak ZIP artifact, lalu pasang `app-debug.apk` pada Android.

APK adalah **debug APK** untuk uji coba/presentasi, bukan rilisan Play Store bertanda tangan produksi.

## Fitur
- Memilih banyak file dari perangkat, termasuk foto, video, dan dokumen.
- Melihat urutan file berdasarkan ukuran, jumlah file, total ukuran, dan file besar di atas 100 MB.
- Menemukan file identik dengan SHA-256 (file sampai 30 MB).
- Mengekspor laporan CSV.
- Panduan Android, iPhone, Windows, dan pembersihan cache TikTok.
- File yang dipilih diproses lokal dan tidak diunggah ke server.

## Fitur Android tambahan (v1.3)
- Membaca total/terpakai/tersedia pada volume penyimpanan internal perangkat.
- Membaca ukuran aplikasi, data, dan cache untuk aplikasi yang tampil di launcher, melalui `StorageStatsManager`.
- Memerlukan **Usage access** yang diaktifkan sendiri oleh pengguna di Pengaturan Android.
- Membuka halaman Info Aplikasi agar pengguna dapat memilih **Hapus cache** per aplikasi.
- Meminta layar konfirmasi resmi Android untuk membersihkan cache aplikasi lintas aplikasi pada Android 11+; memerlukan **Akses semua file**. Android tetap mengendalikan proses dan pengguna tetap harus menyetujui.

## Batasan dan privasi
Android tidak mengizinkan aplikasi biasa membaca isi privat aplikasi lain (misalnya isi chat, foto privat, atau database) atau menghapus data privatnya. RUANG LEGA hanya membaca angka ukuran app/data/cache yang disediakan sistem. Pembersihan lintas aplikasi menggunakan layar konfirmasi Android dan tidak berjalan diam-diam. Akses semua file adalah izin sensitif; jangan aktifkan bila tidak nyaman. Google Play membatasi izin luas ini, sehingga APK ini ditujukan untuk uji coba/presentasi sideload, bukan dinyatakan siap publikasi Play Store.

Versi web/PWA tidak memiliki akses native ke statistik penyimpanan semua aplikasi atau pembersihan cache sistem. Dashboard Storage API di browser hanya mengestimasi kuota origin situs, bukan total memori HP.

## Struktur
- `site/` — PWA publik.
- `android/` — aplikasi Android native WebView dan aset lokal.
- `.github/workflows/publish-pwa.yml` — workflow GitHub Pages.
- `.github/workflows/build-android-apk.yml` — workflow build APK.
