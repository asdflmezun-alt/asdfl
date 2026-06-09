// HOME PAGE LOGIC
document.addEventListener('DOMContentLoaded', async () => {
  const diagHome = document.getElementById('diag-home-js');
  if (diagHome) diagHome.innerHTML = '- home.js Yüklenme Durumu: <span style="color:#2ecc71">Yüklendi (Ok)</span>';
  await ASDFL.waitForAuth();

  // Fetch all required data in parallel (only fetch alumni and posts if logged in)
  const [events, alumni, posts, logoAnnouncements] = await Promise.all([
    ASDFL.fetchEvents(),
    ASDFL.currentUser ? ASDFL.fetchAlumni() : Promise.resolve([]),
    ASDFL.currentUser ? ASDFL.fetchPosts() : Promise.resolve([]),
    ASDFL.fetchLogoAnnouncements()
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
    el.innerHTML = mentors.map(a => {
      let jobCompanyText = '';
      if (a.job) {
        jobCompanyText = a.job + (a.company ? ` @ ${a.company}` : '');
      } else if (a.company) {
        jobCompanyText = a.company;
      }
      
      return `
      <div class="card alumni-card reveal lift">
        ${ASDFL.getAvatarHTML(a, 'avatar avatar-lg', 'margin:0 auto 1rem')}
        <h4>${a.name}</h4>
        <span class="year-badge">${a.grad_year || 'Bilinmiyor'} Mezunu</span>
        ${jobCompanyText ? `<p style="font-size:.82rem;margin-bottom:0.25rem;"><i data-lucide="briefcase" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${jobCompanyText}</p>` : ''}
        ${a.university ? `<p style="font-size:.78rem;color:var(--text-secondary);margin-top:.25rem;margin-bottom:0.25rem;"><i data-lucide="graduation-cap" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${a.university}</p>` : ''}
        <p style="font-size:.78rem;color:var(--text-muted);margin-top:.25rem;"><i data-lucide="map-pin" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${a.city || 'Şehir Belirtilmemiş'}</p>
        <span class="badge badge-teal mentor-tag"><i data-lucide="sparkles" style="width:1em;height:1em"></i> Mentör</span>
      </div>`;
    }).join('');
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
          ${ASDFL.getAvatarHTML({ initials: p.initials, avatar_url: p.profiles?.avatar_url, avatar_position: p.profiles?.avatar_position, name: p.author }, 'post-avatar')}
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

  function renderLogoAnnouncements(announcements) {
    if (!announcements) return;
    announcements.forEach(announce => {
      const cardId = announce.id;
      const titleEl = document.getElementById(`logoAnnounceTitle${cardId}`);
      const subEl = document.getElementById(`logoAnnounceSub${cardId}`);
      const iconEl = document.getElementById(`logoAnnounceIcon${cardId}`);
      if (titleEl) titleEl.textContent = announce.title;
      if (subEl) subEl.textContent = announce.subtitle;
      if (iconEl && announce.icon) {
        iconEl.innerHTML = `<i data-lucide="${announce.icon}" style="width:1.2rem;height:1.2rem"></i>`;
      }
    });
    setTimeout(() => lucide.createIcons(), 10);
  }

  // Render Alumni Map
  function renderAlumniMap(allAlumni) {
    const authEl = document.getElementById('diag-auth');
    if (authEl) {
      authEl.innerHTML = `- Kullanıcı Oturum Durumu: <span style="color:#2ecc71">${ASDFL.currentUser ? 'Giriş Yapıldı (' + ASDFL.currentUser.name + ')' : 'Giriş Yapılmadı'}</span>`;
    }

    const wrapper = document.getElementById('alumniMapWrapper');
    if (!wrapper) return;

    if (!ASDFL.currentUser) {
      wrapper.innerHTML = `
        <div style="text-align: center; padding: 3.5rem 2rem; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); backdrop-filter: blur(12px); max-width: 600px; margin: 2rem auto 0;">
          <i data-lucide="lock" style="width:2.5rem;height:2.5rem;color:var(--gold-500);margin-bottom:1rem;display:inline-block"></i>
          <h3 style="margin-bottom:.5rem;font-family:'Outfit',sans-serif;">Mezun Coğrafi Dağılım Haritası</h3>
          <p style="color:var(--text-muted);font-size:.9rem;margin-bottom:1.5rem;line-height:1.6">Mezunlarımızın dünya ve şehirler üzerindeki dağılımını interaktif harita ve detaylı şehir listesi üzerinden görebilmek için giriş yapmanız gerekmektedir.</p>
          <button class="btn btn-primary" onclick="ASDFL.openModal('loginModal')">Giriş Yap / Üye Ol</button>
        </div>
      `;
      setTimeout(() => lucide.createIcons(), 10);
      return;
    }

    // Coordinates database for Turkey provinces (all 81 cities)
    const TURKEY_CITIES_COORDS = {
      "Adana": [36.9914, 35.3308], "Adıyaman": [37.7648, 38.2786], "Afyonkarahisar": [38.7507, 30.5567],
      "Ağrı": [39.7191, 43.0503], "Amasya": [40.6499, 35.8353], "Ankara": [39.9334, 32.8597],
      "Antalya": [36.8841, 30.7056], "Artvin": [41.1828, 41.8183], "Aydın": [37.8560, 27.8416],
      "Balıkesir": [39.6484, 27.8826], "Bilecik": [40.1419, 29.9793], "Bingöl": [38.8847, 40.4939],
      "Bitlis": [38.3938, 42.1078], "Bolu": [40.7350, 31.6078], "Burdur": [37.7203, 30.2908],
      "Bursa": [40.1826, 29.0660], "Çanakkale": [40.1553, 26.4142], "Çankırı": [40.6013, 33.6134],
      "Çorum": [40.5506, 34.9556], "Denizli": [37.7765, 29.0864], "Diyarbakır": [37.9144, 40.2306],
      "Edirne": [41.6818, 26.5623], "Elazığ": [38.6810, 39.2230], "Erzincan": [39.7500, 39.5000],
      "Erzurum": [39.9000, 41.2700], "Eskişehir": [39.7767, 30.5206], "Gaziantep": [37.0662, 37.3833],
      "Giresun": [40.9128, 38.3895], "Gümüşhane": [40.4600, 39.4814], "Hakkari": [37.5833, 43.7333],
      "Hatay": [36.2000, 36.1500], "Isparta": [37.7648, 30.5566], "Mersin": [36.8121, 34.6415],
      "İstanbul": [41.0082, 28.9784], "İzmir": [38.4237, 27.1428], "Kars": [40.6013, 43.0975],
      "Kastamonu": [41.3787, 33.7744], "Kayseri": [38.7205, 35.4826], "Kırklareli": [41.7333, 27.2167],
      "Kırşehir": [39.1425, 34.1709], "Kocaeli": [40.7654, 29.9408], "Konya": [37.8714, 32.4847],
      "Kütahya": [39.4242, 29.9833], "Malatya": [38.3552, 38.3095], "Manisa": [38.6191, 27.4289],
      "Kahramanmaraş": [37.5858, 36.9371], "Mardin": [37.3212, 40.7245], "Muğla": [37.2153, 28.3636],
      "Muş": [38.7432, 41.5064], "Nevşehir": [38.6244, 34.7144], "Niğde": [37.9667, 34.6833],
      "Ordu": [40.9862, 37.8797], "Rize": [41.0201, 40.5234], "Sakarya": [40.7569, 30.3783],
      "Samsun": [41.2867, 36.33], "Siirt": [37.9333, 41.95], "Sinop": [42.0264, 35.1511],
      "Sivas": [39.75, 37.0167], "Tekirdağ": [40.978, 27.511], "Tokat": [40.3167, 36.55],
      "Trabzon": [41.005, 39.7267], "Tunceli": [39.1083, 39.5472], "Şanlıurfa": [37.15, 38.8],
      "Uşak": [38.6822, 29.4081], "Van": [38.5, 43.375], "Yozgat": [39.82, 34.808],
      "Zonguldak": [41.4506, 31.7908], "Aksaray": [38.3687, 34.037], "Bayburt": [40.2567, 40.265],
      "Karaman": [37.1759, 33.2287], "Kırıkkale": [39.8453, 33.5153], "Batman": [37.8812, 41.1351],
      "Şırnak": [37.5164, 42.4594], "Bartın": [41.6376, 32.3338], "Ardahan": [41.1105, 42.7022],
      "Iğdır": [39.92, 44.045], "Yalova": [40.6549, 29.2842], "Karabük": [41.1992, 32.6264],
      "Kilis": [36.7164, 37.115], "Osmaniye": [37.0742, 36.2467], "Düzce": [40.8438, 31.1625]
    };

    // Render map container HTML
    wrapper.innerHTML = `
      <div class="alumni-map-container reveal visible">
        <div class="alumni-map-sidebar">
          <h4><i data-lucide="map-pin" style="color:var(--gold-500); width:1.2rem; height:1.2rem; flex-shrink:0;"></i> Mezun Dağılımı</h4>
          <div class="sidebar-list" id="mapCityList"></div>
          <div class="sidebar-footer" style="margin-top:1rem; border-top:1px solid var(--glass-border); padding-top:.5rem;">
            <small style="color:var(--text-muted); font-size:.7rem; display:block;">* Sadece konumunu belirten mezunlar haritada gösterilir.</small>
          </div>
        </div>
        <div class="alumni-map-canvas-container">
          <div id="alumniMap" style="height: 100%; width: 100%;"></div>
        </div>
      </div>
    `;

    // Group alumni by city
    const cityCounts = {};
    let totalWithCity = 0;

    allAlumni.forEach(alumnus => {
      let rawCity = alumnus.city;
      if (!rawCity) return;
      
      rawCity = rawCity.trim();
      // Normalize Afyon to Afyonkarahisar
      if (rawCity.toLowerCase() === 'afyon') {
        rawCity = 'Afyonkarahisar';
      }

      // Ensure first letter uppercase (capitalization)
      if (rawCity) {
        rawCity = rawCity.charAt(0).toLocaleUpperCase('tr-TR') + rawCity.slice(1);
        cityCounts[rawCity] = (cityCounts[rawCity] || 0) + 1;
        totalWithCity++;
      }
    });

    // Sort cities by count descending
    const sortedCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);

    // Render city list inside sidebar
    const listEl = document.getElementById('mapCityList');
    if (listEl) {
      if (sortedCities.length === 0) {
        listEl.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:1rem 0;">Kayıtlı mezun konumu bulunamadı.</div>';
      } else {
        listEl.innerHTML = sortedCities.map(([city, count]) => {
          const percentage = totalWithCity > 0 ? Math.round((count / totalWithCity) * 100) : 0;
          return `
            <div class="city-progress-item">
              <div class="city-progress-info">
                <span style="color:var(--text-primary)">${city}</span>
                <span style="color:var(--gold-400)">${count} Mezun</span>
              </div>
              <div class="city-progress-bar-bg">
                <div class="city-progress-bar-fill" style="width: ${percentage}%"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Initialize Leaflet Map
    setTimeout(() => {
      if (typeof L === 'undefined') {
        const mapEl = document.getElementById('alumniMap');
        if (mapEl) {
          mapEl.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:2rem; text-align:center; color:var(--text-muted);">
              <i data-lucide="wifi-off" style="width:2.5rem; height:2.5rem; color:var(--gold-500); margin-bottom:1rem;"></i>
              <h4 style="margin-bottom:0.5rem; color:var(--text-primary); font-family:'Outfit',sans-serif;">Harita Yüklenemedi</h4>
              <p style="font-size:0.85rem; max-width:300px; line-height:1.5;">Harita servis sağlayıcısına ulaşılamadı. Lütfen internet bağlantınızı kontrol edip sayfayı yenileyin.</p>
            </div>
          `;
          setTimeout(() => lucide.createIcons(), 5);
        }
        return;
      }

      // Create map, centering Turkey
      const map = L.map('alumniMap', {
        center: [39.00, 35.10],
        zoom: 6,
        zoomControl: true,
        attributionControl: false
      });

      // Add CartoDB Dark Matter tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        minZoom: 4
      }).addTo(map);

      // Add animated pulsing gold marker for each city
      sortedCities.forEach(([city, count]) => {
        const coords = TURKEY_CITIES_COORDS[city];
        if (!coords) return; // If city coordinates not found, skip

        const customIcon = L.divIcon({
          className: 'map-marker-pulse-wrapper',
          html: `<div class="map-marker-pulse" title="${city}"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        const popupHTML = `
          <div style="min-width: 150px;">
            <h5>${city}</h5>
            <p style="margin-bottom:.5rem;"><b>${count}</b> mezunumuz burada yaşıyor.</p>
            <a href="mezunlar.html?city=${encodeURIComponent(city)}">
              <i data-lucide="search" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i>
              Rehberde Filtrele
            </a>
          </div>
        `;

        const marker = L.marker(coords, { icon: customIcon }).addTo(map);
        marker.bindPopup(popupHTML);

        // Re-init lucide icons inside popup when it opens
        marker.on('popupopen', () => {
          setTimeout(() => lucide.createIcons(), 5);
        });
      });

      // Adjust map layout
      map.invalidateSize();
    }, 100);

    setTimeout(() => lucide.createIcons(), 10);
  }

  renderHomeEvents(events);
  renderFeaturedAlumni(alumni);
  renderHomeFeed(posts);
  renderLogoAnnouncements(logoAnnouncements);
  renderAlumniMap(alumni);
  createParticles();
});
