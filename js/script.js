// Chart.js - Grafik Kendala Bulanan
const ctx = document.getElementById('kendalaChart');
if (ctx) {
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun'],
      datasets: [{
        label: 'Jumlah Kendala',
        data: [5, 9, 7, 14, 8, 12],
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true }
      }
    }
  });
}

/* ===== Data Kendala (frontend-only, localStorage) ===== */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.getElementById('dataKendalaPage');
  if (!page) return; // Jalan hanya di datakendala.html

  // --- Utils ---
  const $  = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const fmtDate = iso => { const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; };
  const today = (off=0)=>{ const d=new Date(); d.setDate(d.getDate()+off); return d.toISOString().slice(0,10); };
  const esc = (s='') => s.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]));
  const badgeStatus = s => `<span class="badge badge-status ${s.toLowerCase()}">${s}</span>`;
  const badgePrio   = p => `<span class="badge badge-prio ${p.toLowerCase()}">${p}</span>`;
  const gid = ()=>'KDL-'+Math.random().toString(36).slice(2,8).toUpperCase();
  const CURRENT_ROLE = window.CURRENT_ROLE || 'admin';

  // --- Toast ---
  const toast = new bootstrap.Toast($('#mainToast'));
  const showToast = m => { $('#toastMsg').textContent = m; toast.show(); };

  // --- Data service (localStorage demo) ---
  const LS_KEY = 'kendalaDataV1';
  const DS = {
    list(){
      const raw = localStorage.getItem(LS_KEY);
      if (!raw){
        const seed = [
          { id: gid(), tanggal: today(-1), kategori:'AC', lokasi:'Ruang Server',
            identitas:{acKode:'AC-001', acMerk:'Daikin FTKQ25U', noPol:'', jenisKdr:''},
            deskripsi:'AC tidak dingin, indikasi kurang freon.',
            prioritas:'Tinggi', status:'Baru', teknisi:'', pelapor:'Dini', lampiran:'' },
          { id: gid(), tanggal: today(0), kategori:'Kendaraan', lokasi:'Parkiran Utama',
            identitas:{acKode:'', acMerk:'', noPol:'B 1234 ABC', jenisKdr:'Mobil Dinas'},
            deskripsi:'Ban belakang kiri gundul, perlu diganti.',
            prioritas:'Sedang', status:'Diproses', teknisi:'Bagas', pelapor:'Andri', lampiran:'' },
          { id: gid(), tanggal: today(-3), kategori:'Alat Umum', lokasi:'Gudang',
            identitas:{acKode:'', acMerk:'', noPol:'', jenisKdr:''},
            deskripsi:'Lampu gudang sering flicker.',
            prioritas:'Rendah', status:'Selesai', teknisi:'Rara', pelapor:'Sinta', lampiran:'' }
        ];
        localStorage.setItem(LS_KEY, JSON.stringify(seed)); return seed;
      }
      try { return JSON.parse(raw); } catch { return []; }
    },
    save(list){ localStorage.setItem(LS_KEY, JSON.stringify(list)); },
    upsert(item){
      const list = this.list();
      const idx = list.findIndex(x=>x.id===item.id);
      if (idx>=0) list[idx]=item; else list.unshift(item);
      this.save(list); return list;
    },
    remove(id){ const list=this.list().filter(x=>x.id!==id); this.save(list); return list; },
    get(id){ return this.list().find(x=>x.id===id); }
  };

  // --- DOM refs ---
  const tbody = $('#kendalaTbody');
  const totalInfo = $('#totalInfo');
  const searchInput = $('#searchInput');
  const filterKategori = $('#filterKategori');
  const filterStatus = $('#filterStatus');
  const filterPrioritas = $('#filterPrioritas');
  const filterTanggal = $('#filterTanggal');
  const sortBy = $('#sortBy');

  const form = $('#kendalaForm');
  const formMode = $('#formMode');
  const editId = $('#editId');
  const modalTitle = $('#modalTitle');
  const kendalaModal = new bootstrap.Modal($('#kendalaModal'));
  const detailModal  = new bootstrap.Modal($('#detailModal'));

  const tanggal = $('#tanggal');
  const kategori = $('#kategori');
  const lokasi = $('#lokasi');
  const acKode = $('#acKode');
  const acMerk = $('#acMerk');
  const noPol = $('#noPol');
  const jenisKdr = $('#jenisKdr');
  const deskripsi = $('#deskripsi');
  const prioritas = $('#prioritas');
  const status = $('#status');
  const teknisi = $('#teknisi');
  const lampiran = $('#lampiran');
  const pelapor = $('#pelapor');
  const dynAc = $$('.dyn-ac');
  const dynKdr = $$('.dyn-kdr');

  let data = DS.list();

  // --- Render ---
  function render(){
    const q  = (searchInput.value||'').toLowerCase();
    const fk = filterKategori.value;
    const fs = filterStatus.value;
    const fp = filterPrioritas.value;
    const ft = filterTanggal.value;

    let rows = [...data].filter(r=>{
      const text = [r.deskripsi,r.lokasi,r.teknisi,r.pelapor,r.identitas.acKode,r.identitas.acMerk,r.identitas.noPol,r.identitas.jenisKdr]
        .join(' ').toLowerCase();
      const byQ = !q || text.includes(q);
      const byK = !fk || r.kategori===fk;
      const byS = !fs || r.status===fs;
      const byP = !fp || r.prioritas===fp;
      const byT = !ft || r.tanggal===ft;
      return byQ && byK && byS && byP && byT;
    });

    const sort = sortBy.value;
    rows.sort((a,b)=>{
      if (sort.startsWith('tanggal')) return sort.endsWith('asc') ? a.tanggal.localeCompare(b.tanggal) : b.tanggal.localeCompare(a.tanggal);
      if (sort.startsWith('prioritas')){ const o={Tinggi:3,Sedang:2,Rendah:1}; return sort.endsWith('asc')? o[a.prioritas]-o[b.prioritas] : o[b.prioritas]-o[a.prioritas]; }
      if (sort.startsWith('status')) return sort.endsWith('asc') ? a.status.localeCompare(b.status) : b.status.localeCompare(a.status);
      return 0;
    });

    tbody.innerHTML = '';
    rows.forEach(r=>{
      const ident = r.kategori==='AC'
        ? `${r.identitas.acKode||'-'} • ${r.identitas.acMerk||'-'}`
        : r.kategori==='Kendaraan'
          ? `${r.identitas.noPol||'-'} • ${r.identitas.jenisKdr||'-'}`
          : '-';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-header="Tanggal">${fmtDate(r.tanggal)}</td>
        <td data-header="Kategori">${r.kategori}</td>
        <td data-header="Aset / Identitas">${ident}</td>
        <td data-header="Deskripsi">
          <div class="text-truncate" style="max-width:360px">${esc(r.deskripsi)}</div>
          <div class="text-muted small">${esc(r.lokasi)}</div>
          ${r.lampiran ? `<div class="small mt-1 text-muted">Lampiran: ${esc(r.lampiran)}</div>` : ''}
        </td>
        <td data-header="Prioritas">${badgePrio(r.prioritas)}</td>
        <td data-header="Status">${badgeStatus(r.status)}</td>
        <td data-header="Teknisi">${r.teknisi ? esc(r.teknisi) : '<span class="text-muted">-</span>'}</td>
        <td data-header="Aksi" class="text-end">${actionsHtml(r)}</td>`;
      tbody.appendChild(tr);
      attachRowHandlers(r.id);
    });

    totalInfo.textContent = `${rows.length} kendala`;

    if (window.matchMedia('(max-width: 576px)').matches) {
      const headers = ['Tanggal','Kategori','Aset / Identitas','Deskripsi','Prioritas','Status','Teknisi','Aksi'];
      tbody.querySelectorAll('tr').forEach(tr => tr.querySelectorAll('td').forEach((td,i)=>td.setAttribute('data-header', headers[i])));
    }
  }

  function actionsHtml(r){
    const viewBtn = `<button class="btn btn-sm btn-outline-secondary me-1" data-action="detail" data-id="${r.id}"><i class="bi bi-eye"></i></button>`;
    const editBtn = `<button class="btn btn-sm btn-outline-primary me-1" data-action="edit" data-id="${r.id}"><i class="bi bi-pencil-square"></i></button>`;
    const delBtn  = `<button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${r.id}"><i class="bi bi-trash"></i></button>`;
    const takeBtn = `<button class="btn btn-sm btn-success me-1" data-action="take" data-id="${r.id}"><i class="bi bi-person-check"></i> Ambil</button>`;
    if (CURRENT_ROLE==='admin') return viewBtn+editBtn+delBtn;
    const canTake = !r.teknisi && r.status!=='Selesai';
    return viewBtn + (canTake?takeBtn:'') + editBtn;
  }

  function attachRowHandlers(id){
    page.querySelectorAll(`[data-id="${id}"]`).forEach(btn=>{
      btn.addEventListener('click', e=>{
        const act = e.currentTarget.getAttribute('data-action');
        if (act==='detail') openDetail(id);
        if (act==='edit')   openEdit(id);
        if (act==='delete') removeItem(id);
        if (act==='take')   takeJob(id);
      });
    });
  }

  function openDetail(id){
    const it = data.find(x=>x.id===id); if (!it) return;
    const ident = it.kategori==='AC'
      ? `<tr><td class="text-muted">Kode/Asset</td><td>${esc(it.identitas.acKode||'-')}</td></tr>
         <tr><td class="text-muted">Merk/Model</td><td>${esc(it.identitas.acMerk||'-')}</td></tr>`
      : it.kategori==='Kendaraan'
        ? `<tr><td class="text-muted">No. Polisi</td><td>${esc(it.identitas.noPol||'-')}</td></tr>
           <tr><td class="text-muted">Jenis</td><td>${esc(it.identitas.jenisKdr||'-')}</td></tr>`
        : `<tr><td class="text-muted">Identitas</td><td>-</td></tr>`;
    $('#detailContent').innerHTML = `
      <div class="mb-3">
        <span class="badge me-1">${it.kategori}</span>
        ${badgePrio(it.prioritas)} ${badgeStatus(it.status)}
      </div>
      <table class="table table-sm">
        <tbody>
          <tr><td class="text-muted">ID</td><td>${it.id}</td></tr>
          <tr><td class="text-muted">Tanggal</td><td>${fmtDate(it.tanggal)}</td></tr>
          <tr><td class="text-muted">Lokasi</td><td>${esc(it.lokasi)}</td></tr>
          ${ident}
          <tr><td class="text-muted">Deskripsi</td><td>${esc(it.deskripsi)}</td></tr>
          <tr><td class="text-muted">Pelapor</td><td>${esc(it.pelapor)}</td></tr>
          <tr><td class="text-muted">Teknisi</td><td>${esc(it.teknisi||'-')}</td></tr>
          <tr><td class="text-muted">Lampiran</td><td>${it.lampiran?esc(it.lampiran):'-'}</td></tr>
        </tbody>
      </table>`;
    detailModal.show();
  }

  function openEdit(id){
    const it = data.find(x=>x.id===id); if (!it) return;
    formMode.value='edit'; editId.value=it.id; modalTitle.textContent='Edit Kendala';
    tanggal.value=it.tanggal; kategori.value=it.kategori; lokasi.value=it.lokasi;
    acKode.value=it.identitas.acKode||''; acMerk.value=it.identitas.acMerk||'';
    noPol.value=it.identitas.noPol||''; jenisKdr.value=it.identitas.jenisKdr||'';
    deskripsi.value=it.deskripsi; prioritas.value=it.prioritas; status.value=it.status;
    teknisi.value=it.teknisi||''; pelapor.value=it.pelapor||'';
    toggleDyn(); kendalaModal.show();
  }

  // Tambah
  $('#btnOpenTambah').addEventListener('click', ()=>{
    formMode.value='create'; editId.value=''; modalTitle.textContent='Tambah Kendala';
    form.reset(); tanggal.value=today(); toggleDyn();
  });

  // Hapus
  function removeItem(id){
    if (!confirm('Hapus kendala ini?')) return;
    data = DS.remove(id);
    showToast('Data terhapus.'); render();
  }

  // Ambil pekerjaan (teknisi)
  function takeJob(id){
    const it = data.find(x=>x.id===id); if (!it) return;
    it.teknisi = 'Teknisi Saya';
    if (it.status==='Baru') it.status='Diproses';
    DS.save(data); showToast('Pekerjaan diambil.'); render();
  }

  // Submit form
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const item = {
      id: formMode.value==='edit' ? editId.value : gid(),
      tanggal: tanggal.value,
      kategori: kategori.value,
      lokasi: lokasi.value,
      identitas: {
        acKode: acKode.value, acMerk: acMerk.value,
        noPol: noPol.value, jenisKdr: jenisKdr.value
      },
      deskripsi: deskripsi.value,
      prioritas: prioritas.value,
      status: status.value,
      teknisi: teknisi.value,
      pelapor: pelapor.value,
      lampiran: lampiran.files?.[0]?.name || ''
    };
    data = DS.upsert(item);
    kendalaModal.hide();
    showToast('Perubahan tersimpan.');
    render();
  });

  // Dinamis field
  function toggleDyn(){
    const k = kategori.value;
    $$('.dyn-ac').forEach(el=>el.classList.toggle('d-none', k!=='AC'));
    $$('.dyn-kdr').forEach(el=>el.classList.toggle('d-none', k!=='Kendaraan'));
  }
  kategori.addEventListener('change', toggleDyn);

  // Filter & sort
  [searchInput, filterKategori, filterStatus, filterPrioritas, filterTanggal, sortBy]
    .forEach(el=>el.addEventListener('input', render));
  $('#btnResetFilter').addEventListener('click', ()=>{
    searchInput.value=''; filterKategori.value=''; filterStatus.value='';
    filterPrioritas.value=''; filterTanggal.value=''; sortBy.value='tanggal_desc';
    render();
  });

  // init
  render();
});


// ==== Global Sidebar Loader ====
document.addEventListener('DOMContentLoaded', async () => {
  const mount = document.getElementById('sidebarMount');
  if (!mount) return;

  // Kalau halaman berada di subfolder, ganti path jadi '../partials/sidebar.html'
  const PARTIAL_PATH = 'partials/sidebar.html';

  try {
    const res = await fetch(PARTIAL_PATH);
    const html = await res.text();

    // ganti placeholder dengan isi sidebar (agar id dan event offcanvas aktif)
    mount.outerHTML = html;

    // Tandai link aktif & expand submenu jika link aktif berada di submenu
    const current = (location.pathname.split('/').pop() || 'index.html').split('?')[0];
    document.querySelectorAll('.sidebar-nav a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      // cocokkan nama file (abaikan query string)
      if (href.split('?')[0] === current) {
        a.classList.add('active');
        // Kalau link berada dalam submenu collapse, buka submenunya
        const sub = a.closest('#submenuAlat');
        if (sub) sub.classList.add('show');
      }
    });

  } catch (err) {
    console.error('Gagal memuat sidebar:', err);
  }
});

