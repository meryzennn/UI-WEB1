// ===== Dashboard Chart (aman di semua halaman) =====
document.addEventListener('DOMContentLoaded', () => {
  const c = document.getElementById('kendalaChart');
  if (!c) return;                           // bukan halaman dashboard

  if (typeof Chart === 'undefined') {
    console.error('Chart.js belum dimuat');
    return;
  }

  const chart = new Chart(c, {
    type: 'line',
    data: {
      labels: ['Jan','Feb','Mar','Apr','Mei','Jun'],
      datasets: [{
        label: 'Jumlah Kendala',
        data: [5, 9, 7, 14, 8, 12],
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,   // biar tinggi fleksibel di container
      plugins: { legend: { display: true } },
      scales: { y: { beginAtZero: true } }
    }
  });

  // Kalau canvas ada di tab/accordion yang awalnya hidden,
  // panggil resize saat terlihat.
  document.addEventListener('shown.bs.tab', () => chart.resize());
  document.addEventListener('shown.bs.collapse', () => chart.resize());
});




/* ===== FE-ONLY Data Kendala (localStorage) ===== */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.getElementById('dataKendalaPage');
  if (!page) return;

  // ---------- Utils ----------
  const $  = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const fmtDate = iso => { const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; };
  const today = (off=0)=>{ const d=new Date(); d.setDate(d.getDate()+off); return d.toISOString().slice(0,10); };
  const esc = (s='') => s.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]));
  const gid = ()=>'KDL-'+Math.random().toString(36).slice(2,8).toUpperCase();
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const ALLOWED_KAT = ['AC','Kendaraan'];

  const badgeStatus = s => `<span class="badge badge-status ${s.toLowerCase()}">${s}</span>`;
  const badgePrio   = p => `<span class="badge badge-prio ${p.toLowerCase()}">${p}</span>`;
  const badgeApproval = (s, forWhat='') => {
    const cls = (s||'pending').toLowerCase();
    const label = s ? s[0].toUpperCase()+s.slice(1) : 'Pending';
    const extra = forWhat ? ` <span class="text-muted small">(${esc(forWhat)})</span>` : '';
    return `<span class="badge badge-approval ${cls}">${label}</span>${extra}`;
  };



  // ---------- Toast ----------
  const toast = new bootstrap.Toast($('#mainToast'));
  const showToast = m => { $('#toastMsg').textContent = m; toast.show(); };

  // ---------- Data Service ----------
  const LS_KEY = 'kendalaDataV2';
  const DS = {
    _sanitize(list){ return (list||[]).filter(r => ALLOWED_KAT.includes(r.kategori)); },
    _seed(){
      const seed = [
        { id: gid(), tanggal: today(-1), kategori:'AC', lokasi:'Ruang Server',
          identitas:{acKode:'AC-001', acMerk:'Daikin FTKQ25U', noPol:'', jenisKdr:''},
          deskripsi:'AC tidak dingin, indikasi kurang freon.',
          prioritas:'Tinggi', status:'Baru', teknisi:'', pelapor:'Dini', lampiran:'',
          approval_status:'approved', approval_for:'', last_approved:null },
        { id: gid(), tanggal: today(0), kategori:'Kendaraan', lokasi:'Parkiran Utama',
          identitas:{acKode:'', acMerk:'', noPol:'B 1234 ABC', jenisKdr:'Mobil Dinas'},
          deskripsi:'Ban belakang kiri gundul, perlu diganti.',
          prioritas:'Sedang', status:'Diproses', teknisi:'Bagas', pelapor:'Andri', lampiran:'',
          approval_status:'approved', approval_for:'', last_approved:null },
      ];
      localStorage.setItem(LS_KEY, JSON.stringify(seed));
      return seed;
    },
    list(){
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return this._seed();
      try { return this._sanitize(JSON.parse(raw)); } catch { return []; }
    },
    save(list){ localStorage.setItem(LS_KEY, JSON.stringify(this._sanitize(list))); },
    get(id){ return this.list().find(x=>x.id===id); },
    upsert(item){
      const list = this.list();
      const idx = list.findIndex(x=>x.id===item.id);
      if (idx>=0) list[idx] = { ...list[idx], ...item };
      else list.unshift(item);
      this.save(list);
      return list;
    },
    remove(id){
      const list = this.list().filter(x=>x.id!==id);
      this.save(list); return list;
    }
  };

  // ---------- DOM refs ----------
  const tbody = $('#kendalaTbody');
  const totalInfo = $('#totalInfo');
  const searchInput = $('#searchInput');
  const filterKategori = $('#filterKategori');
  const filterStatus = $('#filterStatus');
  const filterPrioritas = $('#filterPrioritas');
  const filterTanggal = $('#filterTanggal');
  const sortBy = $('#sortBy');

  const kendalaModalEl = $('#kendalaModal');
  const kendalaModal = new bootstrap.Modal(kendalaModalEl);
  const detailModal  = new bootstrap.Modal($('#detailModal'));

  const form = $('#kendalaForm');
  const formMode = $('#formMode');
  const editId = $('#editId');
  const modalTitle = $('#modalTitle');

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

  let data = DS.list();

  // ---------- Approval computation ----------
  // --- Approval rules: selalu pending saat tambah/ubah (siapa pun yang input) ---
  function computeApprovalOnSave({ prev, next }) {
    if (!prev) {
      // Buat baru → pending
      next.approval_status = 'pending';
      next.approval_for    = 'Laporan baru';
      return;
    }
    // Perubahan status → pending
    if (prev.status !== next.status) {
      next.approval_status = 'pending';
      next.approval_for    = `Ubah status ke ${next.status}`;
      return;
    }
    // Perubahan data lain → pending
    const fieldsToCompare = ['tanggal','kategori','lokasi','deskripsi','prioritas','teknisi','pelapor','lampiran'];
    const changed = fieldsToCompare.some(f => (prev[f]||'') !== (next[f]||''))
                  || (prev.identitas?.acKode !== next.identitas?.acKode)
                  || (prev.identitas?.acMerk !== next.identitas?.acMerk)
                  || (prev.identitas?.noPol !== next.identitas?.noPol)
                  || (prev.identitas?.jenisKdr !== next.identitas?.jenisKdr);
    if (changed) {
      next.approval_status = 'pending';
      next.approval_for    = 'Perubahan data';
    }
  }


  function snapshot(it){
    const copy = clone(it);
    delete copy.last_approved;
    return copy;
  }

  function approveItem(id){
    const it = data.find(x=>x.id===id); if (!it) return;
    it.approval_status = 'approved';
    it.approval_for    = '';
    DS.save(data);
    showToast('Disetujui.');
    render();             // <- penting
  }

  function rejectItem(id){
    const it = data.find(x=>x.id===id); if (!it) return;
    it.approval_status = 'rejected';
    it.approval_for    = '';
    DS.save(data);
    showToast('Ditolak.');
    render();             // <- penting
  }


  // ---------- Render ----------
  function render(){
    const q  = (searchInput.value||'').toLowerCase();
    const fk = filterKategori.value;
    const fs = filterStatus.value;
    const fp = filterPrioritas.value;
    const ft = filterTanggal.value;

    let rows = [...data].filter(r=>{
      const text = [
        r.deskripsi,r.lokasi,r.teknisi,r.pelapor,
        r.identitas.acKode,r.identitas.acMerk,r.identitas.noPol,r.identitas.jenisKdr
      ].join(' ').toLowerCase();
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
        : `${r.identitas.noPol||'-'} • ${r.identitas.jenisKdr||'-'}`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-header="Tanggal">${fmtDate(r.tanggal)}</td>
        <td data-header="Kategori">${r.kategori}</td>
        <td data-header="Aset / Identitas">${esc(ident)}</td>
        <td data-header="Deskripsi">
          <div class="text-truncate" style="max-width:360px">${esc(r.deskripsi)}</div>
          <div class="text-muted small">${esc(r.lokasi)}</div>
          ${r.lampiran ? `<div class="small mt-1 text-muted">Lampiran: ${esc(r.lampiran)}</div>` : ''}
        </td>
        <td data-header="Prioritas">${badgePrio(r.prioritas)}</td>
        <td data-header="Status">${badgeStatus(r.status)}</td>

        <td data-header="Approval">
          ${badgeApproval(r.approval_status, r.approval_for || '')}
          ${
            (window.CURRENT_ROLE==='admin' && r.approval_status === 'pending')
              ? `<div class="approval-actions mt-1">
                  <button class="btn btn-success btn-sm" data-action="approve" data-id="${r.id}" title="Setujui"><i class="bi bi-check2"></i></button>
                  <button class="btn btn-outline-danger btn-sm" data-action="reject" data-id="${r.id}" title="Tolak"><i class="bi bi-x-lg"></i></button>
                </div>`
              : ''
          }
        </td>


        <td data-header="Teknisi">${r.teknisi ? esc(r.teknisi) : '<span class="text-muted">-</span>'}</td>
        <td data-header="Aksi" class="text-end">${actionsHtml(r)}</td>`;
      tbody.appendChild(tr);
    });

    // Attach handlers (delegasi bawah)
    totalInfo.textContent = `${rows.length} kendala`;

    if (window.matchMedia('(max-width: 576px)').matches) {
      const headers = ['Tanggal','Kategori','Aset / Identitas','Deskripsi','Prioritas','Status','Approval','Teknisi','Aksi'];
      tbody.querySelectorAll('tr').forEach(tr => tr.querySelectorAll('td').forEach((td,i)=>td.setAttribute('data-header', headers[i])));
    }
  }

  function actionsHtml(r){
    const viewBtn = `<button class="btn btn-sm btn-outline-secondary me-1" data-action="detail" data-id="${r.id}"><i class="bi bi-eye"></i></button>`;
    const editBtn = `<button class="btn btn-sm btn-outline-primary me-1" data-action="edit" data-id="${r.id}"><i class="bi bi-pencil-square"></i></button>`;
    const delBtn  = `<button class="btn btn-sm btn-outline-danger me-1" data-action="delete" data-id="${r.id}"><i class="bi bi-trash"></i></button>`;
    const takeBtn = `<button class="btn btn-sm btn-success me-1" data-action="take" data-id="${r.id}"><i class="bi bi-person-check"></i> Ambil</button>`;
    const startBtn= `<button class="btn btn-sm btn-warning me-1" data-action="start" data-id="${r.id}"><i class="bi bi-play"></i> Mulai</button>`;
    const doneBtn = `<button class="btn btn-sm btn-primary me-1" data-action="done" data-id="${r.id}"><i class="bi bi-flag"></i> Selesai</button>`;

    let left = viewBtn;
    if (window.CURRENT_ROLE==='admin'){
      left += editBtn + delBtn;
    } else {
      // teknisi/user
      const canTake = !r.teknisi && r.status!=='Selesai';
      const canStart = r.status==='Baru';
      const canDone  = r.status!=='Selesai';
      left += (canTake?takeBtn:'') + (canStart?startBtn:'') + (canDone?doneBtn:'') + editBtn + delBtn;
    }
    return left;
  }

  // ---------- Delegated events ----------
  tbody.addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const act = btn.getAttribute('data-action');
    const id  = btn.getAttribute('data-id');
    if (act==='detail') openDetail(id);
    if (act==='edit')   openEdit(id);
    if (act==='delete') removeItem(id);
    if (act==='take')   takeJob(id);
    if (act==='start')  setStatus(id, 'Diproses');
    if (act==='done')   setStatus(id, 'Selesai');
    if (act==='approve') doApprove(id, true);
    if (act==='reject')  doApprove(id, false);
  });

  function doApprove(id, isApprove){
    if (window.CURRENT_ROLE!=='admin'){ alert('Hanya admin.'); return; }
    if (isApprove) approveItem(id); else rejectItem(id);
  }

  // ---------- Actions ----------
  function openDetail(id){
    const it = data.find(x=>x.id===id); if (!it) return;
    const identRows = it.kategori==='AC'
      ? `<tr><td class="text-muted">Kode/Asset</td><td>${esc(it.identitas.acKode||'-')}</td></tr>
         <tr><td class="text-muted">Merk/Model</td><td>${esc(it.identitas.acMerk||'-')}</td></tr>`
      : `<tr><td class="text-muted">No. Polisi</td><td>${esc(it.identitas.noPol||'-')}</td></tr>
         <tr><td class="text-muted">Jenis</td><td>${esc(it.identitas.jenisKdr||'-')}</td></tr>`;
    $('#detailContent').innerHTML = `
      <div class="mb-3">
        <span class="badge me-1">${it.kategori}</span>
        ${badgePrio(it.prioritas)} ${badgeStatus(it.status)} ${badgeApproval(it.approval_status, it.approval_for||'')}
      </div>
      <table class="table table-sm">
        <tbody>
          <tr><td class="text-muted">ID</td><td>${it.id}</td></tr>
          <tr><td class="text-muted">Tanggal</td><td>${fmtDate(it.tanggal)}</td></tr>
          <tr><td class="text-muted">Lokasi</td><td>${esc(it.lokasi)}</td></tr>
          ${identRows}
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

  function removeItem(id){
    if (!confirm('Hapus kendala ini?')) return;
    data = DS.remove(id);
    showToast('Data terhapus.'); render();
  }

  function takeJob(id){
    const it = data.find(x=>x.id===id); if (!it) return;
    it.teknisi = it.teknisi || 'Teknisi';
    if (it.status==='Baru') it.status='Diproses';
    // perubahan oleh non-admin -> pending
    computeApprovalOnSave({ prev: it, next: it, role: (window.CURRENT_ROLE || 'user') });
    DS.save(data); showToast('Pekerjaan diambil.'); render();
  }

  function setStatus(id, newStatus){
    const it = data.find(x=>x.id===id); if (!it) return;
    const prev = clone(it);
    it.status = newStatus;
    computeApprovalOnSave({ prev, next: it, role: (window.CURRENT_ROLE || 'user') });
    DS.save(data); showToast(`Status diubah ke ${newStatus}.`); render();
  }

  // ---------- Form submit ----------
  $('#btnOpenTambah').addEventListener('click', ()=>{
    formMode.value='create'; editId.value=''; modalTitle.textContent='Tambah Kendala';
    form.reset(); tanggal.value=today(); toggleDyn();
  });

    form.addEventListener('submit', (e)=>{
    e.preventDefault();

    if (!ALLOWED_KAT.includes(kategori.value)) {
      alert('Kategori harus AC atau Kendaraan.'); return;
    }

    const idNew = formMode.value==='edit' ? editId.value : gid();
    const prev  = formMode.value==='edit' ? DS.get(idNew) : null;

    const next = {
      id: idNew,
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
      lampiran: lampiran.files?.[0]?.name || '',
      // default agar field ada
      approval_status: prev?.approval_status || 'pending',
      approval_for:    prev?.approval_for    || ''
    };

    // <- KUNCI: selalu tetapkan ulang approval berdasarkan perubahan
    computeApprovalOnSave({ prev, next });

    data = DS.upsert(next);
    kendalaModal.hide();
    showToast('Perubahan tersimpan.');
    render();
  });


  // ---------- Dinamis field ----------
  function applyKategoriRequirements(){
    [acKode, acMerk, noPol, jenisKdr].forEach(el => { if (el) el.required = false; });
    if (kategori.value === 'AC'){ acKode.required = true; acMerk.required = true; }
    if (kategori.value === 'Kendaraan'){ noPol.required = true; jenisKdr.required = true; }
  }
  function toggleDyn(){
    const k = kategori.value;
    $$('.dyn-ac').forEach(el=>el.classList.toggle('d-none', k!=='AC'));
    $$('.dyn-kdr').forEach(el=>el.classList.toggle('d-none', k!=='Kendaraan'));
    applyKategoriRequirements();
  }
  kategori.addEventListener('change', toggleDyn);
  kendalaModalEl.addEventListener('shown.bs.modal', toggleDyn);

  // ---------- Filter & sort ----------
  [searchInput, filterKategori, filterStatus, filterPrioritas, filterTanggal, sortBy]
    .forEach(el=>el.addEventListener('input', render));
  $('#btnResetFilter').addEventListener('click', ()=>{
    searchInput.value=''; filterKategori.value=''; filterStatus.value='';
    filterPrioritas.value=''; filterTanggal.value=''; sortBy.value='tanggal_desc';
    render();
  });

  // ---------- init ----------
  render();
});

/* ==== Optional: Sidebar loader (abaikan jika tidak dipakai) ==== */
document.addEventListener('DOMContentLoaded', async () => {
  const mount = document.getElementById('sidebarMount');
  if (!mount) return;
  const PARTIAL_PATH = 'partials/sidebar.html';
  try {
    const res = await fetch(PARTIAL_PATH);
    const html = await res.text();
    mount.outerHTML = html;
    const current = (location.pathname.split('/').pop() || 'datakendala.html').split('?')[0];
    document.querySelectorAll('.sidebar-nav a[href]').forEach(a => {
      const href = a.getAttribute('href'); if (!href) return;
      if (href.split('?')[0] === current) {
        a.classList.add('active');
        const sub = a.closest('#submenuAlat'); if (sub) sub.classList.add('show');
      }
    });
  } catch (err) { /* ignore */ }
});
