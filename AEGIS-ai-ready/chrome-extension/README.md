# AEGIS Chrome Activity Sync

Extension opsional untuk Chrome desktop (versi 120 atau lebih baru). Mencatat **domain**, jam mulai, dan jam selesai saat tab berada di jendela Chrome yang aktif. Tidak mencatat isi halaman, URL lengkap, pencarian, kata sandi, ketikan, screenshot, Incognito, atau aplikasi di luar Chrome.

## Pasang untuk demo

1. Ekstrak ZIP extension atau unduh folder ini ke komputer.
2. Buka chrome://extensions di Chrome desktop.
3. Nyalakan **Developer mode** lalu klik **Load unpacked**.
4. Pilih folder chrome-extension yang langsung berisi manifest.json.
5. Buka atau refresh https://aegis-project-team.netlify.app/ lalu login.
6. Buka **Settings → Chrome activity** dan klik **Connect Chrome**. Pencatatan baru aktif setelah langkah ini.
7. Buka situs lain selama sekitar satu menit, kembali ke AEGIS, lalu lihat **Activity**. Data sinkron otomatis setiap 30 detik ketika halaman AEGIS terbuka.

AEGIS menampilkan domain dengan sumber **Chrome extension**. Jam dan durasi adalah perkiraan aktivitas tab, bukan bukti bahwa pengguna membaca atau memperhatikan halaman.

## Jeda dan akun

- Klik ikon extension di toolbar Chrome untuk **Pause**, **Resume**, atau **Disconnect**.
- Jika AEGIS ditutup, data tetap tersimpan lokal untuk akun yang dihubungkan. Buka AEGIS dan login ke akun yang sama untuk menyinkronkan.
- Akun lain tidak menerima data akun sebelumnya. Untuk berganti akun, disconnect dahulu; data yang belum tersinkron akan dihapus setelah konfirmasi.
- Data lokal baru dihapus dari antrean setelah halaman AEGIS mengonfirmasi penyimpanan Firebase.
- Saat Chrome kehilangan fokus atau perangkat idle selama 60 detik, pencatatan berhenti. Waktu menonton tanpa interaksi dapat terpotong setelah batas idle. Jeda panjang karena sleep atau alarm terlambat tidak dihitung; data dapat sedikit kurang terhitung.
- Maksimum 5.000 interval menunggu sinkron. Jika penuh, pencatatan dijeda tanpa menghapus antrean. Buka AEGIS untuk sinkron, lalu Resume.

Extension ini untuk Chrome desktop, belum Chrome HP. Setiap pengguna perlu memasangnya. Untuk pemasangan umum tanpa Developer mode, perlu publikasi terpisah ke Chrome Web Store.
