// HOME PAGE LOGIC
document.addEventListener('DOMContentLoaded', async () => {
  await ASDFL.waitForAuth();

  // Fetch all required data in parallel (only fetch alumni and posts if logged in)
  const [events, alumni, posts] = await Promise.all([
    ASDFL.fetchEvents(),
    ASDFL.currentUser ? ASDFL.fetchAlumni() : Promise.resolve([]),
    ASDFL.currentUser ? ASDFL.fetchPosts() : Promise.resolve([])
  ]);

  // Render upcoming events
  function renderHomeEvents(allEvents) {
    const el = document.getElementById('homeEventsList');
    if (!el) return;
    const upcoming = allEvents.filter(e => e.upcoming).slice(0, 3);
    el.innerHTML = upcoming.map(ev => {
      const d = new Date(ev.date);
      const day = d.getDate();
      const mon = d.toLocaleDateString('tr-TR', { month: 'short' });
      const typeColors = { bulusma:'badge-teal', gala:'badge-gold', kariyer:'badge-blue', spor:'badge-teal', meziyet:'badge-gold', panel:'badge-blue' };
      return `
        <a href="etkinlikler.html" class="event-item reveal">
          <div class="event-date-box">
            <span class="day">${day}</span>
            <span class="mon">${mon}</span>
          </div>
          <div class="event-info">
            <h4>${ev.title}</h4>
            <div class="event-meta">
              <span class="badge ${typeColors[ev.type]||'badge-blue'}">${ev.type}</span>
              <span style="font-size:.8rem;color:var(--text-muted)"><i data-lucide="map-pin" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${ev.location}</span>
              <span style="font-size:.8rem;color:var(--text-muted)"><i data-lucide="clock" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${ev.time}</span>
            </div>
          </div>
          <span style="color:var(--text-muted);font-size:1.2rem"><i data-lucide="chevron-right" style="width:1.2rem;height:1.2rem"></i></span>
        </a>`;
    }).join('');
    ASDFL.initReveal();
    setTimeout(() => lucide.createIcons(), 10);
  }

  // Render featured alumni (mentor olanlar)
  function renderFeaturedAlumni(allAlumni) {
    const el = document.getElementById('featuredAlumni');
    if (!el) return;
    
    if (!ASDFL.currentUser) {
      el.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); backdrop-filter: blur(12px);">
          <i data-lucide="lock" style="width:2rem;height:2rem;color:var(--gold-500);margin-bottom:.75rem;display:inline-block"></i>
          <h4 style="margin-bottom:.5rem">Öne Çıkan Mezunlarımızı Görün</h4>
          <p style="color:var(--text-muted);font-size:.85rem;margin-bottom:1.25rem">Mezunlarımızın başarılarını ve detaylarını görebilmek için üye olmanız gerekmektedir.</p>
          <button class="btn btn-primary btn-sm" onclick="ASDFL.openModal('loginModal')">Giriş Yap / Üye Ol</button>
        </div>
      `;
      setTimeout(() => lucide.createIcons(), 10);
      return;
    }
    
    const mentors = allAlumni.filter(a => a.mentor).slice(0, 4);
    el.innerHTML = mentors.map(a => `
      <div class="card alumni-card reveal lift">
        <div class="avatar avatar-lg" style="margin:0 auto 1rem">${a.initials}</div>
        <h4>${a.name}</h4>
        <span class="year-badge">${a.grad_year || 'Bilinmiyor'} Mezunu</span>
        <p style="font-size:.82rem">${a.job || 'Meslek Belirtilmemiş'}${a.company ? ' · ' + a.company : ''}</p>
        <p style="font-size:.78rem;color:var(--text-muted);margin-top:.25rem"><i data-lucide="map-pin" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${a.city || 'Şehir Belirtilmemiş'}</p>
        <span class="badge badge-teal mentor-tag"><i data-lucide="sparkles" style="width:1em;height:1em"></i> Mentör</span>
      </div>`).join('');
    ASDFL.initReveal();
    setTimeout(() => lucide.createIcons(), 10);
  }

  // Render social feed preview
  function renderHomeFeed(allPosts) {
    const el = document.getElementById('homeFeed');
    if (!el) return;
    
    if (!ASDFL.currentUser) {
      el.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); backdrop-filter: blur(12px);">
          <i data-lucide="lock" style="width:2rem;height:2rem;color:var(--gold-500);margin-bottom:.75rem;display:inline-block"></i>
          <h4 style="margin-bottom:.5rem">Topluluk Paylaşımlarını Görün</h4>
          <p style="color:var(--text-muted);font-size:.85rem;margin-bottom:1.25rem">Paylaşımları görmek ve etkileşime geçmek için üye olmanız gerekmektedir.</p>
          <button class="btn btn-primary btn-sm" onclick="ASDFL.openModal('loginModal')">Giriş Yap / Üye Ol</button>
        </div>
      `;
      setTimeout(() => lucide.createIcons(), 10);
      return;
    }
    
    const feed = allPosts.slice(0, 4);
    el.innerHTML = feed.map(p => {
      const d = new Date(p.created_at);
      const timeStr = d.toLocaleDateString('tr-TR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
      return `
      <div class="card feed-card reveal">
        <div class="feed-header">
          <div class="avatar">${p.initials}</div>
          <div class="info">
            <strong>${p.author}</strong>
            <span>${p.authorYear || 'Bilinmiyor'} Mezunu · ${timeStr}</span>
          </div>
        </div>
        <div class="feed-body">${p.content}</div>
        <div class="feed-footer">
          <button class="feed-action" onclick="ASDFL.toast('Beğenildi!','success')"><i data-lucide="heart" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${p.likes || 0}</button>
          <button class="feed-action"><i data-lucide="message-circle" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> 0</button>
        </div>
      </div>`;
    }).join('');
    ASDFL.initReveal();
    setTimeout(() => lucide.createIcons(), 10);
  }

  window.handleCreatePost = async function() {
    const input = document.getElementById('postContent');
    const btn = document.getElementById('postBtn');
    if(!input.value.trim()) return;

    btn.textContent = 'Gönderiliyor...';
    btn.disabled = true;

    const success = await ASDFL.createPost(input.value.trim());
    if(success) {
      input.value = '';
      const newPosts = await ASDFL.fetchPosts();
      renderHomeFeed(newPosts);
    }
    
    btn.innerHTML = 'Paylaş <i data-lucide="send" style="width:1em;height:1em"></i>';
    btn.disabled = false;
    setTimeout(() => lucide.createIcons(), 10);
  };

  // Particle effect in hero
  function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.cssText = `
        left:${Math.random()*100}%;
        top:${Math.random()*100}%;
        animation-delay:${Math.random()*6}s;
        animation-duration:${4+Math.random()*4}s;
        opacity:${.1+Math.random()*.25};
        width:${2+Math.random()*4}px;
        height:${2+Math.random()*4}px;
      `;
      container.appendChild(p);
    }
  }

  // Login handler
  window.handleLogin = function() {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    if (!email || !pass) { ASDFL.toast('Lütfen tüm alanları doldurun.', 'warning'); return; }
    ASDFL.toast('Demo modunda giriş yapıldı! <i data-lucide="party-popper" style="width:1em;height:1em"></i>', 'success');
    ASDFL.closeModal('loginModal');
  };

  renderHomeEvents(events);
  renderFeaturedAlumni(alumni);
  renderHomeFeed(posts);
  createParticles();
});
