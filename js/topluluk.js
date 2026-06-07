/* =====================================================
   js/topluluk.js — Topluluk Sayfası Mantığı
   - Global / Yıla Özel / Şubeye Özel akışlar
   - Beğeni (Like) sistemi
   - Gönderi oluşturma
   ===================================================== */

(function () {
  let currentFeed = 'global'; // 'global' | 'year' | 'section'
  let myProfile = null;
  let likedPosts = new Set();
  let activeAttachment = null; // { type: 'photo'|'video'|'event', value: ... }
  let activeFeeling = null;     // { emoji: '🥳', text: 'Heyecanlı' }

  /* ---------- Başlat ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    await ASDFL.waitForAuth();
    
    // Toggle compose box and login prompt based on resolved auth state
    const isLoggedIn = !!ASDFL.currentUser;
    const composeBox = document.getElementById('composeBox');
    const loginPrompt = document.getElementById('loginPrompt');
    if (composeBox) {
      composeBox.classList.toggle('hidden', !isLoggedIn);
    }
    if (loginPrompt) {
      loginPrompt.classList.toggle('hidden', isLoggedIn);
    }
    if (isLoggedIn && composeBox) {
      const composeAvatar = document.getElementById('composeAvatar');
      if (composeAvatar) {
        ASDFL.setAvatarElement(composeAvatar, ASDFL.currentUser);
      }
    }

    await loadMyProfile();
    buildSidebar();
    await loadFeed('global');
    initComposeAttachments();
  });

  async function loadMyProfile() {
    if (!ASDFL.currentUser || !ASDFL.supabase) return;
    const { data } = await ASDFL.supabase
      .from('profiles')
      .select('*')
      .eq('id', ASDFL.currentUser.id)
      .single();
    myProfile = data;

    // Load my liked posts
    const { data: likes } = await ASDFL.supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', ASDFL.currentUser.id);
    if (likes) likes.forEach(l => likedPosts.add(l.post_id));
  }

  /* ---------- Sidebar ---------- */
  function buildSidebar() {
    const sidebar = document.getElementById('feedSidebar');
    if (!sidebar) return;

    const user = ASDFL.currentUser;
    const gradYear = myProfile?.grad_year || user?.gradYear;
    const section = myProfile?.class_section || user?.classSection;

    sidebar.innerHTML = `
      <div class="feed-channel ${currentFeed === 'global' ? 'active' : ''}" onclick="window.switchFeed('global', this)">
        <i data-lucide="globe" style="width:1.1rem;height:1.1rem"></i>
        <span>Genel Akış</span>
      </div>
      ${gradYear ? `
      <div class="feed-channel ${currentFeed === 'year' ? 'active' : ''}" onclick="window.switchFeed('year', this)">
        <i data-lucide="graduation-cap" style="width:1.1rem;height:1.1rem"></i>
        <span>${gradYear} Mezunları</span>
      </div>` : ''}
      ${(gradYear && section) ? `
      <div class="feed-channel ${currentFeed === 'section' ? 'active' : ''}" onclick="window.switchFeed('section', this)">
        <i data-lucide="users" style="width:1.1rem;height:1.1rem"></i>
        <span>${gradYear}-${section} Sınıfı</span>
      </div>` : ''}
    `;
    setTimeout(() => lucide.createIcons(), 10);
  }

  /* ---------- Feed Switch ---------- */
  window.switchFeed = async function (type, el) {
    currentFeed = type;
    document.querySelectorAll('.feed-channel').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
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

    if (!ASDFL.currentUser) {
      container.innerHTML = `
        <div class="feed-empty">
          <i data-lucide="lock" style="width:3rem;height:3rem;opacity:.5;color:var(--gold-500);margin-bottom:1rem"></i>
          <p style="color:var(--text-secondary);font-size:1rem;font-weight:500">Paylaşımları görebilmek için giriş yapmalısınız.</p>
        </div>
      `;
      setTimeout(() => lucide.createIcons(), 10);
      return;
    }

    if (!ASDFL.supabase) {
      container.innerHTML = '<div class="feed-empty">Supabase bağlantısı kurulamadı.</div>';
      return;
    }

    let query = ASDFL.supabase
      .from('posts')
      .select(`
        id, content, likes_count, created_at, target_year, target_section,
        profiles!author_id (id, name, job, grad_year, class_section, avatar_url, avatar_position),
        post_comments(id)
      `)
      .order('created_at', { ascending: false })
      .limit(30);

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

    const { data: posts, error } = await query;
    if (error || !posts || posts.length === 0) {
      container.innerHTML = `<div class="feed-empty"><i data-lucide="message-circle" style="width:3rem;height:3rem;opacity:.3"></i><p>Henüz paylaşım yok. İlk paylaşımı sen yap!</p></div>`;
      setTimeout(() => lucide.createIcons(), 10);
      return;
    }

    container.innerHTML = posts.map(post => renderPost(post)).join('');
    setTimeout(() => lucide.createIcons(), 10);
  }

  function renderPost(post) {
    const author = post.profiles;
    const name = author?.name || 'Anonim';
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const meta = [
      author?.job,
      author?.grad_year ? author.grad_year + ' Mezunu' : null,
      author?.class_section ? author.class_section + ' Şubesi' : null
    ].filter(Boolean).join(' · ');
    const time = timeAgo(post.created_at);
    const liked = likedPosts.has(post.id);

    const audienceBadge = post.target_section
      ? `<span class="post-audience"><i data-lucide="users" style="width:.85rem;height:.85rem"></i> ${post.target_year}-${post.target_section}</span>`
      : post.target_year
      ? `<span class="post-audience"><i data-lucide="graduation-cap" style="width:.85rem;height:.85rem"></i> ${post.target_year} Mezunları</span>`
      : '';

    let commentCount = 0;
    if (ASDFL.supabase) {
      commentCount = post.post_comments ? post.post_comments.length : 0;
    } else {
      let allComments = JSON.parse(localStorage.getItem('asdfl_post_comments') || '[]');
      commentCount = allComments.filter(c => c.post_id === post.id).length;
    }

    // Parse Rich Content
    let postText = post.content || '';
    let attachmentHtml = '';
    let feelingHtml = '';

    if (postText.trim().startsWith('{') && postText.trim().endsWith('}')) {
      try {
        const parsed = JSON.parse(postText);
        if (parsed.richPost) {
          postText = parsed.text || '';
          
          if (parsed.feeling) {
            feelingHtml = `<span class="feeling-text">— ${parsed.feeling.emoji} ${parsed.feeling.text} hissediyor</span>`;
          }

          if (parsed.attachment) {
            const att = parsed.attachment;
            if (att.type === 'photo') {
              attachmentHtml = `
                <div class="post-media-attachment">
                  <img src="${att.value}" alt="Paylaşım görseli" onclick="window.openImageLightbox('${att.value}')">
                </div>
              `;
            } else if (att.type === 'video') {
              attachmentHtml = `
                <div class="post-media-attachment video-attachment">
                  <iframe src="https://www.youtube.com/embed/${att.value}" frameborder="0" allowfullscreen></iframe>
                </div>
              `;
            } else if (att.type === 'event') {
              attachmentHtml = `
                <div class="post-media-attachment">
                  <div class="event-attach-card">
                    <div class="event-attach-icon"><i data-lucide="calendar"></i></div>
                    <div class="event-attach-info">
                      <h4 class="event-attach-title">${att.value.title}</h4>
                      <div class="event-attach-meta">
                        <span><i data-lucide="calendar-days"></i> ${ASDFL.formatDate(att.value.date)}</span>
                        <span><i data-lucide="map-pin"></i> ${att.value.location}</span>
                      </div>
                    </div>
                    <a href="etkinlikler.html" class="btn btn-secondary btn-sm event-attach-btn">Etkinliğe Git</a>
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

    return `
      <div class="post-card" id="post-${post.id}">
        <div class="post-header">
          ${ASDFL.getAvatarHTML({ initials, avatar_url: author?.avatar_url, avatar_position: author?.avatar_position, name }, 'post-avatar')}
          <div class="post-meta">
            <strong class="post-author" style="display:inline-block">${name} ${feelingHtml}</strong>
            <span class="post-submeta">${meta}</span>
          </div>
          <div class="post-time-audience">
            <span class="post-time">${time}</span>
            ${audienceBadge}
          </div>
        </div>
        <div class="post-body">${escapeHtml(postText)} ${attachmentHtml}</div>
        <div class="post-actions">
          <button class="post-action-btn ${liked ? 'liked' : ''}" onclick="window.toggleLike('${post.id}', this)" id="like-${post.id}">
            <i data-lucide="heart" style="width:1.1rem;height:1.1rem"></i>
            <span class="like-count">${post.likes_count || 0}</span>
          </button>
          <button class="post-action-btn" onclick="window.toggleComments('${post.id}', this)" id="comment-btn-${post.id}">
            <i data-lucide="message-square" style="width:1.1rem;height:1.1rem"></i>
            <span class="comment-count">${commentCount}</span> Yorum
          </button>
          <button class="post-action-btn" onclick="window.sharePost('${post.id}')">
            <i data-lucide="share-2" style="width:1.1rem;height:1.1rem"></i>
            <span>Paylaş</span>
          </button>
        </div>
        
        <!-- YORUMLAR PANELİ -->
        <div class="comments-section hidden" id="comments-section-${post.id}">
          <div class="comments-list" id="comments-list-${post.id}"></div>
          <div class="comment-compose">
            ${ASDFL.getAvatarHTML(ASDFL.currentUser, 'comment-avatar', 'width:30px;height:30px;font-size:0.7rem')}
            <input type="text" class="comment-input" placeholder="Yorum yaz ve Enter'a bas..." id="comment-input-${post.id}" onkeydown="if(event.key==='Enter')window.submitCommentAction('${post.id}')">
            <button class="btn btn-primary btn-sm" style="padding:0.35rem 0.85rem;font-size:0.8rem;border-radius:var(--radius-full)" onclick="window.submitCommentAction('${post.id}')">Gönder</button>
          </div>
        </div>
      </div>
    `;
  }

  /* ---------- Like ---------- */
  window.toggleLike = async function (postId, btn) {
    if (!ASDFL.currentUser) { ASDFL.toast('Beğenmek için giriş yapmalısın!', 'warning'); return; }

    const alreadyLiked = likedPosts.has(postId);
    const countEl = btn.querySelector('.like-count');
    let count = parseInt(countEl.textContent);

    if (alreadyLiked) {
      likedPosts.delete(postId);
      btn.classList.remove('liked');
      count = Math.max(0, count - 1);
      await ASDFL.supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', ASDFL.currentUser.id);
      await ASDFL.supabase.from('posts').update({ likes_count: count }).eq('id', postId);
    } else {
      likedPosts.add(postId);
      btn.classList.add('liked');
      count += 1;
      await ASDFL.supabase.from('post_likes').insert({ post_id: postId, user_id: ASDFL.currentUser.id });
      await ASDFL.supabase.from('posts').update({ likes_count: count }).eq('id', postId);
    }

    countEl.textContent = count;
    // Animate
    btn.style.transform = 'scale(1.25)';
    setTimeout(() => { btn.style.transform = ''; }, 200);
  };

  /* ---------- Share ---------- */
  window.sharePost = function (postId) {
    const url = window.location.origin + window.location.pathname + '#post-' + postId;
    navigator.clipboard.writeText(url).then(() => {
      ASDFL.toast('Bağlantı panoya kopyalandı!', 'success');
    }).catch(() => {
      ASDFL.toast('Kopyalanamadı, lütfen URL\'yi manuel kopyalayın.', 'info');
    });
  };

  /* ---------- Create Post ---------- */
  window.handleToplulukPost = async function () {
    if (!ASDFL.currentUser) { ASDFL.toast('Paylaşım yapmak için giriş yapmalısınız!', 'warning'); return; }

    const content = document.getElementById('toplulukContent')?.value?.trim();
    if (!content && !activeAttachment) { ASDFL.toast('Lütfen bir şeyler yazın veya bir medya ekleyin!', 'warning'); return; }

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

    let finalContent = content;
    if (activeAttachment || activeFeeling) {
      finalContent = JSON.stringify({
        richPost: true,
        text: content,
        attachment: activeAttachment,
        feeling: activeFeeling
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
      renderAttachmentPreview();
      ASDFL.toast('Paylaşımın yayınlandı! 🚀', 'success');
      await loadFeed(currentFeed);
    }

    btn.disabled = false;
    btn.innerHTML = 'Paylaş <i data-lucide="send" style="width:1em;height:1em"></i>';
    setTimeout(() => lucide.createIcons(), 10);
  };

  /* ---------- Audience Change ---------- */
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

    if (!isHidden) {
      await loadComments(postId);
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
      return `
        <div class="comment-item">
          ${ASDFL.getAvatarHTML({ initials: c.initials, avatar_url: c.authorAvatarUrl, avatar_position: c.authorAvatarPosition, name: c.authorName }, 'comment-avatar')}
          <div class="comment-content-area">
            <div class="comment-author-row">
              <strong class="comment-author-name">${c.authorName}</strong>
              <span class="comment-author-meta">${c.authorMeta}</span>
              <span class="comment-time">${timeAgo(c.created_at)}</span>
            </div>
            <p class="comment-text">${escapeHtml(c.content)}</p>
          </div>
        </div>
      `;
    }).join('');
    
    setTimeout(() => lucide.createIcons(), 10);
  }

  async function getCommentsForPost(postId) {
    if (ASDFL.supabase) {
      const { data, error } = await ASDFL.supabase
        .from('post_comments')
        .select('*, profiles!author_id(name, grad_year, class_section, job, avatar_url, avatar_position)')
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
        authorName: c.profiles?.name || 'Anonim',
        authorAvatarUrl: c.profiles?.avatar_url || '',
        authorAvatarPosition: c.profiles?.avatar_position || '',
        authorMeta: [
          c.profiles?.job,
          c.profiles?.grad_year ? c.profiles.grad_year + ' Mezunu' : null
        ].filter(Boolean).join(' · '),
        initials: ASDFL.getInitials(c.profiles?.name || 'U')
      }));
    } else {
      let allComments = JSON.parse(localStorage.getItem('asdfl_post_comments') || '[]');
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
        .select('*, profiles!author_id(name, grad_year, class_section, job, avatar_url, avatar_position)')
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
        authorName: data.profiles?.name || 'Anonim',
        authorAvatarUrl: data.profiles?.avatar_url || '',
        authorAvatarPosition: data.profiles?.avatar_position || '',
        authorMeta: [
          data.profiles?.job,
          data.profiles?.grad_year ? data.profiles.grad_year + ' Mezunu' : null
        ].filter(Boolean).join(' · '),
        initials: ASDFL.getInitials(data.profiles?.name || 'U')
      };
    } else {
      let allComments = JSON.parse(localStorage.getItem('asdfl_post_comments') || '[]');
      const newComment = {
        id: Math.random().toString(36).substring(2),
        post_id: postId,
        author_id: ASDFL.currentUser.id,
        content: content,
        created_at: new Date().toISOString(),
        authorName: ASDFL.currentUser.name,
        authorAvatarUrl: ASDFL.currentUser.avatar_url || ASDFL.currentUser.avatarUrl || '',
        authorAvatarPosition: ASDFL.currentUser.avatar_position || '50% 50%',
        authorMeta: [
          ASDFL.currentUser.job,
          ASDFL.currentUser.gradYear ? ASDFL.currentUser.gradYear + ' Mezunu' : null
        ].filter(Boolean).join(' · '),
        initials: ASDFL.getInitials(ASDFL.currentUser.name)
      };
      allComments.push(newComment);
      localStorage.setItem('asdfl_post_comments', JSON.stringify(allComments));
      return newComment;
    }
  }

  /* ---------- Helpers ---------- */
  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
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

    ASDFL.closeModal('eventAttachModal');
    renderAttachmentPreview();
    ASDFL.toast('Etkinlik iliştirildi! 📅', 'success');
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
    setTimeout(() => lucide.createIcons(), 10);
  }

  // Opens Image Lightbox
  window.openImageLightbox = function(src) {
    const lightbox = document.getElementById('imageLightbox');
    const img = document.getElementById('lightboxImg');
    if (lightbox && img) {
      img.src = src;
      lightbox.classList.add('open');
    }
  };

  function initComposeAttachments() {
    activeAttachment = null;
    activeFeeling = null;
  }
})();
