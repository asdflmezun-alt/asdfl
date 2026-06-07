// GALERI PAGE LOGIC
// GALERI PAGE LOGIC
let allGallery = [];
let activeFilter = 'all';
let activeYear = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  await loadGallery();
});

async function loadGallery() {
  allGallery = await ASDFL.fetchGallery();
  renderGaleri();
}

window.filterGaleri = function(cat, btn) {
  if(btn) {
    document.querySelectorAll('.galeri-tags .tag').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = cat;
  } else {
    activeYear = document.getElementById('yearGaleri')?.value || 'all';
  }
  renderGaleri();
};

function renderGaleri() {
  const yearVal = document.getElementById('yearGaleri')?.value || 'all';
  activeYear = yearVal;

  let filtered = allGallery.filter(g => {
    const matchCat = activeFilter === 'all' || g.category.toLowerCase() === activeFilter.toLowerCase();
    const matchYear = activeYear === 'all' || g.year == activeYear;
    return matchCat && matchYear;
  });

  const grid = document.getElementById('galeriGrid');
  if(!grid) return;

  if(filtered.length === 0) {
    grid.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-muted);grid-column:1/-1"><div style="font-size:3rem;margin-bottom:1rem"><i data-lucide="image" style="width:1em;height:1em"></i></div><p>Bu kategoride fotoğraf bulunamadı.</p></div>`;
    return;
  }

  grid.innerHTML = filtered.map(g => {
    const authorName = g.profiles?.name || 'Bilinmiyor';
    return `
    <div class="galeri-item reveal" onclick="openLightbox('${g.id}')">
      <div class="galeri-item-inner">
        <img src="${g.image_url}" alt="${g.title}" style="width:100%;height:220px;object-fit:cover;border-radius:var(--radius-lg)">
        <div class="galeri-overlay">
          <h4>${g.title}</h4>
          <span><i data-lucide="calendar" style="width:1em;height:1em"></i> ${g.year || ''} · <i data-lucide="user" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${authorName}</span>
        </div>
      </div>
    </div>`
  }).join('');

  ASDFL.initReveal();
  setTimeout(() => lucide.createIcons(), 10);
}

window.openLightbox = function(id) {
  const g = allGallery.find(x => x.id === id);
  if(!g) return;
  const lb = document.getElementById('lightbox');
  const authorName = g.profiles?.name || 'Bilinmiyor';
  
  document.getElementById('lightboxImg').innerHTML = `
    <img src="${g.image_url}" style="width:100%;max-height:60vh;object-fit:contain;border-radius:var(--radius-lg)">
  `;
  document.getElementById('lightboxInfo').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-top:1rem">
      <div>
        <strong style="color:var(--text-primary)">${g.title}</strong><br>
        <span style="font-size:.82rem"><i data-lucide="calendar" style="width:1em;height:1em"></i> ${g.year || ''} · <i data-lucide="user" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${authorName}</span>
        <p style="font-size:.85rem;color:var(--text-secondary);margin-top:.5rem">${g.description || ''}</p>
      </div>
    </div>`;
  lb.classList.add('open');
};

window.closeLightbox = function() {
  document.getElementById('lightbox').classList.remove('open');
};

window.previewFiles = function(input) {
  const preview = document.getElementById('filePreview');
  if(!input.files.length) return;
  preview.style.display = 'flex';
  preview.style.gap = '.5rem';
  preview.style.flexWrap = 'wrap';
  preview.innerHTML = '';
  Array.from(input.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,.1)';
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
};

window.handleGalleryUpload = async function() {
  if(!ASDFL.currentUser) {
    ASDFL.toast('Fotoğraf yüklemek için giriş yapmalısınız.', 'warning');
    return;
  }
  const fileInput = document.getElementById('fileInput');
  const title = document.getElementById('uploadTitle').value;
  const category = document.getElementById('uploadCategory').value;
  const year = document.getElementById('uploadYear').value;
  const desc = document.getElementById('uploadDesc').value;

  if(!fileInput.files.length) {
    ASDFL.toast('Lütfen bir fotoğraf seçin', 'warning');
    return;
  }
  
  const btn = document.getElementById('uploadBtn');
  btn.textContent = 'Yükleniyor...';
  btn.disabled = true;

  const file = fileInput.files[0];
  const publicUrl = await ASDFL.uploadImage(file, 'gallery');

  if(publicUrl) {
    const { error } = await ASDFL.supabase.from('gallery').insert({
      uploader_id: ASDFL.currentUser.id,
      image_url: publicUrl,
      title: title || 'İsimsiz Fotoğraf',
      category: category,
      year: year ? parseInt(year) : new Date().getFullYear(),
      description: desc
    });

    if(error) {
      ASDFL.toast('Veritabanına kaydedilirken hata oluştu.', 'error');
    } else {
      ASDFL.toast('Fotoğraf başarıyla paylaşıldı!', 'success');
      ASDFL.closeModal('uploadModal');
      await loadGallery(); 
      
      fileInput.value = '';
      document.getElementById('filePreview').innerHTML = '';
      document.getElementById('filePreview').style.display = 'none';
      document.getElementById('uploadTitle').value = '';
      document.getElementById('uploadDesc').value = '';
    }
  }
  btn.textContent = 'Paylaş';
  btn.disabled = false;
};
