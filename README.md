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


## Fitur pembersihan aman (v1.6)
- Pindai Sampah pada web: pengguna memilih satu folder melalui File System Access API (browser desktop Chromium yang mendukungnya, di HTTPS) dengan izin baca/tulis yang jelas.
- Memindai file dalam folder yang dipilih sampai 5.000 file; melewati folder sistem/terlindungi yang umum.
- Kandidat terbatas pada metadata sampah (.DS_Store, Thumbs.db, desktop.ini), file kunci Office lama, serta file sementara/unduhan tidak lengkap yang sudah berumur sekurangnya 7 hari. File foto, video, dokumen, backup, dan log tidak otomatis ditandai.
- Semua kandidat tampil untuk ditinjau; tidak ada file yang dihapus otomatis setelah pemindaian. Pengguna memilih file dan mengonfirmasi sebelum penghapusan.
- Fitur penghapusan folder belum tersedia di browser yang tidak mendukung File System Access API; browser biasa tetap dapat menganalisis file pilihan namun tidak diberi hak menghapusnya.
- APK Android menyertakan panel native untuk membaca statistik cache aplikasi setelah Usage Access dan mengajukan permintaan pembersihan melalui konfirmasi sistem Android. Pembersihan cache milik RUANG LEGA sendiri juga tersedia. Android tetap mengatur persetujuan; aplikasi tidak menghapus data privat aplikasi lain.
- Web/PWA tidak dapat membaca cache privat aplikasi lain atau membersihkan seluruh disk secara diam-diam. Angka Storage API hanya kuota situs. Hindari klaim bahwa satu tombol web dapat membersihkan semua sampah perangkat.


## Pembersihan cache otomatis (v1.9)
- Android memakai AndroidX WorkManager untuk menjadwalkan pembersihan cache internal dan eksternal milik RUANG LEGA sendiri setiap 24 jam.
- Aplikasi memeriksa saat pertama kali dibuka, setelah versionCode berubah, dan saat dibuka kembali setelah interval 24 jam terlampaui.
- Hanya isi `cacheDir` dan `externalCacheDirs` milik paket RUANG LEGA yang dibersihkan. Folder `files`, database, SharedPreferences, log, cookies, WebView DOM storage, file unduhan, foto, dokumen, dan data/cache aplikasi lain tidak disentuh.
- Log menyimpan waktu, pemicu, status mulai/selesai/gagal, dan estimasi byte yang dibebaskan. Pengguna dapat mengaktifkan atau menonaktifkan jadwal otomatis dari panel Android.
- Jadwal WorkManager adalah pekerjaan berkala yang dapat ditunda oleh Doze/optimasi baterai Android; 24 jam adalah interval target, bukan janji waktu eksekusi tepat.
- PWA membersihkan cache sementara/runtime milik RUANG LEGA saat dibuka paling banyak sekali per 24 jam dan mencatat log lokal. Jika browser mendukung Periodic Background Sync dan mengizinkannya, PWA juga meminta jadwal background 24 jam; jadwal ini bersifat best-effort dan tidak tersedia di semua browser. Ketika versi Service Worker baru aktif, cache versi lama dengan awalan `ruang-lega-` dibersihkan. Jika background sync tidak tersedia, pembersihan PWA hanya terjadi saat website dibuka.
- Tidak ada pembersihan otomatis terhadap cache privat aplikasi lain atau file pengguna. Penghapusan folder pribadi tetap memerlukan pemilihan folder dan persetujuan pengguna.


## Perbaikan pemuatan skrip (v1.9.1)
- JavaScript aplikasi dipindahkan dari inline HTML ke `site/app.js` dan `android/app/src/main/assets/app.js`.
- HTML tidak lagi memuat fragmen kode di luar tag script; skrip dimuat melalui `<script src="./app.js?v=1.9.1" defer>`.
- Service Worker mempramuat app.js bersama shell utama agar tetap tersedia offline dan mengganti cache versi sebelumnya.


## Device storage and cache access (v1.10)
- Android APK requests the special `MANAGE_EXTERNAL_STORAGE` setting only when the user taps “Izinkan akses penyimpanan”. After this permission is granted, “Minta Android bersihkan cache aplikasi” launches Android's official `StorageManager.ACTION_CLEAR_APP_CACHE` confirmation dialog (Android 11+). The operating system, not RUANG LEGA, decides which external app-cache folders can be cleared and waits for the user's confirmation.
- This system dialog is not an API for silently clearing every app's private/internal cache or user data. The user must confirm it. The 24-hour WorkManager task continues to clear only RUANG LEGA's own cache directories.
- Web desktop browsers that support the File System Access API let users pick one folder and grant read/write permission. Optional 24-hour cleanup runs when the site is opened, and only removes selected temporary-file extensions older than seven days within that granted folder.
- The web app cannot get a permission to sweep all operating-system storage or private caches belonging to other apps. Folder permissions are user-controlled and can be revoked in browser settings.

## Android install compatibility (v1.11)
- Android minimum version: Android 6.0 Marshmallow (API 23). WorkManager 2.11.2 is used because WorkManager 2.12.0 raised minSdk to API 24.
- APK is built as a single universal Java/Kotlin package without ABI-specific native libraries.
- The app ID is now `id.ruanglega.app`, separate from earlier debug-package ID `id.ruanglega.app.debug`; this allows the new installation to coexist with previous debug builds.
- GitHub Actions reuses a stable debug signing keystore cache so subsequent v1.11+ APK builds keep the same signing identity. First build with the new stable key is not signed with the former temporary runner key.
- The first install is a sideload/debug distribution and is not a Play Store release.
