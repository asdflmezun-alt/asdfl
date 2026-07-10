/* =====================================================
   js/topluluk.js — Topluluk Sayfası Mantığı
   - Global / Yıla Özel / Şubeye Özel akışlar
   - Beğeni (Like) sistemi
   - Gönderi oluşturma
   - Anket oluşturma ve oylama sistemi (NEW)
   - Arama ve hashtag/çip filtreleme (NEW)
   - Sağ sidebar dinamik widget'ları (NEW)
   - Kullanıcı mini profil istatistikleri (NEW)
   ===================================================== */

(function () {
  let currentFeed = 'global'; // 'global' | 'year' | 'section'
  let myProfile = null;
  let likedPosts = new Set();
  let activeAttachment = null; // { type: 'photo'|'video'|'event'|'poll', value: ... }
  let activeFeeling = null;     // { emoji: '🥳', text: 'Heyecanlı' }
  
  // Arama & Filtreleme State
  let loadedPosts = [];
  let searchQuery = '';
  let searchDebounceTimer = null;
  let activeFilter = 'all'; // 'all' | 'photo' | 'video' | 'poll' | 'event'
  let pollOptions = [];
  let eventRsvpState = new Map();
  let authEnhancementsInitialized = false;
  let authRefreshPromise = null;
  let authRefreshQueued = false;

  const preferredScrollBehavior = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

  /* ---------- Başlat ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    const composeBox = document.getElementById('composeBox');
    const loginPrompt = document.getElementById('loginPrompt');
    window.addEventListener('asdfl:auth-changed', () => {
      refreshCommunityForAuth();
    });
    
    // Synchronous local session check to avoid initial load warning box flicker/flash
    const userStr = ASDFL._storage.getItem('asdfl_user');
    if (userStr) {
      if (composeBox) composeBox.classList.remove('hidden');
      if (loginPrompt) loginPrompt.classList.add('hidden');
    } else {
      if (composeBox) composeBox.classList.add('hidden');
      if (loginPrompt) loginPrompt.classList.remove('hidden');
    }

    await ASDFL.waitForAuth();
    await refreshCommunityForAuth();
    initComposeAttachments();
    initLightboxAccessibility();
    
    // Arama Çubuğu Event Listener
    const searchInput = document.getElementById('feedSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        window.clearTimeout(searchDebounceTimer);
        searchDebounceTimer = window.setTimeout(() => {
          searchQuery = e.target.value.trim().toLocaleLowerCase('tr');
          filterAndRenderPosts();
        }, 180);
      });
    }

    // Hashtag tıklamaları (akış + trend listesi) tek delegated listener'dan yönetilir
    document.addEventListener('click', (e) => {
      const tagEl = e.target.closest('[data-tag]');
      if (tagEl && tagEl.dataset.tag) window.filterByHashtag(tagEl.dataset.tag);
    });

  });

  async function refreshCommunityForAuth() {
    if (authRefreshPromise) {
      authRefreshQueued = true;
      return authRefreshPromise;
    }
    authRefreshPromise = (async () => {
      const composeBox = document.getElementById('composeBox');
      const loginPrompt = document.getElementById('loginPrompt');
      const isLoggedIn = !!ASDFL.currentUser;
      if (composeBox) composeBox.classList.toggle('hidden', !isLoggedIn);
      if (loginPrompt) loginPrompt.classList.toggle('hidden', isLoggedIn);
      if (isLoggedIn && composeBox) {
        const composeAvatar = document.getElementById('composeAvatar');
        if (composeAvatar) ASDFL.setAvatarElement(composeAvatar, ASDFL.currentUser);
      }

      myProfile = null;
      likedPosts.clear();
      await loadMyProfile();
      buildSidebar();
      await loadFeed(currentFeed);

      if (isLoggedIn) {
        if (!authEnhancementsInitialized) {
          authEnhancementsInitialized = true;
          initMentionAutocomplete();
        }
        subscribeFeedRealtime();
        await loadUserMiniCardStats();
      }
    })().finally(() => {
      const shouldRefreshAgain = authRefreshQueued;
      authRefreshQueued = false;
      authRefreshPromise = null;
      if (shouldRefreshAgain) setTimeout(() => refreshCommunityForAuth(), 0);
    });
    return authRefreshPromise;
  }

  async function loadMyProfile() {
    if (!ASDFL.currentUser) return;
    
    if (ASDFL.supabase) {
      try {
        const [profileResult, likesResult] = await Promise.all([
          ASDFL.queryWithTimeout(
            ASDFL.supabase
              .from('profiles')
              .select('id,name,role,grad_year,class_section,job,avatar_url,avatar_position,academic_title,specialization,mentor')
              .eq('id', ASDFL.currentUser.id)
              .single(),
            8000
          ),
          ASDFL.queryWithTimeout(
            ASDFL.supabase
              .from('post_likes')
              .select('post_id')
              .eq('user_id', ASDFL.currentUser.id),
            8000
          )
        ]);
        if (profileResult.error) throw profileResult.error;
        myProfile = profileResult.data;
        if (likesResult.error) throw likesResult.error;
        (likesResult.data || []).forEach(like => likedPosts.add(like.post_id));
      } catch (error) {
        console.warn('Topluluk profil bilgileri zamanında yüklenemedi:', error?.message || error);
        myProfile = ASDFL.currentUser;
      }
    } else {
      // Yerel ortamda beğenilen gönderileri yükle
      try {
        const localLikes = JSON.parse(ASDFL._storage.getItem('asdfl_local_likes') || '[]');
        localLikes.forEach(id => likedPosts.add(id));
      } catch (e) {
        console.error('Error loading local likes:', e);
      }
    }
  }

  /* ---------- Mini Profil Kartı Yükleme ---------- */
  async function loadUserMiniCardStats() {
    const userCard = document.getElementById('userMiniCard');
    if (!userCard || !ASDFL.currentUser) return;

    userCard.classList.remove('hidden');

    const avatarEl = document.getElementById('userMiniAvatar');
    if (avatarEl) {
      ASDFL.setAvatarElement(avatarEl, ASDFL.currentUser);
    }

    const nameEl = document.getElementById('userMiniName');
    if (nameEl) nameEl.textContent = ASDFL.currentUser.name || 'Kullanıcı';

    const roleEl = document.getElementById('userMiniRole');
    if (roleEl) {
      const role = myProfile?.role || ASDFL.currentUser.role || 'Üye';
      roleEl.textContent = role;
      roleEl.className = 'user-mini-role-badge ' + role.toLowerCase().replace('ğ', 'g').replace('ı', 'i');
    }

    const metaEl = document.getElementById('userMiniMeta');
    if (metaEl) {
      const gradYear = myProfile?.grad_year || ASDFL.currentUser.gradYear;
      const section = myProfile?.class_section || ASDFL.currentUser.classSection;
      const grade = myProfile?.grade || ASDFL.currentUser.grade;
      
      if (gradYear) {
        metaEl.textContent = `${gradYear} Mezunu` + (section ? ` (${section})` : '');
      } else if (grade) {
        metaEl.textContent = `${grade}` + (section ? ` - ${section}` : '');
      } else {
        metaEl.textContent = 'ASDFL Topluluğu';
      }
    }

    let postsCount = 0;
    let commentsCount = 0;

    if (ASDFL.supabase) {
      try {
        const { count: pCount } = await ASDFL.supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .eq('author_id', ASDFL.currentUser.id);
        postsCount = pCount || 0;

        const { count: cCount } = await ASDFL.supabase
          .from('post_comments')
          .select('id', { count: 'exact', head: true })
          .eq('author_id', ASDFL.currentUser.id);
        commentsCount = cCount || 0;
      } catch (err) {
        console.warn('Mini kart sayacı yüklenirken hata oluştu:', err);
      }
    } else {
      try {
        const allComments = JSON.parse(ASDFL._storage.getItem('asdfl_post_comments') || '[]');
        commentsCount = allComments.filter(c => c.author_id === ASDFL.currentUser.id).length;
        
        const allPosts = JSON.parse(ASDFL._storage.getItem('asdfl_posts') || '[]');
        postsCount = allPosts.filter(p => p.author_id === ASDFL.currentUser.id).length;
      } catch (e) {}
    }

    const postsCountEl = document.getElementById('userMiniPostsCount');
    if (postsCountEl) postsCountEl.textContent = postsCount;

    const commentsCountEl = document.getElementById('userMiniCommentsCount');
    if (commentsCountEl) commentsCountEl.textContent = commentsCount;

    // Mevcut sayaçlardan hesaplanan profil rozetleri
    const badgesEl = document.getElementById('userMiniBadges');
    if (badgesEl) {
      const badges = [];
      if (myProfile?.mentor) badges.push(['sparkles', 'Mentör']);
      if (postsCount >= 10) badges.push(['flame', 'Aktif Yazar']);
      else if (postsCount >= 1) badges.push(['pencil', 'İlk Gönderi']);
      if (commentsCount >= 10) badges.push(['message-circle', 'Sohbetçi']);
      badgesEl.innerHTML = badges.map(([icon, label]) =>
        `<span class="user-mini-badge"><i data-lucide="${icon}" style="width:.8rem;height:.8rem"></i> ${label}</span>`
      ).join('');
      badgesEl.classList.toggle('hidden', badges.length === 0);
      setTimeout(() => ASDFL.refreshIcons(badgesEl), 10);
    }
  }

  /* ---------- Sidebar ---------- */
  function buildSidebar() {
    const sidebar = document.getElementById('feedSidebar');
    if (!sidebar) return;

    const user = ASDFL.currentUser;
    const gradYear = myProfile?.grad_year || user?.gradYear;
    const section = myProfile?.class_section || user?.classSection;
    const safeGradYear = ASDFL.escapeHTML(String(gradYear ?? ''));
    const safeSection = ASDFL.escapeHTML(String(section ?? ''));

    sidebar.innerHTML = `
      <button type="button" class="feed-channel ${currentFeed === 'global' ? 'active' : ''}" onclick="window.switchFeed('global', this)" ${currentFeed === 'global' ? 'aria-current="page"' : ''}>
        <i data-lucide="globe" style="width:1.1rem;height:1.1rem"></i>
        <span>Genel Akış</span>
      </button>
      ${gradYear ? `
      <button type="button" class="feed-channel ${currentFeed === 'year' ? 'active' : ''}" onclick="window.switchFeed('year', this)" ${currentFeed === 'year' ? 'aria-current="page"' : ''}>
        <i data-lucide="graduation-cap" style="width:1.1rem;height:1.1rem"></i>
        <span>${safeGradYear} Mezunları</span>
      </button>` : ''}
      ${(gradYear && section) ? `
      <button type="button" class="feed-channel ${currentFeed === 'section' ? 'active' : ''}" onclick="window.switchFeed('section', this)" ${currentFeed === 'section' ? 'aria-current="page"' : ''}>
        <i data-lucide="users" style="width:1.1rem;height:1.1rem"></i>
        <span>${safeGradYear}-${safeSection} Sınıfı</span>
      </button>` : ''}
    `;
    setTimeout(() => ASDFL.refreshIcons(), 10);
  }

  /* ---------- Feed Switch ---------- */
  window.switchFeed = async function (type, el) {
    currentFeed = type;
    document.querySelectorAll('.feed-channel').forEach(c => {
      c.classList.remove('active');
      c.removeAttribute('aria-current');
    });
    el.classList.add('active');
    el.setAttribute('aria-current', 'page');
    await loadFeed(type);
    updateComposeAudience(type);
  };

  function updateComposeAudience(type) {
    const audienceEl = document.getElementById('postAudience');
    if (!audienceEl) return;
    if (type === 'global') {
      audienceEl.value = 'global';
      audienceEl.dispatchEvent(new Event('change'));
    } else if (type === 'year') {
      audienceEl.value = 'year';
      audienceEl.dispatchEvent(new Event('change'));
    } else {
      audienceEl.value = 'section';
      audienceEl.dispatchEvent(new Event('change'));
    }
  }

  /* ---------- Load Feed ---------- */
  async function loadFeed(type) {
    const container = document.getElementById('feedPosts');
    if (!container) return;
    container.innerHTML = '<div class="feed-loading"><div class="spinner"></div><span>Yükleniyor...</span></div>';

    // Akış yenilendiğinde "yeni paylaşım" şeridini sıfırla
    pendingNewPosts = 0;
    const newPostsBanner = document.getElementById('newPostsBanner');
    if (newPostsBanner) newPostsBanner.classList.add('hidden');

    if (!ASDFL.currentUser) {
      container.innerHTML = `
        <div class="feed-empty">
          <i data-lucide="lock" style="width:3rem;height:3rem;opacity:.5;color:var(--gold-500);margin-bottom:1rem"></i>
          <p style="color:var(--text-secondary);font-size:1rem;font-weight:500">Paylaşımları görebilmek için giriş yapmalısınız.</p>
        </div>
      `;
      setTimeout(() => ASDFL.refreshIcons(), 10);
      return;
    }

    if (!ASDFL.supabase) {
      container.innerHTML = '<div class="feed-empty">Supabase bağlantısı kurulamadı.</div>';
      return;
    }

    let query = ASDFL.supabase
      .from('posts')
      .select(`
        id, content, likes_count, created_at, target_year, target_section, pinned,
        profiles!author_id (id, name, job, grad_year, class_section, avatar_url, avatar_position, academic_title, specialization),
        post_comments(id),
        post_poll_votes(option_id, voter_id)
      `)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(40);

    if (type === 'global') {
      query = query.is('target_year', null).is('target_section', null);
    } else if (type === 'year') {
      const year = myProfile?.grad_year;
      if (!year) { container.innerHTML = '<div class="feed-empty">Mezuniyet yılınız profilinizde kayıtlı değil.</div>'; return; }
      query = query.eq('target_year', year).is('target_section', null);
    } else if (type === 'section') {
      const year = myProfile?.grad_year;
      const sec = myProfile?.class_section;
      if (!year || !sec) { container.innerHTML = '<div class="feed-empty">Yıl ve şube bilgisi profilinizde kayıtlı değil.</div>'; return; }
      query = query.eq('target_year', year).eq('target_section', sec);
    }

    let posts;
    let error;
    try {
      ({ data: posts, error } = await ASDFL.queryWithTimeout(query, 10000));
    } catch (queryError) {
      error = queryError;
    }

    if (error) {
      console.warn('Topluluk akışı yüklenemedi:', error?.message || error);
      container.innerHTML = `
        <div class="feed-empty">
          <i data-lucide="wifi-off" style="width:3rem;height:3rem;opacity:.45;color:var(--gold-500)"></i>
          <p>Topluluk akışı şu anda yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.</p>
          <button type="button" class="btn btn-secondary btn-sm" data-retry-feed>Yeniden Dene</button>
        </div>
      `;
      container.querySelector('[data-retry-feed]')?.addEventListener('click', () => loadFeed(type));
      setTimeout(() => ASDFL.refreshIcons(container), 10);
      return;
    }

    if (!posts || posts.length === 0) {
      loadedPosts = [];
      container.innerHTML = `<div class="feed-empty"><i data-lucide="message-circle" style="width:3rem;height:3rem;opacity:.3"></i><p>Henüz paylaşım yok. İlk paylaşımı sen yap!</p></div>`;
      setTimeout(() => ASDFL.refreshIcons(), 10);
      
      // Sağ sidebar'ı boş haliyle de olsa yükle
      await loadRightSidebarWidgets();
      return;
    }

    loadedPosts = posts;
    await loadAttachedEventRsvpState(posts);
    filterAndRenderPosts();
    
    // Sağ taraftaki widget'ları güncelle
    await loadRightSidebarWidgets();
  }

  /* ---------- Arama ve Filtreleme Uygulama ---------- */
  function filterAndRenderPosts() {
    const container = document.getElementById('feedPosts');
    if (!container) return;

    let filtered = [...loadedPosts];

    // Arama Kelimesi Filtresi
    if (searchQuery) {
      filtered = filtered.filter(p => {
        let textToCheck = p.content || '';
        if (textToCheck.startsWith('{') && textToCheck.endsWith('}')) {
          try {
            const parsed = JSON.parse(p.content);
            textToCheck = parsed.text || '';
          } catch(e) {}
        }
        const authorName = (p.profiles?.name || '').toLocaleLowerCase('tr');
        return textToCheck.toLocaleLowerCase('tr').includes(searchQuery) || authorName.includes(searchQuery);
      });
    }

    // Filtre Çipleri Filtresi
    if (activeFilter !== 'all') {
      filtered = filtered.filter(p => {
        let type = 'text';
        if (p.content && p.content.startsWith('{') && p.content.endsWith('}')) {
          try {
            const parsed = JSON.parse(p.content);
            if (parsed.richPost && parsed.attachment) {
              type = parsed.attachment.type;
            }
          } catch (e) {}
        }
        return type === activeFilter;
      });
    }

    const searchStatus = document.getElementById('feedSearchStatus');
    if (searchStatus) {
      searchStatus.textContent = searchQuery || activeFilter !== 'all'
        ? `${filtered.length} gönderi bulundu.`
        : `${filtered.length} gönderi gösteriliyor.`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="feed-empty">
          <i data-lucide="search-code" style="width:2.5rem;height:2.5rem;opacity:.3;margin-bottom:1rem"></i>
          <p>Kriterlere uygun paylaşım bulunamadı.</p>
        </div>
      `;
      setTimeout(() => ASDFL.refreshIcons(), 10);
      return;
    }

    container.innerHTML = filtered.map(post => renderPost(post)).join('');
    setTimeout(() => ASDFL.refreshIcons(), 10);
    handlePostDeepLink();
  }

  /* ---------- Paylaşılan #post- linkiyle gelen ziyaretçiyi gönderiye götür ---------- */
  let deepLinkHandled = false;
  function handlePostDeepLink() {
    if (deepLinkHandled) return;
    const hash = window.location.hash || '';
    if (!hash.startsWith('#post-')) return;
    const el = document.getElementById(hash.slice(1));
    if (!el) return; // gönderi bu akış sayfasında yoksa sessizce geç
    deepLinkHandled = true;
    setTimeout(() => {
      el.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'center' });
      el.classList.add('highlighted');
      setTimeout(() => el.classList.remove('highlighted'), 2500);
    }, 150);
  }

  /* ---------- Filtre Seçimi & Hashtag Tetikleme ---------- */
  window.setFilter = function (filter, el) {
    activeFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(c => {
      c.classList.remove('active');
      c.setAttribute('aria-pressed', 'false');
    });
    el.classList.add('active');
    el.setAttribute('aria-pressed', 'true');
    filterAndRenderPosts();
  };

  window.filterByHashtag = function (tag) {
    searchQuery = '#' + tag.toLocaleLowerCase('tr');
    const searchInput = document.getElementById('feedSearchInput');
    if (searchInput) searchInput.value = searchQuery;
    filterAndRenderPosts();
  };

  /* ---------- Hashtag + @Mention + URL Linkleme ve HTML Kaçış ---------- */
  function formatPostText(str, mentions = []) {
    // URL'ler önce yer tutucuya alınır: hashtag/mention işlemleri link içini bozmasın
    const links = [];
    const tokenized = String(str ?? '').replace(/https?:\/\/[^\s<>"']+/g, (url) => {
      links.push(url);
      return '\u0000LINK' + (links.length - 1) + '\u0000';
    });
    const escaped = tokenized.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    // data-tag + delegation: kullanıcı metni inline JS string'ine gömülmez
    let out = escaped.replace(/#([a-zA-Z0-9ĞğÜüŞşİıÖöÇç_]+)/g, '<span class="hashtag" data-tag="$1">#$1</span>');
    // @Mention'ları profil linkine çevir (isimler de aynı şekilde escape edilir)
    (mentions || []).forEach(m => {
      if (!m || !m.id || !m.name) return;
      const escName = String(m.name).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      out = out.split('@' + escName).join(`<a class="mention-link" href="profil.html?id=${encodeURIComponent(m.id)}">@${escName}</a>`);
    });
    // URL'leri güvenli tıklanabilir linklere çevir
    out = out.replace(/\u0000LINK(\d+)\u0000/g, (_, i) => {
      const url = links[Number(i)] || '';
      const safe = ASDFL.safeURL(url);
      if (!safe) return escapeHtml(url);
      const display = url.length > 45 ? url.slice(0, 42) + '…' : url;
      return `<a class="post-link" href="${ASDFL.escapeAttr(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(display)}</a>`;
    });
    return out;
  }

  window.expandPostText = function(postId) {
    const body = document.getElementById(`post-text-${ASDFL.escapeAttr(postId)}`);
    const btn = document.getElementById(`post-more-${ASDFL.escapeAttr(postId)}`);
    if (body) body.classList.remove('is-collapsed');
    if (btn) btn.remove();
  };

  function renderPost(post) {
    const author = post.profiles;
    const academicTitle = author?.academic_title || '';
    const name = (academicTitle ? academicTitle + ' ' : '') + (author?.name || 'Anonim');
    const initials = (author?.name || 'Anonim').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const meta = [
      author?.job,
      author?.specialization ? `Uzmanlık: ${author.specialization}` : null,
      author?.grad_year ? author.grad_year + ' Mezunu' : null,
      author?.class_section ? author.class_section + ' Şubesi' : null
    ].filter(Boolean).join(' · ');
    const time = timeAgo(post.created_at);
    const liked = likedPosts.has(post.id);
    const safePostId = ASDFL.jsString(post.id);
    const safePostIdAttr = ASDFL.escapeAttr(post.id);

    const audienceBadge = post.target_section
      ? `<span class="post-audience"><i data-lucide="users" style="width:.85rem;height:.85rem"></i> ${escapeHtml(post.target_year)}-${escapeHtml(post.target_section)}</span>`
      : post.target_year
      ? `<span class="post-audience"><i data-lucide="graduation-cap" style="width:.85rem;height:.85rem"></i> ${escapeHtml(post.target_year)} Mezunları</span>`
      : '';

    let commentCount = 0;
    if (ASDFL.supabase) {
      commentCount = post.post_comments ? post.post_comments.length : 0;
    } else {
      let allComments = JSON.parse(ASDFL._storage.getItem('asdfl_post_comments') || '[]');
      commentCount = allComments.filter(c => c.post_id === post.id).length;
    }

    // Parse Rich Content
    let postText = post.content || '';
    let attachmentHtml = '';
    let feelingHtml = '';
    let postMentions = [];

    if (postText.trim().startsWith('{') && postText.trim().endsWith('}')) {
      try {
        const parsed = JSON.parse(postText);
        if (parsed.richPost) {
          postText = parsed.text || '';
          if (Array.isArray(parsed.mentions)) postMentions = parsed.mentions;

          if (parsed.feeling) {
            feelingHtml = `<span class="feeling-text">— ${escapeHtml(parsed.feeling.emoji || '')} ${escapeHtml(parsed.feeling.text || '')} hissediyor</span>`;
          }

          if (parsed.attachment) {
            const att = parsed.attachment;
            if (att.type === 'photo') {
              const photoUrl = ASDFL.safeURL(att.value, { allowBlob: true });
              attachmentHtml = photoUrl ? `
                <div class="post-media-attachment">
                  <img src="${ASDFL.escapeAttr(photoUrl)}" alt="Paylaşım görseli" role="button" tabindex="0" aria-label="Görseli büyüt" onclick="window.openImageLightbox(${ASDFL.jsString(photoUrl)})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.openImageLightbox(${ASDFL.jsString(photoUrl)})}">
                </div>
              ` : '';
            } else if (att.type === 'video') {
              attachmentHtml = `
                <div class="post-media-attachment video-attachment">
                  <iframe src="https://www.youtube.com/embed/${ASDFL.escapeAttr(String(att.value || '').match(/^[a-zA-Z0-9_-]{6,20}$/) ? att.value : '')}" frameborder="0" allowfullscreen></iframe>
                </div>
              `;
            } else if (att.type === 'event') {
              const eventId = String(att.value?.id || '');
              const eventState = eventRsvpState.get(eventId) || {};
              const goingCount = Number(eventState.goingCount ?? att.value?.rsvpCount ?? att.value?.goingCount ?? 0);
              const eventHref = eventId ? `etkinlikler.html#event-${eventId}` : 'etkinlikler.html';
              const rsvpButton = renderEventAttachmentRsvpButton(eventId, eventState);
              attachmentHtml = `
                <div class="post-media-attachment">
                  <div class="event-attach-card">
                    <div class="event-attach-icon"><i data-lucide="calendar"></i></div>
                    <div class="event-attach-info">
                      <h4 class="event-attach-title">${escapeHtml(att.value.title || '')}</h4>
                      <div class="event-attach-meta">
                        <span><i data-lucide="calendar-days"></i> ${ASDFL.formatDate(att.value.date)}</span>
                        <span><i data-lucide="map-pin"></i> ${escapeHtml(att.value.location || '')}</span>
                        <span class="event-attach-attendees"><i data-lucide="users"></i> ${goingCount} kişi katılıyor</span>
                      </div>
                    </div>
                    ${rsvpButton}
                    <a href="${ASDFL.escapeAttr(eventHref)}" class="btn btn-secondary btn-sm event-attach-btn">Etkinliğe Git</a>
                  </div>
                </div>
              `;
            } else if (att.type === 'poll') {
              // Anket Rendering — oylar post_poll_votes tablosundan okunur; içerik
              // JSON'unda kalan eski oylarla birleştirilir (geriye uyumluluk).
              const poll = att.value;
              const tableVotes = Array.isArray(post.post_poll_votes) ? post.post_poll_votes : [];
              const votersFor = (opt) => {
                const legacy = Array.isArray(opt.votes) ? opt.votes : [];
                const recorded = tableVotes.filter(v => v.option_id === opt.id).map(v => v.voter_id);
                return [...new Set([...legacy, ...recorded])];
              };
              const myId = ASDFL.currentUser?.id;
              const hasVoted = poll.options.some(opt => votersFor(opt).includes(myId));
              const totalVotes = poll.options.reduce((sum, opt) => sum + votersFor(opt).length, 0);

              const optionsHtml = poll.options.map(opt => {
                const optVotes = votersFor(opt);
                const isMyVote = optVotes.includes(myId);
                const pct = totalVotes > 0 ? Math.round((optVotes.length / totalVotes) * 100) : 0;

                if (hasVoted) {
                  return `
                    <div class="poll-option-btn disabled ${isMyVote ? 'voted' : ''}">
                      <div class="poll-option-progress" style="width: ${pct}%"></div>
                      <span class="poll-option-text">${escapeHtml(opt.text)}</span>
                      <span class="poll-option-percentage">${pct}% (${optVotes.length} oy)</span>
                    </div>
                  `;
                } else {
                  return `
                    <button class="poll-option-btn" onclick="window.votePoll(${safePostId}, '${ASDFL.escapeAttr(opt.id)}')">
                      <span class="poll-option-text">${escapeHtml(opt.text)}</span>
                    </button>
                  `;
                }
              }).join('');

              attachmentHtml = `
                <div class="poll-card">
                  <h4 class="poll-question">${escapeHtml(poll.question)}</h4>
                  <div class="poll-options-list">${optionsHtml}</div>
                  <div class="poll-total-votes">
                    <i data-lucide="bar-chart-3" style="width:12px;height:12px"></i>
                    <span>Toplam ${totalVotes} oy kullanıldı</span>
                  </div>
                </div>
              `;
            }
          }
        }
      } catch (e) {
        // Not a JSON post
      }
    }

    const isAdmin = (myProfile?.role === 'Admin') || (ASDFL.currentUser?.role === 'Admin');
    const isMyPost = author?.id && author.id === ASDFL.currentUser?.id;

    // Metindeki ilk URL için alan adı etiketli bağlantı kartı
    let linkCardHtml = '';
    const firstUrlMatch = String(postText).match(/https?:\/\/[^\s<>"']+/);
    if (firstUrlMatch) {
      const safeLink = ASDFL.safeURL(firstUrlMatch[0]);
      if (safeLink) {
        let host = '';
        try { host = new URL(safeLink).hostname.replace(/^www\./, ''); } catch (e) {}
        linkCardHtml = `
          <a class="link-attach-card" href="${ASDFL.escapeAttr(safeLink)}" target="_blank" rel="noopener noreferrer">
            <div class="link-attach-icon"><i data-lucide="globe"></i></div>
            <div class="link-attach-info">
              <span class="link-attach-domain">${escapeHtml(host)}</span>
              <span class="link-attach-url">${escapeHtml(safeLink.length > 60 ? safeLink.slice(0, 57) + '…' : safeLink)}</span>
            </div>
            <i data-lucide="external-link" style="width:1rem;height:1rem;color:var(--text-muted);flex-shrink:0"></i>
          </a>`;
      }
    }
    const shouldCollapseText = String(postText || '').length > 420;
    const postTextHtml = `
      <div class="post-text${shouldCollapseText ? ' is-collapsed' : ''}" id="post-text-${safePostIdAttr}">
        ${formatPostText(postText, postMentions)}
      </div>
      ${shouldCollapseText ? `<button type="button" class="post-read-more" id="post-more-${safePostIdAttr}" onclick="window.expandPostText(${safePostId})">Devamını oku</button>` : ''}
    `;

    const moderationBtn = (isMyPost || isAdmin)
      ? `<button type="button" class="post-action-btn post-action-danger" style="margin-left:auto" onclick="window.deletePost(${safePostId})" title="Gönderiyi sil">
           <i data-lucide="trash-2" style="width:1.1rem;height:1.1rem"></i>
         </button>`
      : `<button type="button" class="post-action-btn" style="margin-left:auto" onclick="window.openReportModal(${safePostId})" title="Gönderiyi şikâyet et">
           <i data-lucide="flag" style="width:1.1rem;height:1.1rem"></i>
         </button>`;

    return `
      <div class="post-card${post.pinned ? ' pinned' : ''}" id="post-${safePostIdAttr}">
        <div class="post-header">
          <a class="post-author-link" href="profil.html?id=${encodeURIComponent(author?.id || '')}" aria-label="${ASDFL.escapeAttr(name)} profilini aç">
            ${ASDFL.getAvatarHTML({ initials, avatar_url: author?.avatar_url, avatar_position: author?.avatar_position, name }, 'post-avatar')}
          </a>
          <a class="post-meta post-author-link" href="profil.html?id=${encodeURIComponent(author?.id || '')}" aria-label="${ASDFL.escapeAttr(name)} profilini aç">
            <strong class="post-author" style="display:inline-block">${escapeHtml(name)} ${feelingHtml}</strong>
            <span class="post-submeta">${escapeHtml(meta)}</span>
          </a>
          <div class="post-time-audience">
            <span class="post-time">${escapeHtml(time)}</span>
            ${post.pinned ? '<span class="pinned-badge"><i data-lucide="pin" style="width:.8rem;height:.8rem"></i> Sabitlendi</span>' : ''}
            ${audienceBadge}
          </div>
        </div>
        <div class="post-body">${postTextHtml} ${attachmentHtml} ${linkCardHtml}</div>
        <div class="post-actions">
          <button type="button" class="post-action-btn like-action ${liked ? 'liked' : ''}" onclick="window.toggleLike(${safePostId}, this)" id="like-${safePostIdAttr}" aria-label="${liked ? 'Beğeniyi kaldır' : 'Gönderiyi beğen'}" aria-pressed="${liked}">
            <span class="like-icon" aria-hidden="true"><i data-lucide="heart"></i></span>
            <span class="like-count">${post.likes_count || 0}</span>
          </button>
          <button type="button" class="post-action-btn" onclick="window.toggleComments(${safePostId}, this)" id="comment-btn-${safePostIdAttr}" aria-expanded="false" aria-controls="comments-section-${safePostIdAttr}">
            <i data-lucide="message-square" style="width:1.1rem;height:1.1rem"></i>
            <span class="comment-count">${commentCount}</span> Yorum
          </button>
          <button type="button" class="post-action-btn" onclick="window.sharePost(${safePostId})">
            <i data-lucide="share-2" style="width:1.1rem;height:1.1rem"></i>
            <span>Paylaş</span>
          </button>
          ${isAdmin ? `
          <button type="button" class="post-action-btn" onclick="window.togglePin(${safePostId}, ${!post.pinned})" title="${post.pinned ? 'Sabitlemeyi kaldır' : 'Gönderiyi sabitle'}">
            <i data-lucide="pin" style="width:1.1rem;height:1.1rem"></i>
            <span>${post.pinned ? 'Kaldır' : 'Sabitle'}</span>
          </button>` : ''}
          ${moderationBtn}
        </div>
        
        <!-- YORUMLAR PANELİ -->
        <div class="comments-section hidden" id="comments-section-${safePostIdAttr}">
          <div class="comments-list" id="comments-list-${safePostIdAttr}"></div>
          <div class="comment-compose">
            ${ASDFL.getAvatarHTML(ASDFL.currentUser, 'comment-avatar', 'width:30px;height:30px;font-size:0.7rem')}
            <input type="text" class="comment-input" placeholder="Yorum yaz ve Enter'a bas..." aria-label="Yorum yaz" id="comment-input-${safePostIdAttr}" onkeydown="if(event.key==='Enter')window.submitCommentAction(${safePostId})">
            <button type="button" class="btn btn-primary btn-sm" style="padding:0.35rem 0.85rem;font-size:0.8rem;border-radius:var(--radius-full)" onclick="window.submitCommentAction(${safePostId})">Gönder</button>
          </div>
        </div>
      </div>
    `;
  }

  /* ---------- Beğeni Oy Verme ---------- */
  function getAttachedEventIds(posts) {
    const ids = new Set();
    (posts || []).forEach(post => {
      const text = String(post.content || '').trim();
      if (!text.startsWith('{') || !text.endsWith('}')) return;
      try {
        const parsed = JSON.parse(text);
        const eventId = parsed.richPost && parsed.attachment?.type === 'event'
          ? parsed.attachment.value?.id
          : null;
        if (eventId) ids.add(String(eventId));
      } catch (e) {}
    });
    return [...ids];
  }

  async function loadAttachedEventRsvpState(posts) {
    const ids = getAttachedEventIds(posts);
    eventRsvpState = new Map(ids.map(id => [id, { going: [], goingCount: 0, iAmGoing: false, capacity: null }]));
    if (!ids.length) return;

    const myId = ASDFL.currentUser?.id;
    if (ASDFL.supabase) {
      try {
        const { data, error } = await ASDFL.supabase
          .from('events')
          .select('id,capacity,event_rsvps(user_id,status)')
          .in('id', ids);
        if (error) throw error;
        (data || []).forEach(ev => {
          const going = (Array.isArray(ev.event_rsvps) ? ev.event_rsvps : []).filter(r => r.status === 'going');
          eventRsvpState.set(String(ev.id), {
            going,
            goingCount: going.length,
            iAmGoing: !!(myId && going.some(r => r.user_id === myId)),
            capacity: ev.capacity ?? null
          });
        });
      } catch (err) {
        console.error('Etkinlik katılım bilgileri yüklenemedi:', err);
      }
      return;
    }

    try {
      const localRsvps = JSON.parse(ASDFL._storage.getItem('asdfl_event_rsvps') || '[]');
      ids.forEach(id => {
        const going = localRsvps.filter(r => String(r.event_id) === id && (r.status || 'going') === 'going');
        eventRsvpState.set(id, {
          going,
          goingCount: going.length,
          iAmGoing: !!(myId && going.some(r => r.user_id === myId)),
          capacity: null
        });
      });
    } catch (err) {
      console.error('Yerel etkinlik katılım bilgileri okunamadı:', err);
    }
  }

  function renderEventAttachmentRsvpButton(eventId, state = {}) {
    if (!eventId) return '';
    const idJs = ASDFL.jsString(eventId);
    const full = state.capacity != null && state.goingCount >= state.capacity && !state.iAmGoing;
    if (!ASDFL.currentUser) {
      return `<button class="btn btn-primary btn-sm event-attach-btn" onclick="ASDFL.openModal('loginModal')">Katılmak için giriş yap</button>`;
    }
    if (state.iAmGoing) {
      return `<button class="btn btn-success btn-sm event-attach-btn rsvp-btn going" onclick="window.toggleFeedEventRsvp(${idJs})"><i data-lucide="check-circle" style="width:1.1rem;height:1.1rem"></i> Katılıyorsun</button>`;
    }
    if (full) {
      return `<button class="btn btn-ghost btn-sm event-attach-btn" disabled><i data-lucide="users" style="width:1.1rem;height:1.1rem"></i> Kontenjan doldu</button>`;
    }
    return `<button class="btn btn-primary btn-sm event-attach-btn rsvp-btn" onclick="window.toggleFeedEventRsvp(${idJs})"><i data-lucide="plus" style="width:1.1rem;height:1.1rem"></i> Katılıyorum</button>`;
  }

  window.toggleFeedEventRsvp = async function (eventId) {
    if (!ASDFL.currentUser) { ASDFL.openModal('loginModal'); return; }
    eventId = String(eventId || '');
    if (!eventId) return;

    const myId = ASDFL.currentUser.id;
    const state = eventRsvpState.get(eventId) || { going: [], goingCount: 0, iAmGoing: false, capacity: null };
    const wasGoing = !!state.iAmGoing;
    if (!wasGoing && state.capacity != null && state.goingCount >= state.capacity) {
      ASDFL.toast('Kontenjan dolu.', 'warning');
      return;
    }

    const nextGoing = wasGoing
      ? (state.going || []).filter(r => r.user_id !== myId)
      : [...(state.going || []), { user_id: myId, status: 'going' }];
    eventRsvpState.set(eventId, {
      ...state,
      going: nextGoing,
      goingCount: nextGoing.length,
      iAmGoing: !wasGoing
    });
    filterAndRenderPosts();

    if (ASDFL.supabase) {
      try {
        if (wasGoing) {
          const { error } = await ASDFL.supabase.from('event_rsvps').delete().eq('event_id', eventId).eq('user_id', myId);
          if (error) throw error;
          ASDFL.toast('Katılım iptal edildi.', 'info');
        } else {
          const { error } = await ASDFL.supabase.from('event_rsvps').insert({ event_id: eventId, user_id: myId, status: 'going' });
          if (error) throw error;
          ASDFL.toast('Katılımın kaydedildi!', 'success');
        }
        return;
      } catch (err) {
        eventRsvpState.set(eventId, state);
        filterAndRenderPosts();
        const msg = /capacity/i.test(err.message || '') ? 'Kontenjan doldu.' : 'Katılım kaydedilemedi: ' + (err.message || '');
        ASDFL.toast(msg, 'error');
        return;
      }
    }

    try {
      let localRsvps = JSON.parse(ASDFL._storage.getItem('asdfl_event_rsvps') || '[]');
      if (wasGoing) {
        localRsvps = localRsvps.filter(r => !(String(r.event_id) === eventId && r.user_id === myId));
      } else if (!localRsvps.some(r => String(r.event_id) === eventId && r.user_id === myId)) {
        localRsvps.push({ event_id: eventId, user_id: myId, status: 'going', created_at: new Date().toISOString() });
      }
      ASDFL._storage.setItem('asdfl_event_rsvps', JSON.stringify(localRsvps));
      ASDFL.toast(wasGoing ? 'Katılım iptal edildi.' : 'Katılımın kaydedildi!', wasGoing ? 'info' : 'success');
    } catch (err) {
      eventRsvpState.set(eventId, state);
      filterAndRenderPosts();
      ASDFL.toast('Katılım yerelde kaydedilemedi.', 'error');
    }
  };

  window.toggleLike = async function (postId, btn) {
    if (!ASDFL.currentUser) { ASDFL.toast('Beğenmek için giriş yapmalısın!', 'warning'); return; }

    const alreadyLiked = likedPosts.has(postId);
    const countEl = btn.querySelector('.like-count');
    let count = parseInt(countEl.textContent) || 0;

    // Optimistik Arayüz Güncellemesi (Tıklanır tıklanmaz sayıyı ve stili değiştir)
    if (alreadyLiked) {
      likedPosts.delete(postId);
      btn.classList.remove('liked');
      count = Math.max(0, count - 1);
    } else {
      likedPosts.add(postId);
      btn.classList.add('liked');
      count += 1;
    }
    countEl.textContent = count;
    const isLikedNow = !alreadyLiked;
    btn.setAttribute('aria-pressed', String(isLikedNow));
    btn.setAttribute('aria-label', isLikedNow ? 'Beğeniyi kaldır' : 'Gönderiyi beğen');

    // Animasyonu tetikle
    const icon = btn.querySelector('.like-icon');
    if (icon && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      icon.classList.remove('is-bursting');
      void icon.offsetWidth;
      icon.classList.add('is-bursting');
      icon.addEventListener('animationend', () => icon.classList.remove('is-bursting'), { once: true });
    }

    // Veritabanına ya da LocalStorage'a kaydet
    if (ASDFL.supabase) {
      try {
        if (alreadyLiked) {
          const { error } = await ASDFL.supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', ASDFL.currentUser.id);
          if (error) throw error;
        } else {
          const { error } = await ASDFL.supabase.from('post_likes').insert({ post_id: postId, user_id: ASDFL.currentUser.id });
          if (error) throw error;
        }
      } catch (err) {
        console.error('Error updating like in Supabase:', err);
        // Rollback optimistic update on error
        if (alreadyLiked) {
          likedPosts.add(postId);
          btn.classList.add('liked');
          countEl.textContent = count + 1;
        } else {
          likedPosts.delete(postId);
          btn.classList.remove('liked');
          countEl.textContent = Math.max(0, count - 1);
        }
        btn.setAttribute('aria-pressed', String(alreadyLiked));
        btn.setAttribute('aria-label', alreadyLiked ? 'Beğeniyi kaldır' : 'Gönderiyi beğen');
        ASDFL.toast('Beğeni kaydedilemedi, lütfen tekrar deneyin.', 'error');
      }
    } else {
      // Çevrimdışı mod yerel kaydetme
      try {
        let localLikes = JSON.parse(ASDFL._storage.getItem('asdfl_local_likes') || '[]');
        if (alreadyLiked) {
          localLikes = localLikes.filter(id => id !== postId);
        } else {
          localLikes.push(postId);
        }
        ASDFL._storage.setItem('asdfl_local_likes', JSON.stringify(localLikes));

        // Yerel gönderilerdeki beğeni sayısını da güncelle
        let localPosts = JSON.parse(ASDFL._storage.getItem('asdfl_posts') || '[]');
        localPosts = localPosts.map(p => {
          if (p.id === postId) {
            p.likes_count = count;
          }
          return p;
        });
        ASDFL._storage.setItem('asdfl_posts', JSON.stringify(localPosts));
      } catch (e) {
        console.error('Error updating local like:', e);
      }
    }
  };

  /* ---------- Gönderi Silme (Sahibi veya Admin) ---------- */
  window.deletePost = async function (postId) {
    if (!ASDFL.supabase || !ASDFL.currentUser) return;
    if (!confirm('Bu gönderiyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
    const { error } = await ASDFL.supabase.from('posts').delete().eq('id', postId);
    if (error) {
      ASDFL.toast('Gönderi silinemedi: ' + error.message, 'error');
      return;
    }
    ASDFL.toast('Gönderi silindi.', 'success');
    await loadUserMiniCardStats();
    await loadFeed(currentFeed);
  };

  /* ---------- Gönderi Şikâyet Etme ---------- */
  window.openReportModal = function (postId) {
    if (!ASDFL.currentUser) {
      ASDFL.toast('Şikâyet etmek için giriş yapmalısınız.', 'warning');
      return;
    }
    const idEl = document.getElementById('reportPostId');
    const reasonEl = document.getElementById('reportReason');
    if (idEl) idEl.value = postId;
    if (reasonEl) reasonEl.value = '';
    ASDFL.openModal('reportModal');
  };

  window.submitPostReport = async function () {
    if (!ASDFL.supabase || !ASDFL.currentUser) return;
    const postId = document.getElementById('reportPostId')?.value;
    const reason = document.getElementById('reportReason')?.value?.trim();
    if (!reason) {
      ASDFL.toast('Lütfen şikâyet nedeninizi kısaca yazın.', 'warning');
      return;
    }
    const { error } = await ASDFL.supabase.from('post_reports').insert({
      post_id: postId,
      reporter_id: ASDFL.currentUser.id,
      reason
    });
    if (error) {
      if (error.code === '23505') ASDFL.toast('Bu gönderiyi zaten şikâyet ettiniz.', 'info');
      else ASDFL.toast('Şikâyet gönderilemedi: ' + error.message, 'error');
    } else {
      ASDFL.toast('Şikâyetiniz yönetime iletildi. Teşekkürler. 🛡️', 'success');
    }
    ASDFL.closeModal('reportModal');
  };

  /* ---------- Gönderi Sabitleme (Admin) ---------- */
  window.togglePin = async function (postId, pin) {
    if (!ASDFL.supabase) return;
    const { error } = await ASDFL.supabase.rpc('set_post_pinned', { target_post_id: postId, is_pinned: pin });
    if (error) {
      ASDFL.toast('Sabitleme başarısız: ' + error.message, 'error');
      return;
    }
    ASDFL.toast(pin ? 'Gönderi sabitlendi 📌' : 'Sabitleme kaldırıldı', 'success');
    await loadFeed(currentFeed);
  };

  /* ---------- Paylaşım ---------- */
  window.sharePost = async function (postId) {
    const url = window.location.origin + window.location.pathname + '#post-' + postId;

    // Paylaşım metni: gönderinin ilk 120 karakteri
    let shareText = 'ASDFL Topluluk paylaşımı';
    const post = loadedPosts.find(p => p.id === postId);
    if (post) {
      let t = post.content || '';
      if (t.trim().startsWith('{')) {
        try { t = JSON.parse(t).text || ''; } catch (e) {}
      }
      if (t) shareText = t.length > 120 ? t.slice(0, 117) + '...' : t;
    }

    // 1) Mobilde yerel paylaşım menüsü (WhatsApp, Instagram, SMS...)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ASDFL Mezunlar Derneği', text: shareText, url });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // kullanıcı menüyü kapattı
        // paylaşım başarısızsa panoya kopyalamaya düş
      }
    }

    // 2) Pano API (HTTPS gerektirir)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        ASDFL.toast('Bağlantı panoya kopyalandı! 🔗', 'success');
        return;
      } catch (e) {}
    }

    // 3) Eski tarayıcı / güvensiz bağlam için execCommand yedeği
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (ok) {
        ASDFL.toast('Bağlantı panoya kopyalandı! 🔗', 'success');
        return;
      }
    } catch (e) {}

    ASDFL.toast('Bağlantı: ' + url, 'info');
  };

  /* ---------- Gönderi Oluşturma ---------- */
  window.handleToplulukPost = async function () {
    if (!ASDFL.currentUser) { ASDFL.toast('Paylaşım yapmak için giriş yapmalısınız!', 'warning'); return; }

    const content = document.getElementById('toplulukContent')?.value?.trim();
    const builderActive = !document.getElementById('pollBuilderArea').classList.contains('hidden');
    
    // Anket kontrolü
    if (builderActive) {
      const question = document.getElementById('pollQuestionInput').value.trim();
      if (!question) {
        ASDFL.toast('Lütfen anket sorusunu yazın!', 'warning');
        return;
      }
      
      const validOptions = pollOptions.filter(o => o.trim() !== '');
      if (validOptions.length < 2) {
        ASDFL.toast('Lütfen en az 2 geçerli seçenek ekleyin!', 'warning');
        return;
      }

      activeAttachment = {
        type: 'poll',
        value: {
          question: question,
          options: validOptions.map((opt, i) => ({
            id: 'opt_' + i + '_' + Math.random().toString(36).substring(2, 6),
            text: opt.trim(),
            votes: []
          }))
        }
      };
    }

    if (!content && !activeAttachment) { ASDFL.toast('Lütfen bir şeyler yazın veya bir medya/anket ekleyin!', 'warning'); return; }

    const audienceVal = document.getElementById('postAudience')?.value || 'global';
    const btn = document.getElementById('toplulukPostBtn');
    btn.disabled = true;
    btn.textContent = 'Paylaşılıyor...';

    let target_year = null;
    let target_section = null;

    if (audienceVal === 'year' || audienceVal === 'section') {
      target_year = myProfile?.grad_year || null;
    }
    if (audienceVal === 'section') {
      target_section = myProfile?.class_section || null;
    }

    // Metinde hâlâ geçen @mention'ları doğrula (kullanıcı seçtikten sonra silmiş olabilir)
    const confirmedMentions = activeMentions.filter(m => (content || '').includes('@' + m.name));

    let finalContent = content;
    if (activeAttachment || activeFeeling || confirmedMentions.length) {
      finalContent = JSON.stringify({
        richPost: true,
        text: content || (activeAttachment?.type === 'poll' ? activeAttachment.value.question : ''),
        attachment: activeAttachment,
        feeling: activeFeeling,
        mentions: confirmedMentions.length ? confirmedMentions : undefined
      });
    }

    const { error } = await ASDFL.supabase.from('posts').insert({
      author_id: ASDFL.currentUser.id,
      content: finalContent,
      target_year,
      target_section,
    });

    if (error) {
      ASDFL.toast('Hata: ' + error.message, 'error');
    } else {
      document.getElementById('toplulukContent').value = '';
      activeAttachment = null;
      activeFeeling = null;
      activeMentions = [];
      window.cancelPollCreator();
      renderAttachmentPreview();
      ASDFL.toast('Paylaşımın yayınlandı! 🚀', 'success');
      
      // Mini Profil Kartı İstatistiklerini yenile
      await loadUserMiniCardStats();
      await loadFeed(currentFeed);
    }

    btn.disabled = false;
    btn.innerHTML = 'Paylaş <i data-lucide="send" style="width:1em;height:1em"></i>';
    setTimeout(() => ASDFL.refreshIcons(), 10);
  };

  /* ---------- Hedef Kitle Değişimi ---------- */
  window.onAudienceChange = function (sel) {
    const hint = document.getElementById('audienceHint');
    if (!hint) return;
    const gradYear = myProfile?.grad_year;
    const sec = myProfile?.class_section;
    if (sel.value === 'global') hint.textContent = 'Tüm okul topluluğu görebilir.';
    else if (sel.value === 'year') hint.textContent = gradYear ? `Sadece ${gradYear} mezunları görebilir.` : 'Profil sayfanızda mezuniyet yılınızı ekleyin.';
    else hint.textContent = (gradYear && sec) ? `Sadece ${gradYear}-${sec} sınıf arkadaşlarınız görebilir.` : 'Profil sayfanızdan yıl ve şube bilginizi ekleyin.';
  };

  /* ---------- Yorum İşlemleri ---------- */
  window.toggleComments = async function (postId, btn) {
    const section = document.getElementById(`comments-section-${postId}`);
    if (!section) return;

    const isHidden = section.classList.toggle('hidden');
    btn.classList.toggle('commented', !isHidden);
    btn.setAttribute('aria-expanded', String(!isHidden));

    if (!isHidden) {
      await loadComments(postId);
      document.getElementById(`comment-input-${postId}`)?.focus({ preventScroll: true });
    }
  };

  async function loadComments(postId) {
    const list = document.getElementById(`comments-list-${postId}`);
    if (!list) return;

    list.innerHTML = '<div class="text-center p-2"><div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block"></div></div>';

    const comments = await getCommentsForPost(postId);
    
    if (comments.length === 0) {
      list.innerHTML = '<p style="font-size:0.8rem;color:var(--text-muted);text-align:center;padding:0.75rem 0.5rem">Henüz yorum yapılmamış. İlk yorumu sen yaz!</p>';
      return;
    }

    list.innerHTML = comments.map(c => {
      const commentAuthorId = c.authorId || c.author_id || '';
      return `
        <div class="comment-item">
          <div style="cursor:pointer" onclick="window.location.href='profil.html?id=${encodeURIComponent(commentAuthorId)}'">
            ${ASDFL.getAvatarHTML({ initials: c.initials, avatar_url: c.authorAvatarUrl, avatar_position: c.authorAvatarPosition, name: c.authorName }, 'comment-avatar')}
          </div>
          <div class="comment-content-area">
            <div class="comment-author-row">
              <strong class="comment-author-name" style="cursor:pointer" onclick="window.location.href='profil.html?id=${encodeURIComponent(commentAuthorId)}'">${escapeHtml(c.authorName)}</strong>
              <span class="comment-author-meta">${escapeHtml(c.authorMeta)}</span>
              <span class="comment-time">${escapeHtml(timeAgo(c.created_at))}</span>
            </div>
            <p class="comment-text">${escapeHtml(c.content)}</p>
          </div>
        </div>
      `;
    }).join('');
    
    setTimeout(() => ASDFL.refreshIcons(), 10);
  }

  async function getCommentsForPost(postId) {
    if (ASDFL.supabase) {
      const { data, error } = await ASDFL.supabase
        .from('post_comments')
        .select('*, profiles!author_id(name, grad_year, class_section, job, avatar_url, avatar_position, academic_title, specialization)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
        
      if (error) {
        console.error('Error loading comments:', error);
        return [];
      }
      
      return data.map(c => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        authorId: c.author_id,
        authorName: (c.profiles?.academic_title ? c.profiles.academic_title + ' ' : '') + (c.profiles?.name || 'Anonim'),
        authorAvatarUrl: c.profiles?.avatar_url || '',
        authorAvatarPosition: c.profiles?.avatar_position || '',
        authorMeta: [
          c.profiles?.job,
          c.profiles?.specialization ? `Uzmanlık: ${c.profiles.specialization}` : null,
          c.profiles?.grad_year ? c.profiles.grad_year + ' Mezunu' : null
        ].filter(Boolean).join(' · '),
        initials: ASDFL.getInitials(c.profiles?.name || 'U')
      }));
    } else {
      let allComments = JSON.parse(ASDFL._storage.getItem('asdfl_post_comments') || '[]');
      return allComments.filter(c => c.post_id === postId);
    }
  }

  window.submitCommentAction = async function (postId) {
    if (!ASDFL.currentUser) {
      ASDFL.toast('Yorum yapabilmek için lütfen giriş yapın.', 'warning');
      ASDFL.openModal('loginModal');
      return;
    }

    const input = document.getElementById(`comment-input-${postId}`);
    const content = input?.value?.trim();
    if (!content) return;

    input.value = ''; // Inputu temizle

    const newComment = await submitComment(postId, content);
    if (newComment) {
      await loadComments(postId); // Yorum listesini yenile
      
      // Buton üzerindeki yorum sayısını güncelle
      const countEl = document.querySelector(`#comment-btn-${postId} .comment-count`);
      if (countEl) {
        let count = parseInt(countEl.textContent || '0');
        countEl.textContent = count + 1;
      }
      
      // Mini Profil Kartı istatistiklerini güncelle
      await loadUserMiniCardStats();
      ASDFL.toast('Yorumunuz yayınlandı! 💬', 'success');
    }
  };

  async function submitComment(postId, content) {
    if (ASDFL.supabase) {
      const { data, error } = await ASDFL.supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          author_id: ASDFL.currentUser.id,
          content: content
        })
        .select('*, profiles!author_id(name, grad_year, class_section, job, avatar_url, avatar_position, academic_title, specialization)')
        .single();
        
      if (error) {
        console.error('Error submitting comment:', error);
        ASDFL.toast('Yorum gönderilemedi: ' + error.message, 'error');
        return null;
      }
      
      return {
        id: data.id,
        content: data.content,
        created_at: data.created_at,
        authorName: (data.profiles?.academic_title ? data.profiles.academic_title + ' ' : '') + (data.profiles?.name || 'Anonim'),
        authorAvatarUrl: data.profiles?.avatar_url || '',
        authorAvatarPosition: data.profiles?.avatar_position || '',
        authorMeta: [
          data.profiles?.job,
          data.profiles?.specialization ? `Uzmanlık: ${data.profiles.specialization}` : null,
          data.profiles?.grad_year ? data.profiles.grad_year + ' Mezunu' : null
        ].filter(Boolean).join(' · '),
        initials: ASDFL.getInitials(data.profiles?.name || 'U')
      };
    } else {
      let allComments = JSON.parse(ASDFL._storage.getItem('asdfl_post_comments') || '[]');
      const newComment = {
        id: Math.random().toString(36).substring(2),
        post_id: postId,
        author_id: ASDFL.currentUser.id,
        content: content,
        created_at: new Date().toISOString(),
        authorName: (ASDFL.currentUser.academic_title ? ASDFL.currentUser.academic_title + ' ' : '') + ASDFL.currentUser.name,
        authorAvatarUrl: ASDFL.currentUser.avatar_url || ASDFL.currentUser.avatarUrl || '',
        authorAvatarPosition: ASDFL.currentUser.avatar_position || '50% 50%',
        authorMeta: [
          ASDFL.currentUser.job,
          ASDFL.currentUser.specialization ? `Uzmanlık: ${ASDFL.currentUser.specialization}` : null,
          ASDFL.currentUser.gradYear || ASDFL.currentUser.grad_year ? (ASDFL.currentUser.gradYear || ASDFL.currentUser.grad_year) + ' Mezunu' : null
        ].filter(Boolean).join(' · '),
        initials: ASDFL.getInitials(ASDFL.currentUser.name)
      };
      allComments.push(newComment);
      ASDFL._storage.setItem('asdfl_post_comments', JSON.stringify(allComments));
      return newComment;
    }
  }

  /* ---------- Anket Oylama Mantığı ---------- */
  window.votePoll = async function (postId, optionId) {
    if (!ASDFL.currentUser) {
      ASDFL.toast('Oy vermek için giriş yapmalısınız.', 'warning');
      return;
    }

    const post = loadedPosts.find(p => p.id === postId);
    if (!post) return;

    // Oy, gönderi içeriği güncellenerek DEĞİL, seçenek doğrulamasını ve tek oy
    // kuralını sunucuda uygulayan cast_poll_vote RPC'siyle kaydedilir.
    if (ASDFL.supabase) {
      const { error } = await ASDFL.supabase.rpc('cast_poll_vote', {
        target_post_id: postId,
        target_option_id: optionId
      });

      if (error) {
        if (/already voted/i.test(error.message)) {
          ASDFL.toast('Bu ankete zaten oy verdiniz!', 'info');
        } else {
          console.error('Oy kaydedilirken hata oluştu:', error);
          ASDFL.toast('Oy kaydedilemedi: ' + error.message, 'error');
        }
        return;
      }

      if (!Array.isArray(post.post_poll_votes)) post.post_poll_votes = [];
      post.post_poll_votes.push({ option_id: optionId, voter_id: ASDFL.currentUser.id });
      filterAndRenderPosts();
      ASDFL.toast('Oyunuz kaydedildi! 🗳️', 'success');
      return;
    }

    // localStorage fallback (Supabase bağlantısı yok)
    try {
      const parsed = JSON.parse(post.content);
      if (parsed.richPost && parsed.attachment && parsed.attachment.type === 'poll') {
        const poll = parsed.attachment.value;

        const hasVoted = poll.options.some(opt => (opt.votes || []).includes(ASDFL.currentUser.id));
        if (hasVoted) {
          ASDFL.toast('Bu ankete zaten oy verdiniz!', 'info');
          return;
        }

        poll.options.forEach(opt => {
          if (!opt.votes) opt.votes = [];
          if (opt.id === optionId) {
            opt.votes.push(ASDFL.currentUser.id);
          }
        });

        const updatedContent = JSON.stringify(parsed);
        let localPosts = JSON.parse(ASDFL._storage.getItem('asdfl_posts') || '[]');
        const idx = localPosts.findIndex(p => p.id === postId);
        if (idx !== -1) {
          localPosts[idx].content = updatedContent;
          ASDFL._storage.setItem('asdfl_posts', JSON.stringify(localPosts));
        }

        post.content = updatedContent;
        filterAndRenderPosts();
        ASDFL.toast('Oyunuz kaydedildi! 🗳️', 'success');
      }
    } catch (err) {
      console.error('Anket oylama hatası:', err);
    }
  };

  /* ---------- Sağ Sidebar Widgets Yükleme ---------- */
  async function loadRightSidebarWidgets() {
    await Promise.all([
      loadTrendingHashtags(),
      loadActiveAlumni(),
      loadUpcomingEvents()
    ]);
  }

  async function loadTrendingHashtags() {
    const container = document.getElementById('trendingHashtagsList');
    if (!container) return;

    const hashCounts = {};
    loadedPosts.forEach(p => {
      let text = p.content || '';
      if (text.startsWith('{') && text.endsWith('}')) {
        try {
          const parsed = JSON.parse(text);
          text = parsed.text || '';
        } catch(e) {}
      }
      const tags = text.match(/#([a-zA-Z0-9ĞğÜüŞşİıÖöÇç_]+)/g);
      if (tags) {
        tags.forEach(t => {
          hashCounts[t] = (hashCounts[t] || 0) + 1;
        });
      }
    });

    const sorted = Object.entries(hashCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    if (sorted.length === 0) {
      container.innerHTML = `
        <div style="font-size:0.78rem; color:var(--text-muted); text-align:center; padding:0.5rem">
          Trend konu bulunmuyor. Gönderilerinizde #tag kullanın!
        </div>
      `;
      return;
    }

    container.innerHTML = sorted.map(item => `
      <div class="trending-item" data-tag="${ASDFL.escapeAttr(item.tag.substring(1))}">
        <span class="trending-tag">${escapeHtml(item.tag)}</span>
        <span class="trending-count">${item.count} gönderi</span>
      </div>
    `).join('');
  }

  async function loadActiveAlumni() {
    const container = document.getElementById('activeAlumniList');
    if (!container) return;

    const alumni = await ASDFL.fetchAlumni();
    if (!alumni || alumni.length === 0) {
      container.innerHTML = `<div style="font-size:0.78rem; color:var(--text-muted); text-align:center">Aktif üye bulunamadı.</div>`;
      return;
    }

    // İlk 4 aktif üyeyi al
    const list = alumni.slice(0, 4);

    container.innerHTML = list.map(a => {
      const academicTitle = a.academic_title || '';
      const fullName = (academicTitle ? academicTitle + ' ' : '') + a.name;
      const initials = a.initials || ASDFL.getInitials(a.name);
      const title = [a.job, a.grad_year ? a.grad_year + ' Mezunu' : null].filter(Boolean).join(' · ');

      return `
        <div class="active-alumni-item">
          ${ASDFL.getAvatarHTML({ initials, avatar_url: a.avatar_url, avatar_position: a.avatar_position, name: fullName }, 'active-alumni-avatar', 'width:34px;height:34px;font-size:0.75rem')}
          <div class="active-alumni-info">
            <span class="active-alumni-name">${escapeHtml(fullName)}</span>
            <span class="active-alumni-title">${escapeHtml(title)}</span>
          </div>
          <a href="profil.html?id=${encodeURIComponent(a.id)}" class="active-alumni-link">İncele</a>
        </div>
      `;
    }).join('');
    
    setTimeout(() => ASDFL.refreshIcons(), 10);
  }

  async function loadUpcomingEvents() {
    const container = document.getElementById('upcomingEventsMiniList');
    if (!container) return;

    const events = await ASDFL.fetchEvents();
    if (!events || events.length === 0) {
      container.innerHTML = `<div style="font-size:0.78rem; color:var(--text-muted); text-align:center">Yaklaşan etkinlik bulunamadı.</div>`;
      return;
    }

    // Gelecekteki etkinlikleri süz
    const upcoming = events
      .filter(e => new Date(e.date || e.event_date) >= new Date().setHours(0,0,0,0))
      .slice(0, 3);

    if (upcoming.length === 0) {
      container.innerHTML = `<div style="font-size:0.78rem; color:var(--text-muted); text-align:center">Yaklaşan etkinlik bulunamadı.</div>`;
      return;
    }

    container.innerHTML = upcoming.map(e => `
      <div class="mini-event-item">
        <span class="mini-event-date">${ASDFL.formatDate(e.date || e.event_date)}</span>
        <a href="etkinlikler.html" class="mini-event-title">${escapeHtml(e.title)}</a>
        <span class="mini-event-loc"><i data-lucide="map-pin" style="width:12px;height:12px"></i> ${escapeHtml(e.location || 'ASDFL')}</span>
      </div>
    `).join('');
    
    setTimeout(() => ASDFL.refreshIcons(), 10);
  }

  /* ---------- Helpers ---------- */
  function escapeHtml(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Az önce';
    if (m < 60) return m + ' dk önce';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' sa önce';
    const d = Math.floor(h / 24);
    return d + ' gün önce';
  }

  /* ---------- Rich Attachments State & Logic ---------- */
  
  // Triggers photo input when clicked
  window.handlePhotoClick = function() {
    if (!ASDFL.currentUser) {
      ASDFL.toast('Fotoğraf eklemek için giriş yapmalısınız.', 'warning');
      return;
    }
    const input = document.getElementById('composePhotoInput');
    if (input) input.click();
  };

  // Called when a photo is selected
  window.onPhotoSelected = async function(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      ASDFL.toast('Lütfen geçerli bir resim dosyası seçin.', 'error');
      return;
    }

    const previewArea = document.getElementById('composePreviewArea');
    if (!previewArea) return;

    previewArea.innerHTML = `
      <div class="text-center p-3">
        <div class="spinner" style="width:20px;height:20px;border-width:2px;display:inline-block"></div>
        <span style="font-size:0.8rem;color:var(--text-muted);margin-left:0.5rem">Fotoğraf yükleniyor...</span>
      </div>
    `;
    previewArea.classList.remove('hidden');

    try {
      let imageUrl = null;
      if (ASDFL.supabase) {
        imageUrl = await ASDFL.uploadImage(file, 'gallery');
      }
      
      // Fallback to local URL if Supabase is offline/errored
      if (!imageUrl) {
        imageUrl = URL.createObjectURL(file);
      }

      activeAttachment = { type: 'photo', value: imageUrl };
      window.cancelPollCreator(); // Poll builder'ı kapat
      renderAttachmentPreview();
    } catch (err) {
      console.error(err);
      ASDFL.toast('Görsel yüklenirken bir hata oluştu.', 'error');
      previewArea.classList.add('hidden');
      activeAttachment = null;
    }
  };

  // Opens Video URL attachment modal
  window.openVideoModal = function() {
    if (!ASDFL.currentUser) {
      ASDFL.toast('Video eklemek için giriş yapmalısınız.', 'warning');
      return;
    }
    const urlInput = document.getElementById('videoAttachUrl');
    if (urlInput) urlInput.value = '';
    ASDFL.openModal('videoAttachModal');
  };

  // Parses YouTube video ID from URL
  function getYoutubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  // Submits YouTube Video attachment
  window.submitVideoAttachment = function() {
    const urlInput = document.getElementById('videoAttachUrl');
    const url = urlInput?.value?.trim();
    if (!url) {
      ASDFL.toast('Lütfen bir YouTube bağlantısı girin.', 'warning');
      return;
    }

    const videoId = getYoutubeId(url);
    if (!videoId) {
      ASDFL.toast('Geçersiz YouTube bağlantısı. Lütfen doğru bir link girin.', 'error');
      return;
    }

    activeAttachment = { type: 'video', value: videoId };
    window.cancelPollCreator();
    ASDFL.closeModal('videoAttachModal');
    renderAttachmentPreview();
    ASDFL.toast('Video eklendi! 🎥', 'success');
  };

  // Opens Event Selection modal
  window.openEventModal = async function() {
    if (!ASDFL.currentUser) {
      ASDFL.toast('Etkinlik eklemek için giriş yapmalısınız.', 'warning');
      return;
    }
    ASDFL.openModal('eventAttachModal');
    
    const select = document.getElementById('eventAttachSelect');
    if (!select) return;

    select.innerHTML = '<option value="" disabled selected>Etkinlikler yükleniyor...</option>';

    try {
      const events = await ASDFL.fetchEvents();
      if (!events || events.length === 0) {
        select.innerHTML = '<option value="" disabled>Yaklaşan etkinlik bulunamadı.</option>';
        return;
      }

      select.innerHTML = '<option value="" disabled selected>Bir etkinlik seçin</option>' + 
        events.map(ev => `<option value="${ev.id}" data-title="${ev.title}" data-date="${ev.date || ev.event_date}" data-location="${ev.location || ''}">${ev.title} (${ASDFL.formatDate(ev.date || ev.event_date)})</option>`).join('');
    } catch(err) {
      console.error(err);
      select.innerHTML = '<option value="" disabled>Etkinlikler yüklenemedi.</option>';
    }
  };

  // Submits Selected Event attachment
  window.submitEventAttachment = function() {
    const select = document.getElementById('eventAttachSelect');
    if (!select || !select.value) {
      ASDFL.toast('Lütfen listeden bir etkinlik seçin.', 'warning');
      return;
    }

    const option = select.options[select.selectedIndex];
    const eventId = select.value;
    const title = option.getAttribute('data-title');
    const date = option.getAttribute('data-date');
    const location = option.getAttribute('data-location') || 'ASDFL';

    activeAttachment = {
      type: 'event',
      value: { id: eventId, title, date, location }
    };

    window.cancelPollCreator();
    ASDFL.closeModal('eventAttachModal');
    renderAttachmentPreview();
    ASDFL.toast('Etkinlik iliştirildi! 📅', 'success');
  };

  // Opens Anket Builder inside Compose Box (NEW)
  window.openPollCreator = function () {
    if (!ASDFL.currentUser) {
      ASDFL.toast('Anket oluşturmak için giriş yapmalısınız.', 'warning');
      return;
    }
    const builder = document.getElementById('pollBuilderArea');
    if (!builder) return;

    builder.classList.remove('hidden');
    document.getElementById('pollQuestionInput').value = '';
    pollOptions = ['', ''];
    renderPollOptionInputs();

    // Cancel other attachments
    activeAttachment = null;
    renderAttachmentPreview();
  };

  window.cancelPollCreator = function () {
    const builder = document.getElementById('pollBuilderArea');
    if (builder) builder.classList.add('hidden');
    pollOptions = [];
  };

  function renderPollOptionInputs() {
    const container = document.getElementById('pollOptionsContainer');
    if (!container) return;

    container.innerHTML = pollOptions.map((opt, index) => `
      <div class="poll-option-input-row" id="poll-opt-row-${index}">
        <input type="text" class="form-input poll-option-input" style="padding:0.45rem 0.75rem; font-size:0.84rem" placeholder="Seçenek ${index + 1}" value="${escapeHtml(opt)}" onchange="window.updatePollOptionText(${index}, this.value)">
        ${pollOptions.length > 2 ? `<button class="poll-option-remove" onclick="window.removePollOptionField(${index})" title="Seçeneği Sil">✕</button>` : ''}
      </div>
    `).join('');
  }

  window.updatePollOptionText = function(index, value) {
    pollOptions[index] = value;
  };

  window.addPollOptionField = function () {
    if (pollOptions.length >= 6) {
      ASDFL.toast('En fazla 6 seçenek ekleyebilirsiniz.', 'warning');
      return;
    }
    pollOptions.push('');
    renderPollOptionInputs();
  };

  window.removePollOptionField = function (index) {
    pollOptions.splice(index, 1);
    renderPollOptionInputs();
  };

  // Opens Feeling Selection modal
  window.openFeelingModal = function() {
    if (!ASDFL.currentUser) {
      ASDFL.toast('Hislerinizi eklemek için giriş yapmalısınız.', 'warning');
      return;
    }
    ASDFL.openModal('feelingAttachModal');
  };

  // Submits Feeling attachment
  window.submitFeelingAttachment = function(emoji, text) {
    activeFeeling = { emoji, text };
    ASDFL.closeModal('feelingAttachModal');
    renderAttachmentPreview();
    ASDFL.toast(`Modunuz eklendi: ${emoji} ${text}`, 'success');
  };

  // Removes active media attachment (photo/video/event)
  window.removeAttachment = function() {
    activeAttachment = null;
    renderAttachmentPreview();
  };

  // Removes active feeling attachment
  window.removeFeeling = function() {
    activeFeeling = null;
    renderAttachmentPreview();
  };

  // Renders the preview inside compose preview area
  function renderAttachmentPreview() {
    const previewArea = document.getElementById('composePreviewArea');
    if (!previewArea) return;

    if (!activeAttachment && !activeFeeling) {
      previewArea.classList.add('hidden');
      previewArea.innerHTML = '';
      return;
    }

    previewArea.classList.remove('hidden');
    let html = '';

    // Render feeling badge if active
    if (activeFeeling) {
      html += `
        <div style="margin-bottom: 0.75rem; text-align: left;">
          <div class="preview-feeling-badge">
            <span>${activeFeeling.emoji} ${activeFeeling.text} hissediyor</span>
            <span onclick="window.removeFeeling()" style="margin-left:0.5rem; cursor:pointer; opacity:0.7;" title="Hissi kaldır">✕</span>
          </div>
        </div>
      `;
    }

    // Render media attachment preview if active
    if (activeAttachment) {
      if (activeAttachment.type === 'photo') {
        html += `
          <div class="preview-item-wrapper">
            <button class="preview-remove-btn" onclick="window.removeAttachment()" title="Fotoğrafı Kaldır">✕</button>
            <img src="${activeAttachment.value}" alt="Önizleme">
          </div>
        `;
      } else if (activeAttachment.type === 'video') {
        html += `
          <div class="preview-item-wrapper" style="width: 100%;">
            <button class="preview-remove-btn" onclick="window.removeAttachment()" title="Videoyu Kaldır">✕</button>
            <div class="preview-video-container">
              <iframe src="https://www.youtube.com/embed/${activeAttachment.value}" frameborder="0" allowfullscreen></iframe>
            </div>
          </div>
        `;
      } else if (activeAttachment.type === 'event') {
        html += `
          <div class="preview-event-card">
            <div class="preview-event-icon"><i data-lucide="calendar"></i></div>
            <div class="preview-event-info">
              <h4 class="preview-event-title">${activeAttachment.value.title}</h4>
              <div class="preview-event-meta">
                <span>📅 ${ASDFL.formatDate(activeAttachment.value.date)}</span>
                <span>📍 ${activeAttachment.value.location}</span>
              </div>
            </div>
            <button class="preview-remove-btn" style="position:static; margin-left: auto;" onclick="window.removeAttachment()" title="Etkinliği Kaldır">✕</button>
          </div>
        `;
      }
    }

    previewArea.innerHTML = html;
    setTimeout(() => ASDFL.refreshIcons(), 10);
  }

  let lightboxReturnFocus = null;

  function initLightboxAccessibility() {
    document.addEventListener('keydown', (event) => {
      const lightbox = document.getElementById('imageLightbox');
      if (!lightbox?.classList.contains('open')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        window.closeImageLightbox();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        document.getElementById('lightboxCloseBtn')?.focus();
      }
    });
  }

  // Opens Image Lightbox
  window.openImageLightbox = function(src) {
    const lightbox = document.getElementById('imageLightbox');
    const img = document.getElementById('lightboxImg');
    const safeSrc = ASDFL.safeURL(src, { allowBlob: true });
    if (lightbox && img && safeSrc) {
      lightboxReturnFocus = document.activeElement;
      img.src = safeSrc;
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.classList.add('community-lightbox-open');
      document.getElementById('lightboxCloseBtn')?.focus({ preventScroll: true });
    }
  };

  window.closeImageLightbox = function() {
    const lightbox = document.getElementById('imageLightbox');
    const img = document.getElementById('lightboxImg');
    if (!lightbox) return;
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('community-lightbox-open');
    if (img) img.removeAttribute('src');
    if (lightboxReturnFocus instanceof HTMLElement) lightboxReturnFocus.focus({ preventScroll: true });
    lightboxReturnFocus = null;
  };

  function initComposeAttachments() {
    activeAttachment = null;
    activeFeeling = null;
  }

  /* ---------- @Mention Autocomplete ---------- */
  let activeMentions = [];
  let mentionCandidates = null;

  async function getMentionCandidates() {
    if (mentionCandidates) return mentionCandidates;
    try {
      const alumni = await ASDFL.fetchAlumni({ limit: 200 });
      mentionCandidates = (alumni || []).filter(a => a.name);
    } catch (e) {
      mentionCandidates = [];
    }
    return mentionCandidates;
  }

  function initMentionAutocomplete() {
    const textarea = document.getElementById('toplulukContent');
    if (!textarea) return;
    let box = document.getElementById('mentionSuggestBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'mentionSuggestBox';
      box.className = 'mention-suggest hidden';
      textarea.parentElement.insertBefore(box, textarea.nextSibling);
    }

    textarea.addEventListener('input', async () => {
      const caret = textarea.selectionStart;
      const before = textarea.value.slice(0, caret);
      const match = before.match(/@([\p{L}0-9._-]{1,30}(?: [\p{L}0-9._-]{0,30})?)$/u);
      if (!match) { box.classList.add('hidden'); return; }
      const q = match[1].toLocaleLowerCase('tr');
      const candidates = (await getMentionCandidates())
        .filter(a => a.name.toLocaleLowerCase('tr').includes(q))
        .slice(0, 5);
      if (!candidates.length) { box.classList.add('hidden'); return; }
      box.innerHTML = candidates.map(a => `
        <button type="button" class="mention-suggest-item" onclick="window.pickMention(${ASDFL.jsString(a.id)}, ${ASDFL.jsString(a.name)})">
          ${ASDFL.getAvatarHTML(a, 'mention-suggest-avatar', 'width:26px;height:26px;font-size:0.65rem;border-radius:6px')}
          <span>${escapeHtml(a.name)}</span>
          <small>${escapeHtml(a.grad_year ? a.grad_year + ' Mezunu' : (a.job || ''))}</small>
        </button>`).join('');
      box.classList.remove('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!box.contains(e.target) && e.target !== textarea) box.classList.add('hidden');
    });
  }

  window.pickMention = function (id, name) {
    const textarea = document.getElementById('toplulukContent');
    const box = document.getElementById('mentionSuggestBox');
    if (!textarea) return;
    const caret = textarea.selectionStart;
    const before = textarea.value.slice(0, caret)
      .replace(/@[\p{L}0-9._-]{0,30}(?: [\p{L}0-9._-]{0,30})?$/u, '@' + name + ' ');
    textarea.value = before + textarea.value.slice(caret);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = before.length;
    if (!activeMentions.some(m => m.id === id)) activeMentions.push({ id, name });
    if (box) box.classList.add('hidden');
  };

  /* ---------- Canlı Akış (Realtime) ---------- */
  let pendingNewPosts = 0;
  let feedRealtimeChannel = null;

  function ensureNewPostsBanner() {
    let banner = document.getElementById('newPostsBanner');
    if (banner) return banner;
    const feed = document.getElementById('feedPosts');
    if (!feed) return null;
    banner = document.createElement('button');
    banner.id = 'newPostsBanner';
    banner.className = 'new-posts-banner hidden';
    banner.onclick = async () => {
      await loadFeed(currentFeed);
      feed.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'start' });
    };
    feed.parentElement.insertBefore(banner, feed);
    return banner;
  }

  function matchesCurrentFeed(post) {
    if (currentFeed === 'global') return post.target_year == null && post.target_section == null;
    if (currentFeed === 'year') return post.target_year == myProfile?.grad_year && post.target_section == null;
    return post.target_year == myProfile?.grad_year && post.target_section === myProfile?.class_section;
  }

  function subscribeFeedRealtime() {
    if (!ASDFL.supabase || typeof ASDFL.supabase.channel !== 'function' || feedRealtimeChannel) return;
    feedRealtimeChannel = ASDFL.supabase
      .channel('community-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
        const post = payload.new;
        if (!post || post.author_id === ASDFL.currentUser?.id) return;
        if (!matchesCurrentFeed(post)) return;
        pendingNewPosts++;
        const banner = ensureNewPostsBanner();
        if (banner) {
          banner.innerHTML = `<i data-lucide="arrow-up" style="width:1rem;height:1rem"></i> ${pendingNewPosts} yeni paylaşım — görmek için tıkla`;
          banner.classList.remove('hidden');
          setTimeout(() => ASDFL.refreshIcons(banner), 10);
        }
      })
      .subscribe();
  }
})();
