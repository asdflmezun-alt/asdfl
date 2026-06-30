// ETKINLIKLER PAGE LOGIC
let allEvents = [];

document.addEventListener('DOMContentLoaded', async () => {
  allEvents = await ASDFL.fetchEvents();

  let currentFilter = 'all';

  function renderEvents(filter) {
    currentFilter = filter;
    let upcoming = allEvents.filter(e => e.upcoming);
    let past = allEvents.filter(e => !e.upcoming);

    if(filter !== 'all' && filter !== 'upcoming' && filter !== 'past') {
      upcoming = upcoming.filter(e => e.type === filter);
      past = past.filter(e => e.type === filter);
    } else if(filter === 'upcoming') { past = []; }
    else if(filter === 'past') { upcoming = []; }

    const upcomingEl = document.getElementById('upcomingGrid');
    const pastEl = document.getElementById('pastGrid');
    const upCount = document.getElementById('upcomingCount');
    const pastCount = document.getElementById('pastCount');

    if(upCount) upCount.textContent = upcoming.length + ' etkinlik';
    if(pastCount) pastCount.textContent = past.length + ' etkinlik';

    if(upcomingEl) upcomingEl.innerHTML = upcoming.map(ev => renderEventCard(ev, true)).join('');
    if(pastEl) pastEl.innerHTML = past.map(ev => renderEventCard(ev, false)).join('');

    document.getElementById('upcomingSection').style.display = filter === 'past' ? 'none' : '';
    document.getElementById('pastSection').style.display = filter === 'upcoming' ? 'none' : '';

    ASDFL.initReveal();
    setTimeout(() => ASDFL.refreshIcons(), 10);
  }

  function renderEventCard(ev, isUpcoming) {
    const d = new Date(ev.date);
    const day = d.getDate();
    const mon = d.toLocaleDateString('tr-TR', { month: 'short' });
    const fullDate = ASDFL.formatDate(ev.date);
    const typeLabels = { bulusma:'<i data-lucide="handshake" style="width:1em;height:1em"></i> Buluşma', gala:'<i data-lucide="sparkles" style="width:1em;height:1em"></i> Gala', kariyer:'<i data-lucide="briefcase" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> Kariyer', spor:'<i data-lucide="dribbble" style="width:1em;height:1em"></i> Spor', meziyet:'<i data-lucide="graduation-cap" style="width:1em;height:1em"></i> Mezuniyet', panel:'🎤 Panel' };
    const typeColors = { bulusma:'badge-teal', gala:'badge-gold', kariyer:'badge-blue', spor:'badge-teal', meziyet:'badge-gold', panel:'badge-blue' };

    return `
      <div class="card event-card ${isUpcoming ? 'upcoming' : 'past'} reveal">
        <div class="ec-top">
          <div class="event-date-box2">
            <span class="day">${day}</span>
            <span class="mon">${mon}</span>
          </div>
          <div>
            <div style="margin-bottom:.4rem"><span class="badge ${typeColors[ev.type]||'badge-blue'}">${typeLabels[ev.type]||ev.type}</span></div>
            <h4>${ev.title}</h4>
            <div class="ec-meta">
              <span><i data-lucide="calendar" style="width:1em;height:1em"></i> ${fullDate} · ${ev.time}</span>
              <span><i data-lucide="map-pin" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${ev.location}</span>
              ${isUpcoming ? '' : `<span><i data-lucide="users" style="width:1.2rem;height:1.2rem"></i> ${ev.attendees} katılımcı</span>`}
            </div>
          </div>
        </div>
        <div class="ec-desc">${ev.desc}</div>
        <div class="ec-footer">
          ${isUpcoming
            ? `<button class="btn btn-primary btn-sm" onclick="ASDFL.toast('Etkinliğe katılım kaydedildi!','success')">Katıl</button>
               <button class="btn btn-ghost btn-sm" onclick="ASDFL.toast('Takvime eklendi!','info')"><i data-lucide="calendar" style="width:1em;height:1em"></i> Takvime Ekle</button>`
            : `<span class="badge badge-blue">Tamamlandı</span>
               <a href="galeri.html" class="btn btn-ghost btn-sm"><i data-lucide="image" style="width:1.2rem;height:1.2rem"></i> Fotoğraflar</a>`
          }
        </div>
      </div>`;
  }

  window.filterEvents = function(type, btn) {
    document.querySelectorAll('.event-filter-bar .tag').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderEvents(type);
  };

  renderEvents('all');
});
