// MEZUNLAR PAGE LOGIC
let allAlumni = [];
let myRequests = [];

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

  if (ASDFL.supabase) {
    const [alumniData, requestsData] = await Promise.all([
      ASDFL.fetchAlumni(),
      ASDFL.supabase
        .from('contact_requests')
        .select('*')
        .or(`sender_id.eq.${ASDFL.currentUser.id},receiver_id.eq.${ASDFL.currentUser.id}`)
    ]);
    allAlumni = alumniData.filter(a => a.role !== 'Öğrenci');
    myRequests = requestsData.data || [];
    if (ASDFL.lastAlumniError) {
      ASDFL.toast('Mezun listesi veritabanından alınamadı. Lütfen sayfayı yenileyin.', 'error');
    }
  } else {
    allAlumni = (await ASDFL.fetchAlumni()).filter(a => a.role !== 'Öğrenci');
    myRequests = [];
  }

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
          <span>${alumnus.phone || 'Telefon belirtilmemiş'}</span>
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
          <button class="btn btn-secondary btn-sm" onclick="sendContactRequest('${alumnus.id}')" style="font-size:.75rem; padding:.25rem .75rem; width:100%; display:flex; align-items:center; justify-content:center; gap:.4rem;">
            <i data-lucide="lock" style="width:.9em;height:.9em"></i> İletişim Bilgilerini Talep Et
          </button>
        </div>
      `;
    }

    if (isMe || hasEmailShared || isApproved) {
      emailHTML = `
        <div style="font-size:.82rem; color:var(--text-secondary); margin-top:.4rem; display:flex; align-items:center; gap:.4rem;">
          <i data-lucide="mail" style="width:1em;height:1em;color:var(--gold-500)"></i>
          <span>${alumnus.email || 'E-posta belirtilmemiş'}</span>
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
    
    if(yf) {
      yf.innerHTML = '<option value="all">Tüm Yıllar</option>';
      years.forEach(y => { const o=document.createElement('option'); o.value=y; o.textContent=y+' Mezunu'; yf.appendChild(o); });
    }
    if(cf) {
      cf.innerHTML = '<option value="all">Tüm Şehirler</option>';
      cities.forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; cf.appendChild(o); });
    }
    if(uf) {
      uf.innerHTML = '<option value="all">Tüm Üniversiteler</option>';
      universities.forEach(u => { const o=document.createElement('option'); o.value=u; o.textContent=u; uf.appendChild(o); });
    }
    if(sf) {
      sf.innerHTML = '<option value="all">Tüm Uzmanlıklar</option>';
      specializations.forEach(s => { const o=document.createElement('option'); o.value=s; o.textContent=s; sf.appendChild(o); });
    }
  }

  window.filterAlumni = function() {
    const search = document.getElementById('searchInput')?.value.toLocaleLowerCase('tr') || '';
    const year = document.getElementById('yearFilter')?.value || 'all';
    const city = document.getElementById('cityFilter')?.value || 'all';
    const university = document.getElementById('universityFilter')?.value || 'all';
    const specialization = document.getElementById('specializationFilter')?.value || 'all';
    const mentorOnly = document.getElementById('mentorOnly')?.checked || false;
    
    let filtered = allAlumni.filter(a => {
      const matchSearch = !search || 
        (a.name && a.name.toLocaleLowerCase('tr').includes(search)) || 
        (a.job && a.job.toLocaleLowerCase('tr').includes(search)) ||
        (a.company && a.company.toLocaleLowerCase('tr').includes(search)) ||
        (a.university && a.university.toLocaleLowerCase('tr').includes(search)) ||
        (a.specialization && a.specialization.toLocaleLowerCase('tr').includes(search)) ||
        (a.academic_title && a.academic_title.toLocaleLowerCase('tr').includes(search));
        
      const matchYear = year === 'all' || a.grad_year == year;
      const matchCity = city === 'all' || a.city === city;
      const matchUniversity = university === 'all' || a.university === university;
      const matchSpecialization = specialization === 'all' || a.specialization === specialization;
      const matchMentor = !mentorOnly || (a.mentor && a.role !== 'Öğrenci');
      
      return matchSearch && matchYear && matchCity && matchUniversity && matchSpecialization && matchMentor;
    });
    renderAlumniGrid(filtered);
  };

  function renderAlumniGrid(list) {
    const grid = document.getElementById('alumniGrid');
    const count = document.getElementById('alumniCount');
    if(!grid) return;
    if(count) count.textContent = `${list.length} mezun listeleniyor`;
    if(list.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">
        <div style="font-size:3rem;margin-bottom:1rem"><i data-lucide="search" style="width:1em;height:1em"></i></div>
        <p>Arama kriterlerinize uygun mezun bulunamadı.</p>
      </div>`;
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
      
      return `
      <div class="card alumni-card-full lift reveal">
        <div class="ac-header">
          ${ASDFL.getAvatarHTML(a, 'avatar avatar-lg')}
          <div class="ac-info">
            <strong>${a.academic_title ? ASDFL.escapeHTML(a.academic_title) + ' ' : ''}${ASDFL.escapeHTML(a.name)}</strong>
            <span>${ASDFL.escapeHTML(a.grad_year || 'Bilinmiyor')} Mezunu</span>
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
        
        <div class="ac-tags">
          ${a.mentor ? '<span class="badge badge-teal"><i data-lucide="sparkles" style="width:1em;height:1em"></i> Mentör</span>' : ''}
          ${a.specialization ? `<span class="badge badge-gold"><i data-lucide="award" style="width:1.1em;height:1.1em;margin-right:2px"></i> ${ASDFL.escapeHTML(a.specialization)}</span>` : ''}
          ${a.grad_year ? `<span class="badge badge-blue">${ASDFL.escapeHTML(a.grad_year)}</span>` : ''}
        </div>
        <div class="ac-actions">
          <button class="btn btn-ghost btn-sm" onclick="window.location.href='profil.html?id=${encodeURIComponent(a.id)}'">Profili Gör</button>
          ${a.mentor ? `<button class="btn btn-secondary btn-sm" onclick="openMentorshipRequestModal(${safeId}, ${ASDFL.jsString(a.name)})">Bağlantı Kur</button>` : ''}
        </div>
      </div>`;
    }).join('');
    ASDFL.initReveal();
    setTimeout(() => ASDFL.refreshIcons(), 10);
  }

  function renderYillar() {
    const grid = document.getElementById('yillarGrid');
    if(!grid) return;
    const allYears = [];
    for(let y = 2025; y >= 1992; y--) allYears.push(y);
    grid.innerHTML = allYears.map(y => {
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

  // Browsers may restore checkbox/select state after refresh. Always open the
  // directory unfiltered; URL parameters below are the only intentional filter.
  const mentorOnlyInput = document.getElementById('mentorOnly');
  const searchInput = document.getElementById('searchInput');
  if (mentorOnlyInput) mentorOnlyInput.checked = false;
  if (searchInput) searchInput.value = '';

  populateFilters();

  // URL parametresi ile filtreleme desteği (?city=İstanbul vb.)
  const urlParams = new URLSearchParams(window.location.search);
  const cityParam = urlParams.get('city');
  if (cityParam) {
    const cityFilterEl = document.getElementById('cityFilter');
    if (cityFilterEl) {
      cityFilterEl.value = cityParam;
    }
  }

  filterAlumni();
  renderYillar();
  renderMentors();
});
