// MEZUNLAR PAGE LOGIC
let allAlumni = [];
let myRequests = [];
let alumniCursor = null;
let hasMoreAlumni = false;
const ALUMNI_PAGE_SIZE = 100;

document.addEventListener('DOMContentLoaded', async () => {
  await ASDFL.waitForAuth();

  const isLoggedIn = !!ASDFL.currentUser;

  if (!isLoggedIn) {
    const loginPrompt = document.getElementById('loginPrompt');
    if (loginPrompt) loginPrompt.style.display = 'block';
    
    const tabsWrapper = document.getElementById('mezunTabsWrapper');
    if (tabsWrapper) tabsWrapper.style.display = 'none';
    
    const tabRehber = document.getElementById('tab-rehber');
    if (tabRehber) tabRehber.style.display = 'none';
    
    const tabYillar = document.getElementById('tab-yillar');
    if (tabYillar) tabYillar.style.display = 'none';
    
    const tabMentorlar = document.getElementById('tab-mentorlar');
    if (tabMentorlar) tabMentorlar.style.display = 'none';
    
    setTimeout(() => ASDFL.refreshIcons(), 10);
    return;
  }

  // Bir sayfalık ham veriyi state'e işler: cursor son kaydın created_at'i,
  // sayfa doluysa devamı vardır varsayılır.
  function ingestAlumniPage(page) {
    if (page.length) alumniCursor = page[page.length - 1].created_at;
    hasMoreAlumni = page.length >= ALUMNI_PAGE_SIZE;
    allAlumni = allAlumni.concat(page.filter(a => a.role !== 'Öğrenci'));
  }

  function renderSkeletons() {
    const grid = document.getElementById('alumniGrid');
    if (!grid) return;
    grid.innerHTML = Array.from({ length: 8 }, () => `
      <div class="card alumni-card-full">
        <div class="ac-header">
          <div class="skeleton skeleton-avatar"></div>
          <div style="flex:1">
            <div class="skeleton skeleton-line" style="width:60%"></div>
            <div class="skeleton skeleton-line" style="width:35%"></div>
          </div>
        </div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line" style="width:80%"></div>
        <div class="skeleton skeleton-line" style="width:55%"></div>
      </div>`).join('');
  }

  renderSkeletons();

  if (ASDFL.supabase) {
    const [alumniPage, requestsData] = await Promise.all([
      ASDFL.fetchAlumni({ limit: ALUMNI_PAGE_SIZE }),
      ASDFL.supabase
        .from('contact_requests')
        .select('*')
        .or(`sender_id.eq.${ASDFL.currentUser.id},receiver_id.eq.${ASDFL.currentUser.id}`)
    ]);
    ingestAlumniPage(alumniPage);
    myRequests = requestsData.data || [];
    if (ASDFL.lastAlumniError) {
      ASDFL.toast('Mezun listesi veritabanından alınamadı. Lütfen sayfayı yenileyin.', 'error');
    }
  } else {
    ingestAlumniPage(await ASDFL.fetchAlumni());
    hasMoreAlumni = false;
    myRequests = [];
  }

  window.loadMoreAlumni = async function() {
    const btn = document.getElementById('loadMoreBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Yükleniyor...'; }
    const page = await ASDFL.fetchAlumni({ limit: ALUMNI_PAGE_SIZE, before: alumniCursor });
    ingestAlumniPage(page);
    populateFilters();
    filterAlumni();
    renderYillar();
    renderMentors();
  };

  function getContactHTML(alumnus) {
    if (!ASDFL.currentUser) return '';
    
    const isMe = alumnus.id === ASDFL.currentUser.id;
    const hasPhoneShared = !!alumnus.share_phone;
    const hasEmailShared = !!alumnus.share_email;
    
    const approvedRequest = myRequests.find(r => 
      r.sender_id === ASDFL.currentUser.id && 
      r.receiver_id === alumnus.id && 
      r.status === 'Approved'
    );
    const isApproved = !!approvedRequest;

    const pendingRequest = myRequests.find(r => 
      r.sender_id === ASDFL.currentUser.id && 
      r.receiver_id === alumnus.id && 
      r.status === 'Pending'
    );
    const isPending = !!pendingRequest;

    let phoneHTML = '';
    let emailHTML = '';

    if (isMe || hasPhoneShared || isApproved) {
      phoneHTML = `
        <div style="font-size:.82rem; color:var(--text-secondary); margin-top:.4rem; display:flex; align-items:center; gap:.4rem;">
          <i data-lucide="phone" style="width:1em;height:1em;color:var(--gold-500)"></i>
          <span>${ASDFL.escapeHTML(alumnus.phone || 'Telefon belirtilmemiş')}</span>
        </div>
      `;
    } else if (isPending) {
      phoneHTML = `
        <div style="font-size:.82rem; color:var(--gold-500); margin-top:.4rem; display:flex; align-items:center; gap:.4rem; opacity:.85;">
          <i data-lucide="clock" style="width:1em;height:1em"></i>
          <span>Erişim Talebi Beklemede</span>
        </div>
      `;
    } else {
      phoneHTML = `
        <div style="margin-top:.5rem;">
          <button class="btn btn-ghost btn-sm" onclick="sendContactRequest('${alumnus.id}')" style="font-size:.72rem; padding:.2rem .7rem; display:inline-flex; align-items:center; gap:.35rem;">
            <i data-lucide="lock" style="width:.9em;height:.9em"></i> İletişim Talep Et
          </button>
        </div>
      `;
    }

    if (isMe || hasEmailShared || isApproved) {
      emailHTML = `
        <div style="font-size:.82rem; color:var(--text-secondary); margin-top:.4rem; display:flex; align-items:center; gap:.4rem;">
          <i data-lucide="mail" style="width:1em;height:1em;color:var(--gold-500)"></i>
          <span>${ASDFL.escapeHTML(alumnus.email || 'E-posta belirtilmemiş')}</span>
        </div>
      `;
    }

    return `
      <div style="border-top: 1px solid var(--glass-border); padding-top: .75rem; margin-top: .75rem; text-align: left;">
        ${emailHTML}
        ${phoneHTML}
      </div>
    `;
  }

  window.sendContactRequest = async function(receiverId) {
    if (!ASDFL.supabase || !ASDFL.currentUser) return;

    const { error } = await ASDFL.supabase
      .from('contact_requests')
      .insert({
        sender_id: ASDFL.currentUser.id,
        receiver_id: receiverId,
        status: 'Pending'
      });

    if (error) {
      ASDFL.toast('Talep gönderilirken hata oluştu: ' + error.message, 'error');
    } else {
      ASDFL.toast('İletişim erişim talebi başarıyla gönderildi!', 'success');
      const requestsData = await ASDFL.supabase
        .from('contact_requests')
        .select('*')
        .or(`sender_id.eq.${ASDFL.currentUser.id},receiver_id.eq.${ASDFL.currentUser.id}`);
      myRequests = requestsData.data || [];
      filterAlumni();
    }
  };

  window.openBioModal = function(alumniId) {
    const alumnus = allAlumni.find(a => a.id === alumniId);
    if (!alumnus) return;

    const modalAvatar = document.getElementById('bioModalAvatar');
    const modalTitle = document.getElementById('bioModalTitle');
    const modalSubtitle = document.getElementById('bioModalSubtitle');
    const modalContent = document.getElementById('bioModalContent');

    if (modalAvatar) {
      modalAvatar.innerHTML = ASDFL.getAvatarHTML(alumnus, 'avatar avatar-lg');
    }
    if (modalTitle) {
      modalTitle.textContent = (alumnus.academic_title ? alumnus.academic_title + ' ' : '') + (alumnus.name || '');
    }
    if (modalSubtitle) {
      const yearText = alumnus.grad_year ? alumnus.grad_year + ' Mezunu' : '';
      const sectionText = alumnus.class_section ? '- ' + alumnus.class_section + ' Şubesi' : '';
      modalSubtitle.textContent = `${yearText} ${sectionText}`.trim();
    }
    if (modalContent) {
      modalContent.textContent = alumnus.bio || '';
    }

    ASDFL.openModal('bioModal');
  };

  // Populate filters
  function populateFilters() {
    const years = [...new Set(allAlumni.map(a => a.grad_year).filter(Boolean))].sort((a,b) => b-a);
    const cities = [...new Set(allAlumni.map(a => a.city).filter(Boolean))].sort();
    const universities = [...new Set(allAlumni.map(a => a.university).filter(Boolean))].sort();
    const specializations = [...new Set(allAlumni.map(a => a.specialization).filter(Boolean))].sort();
    
    const yf = document.getElementById('yearFilter');
    const cf = document.getElementById('cityFilter');
    const uf = document.getElementById('universityFilter');
    const sf = document.getElementById('specializationFilter');

    // "Daha fazla yükle" sonrası yeniden doldurulurken mevcut seçim korunur
    function fill(select, defaultLabel, values, labelFn) {
      if (!select) return;
      const current = select.value;
      select.innerHTML = `<option value="all">${defaultLabel}</option>`;
      values.forEach(v => {
        const o = document.createElement('option');
        o.value = v; o.textContent = labelFn ? labelFn(v) : v;
        select.appendChild(o);
      });
      if (current && [...select.options].some(o => o.value === current)) select.value = current;
    }

    fill(yf, 'Tüm Yıllar', years, y => y + ' Mezunu');
    fill(cf, 'Tüm Şehirler', cities);
    fill(uf, 'Tüm Üniversiteler', universities);
    fill(sf, 'Tüm Uzmanlıklar', specializations);
  }

  let searchDebounceTimer = null;
  window.onSearchInput = function() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => filterAlumni(), 250);
  };

  function getFilterState() {
    return {
      q: document.getElementById('searchInput')?.value.trim() || '',
      year: document.getElementById('yearFilter')?.value || 'all',
      city: document.getElementById('cityFilter')?.value || 'all',
      university: document.getElementById('universityFilter')?.value || 'all',
      specialization: document.getElementById('specializationFilter')?.value || 'all',
      mentor: document.getElementById('mentorOnly')?.checked || false,
      sort: document.getElementById('sortFilter')?.value || 'newest'
    };
  }

  // Filtre durumu URL'de tutulur: aramalar paylaşılabilir ve geri tuşuyla korunur
  function syncFiltersToURL(f) {
    const params = new URLSearchParams();
    if (f.q) params.set('q', f.q);
    if (f.year !== 'all') params.set('year', f.year);
    if (f.city !== 'all') params.set('city', f.city);
    if (f.university !== 'all') params.set('uni', f.university);
    if (f.specialization !== 'all') params.set('spec', f.specialization);
    if (f.mentor) params.set('mentor', '1');
    if (f.sort !== 'newest') params.set('sort', f.sort);
    const qs = params.toString();
    history.replaceState(null, '', qs ? '?' + qs : window.location.pathname);
  }

  function renderActiveFilterChips(f) {
    const wrap = document.getElementById('activeFilters');
    if (!wrap) return;
    const chips = [];
    if (f.q) chips.push(['q', 'Arama: "' + f.q + '"']);
    if (f.year !== 'all') chips.push(['year', f.year + ' Mezunu']);
    if (f.city !== 'all') chips.push(['city', f.city]);
    if (f.university !== 'all') chips.push(['university', f.university]);
    if (f.specialization !== 'all') chips.push(['specialization', f.specialization]);
    if (f.mentor) chips.push(['mentor', 'Sadece Mentörler']);
    if (!chips.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = chips.map(([key, label]) =>
      `<button class="filter-chip" onclick="clearFilter('${key}')" aria-label="${ASDFL.escapeAttr(label)} filtresini kaldır">${ASDFL.escapeHTML(label)} <i data-lucide="x" style="width:.85em;height:.85em"></i></button>`
    ).join('') + `<button class="filter-chip filter-chip-clear" onclick="clearFilter('all')">Tümünü Temizle</button>`;
    setTimeout(() => ASDFL.refreshIcons(wrap), 10);
  }

  window.clearFilter = function(key) {
    const all = key === 'all';
    if (all || key === 'q') { const el = document.getElementById('searchInput'); if (el) el.value = ''; }
    if (all || key === 'year') { const el = document.getElementById('yearFilter'); if (el) el.value = 'all'; }
    if (all || key === 'city') { const el = document.getElementById('cityFilter'); if (el) el.value = 'all'; }
    if (all || key === 'university') { const el = document.getElementById('universityFilter'); if (el) el.value = 'all'; }
    if (all || key === 'specialization') { const el = document.getElementById('specializationFilter'); if (el) el.value = 'all'; }
    if (all || key === 'mentor') { const el = document.getElementById('mentorOnly'); if (el) el.checked = false; }
    filterAlumni();
  };

  window.filterAlumni = function() {
    const f = getFilterState();
    const search = f.q.toLocaleLowerCase('tr');

    let filtered = allAlumni.filter(a => {
      const matchSearch = !search ||
        (a.name && a.name.toLocaleLowerCase('tr').includes(search)) ||
        (a.job && a.job.toLocaleLowerCase('tr').includes(search)) ||
        (a.company && a.company.toLocaleLowerCase('tr').includes(search)) ||
        (a.university && a.university.toLocaleLowerCase('tr').includes(search)) ||
        (a.specialization && a.specialization.toLocaleLowerCase('tr').includes(search)) ||
        (a.academic_title && a.academic_title.toLocaleLowerCase('tr').includes(search));

      const matchYear = f.year === 'all' || a.grad_year == f.year;
      const matchCity = f.city === 'all' || a.city === f.city;
      const matchUniversity = f.university === 'all' || a.university === f.university;
      const matchSpecialization = f.specialization === 'all' || a.specialization === f.specialization;
      const matchMentor = !f.mentor || (a.mentor && a.role !== 'Öğrenci');

      return matchSearch && matchYear && matchCity && matchUniversity && matchSpecialization && matchMentor;
    });

    if (f.sort === 'name') filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));
    else if (f.sort === 'year-desc') filtered.sort((a, b) => (b.grad_year || 0) - (a.grad_year || 0));
    else if (f.sort === 'year-asc') filtered.sort((a, b) => (a.grad_year || 0) - (b.grad_year || 0));
    // 'newest': fetch sırası zaten created_at DESC

    syncFiltersToURL(f);
    renderActiveFilterChips(f);
    renderAlumniGrid(filtered);
  };

  function renderAlumniGrid(list) {
    const grid = document.getElementById('alumniGrid');
    const count = document.getElementById('alumniCount');
    if(!grid) return;
    if(count) count.textContent = `${list.length} mezun listeleniyor`;

    const loadMoreWrap = document.getElementById('loadMoreWrap');
    if (loadMoreWrap) {
      loadMoreWrap.innerHTML = hasMoreAlumni
        ? '<button class="btn btn-secondary" id="loadMoreBtn" onclick="loadMoreAlumni()">Daha Fazla Mezun Yükle</button>'
        : '';
    }

    if(list.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">
        <div style="font-size:3rem;margin-bottom:1rem"><i data-lucide="search" style="width:1em;height:1em"></i></div>
        <p>Arama kriterlerinize uygun mezun bulunamadı.</p>
        <button class="btn btn-secondary btn-sm" style="margin-top:1rem" onclick="clearFilter('all')">Filtreleri Temizle</button>
      </div>`;
      setTimeout(() => ASDFL.refreshIcons(), 10);
      return;
    }
    grid.innerHTML = list.map(a => {
      let jobCompanyText = '';
      if (a.job) {
        jobCompanyText = a.job + (a.company ? ` @ ${a.company}` : '');
      } else if (a.company) {
        jobCompanyText = a.company;
      }
      const safeId = ASDFL.jsString(a.id);
      const profileUrl = `profil.html?id=${encodeURIComponent(a.id)}`;

      return `
      <div class="card alumni-card-full lift reveal" onclick="if(!event.target.closest('button,a'))window.location.href='${profileUrl}'" role="link" tabindex="0" onkeydown="if(event.key==='Enter'&&!event.target.closest('button,a'))window.location.href='${profileUrl}'">
        <div class="ac-header">
          ${ASDFL.getAvatarHTML(a, 'avatar avatar-lg')}
          <div class="ac-info">
            <strong>${a.academic_title ? ASDFL.escapeHTML(a.academic_title) + ' ' : ''}${ASDFL.escapeHTML(a.name)}</strong>
            <span>${ASDFL.escapeHTML(a.grad_year || 'Bilinmiyor')} Mezunu${a.mentor ? ' <span class="badge badge-teal ac-mentor-badge"><i data-lucide="sparkles" style="width:.9em;height:.9em"></i> Mentör</span>' : ''}</span>
          </div>
        </div>
        ${jobCompanyText ? `<div class="ac-job"><i data-lucide="briefcase" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${ASDFL.escapeHTML(jobCompanyText)}</div>` : ''}
        ${a.specialization ? `<div class="ac-job"><i data-lucide="award" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px;color:var(--gold-500)"></i> Uzmanlık: ${ASDFL.escapeHTML(a.specialization)}</div>` : ''}
        ${a.university ? `<div class="ac-job"><i data-lucide="graduation-cap" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${ASDFL.escapeHTML(a.university)}</div>` : ''}
        ${a.city ? `<div class="ac-job"><i data-lucide="map-pin" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${ASDFL.escapeHTML(a.city)}</div>` : ''}
        ${a.bio ? (
          a.bio.length > 150 ? `
            <div style="font-size:.82rem;color:var(--text-muted);line-height:1.5">
              ${ASDFL.escapeHTML(a.bio.substring(0, 140))}...
              <a href="javascript:void(0)" onclick="openBioModal(${safeId})" style="color:var(--gold-500);font-weight:600;margin-left:.25rem;display:inline-block;">Devamını Oku</a>
            </div>
          ` : `<div style="font-size:.82rem;color:var(--text-muted);line-height:1.5">${ASDFL.escapeHTML(a.bio)}</div>`
        ) : ''}

        ${getContactHTML(a)}

        <div class="ac-actions">
          <button class="btn btn-ghost btn-sm" onclick="window.location.href='${profileUrl}'">Profili Gör</button>
          ${a.mentor ? `<button class="btn btn-secondary btn-sm" onclick="openMentorshipRequestModal(${safeId}, ${ASDFL.jsString(a.name)})">Bağlantı Kur</button>` : ''}
        </div>
      </div>`;
    }).join('');
    ASDFL.initReveal();
    setTimeout(() => ASDFL.refreshIcons(), 10);
  }

  function renderYillar() {
    const container = document.getElementById('yillarGrid');
    if(!container) return;

    // Yıllar onluk dönemlere gruplanır (2020'ler, 2010'lar...) — en yeni dönem üstte
    const decades = new Map();
    for(let y = new Date().getFullYear(); y >= 1992; y--) {
      const d = Math.floor(y / 10) * 10;
      if (!decades.has(d)) decades.set(d, []);
      decades.get(d).push(y);
    }

    container.innerHTML = [...decades.entries()].map(([decade, years]) => {
      const decadeCount = allAlumni.filter(a => a.grad_year >= decade && a.grad_year <= decade + 9).length;
      const yearCards = years.map(y => {
        const count = allAlumni.filter(a => a.grad_year == y).length;
        return `
        <div class="card yil-card reveal" onclick="openYilModal(${y})">
          <div>
            <div class="yil-number">${y}</div>
            <div class="yil-info">
              <strong>${y} Mezunları</strong>
              <span>${count > 0 ? count+' kayıtlı mezun' : 'Henüz kayıt yok'}</span>
            </div>
          </div>
          <div class="yil-arrow"><i data-lucide="chevron-right" style="width:1.2rem;height:1.2rem"></i></div>
        </div>`;
      }).join('');

      // Onluğun okunuşuna göre çoğul eki: on→lar, yirmi→ler, doksan→lar...
      const suffixMap = { 0: 'ler', 10: 'lar', 20: 'ler', 30: 'lar', 40: 'lar', 50: 'ler', 60: 'lar', 70: 'ler', 80: 'ler', 90: 'lar' };
      const suffix = suffixMap[decade % 100];
      return `
      <section class="decade-section">
        <div class="decade-header">
          <h3>${decade}'${suffix}</h3>
          <div class="decade-line"></div>
          <span>${decadeCount > 0 ? decadeCount + ' mezun' : 'Henüz kayıt yok'}</span>
        </div>
        <div class="yillar-grid">${yearCards}</div>
      </section>`;
    }).join('');

    ASDFL.initReveal();
    setTimeout(() => ASDFL.refreshIcons(), 10);
  }

  function renderMentors() {
    const grid = document.getElementById('mentorGrid');
    if(!grid) return;
    const mentors = allAlumni.filter(a => a.mentor && a.role !== 'Öğrenci');
    grid.innerHTML = mentors.map(a => {
      let jobCompanyText = '';
      if (a.job) {
        jobCompanyText = a.job + (a.company ? ` @ ${a.company}` : '');
      } else if (a.company) {
        jobCompanyText = a.company;
      }
      const safeId = ASDFL.jsString(a.id);
      
      return `
      <div class="card mentor-card lift reveal">
        <div class="mc-avatar">
          ${ASDFL.getAvatarHTML(a, 'avatar avatar-xl')}
          <div class="mc-badge"><i data-lucide="star" style="width:1em;height:1em"></i></div>
        </div>
        <h4>${ASDFL.escapeHTML(a.name)}</h4>
        <span class="mc-year">${ASDFL.escapeHTML(a.grad_year || 'Bilinmiyor')} Mezunu</span>
        ${jobCompanyText ? `<div class="mc-job"><i data-lucide="briefcase" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${ASDFL.escapeHTML(jobCompanyText)}</div>` : ''}
        ${a.university ? `<div class="mc-job" style="font-size:.8rem;color:var(--text-secondary);"><i data-lucide="graduation-cap" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${ASDFL.escapeHTML(a.university)}</div>` : ''}
        ${a.city ? `<div class="mc-city"><i data-lucide="map-pin" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${ASDFL.escapeHTML(a.city)}</div>` : ''}
        ${a.bio ? (
          a.bio.length > 150 ? `
            <div style="font-size:.78rem;color:var(--text-muted);margin-top:.75rem;line-height:1.5">
              ${ASDFL.escapeHTML(a.bio.substring(0, 140))}...
              <a href="javascript:void(0)" onclick="openBioModal(${safeId})" style="color:var(--gold-500);font-weight:600;margin-left:.25rem;display:inline-block;">Devamını Oku</a>
            </div>
          ` : `<div style="font-size:.78rem;color:var(--text-muted);margin-top:.75rem;line-height:1.5">${ASDFL.escapeHTML(a.bio)}</div>`
        ) : ''}
        <button class="btn btn-primary btn-sm" style="margin-top:1rem;width:100%" onclick="openMentorshipRequestModal(${safeId}, ${ASDFL.jsString(a.name)})">Bağlantı Kur</button>
      </div>`;
    }).join('');
    ASDFL.initReveal();
    setTimeout(() => ASDFL.refreshIcons(), 10);
  }

  window.switchTab = function(tab, btn) {
    document.querySelectorAll('.mezun-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-rehber').style.display = tab === 'rehber' ? '' : 'none';
    document.getElementById('tab-yillar').style.display = tab === 'yillar' ? '' : 'none';
    document.getElementById('tab-mentorlar').style.display = tab === 'mentorlar' ? '' : 'none';
  };

  window.openYilModal = function(year) {
    const grads = allAlumni.filter(a => a.grad_year == year);
    if(grads.length === 0) {
      ASDFL.toast(`${year} yılı için henüz mezun kaydı yok.`, 'info');
      return;
    }
    
    document.getElementById('classModalTitle').textContent = `${year} Mezunları`;
    
    const sections = {};
    grads.forEach(g => {
      const sec = g.class_section || 'Diğer';
      if(!sections[sec]) sections[sec] = [];
      sections[sec].push(g);
    });
    
    const sectionKeys = Object.keys(sections).sort((a,b) => {
      if(a === 'Diğer') return 1;
      if(b === 'Diğer') return -1;
      return a.localeCompare(b);
    });
    
    const tabsContainer = document.getElementById('classTabs');
    tabsContainer.innerHTML = sectionKeys.map((sec, idx) => `
      <button class="mezun-tab ${idx === 0 ? 'active' : ''}" onclick="switchClassTab('${sec}', this, ${year})">
        ${sec === 'Diğer' ? 'Şube Belirtmeyenler' : sec + ' Şubesi'} (${sections[sec].length})
      </button>
    `).join('');
    
    window.currentClassSections = sections;
    renderClassGrid(sectionKeys[0]);
    
    ASDFL.openModal('classModal');
  };

  window.switchClassTab = function(sec, btn, year) {
    document.querySelectorAll('#classTabs .mezun-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderClassGrid(sec);
  };

  function renderClassGrid(sec) {
    const grid = document.getElementById('classGrid');
    const students = window.currentClassSections[sec] || [];
    
    if(students.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-muted)">Kayıt bulunamadı.</div>';
      return;
    }
    
    grid.innerHTML = students.map(a => {
      let jobCompanyText = '';
      if (a.job) {
        jobCompanyText = a.job + (a.company ? ` @ ${a.company}` : '');
      } else if (a.company) {
        jobCompanyText = a.company;
      }
      
      return `
      <div class="card p-card" style="margin-bottom:1rem">
        <div class="p-header">
          ${ASDFL.getAvatarHTML(a, 'avatar')}
          <div class="p-info">
            <strong>${ASDFL.escapeHTML(a.name)}</strong>
            <span>${ASDFL.escapeHTML(a.grad_year)} Mezunu ${a.class_section ? '- ' + ASDFL.escapeHTML(a.class_section) + ' Şubesi' : ''}</span>
          </div>
        </div>
        <div class="p-body">
          ${jobCompanyText ? `<div class="p-detail"><i data-lucide="briefcase" style="width:1em;height:1em"></i> ${ASDFL.escapeHTML(jobCompanyText)}</div>` : ''}
          ${a.university ? `<div class="p-detail"><i data-lucide="graduation-cap" style="width:1em;height:1em"></i> ${ASDFL.escapeHTML(a.university)}</div>` : ''}
          ${a.city ? `<div class="p-detail"><i data-lucide="map-pin" style="width:1em;height:1em"></i> ${ASDFL.escapeHTML(a.city)}</div>` : ''}
          
          ${getContactHTML(a)}
        </div>
      </div>`;
    }).join('');
    
    setTimeout(() => ASDFL.refreshIcons(), 10);
  }

  window.openMentorshipRequestModal = function(mentorId, mentorName) {
    if (!ASDFL.currentUser) {
      ASDFL.toast('Mentörlük başvurusu yapmak için giriş yapmalısınız.', 'warning');
      ASDFL.openModal('loginModal');
      return;
    }
    document.getElementById('mReqMentorId').value = mentorId;
    document.getElementById('mReqMentorName').value = mentorName;
    document.getElementById('mReqNotes').value = '';
    ASDFL.openModal('mentorshipRequestModal');
  };

  window.submitSpecificMentorRequest = async function() {
    const mentorId = document.getElementById('mReqMentorId').value;
    const notes = document.getElementById('mReqNotes').value;

    if (!notes.trim()) {
      ASDFL.toast('Lütfen kendinizi açıklayan kısa bir not yazın.', 'warning');
      return;
    }

    const success = await ASDFL.createMentorshipRequest(mentorId, notes);
    if (success) {
      ASDFL.closeModal('mentorshipRequestModal');
    }
  };

  populateFilters();

  // URL parametrelerinden filtre durumunu geri yükle (?q=&year=&city=&uni=&spec=&mentor=&sort=)
  const urlParams = new URLSearchParams(window.location.search);
  const setVal = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
  setVal('searchInput', urlParams.get('q'));
  setVal('yearFilter', urlParams.get('year'));
  setVal('cityFilter', urlParams.get('city'));
  setVal('universityFilter', urlParams.get('uni'));
  setVal('specializationFilter', urlParams.get('spec'));
  setVal('sortFilter', urlParams.get('sort'));
  if (urlParams.get('mentor') === '1') {
    const el = document.getElementById('mentorOnly');
    if (el) el.checked = true;
  }

  filterAlumni();
  renderYillar();
  renderMentors();
});
