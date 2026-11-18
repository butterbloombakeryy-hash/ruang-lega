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

## Batasan dan privasi
Website atau APK biasa **tidak dapat** membaca semua isi penyimpanan internal maupun menghapus cache aplikasi lain secara otomatis. Dashboard Storage API hanya mengestimasi penggunaan kuota origin aplikasi/browser, bukan total memori HP. Penghapusan file tetap menjadi keputusan pengguna melalui File/Galeri atau pengaturan OS. Hindari opsi “Hapus data” jika belum memahami dampaknya.

## Struktur
- `site/` — PWA publik.
- `android/` — aplikasi Android native WebView dan aset lokal.
- `.github/workflows/publish-pwa.yml` — workflow GitHub Pages.
- `.github/workflows/build-android-apk.yml` — workflow build APK.
