# Deploy AEGIS AI ke situs Netlify yang sudah ada

GEMINI_API_KEY harus tersedia di environment variables Production pada situs aegis-project-team. Jangan tulis key ke file.

## Menggunakan terminal VS Code

Install Node.js LTS jika belum tersedia. Buka folder AEGIS-ai-ready di VS Code, lalu Terminal > New Terminal.

Jalankan satu per satu:

```powershell
npm install
npx netlify-cli login
npx netlify-cli link
npx netlify-cli deploy --build --prod
```

Pada langkah link, pilih situs yang sudah ada: aegis-project-team. Jangan membuat situs baru, karena key tersimpan pada situs lama. Login membuka browser untuk otorisasi Netlify. Folder public dan netlify/functions sudah diatur di netlify.toml.

Setelah Published: buka website, Ctrl+Shift+R, login, lalu AI Coach. Uji pertanyaan tentang fokus. Settings > Pengaturan AI Coach memungkinkan memilih AI bawaan atau AI sendiri. Key manual hanya berlaku selama sesi halaman dan tidak ditulis oleh penyimpanan utama ke Firebase. Jika sebelumnya key pernah tersimpan di cloud, penghapusan dari salinan baru tidak menghapus backup atau ekspor lama.

## Alternatif GitHub

Upload isi folder ini (tanpa node_modules) ke repo milikmu. Hubungkan repo ke situs Netlify yang sama lewat pengaturan continuous deployment. Publish directory: public. Functions directory: netlify/functions. Netlify membaca netlify.toml dan memasang dependency dari package.json.

## Pengaturan dan batasan

- Server memverifikasi token Firebase dari project aegis-app-b6019. Tidak membutuhkan private key Firebase tambahan.
- GEMINI_MODEL opsional; default gemini-flash-latest. Alias model dapat berubah mengikuti Google.
- Rate limit Netlify: 10 request per 60 detik per IP dan domain. Pengunjung di jaringan yang sama berbagi batas ini. Ini bukan kuota harian per akun atau batas biaya global.
- Error backend menampilkan pemberitahuan lalu memakai respons aturan offline. Pastikan pengujian tidak menampilkan pemberitahuan fallback tersebut.
- Jangan drag folder proyek ini ke upload HTML biasa: backend harus dibundel melalui Netlify CLI atau Git deployment.
- Kode belum diuji dengan key Production atau login pengguna nyata. Pengujian akhir memerlukan deploy dan akunmu.
