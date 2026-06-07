// BURS & MENTORLUK PAGE LOGIC
document.addEventListener('DOMContentLoaded', async () => {
  await ASDFL.waitForAuth();

  const [scholarships, alumni] = await Promise.all([
    ASDFL.fetchScholarships(),
    ASDFL.currentUser ? ASDFL.fetchAlumni() : Promise.resolve([])
  ]);

  function renderBursList(list) {
    const el = document.getElementById('bursList');
    if(!el) return;
    if(list.length === 0) {
      el.innerHTML = '<p style="color:var(--text-muted);padding:2rem;text-align:center">Şu an aktif bir burs programı bulunmamaktadır.</p>';
      return;
    }
    el.innerHTML = list.map(b => `
      <div class="card burs-card reveal lift">
        <div>
          <span class="badge badge-gold">${b.sponsor}</span>
          ${b.active ? '<span class="badge badge-teal" style="margin-left:.5rem">Açık</span>' : ''}
        </div>
        <div class="burs-amount">${b.amount}</div>
        <h3>${b.title}</h3>
        <p style="font-size:.88rem;color:var(--text-secondary);line-height:1.6">${b.description}</p>
        <div class="burs-deadline">⏰ Son başvuru: ${ASDFL.formatDate(b.deadline)}</div>
        <button class="btn btn-primary btn-sm" style="align-self:flex-start;margin-top:.5rem"
          onclick="ASDFL.openModal('basvuruModal')">Başvur <i data-lucide="arrow-right" style="width:1em;height:1em"></i></button>
      </div>`).join('');
    ASDFL.initReveal();
    setTimeout(() => lucide.createIcons(), 10);
  }

  function renderBursMentors(allAlumni) {
    const el = document.getElementById('bursMentorGrid');
    if(!el) return;

    if (!ASDFL.currentUser) {
      el.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); backdrop-filter: blur(12px);">
          <i data-lucide="lock" style="width:2rem;height:2rem;color:var(--gold-500);margin-bottom:.75rem;display:inline-block"></i>
          <h4 style="margin-bottom:.5rem">Öne Çıkan Mentörleri Görün</h4>
          <p style="color:var(--text-muted);font-size:.85rem;margin-bottom:1.25rem">Aktif mentörlerimizi görmek ve bağlantı kurabilmek için üye olmanız gerekmektedir.</p>
          <button class="btn btn-primary btn-sm" onclick="ASDFL.openModal('loginModal')">Giriş Yap / Üye Ol</button>
        </div>
      `;
      setTimeout(() => lucide.createIcons(), 10);
      return;
    }

    const mentors = allAlumni.filter(a => a.mentor).slice(0, 4);
    el.innerHTML = mentors.map(a => {
      let jobCompanyText = '';
      if (a.job) {
        jobCompanyText = a.job + (a.company ? ` @ ${a.company}` : '');
      } else if (a.company) {
        jobCompanyText = a.company;
      }
      
      return `
      <div class="card lift reveal" style="text-align:center;padding:1.5rem 1rem">
        ${ASDFL.getAvatarHTML(a, 'avatar avatar-xl', 'margin:0 auto 1rem')}
        <h4 style="font-size:.95rem">${a.name}</h4>
        <span style="font-size:.75rem;color:var(--gold-500);font-weight:600;display:block;margin-bottom:.5rem">${a.grad_year || 'Bilinmiyor'} Mezunu</span>
        ${jobCompanyText ? `<div style="font-size:.82rem;color:var(--text-secondary);margin-bottom:0.25rem;"><i data-lucide="briefcase" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${jobCompanyText}</div>` : ''}
        ${a.university ? `<div style="font-size:.78rem;color:var(--text-secondary);margin-top:.25rem;margin-bottom:0.25rem;"><i data-lucide="graduation-cap" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${a.university}</div>` : ''}
        ${a.city ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:.25rem;"><i data-lucide="map-pin" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${a.city}</div>` : ''}
        ${a.bio ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:.75rem;line-height:1.5">${a.bio}</div>` : ''}
        <button class="btn btn-primary btn-sm" style="margin-top:1rem;width:100%"
          onclick="openMentorshipRequestModal('${a.id}', '${a.name}')">Bağlantı Kur</button>
      </div>`;
    }).join('');
    ASDFL.initReveal();
    setTimeout(() => lucide.createIcons(), 10);
  }

  window.selectBagis = function(btn, val) {
    document.querySelectorAll('.bagis-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const customEl = document.getElementById('customAmount');
    if(customEl) customEl.style.display = val === 'custom' ? '' : 'none';
  };

  window.scrollToSection = function(id) {
    document.getElementById(id)?.scrollIntoView({ behavior:'smooth', block:'start' });
  };

  window.submitBursApplication = async function() {
    if(!ASDFL.currentUser) { ASDFL.toast('Başvuru yapmak için giriş yapmalısınız.', 'warning'); return; }
    const name = document.getElementById('basvuruName')?.value;
    const grade = document.getElementById('basvuruGrade')?.value;
    const gpa = document.getElementById('basvuruGPA')?.value;
    const type = document.getElementById('basvuruType')?.value;
    const bio = document.getElementById('basvuruBio')?.value;
    const email = document.getElementById('basvuruEmail')?.value;

    if(!name || !email) {
      ASDFL.toast('Lütfen zorunlu alanları (Ad Soyad, E-posta) doldurun.', 'warning');
      return;
    }

    const details = { name, grade, gpa, bio, email };
    const success = await ASDFL.createApplication('Burs', type, details);
    if (success) {
      ASDFL.closeModal('basvuruModal');
      // Clear fields
      document.getElementById('basvuruName').value = '';
      document.getElementById('basvuruBio').value = '';
      document.getElementById('basvuruEmail').value = '';
    }
  };

  window.submitMentorRequest = async function() {
    if(!ASDFL.currentUser) { ASDFL.toast('Talep göndermek için giriş yapmalısınız.', 'warning'); return; }
    const name = document.getElementById('mBulName')?.value;
    const grade = document.getElementById('mBulGrade')?.value;
    const field = document.getElementById('mBulField')?.value;
    const description = document.getElementById('mBulDesc')?.value;

    if(!name || !field) {
      ASDFL.toast('Lütfen zorunlu alanları doldurun.', 'warning');
      return;
    }

    const details = { name, grade, description };
    const success = await ASDFL.createApplication('MentorlukTalebi', field, details);
    if (success) {
      ASDFL.closeModal('mentorBulModal');
      // Clear fields
      document.getElementById('mBulName').value = '';
      document.getElementById('mBulField').value = '';
      document.getElementById('mBulDesc').value = '';
    }
  };

  window.submitMentorRegister = async function() {
    if(!ASDFL.currentUser) { ASDFL.toast('Başvuru yapmak için giriş yapmalısınız.', 'warning'); return; }
    const name = document.getElementById('mOlName')?.value;
    const gradYear = document.getElementById('mOlGradYear')?.value;
    const job = document.getElementById('mOlJob')?.value;
    const specialty = document.getElementById('mOlSpecialty')?.value;
    const hours = document.getElementById('mOlHours')?.value;

    if(!name || !specialty) {
      ASDFL.toast('Lütfen zorunlu alanları doldurun.', 'warning');
      return;
    }

    const details = { name, gradYear, job, hours };
    const success = await ASDFL.createApplication('MentorlukKaydi', specialty, details);
    if (success) {
      ASDFL.closeModal('mentorOlModal');
      // Clear fields
      document.getElementById('mOlName').value = '';
      document.getElementById('mOlGradYear').value = '';
      document.getElementById('mOlJob').value = '';
      document.getElementById('mOlSpecialty').value = '';
    }
  };


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

  // Show portal link box if logged in
  if (ASDFL.currentUser) {
    const portalBox = document.getElementById('mentorshipPortalLinkBox');
    if (portalBox) portalBox.style.display = 'block';
  }


  renderBursList(scholarships);
  renderBursMentors(alumni);
});
