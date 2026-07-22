(function () {
  'use strict';

  if (window.ASDFLMessenger?.__initialized) return;

  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const POLL_INTERVAL_MS = 30000;
  const MESSAGE_LIMIT = 2000;
  const REPORT_LIMIT = 500;
  const IS_MESSAGES_PAGE = (window.location.pathname.split('/').pop() || '').toLocaleLowerCase('tr-TR') === 'mesajlar.html';

  const state = {
    userId: null,
    conversations: [],
    selectedId: null,
    messages: new Map(),
    root: null,
    refs: {},
    isOpen: false,
    view: 'list',
    sending: false,
    modalAction: null,
    channel: null,
    pollTimer: null,
    pollBusy: false,
    sessionPromise: null,
    authEpoch: 0,
    conversationToken: 0,
    messageToken: 0,
    searchToken: 0,
    searchTimer: null,
    toastTimer: null,
    keydownHandler: null,
    documentClickHandler: null
  };

  const api = {
    __initialized: true,
    open: openWidget,
    openForUser,
    syncAuth: syncAuthSnapshot,
    close: () => closePanel(false),
    destroy: destroyWidget
  };
  window.ASDFLMessenger = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }

  function initialize() {
    if (IS_MESSAGES_PAGE || !window.ASDFL) return;
    window.addEventListener('asdfl:auth-changed', syncSession);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    state.documentClickHandler = event => {
      const trigger = event.target.closest?.('[data-messenger-user]');
      const targetUserId = trigger?.dataset.messengerUser;
      if (!isUUID(targetUserId) || !state.userId || !state.root) return;
      event.preventDefault();
      openForUser(targetUserId);
    };
    document.addEventListener('click', state.documentClickHandler);
    window.addEventListener('beforeunload', cleanupLiveUpdates, { once: true });
    syncSession();
  }

  async function syncSession() {
    if (IS_MESSAGES_PAGE || !window.ASDFL) return false;
    await ASDFL.waitForAuth();
    return syncAuthSnapshot(ASDFL.currentUser, ASDFL.authReady);
  }

  function syncAuthSnapshot(user, authReady) {
    if (IS_MESSAGES_PAGE || !window.ASDFL) return Promise.resolve(false);
    if (!authReady) {
      state.authEpoch += 1;
      teardownSession();
      return Promise.resolve(false);
    }
    const nextUserId = user?.id;
    if (!isUUID(nextUserId) || !ASDFL.supabase) {
      state.authEpoch += 1;
      teardownSession();
      return Promise.resolve(false);
    }
    if (state.userId === nextUserId && state.root) return Promise.resolve(true);
    if (state.sessionPromise) {
      return state.sessionPromise.then(() => (
        state.userId === nextUserId && state.root
          ? true
          : syncAuthSnapshot(user, authReady)
      ));
    }

    const authEpoch = ++state.authEpoch;
    state.sessionPromise = (async () => {
      try {
        teardownSession();
        const verifiedResult = await timed(ASDFL.supabase.auth.getUser());
        const verifiedUserId = verifiedResult?.data?.user?.id;
        if (authEpoch !== state.authEpoch || verifiedResult?.error || verifiedUserId !== nextUserId) {
          if (authEpoch === state.authEpoch) teardownSession();
          return false;
        }
        state.userId = nextUserId;
        mountWidget();
        await loadConversations();
        if (authEpoch !== state.authEpoch || state.userId !== nextUserId || !state.root) return false;
        setupLiveUpdates();
        return true;
      } catch (error) {
        if (authEpoch === state.authEpoch) teardownSession();
        return false;
      }
    })().finally(() => { state.sessionPromise = null; });
    return state.sessionPromise;
  }

  function mountWidget() {
    if (state.root || !state.userId) return;
    const root = document.createElement('div');
    root.id = 'asdflMessengerWidget';
    root.className = 'asdfl-mw-root';
    root.setAttribute('aria-label', 'ASDFL Messenger');
    root.innerHTML = `
      <button class="asdfl-mw-launcher" type="button" data-action="toggle" aria-label="Mesajları aç" aria-expanded="false">
        <i data-lucide="messages-square" aria-hidden="true"></i>
        <span class="asdfl-mw-badge asdfl-mw-hidden" aria-label="Okunmamış mesajlar">0</span>
      </button>
      <section class="asdfl-mw-panel asdfl-mw-hidden" aria-label="Hızlı mesajlar" aria-hidden="true">
        <div class="asdfl-mw-view asdfl-mw-list-view">
          <header class="asdfl-mw-header">
            <div class="asdfl-mw-title-wrap">
              <span class="asdfl-mw-kicker">ASDFL Messenger</span>
              <strong class="asdfl-mw-title">Mesajlar</strong>
            </div>
            <button class="asdfl-mw-icon-button asdfl-mw-new-message" type="button" data-action="new-message" aria-label="Yeni mesaj başlat" title="Yeni mesaj">
              <i data-lucide="square-pen" aria-hidden="true"></i>
            </button>
            <a class="asdfl-mw-icon-button asdfl-mw-inbox-link" href="mesajlar.html" aria-label="Tüm mesajları aç" title="Tüm mesajlar">
              <i data-lucide="expand" aria-hidden="true"></i>
            </a>
            <button class="asdfl-mw-icon-button" type="button" data-action="minimize" aria-label="Messenger'ı küçült">
              <i data-lucide="minus" aria-hidden="true"></i>
            </button>
          </header>
          <div class="asdfl-mw-search-view asdfl-mw-hidden">
            <div class="asdfl-mw-search-bar">
              <button class="asdfl-mw-icon-button" type="button" data-action="search-back" aria-label="Konuşmalara dön">
                <i data-lucide="arrow-left" aria-hidden="true"></i>
              </button>
              <div class="asdfl-mw-search-input-wrap">
                <i data-lucide="search" aria-hidden="true"></i>
                <label class="asdfl-mw-sr-only" for="asdflMessengerSearch">Mesaj göndermek için kişi ara</label>
                <input id="asdflMessengerSearch" type="search" maxlength="80" autocomplete="off" placeholder="İsimle kişi ara…">
              </div>
            </div>
            <div class="asdfl-mw-search-status" role="status">Aramak için en az 2 karakter yazın.</div>
            <div class="asdfl-mw-search-results"></div>
          </div>
          <div class="asdfl-mw-list-status" role="status">Konuşmalar yükleniyor…</div>
          <div class="asdfl-mw-list"></div>
        </div>

        <div class="asdfl-mw-view asdfl-mw-chat-view asdfl-mw-hidden">
          <header class="asdfl-mw-header">
            <button class="asdfl-mw-icon-button" type="button" data-action="back" aria-label="Konuşma listesine dön">
              <i data-lucide="arrow-left" aria-hidden="true"></i>
            </button>
            <span class="asdfl-mw-avatar asdfl-mw-chat-avatar" aria-hidden="true">?</span>
            <div class="asdfl-mw-title-wrap">
              <strong class="asdfl-mw-title asdfl-mw-chat-name">Konuşma</strong>
              <span class="asdfl-mw-subtitle asdfl-mw-chat-role">ASDFL üyesi</span>
            </div>
            <div class="asdfl-mw-chat-actions">
              <button class="asdfl-mw-icon-button asdfl-mw-block-button" type="button" data-action="block" aria-label="Kullanıcıyı engelle" title="Engelle">
                <i data-lucide="shield-ban" aria-hidden="true"></i>
              </button>
              <a class="asdfl-mw-icon-button asdfl-mw-inbox-link asdfl-mw-thread-link" href="mesajlar.html" aria-label="Konuşmayı geniş gelen kutusunda aç" title="Genişlet">
                <i data-lucide="expand" aria-hidden="true"></i>
              </a>
              <button class="asdfl-mw-icon-button" type="button" data-action="minimize" aria-label="Messenger'ı küçült">
                <i data-lucide="minus" aria-hidden="true"></i>
              </button>
              <button class="asdfl-mw-icon-button" type="button" data-action="close-chat" aria-label="Konuşmayı kapat">
                <i data-lucide="x" aria-hidden="true"></i>
              </button>
            </div>
          </header>
          <div class="asdfl-mw-notice asdfl-mw-hidden" role="status"></div>
          <div class="asdfl-mw-messages" role="log" aria-live="polite" aria-relevant="additions text"></div>
          <form class="asdfl-mw-composer" novalidate>
            <div class="asdfl-mw-input-wrap">
              <label class="asdfl-mw-sr-only" for="asdflMessengerInput">Mesajınız</label>
              <textarea id="asdflMessengerInput" rows="1" maxlength="2000" placeholder="Bir mesaj yaz…"></textarea>
              <span class="asdfl-mw-count">0 / 2000</span>
            </div>
            <button class="asdfl-mw-send" type="submit" aria-label="Mesajı gönder" disabled>
              <i data-lucide="send" aria-hidden="true"></i>
            </button>
          </form>
        </div>

        <div class="asdfl-mw-modal asdfl-mw-hidden" role="dialog" aria-modal="true" aria-labelledby="asdflMwModalTitle">
          <div class="asdfl-mw-modal-card">
            <h3 id="asdflMwModalTitle">Onay</h3>
            <p class="asdfl-mw-modal-copy"></p>
            <div class="asdfl-mw-report-fields asdfl-mw-hidden">
              <label for="asdflMwReportReason">Şikâyet nedeni</label>
              <textarea id="asdflMwReportReason" rows="4" maxlength="500" placeholder="Rahatsız edici içerik, istenmeyen iletişim…"></textarea>
              <div class="asdfl-mw-modal-meta"><span class="asdfl-mw-report-count">0 / 500</span></div>
            </div>
            <div class="asdfl-mw-modal-actions">
              <button type="button" data-action="modal-cancel">Vazgeç</button>
              <button class="is-primary asdfl-mw-modal-confirm" type="button" data-action="modal-confirm">Onayla</button>
            </div>
          </div>
        </div>
        <div class="asdfl-mw-toast" role="status" aria-live="polite"></div>
      </section>
    `;

    document.body.appendChild(root);
    state.root = root;
    cacheRefs();
    bindWidgetEvents();
    refreshIcons(root);
    renderConversationList();
  }

  function cacheRefs() {
    const q = selector => state.root.querySelector(selector);
    state.refs = {
      launcher: q('.asdfl-mw-launcher'),
      badge: q('.asdfl-mw-badge'),
      panel: q('.asdfl-mw-panel'),
      listView: q('.asdfl-mw-list-view'),
      newMessage: q('.asdfl-mw-new-message'),
      searchView: q('.asdfl-mw-search-view'),
      searchInput: q('#asdflMessengerSearch'),
      searchStatus: q('.asdfl-mw-search-status'),
      searchResults: q('.asdfl-mw-search-results'),
      listStatus: q('.asdfl-mw-list-status'),
      list: q('.asdfl-mw-list'),
      chatView: q('.asdfl-mw-chat-view'),
      chatAvatar: q('.asdfl-mw-chat-avatar'),
      chatName: q('.asdfl-mw-chat-name'),
      chatRole: q('.asdfl-mw-chat-role'),
      threadLink: q('.asdfl-mw-thread-link'),
      blockButton: q('.asdfl-mw-block-button'),
      notice: q('.asdfl-mw-notice'),
      messages: q('.asdfl-mw-messages'),
      composer: q('.asdfl-mw-composer'),
      input: q('#asdflMessengerInput'),
      count: q('.asdfl-mw-count'),
      send: q('.asdfl-mw-send'),
      modal: q('.asdfl-mw-modal'),
      modalTitle: q('#asdflMwModalTitle'),
      modalCopy: q('.asdfl-mw-modal-copy'),
      reportFields: q('.asdfl-mw-report-fields'),
      reportReason: q('#asdflMwReportReason'),
      reportCount: q('.asdfl-mw-report-count'),
      modalConfirm: q('.asdfl-mw-modal-confirm'),
      toast: q('.asdfl-mw-toast')
    };
  }

  function bindWidgetEvents() {
    state.root.addEventListener('click', handleRootClick);
    state.refs.composer.addEventListener('submit', sendMessage);
    state.refs.input.addEventListener('input', updateComposerMetrics);
    state.refs.searchInput.addEventListener('input', scheduleProfileSearch);
    state.refs.input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        state.refs.composer.requestSubmit();
      }
    });
    state.refs.reportReason.addEventListener('input', () => {
      state.refs.reportCount.textContent = `${state.refs.reportReason.value.length} / ${REPORT_LIMIT}`;
    });
    state.keydownHandler = event => {
      if (event.key !== 'Escape') return;
      if (!state.refs.modal.classList.contains('asdfl-mw-hidden')) closeModal();
      else if (state.view === 'search') showListView({ focusNewMessage: true });
      else if (state.isOpen) closePanel(false);
    };
    document.addEventListener('keydown', state.keydownHandler);
  }

  function handleRootClick(event) {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'toggle') state.isOpen ? closePanel(false) : openWidget();
    if (action === 'minimize') closePanel(false);
    if (action === 'back') showListView();
    if (action === 'new-message') showProfileSearch();
    if (action === 'search-back') showListView({ focusNewMessage: true });
    if (action === 'close-chat') closePanel(true);
    if (action === 'block') openBlockModal();
    if (action === 'modal-cancel') closeModal();
    if (action === 'modal-confirm') confirmModalAction();

    const conversationButton = event.target.closest('[data-conversation-id]');
    if (isUUID(conversationButton?.dataset.conversationId)) openConversation(conversationButton.dataset.conversationId);

    const reportButton = event.target.closest('[data-report-message-id]');
    if (isUUID(reportButton?.dataset.reportMessageId)) openReportModal(reportButton.dataset.reportMessageId);

    const profileButton = event.target.closest('[data-new-message-user]');
    if (isUUID(profileButton?.dataset.newMessageUser)) openForUser(profileButton.dataset.newMessageUser);

    if (event.target === state.refs.modal) closeModal();
  }

  async function openWidget() {
    const ready = await syncSession();
    if (!ready || !state.root) return false;
    showPanel();
    if (state.view === 'list') await loadConversations({ silent: true });
    return true;
  }

  async function openForUser(targetUserId) {
    if (!isUUID(targetUserId)) return false;
    const ready = await syncSession();
    if (!ready || !state.root || targetUserId === state.userId) return false;
    showPanel();
    showListView();
    state.refs.listStatus.classList.remove('asdfl-mw-hidden');
    state.refs.listStatus.textContent = 'Konuşma hazırlanıyor…';
    state.refs.list.classList.add('asdfl-mw-hidden');

    try {
      const result = await timed(ASDFL.supabase.rpc('start_direct_conversation', {
        target_user_id: targetUserId
      }));
      if (result.error || !isUUID(result.data)) throw new Error('Konuşma başlatılamadı');
      await loadConversations({ silent: true });
      if (!state.conversations.some(item => item.id === result.data)) throw new Error('Konuşma yüklenemedi');
      await openConversation(result.data);
      return true;
    } catch (error) {
      console.warn('Messenger konuşması başlatılamadı; ayrıntı gösterilmedi.');
      showToast('Bu konuşma şu anda başlatılamıyor.', true);
      renderConversationList();
      return false;
    }
  }

  function showPanel() {
    if (!state.root) return;
    state.isOpen = true;
    state.root.classList.add('is-open');
    state.refs.launcher.classList.add('asdfl-mw-hidden');
    state.refs.launcher.setAttribute('aria-expanded', 'true');
    state.refs.panel.classList.remove('asdfl-mw-hidden');
    state.refs.panel.setAttribute('aria-hidden', 'false');
  }

  function closePanel(clearConversation) {
    if (!state.root) return;
    closeModal();
    state.isOpen = false;
    state.root.classList.remove('is-open');
    state.refs.panel.classList.add('asdfl-mw-hidden');
    state.refs.panel.setAttribute('aria-hidden', 'true');
    state.refs.launcher.classList.remove('asdfl-mw-hidden');
    state.refs.launcher.setAttribute('aria-expanded', 'false');
    if (clearConversation) showListView();
    state.refs.launcher.focus({ preventScroll: true });
  }

  function showListView(options = {}) {
    if (!state.root) return;
    window.clearTimeout(state.searchTimer);
    state.searchTimer = null;
    state.searchToken += 1;
    state.view = 'list';
    state.selectedId = null;
    state.messages.clear();
    state.refs.chatView.classList.add('asdfl-mw-hidden');
    state.refs.listView.classList.remove('asdfl-mw-hidden');
    state.refs.searchView.classList.add('asdfl-mw-hidden');
    renderConversationList();
    if (options.focusNewMessage) state.refs.newMessage.focus({ preventScroll: true });
  }

  function showProfileSearch() {
    if (!state.root) return;
    state.view = 'search';
    state.refs.searchView.classList.remove('asdfl-mw-hidden');
    state.refs.listStatus.classList.add('asdfl-mw-hidden');
    state.refs.list.classList.add('asdfl-mw-hidden');
    state.refs.searchInput.value = '';
    state.refs.searchResults.replaceChildren();
    state.refs.searchStatus.classList.remove('asdfl-mw-hidden');
    state.refs.searchStatus.textContent = 'Aramak için en az 2 karakter yazın.';
    state.refs.searchInput.focus({ preventScroll: true });
  }

  function scheduleProfileSearch() {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = null;
    const term = state.refs.searchInput.value.trim();
    const token = ++state.searchToken;
    state.refs.searchResults.replaceChildren();
    state.refs.searchStatus.classList.remove('asdfl-mw-hidden');
    if (term.length < 2) {
      state.refs.searchStatus.textContent = 'Aramak için en az 2 karakter yazın.';
      return;
    }
    state.refs.searchStatus.textContent = 'Kişiler aranıyor…';
    state.searchTimer = window.setTimeout(() => searchProfiles(term, token), 280);
  }

  async function searchProfiles(term, token) {
    const safePattern = term.replace(/[\\%_]/g, '\\$&');
    try {
      const result = await timed(
        ASDFL.supabase
          .from('public_profiles')
          .select('id,name,role,avatar_url,avatar_position')
          .ilike('name', `%${safePattern}%`)
          .neq('id', state.userId)
          .order('name', { ascending: true })
          .limit(8)
      );
      if (result.error) throw result.error;
      if (token !== state.searchToken || state.view !== 'search') return;
      renderProfileSearchResults((result.data || []).filter(profile => isUUID(profile.id)));
    } catch (error) {
      if (token !== state.searchToken || state.view !== 'search') return;
      state.refs.searchResults.replaceChildren();
      state.refs.searchStatus.classList.remove('asdfl-mw-hidden');
      state.refs.searchStatus.textContent = 'Kişiler şu anda aranamadı. Lütfen tekrar deneyin.';
    }
  }

  function renderProfileSearchResults(profiles) {
    state.refs.searchResults.replaceChildren();
    if (!profiles.length) {
      state.refs.searchStatus.classList.remove('asdfl-mw-hidden');
      state.refs.searchStatus.textContent = 'Bu isimle eşleşen bir üye bulunamadı.';
      return;
    }
    state.refs.searchStatus.classList.add('asdfl-mw-hidden');
    profiles.forEach(profile => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'asdfl-mw-search-result';
      button.dataset.newMessageUser = profile.id;
      button.setAttribute('aria-label', `${profile.name || 'ASDFL üyesi'} ile mesajlaş`);

      const avatar = document.createElement('span');
      avatar.className = 'asdfl-mw-avatar';
      renderAvatar(avatar, profile);
      const copy = document.createElement('span');
      copy.className = 'asdfl-mw-search-result-copy';
      const name = document.createElement('strong');
      name.textContent = profile.name || 'ASDFL üyesi';
      const role = document.createElement('span');
      role.textContent = profile.role || 'Üye';
      copy.append(name, role);
      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', 'message-circle');
      icon.setAttribute('aria-hidden', 'true');
      button.append(avatar, copy, icon);
      state.refs.searchResults.appendChild(button);
    });
    refreshIcons(state.refs.searchResults);
  }

  async function loadConversations(options = {}) {
    if (!state.userId || !ASDFL.supabase) return;
    const token = ++state.conversationToken;
    if (!options.silent && state.root) {
      state.refs.listStatus.classList.remove('asdfl-mw-hidden');
      state.refs.listStatus.textContent = 'Konuşmalar yükleniyor…';
    }

    try {
      const conversationsResult = await timed(
        ASDFL.supabase.from('conversations').select('id,updated_at').order('updated_at', { ascending: false }).limit(40)
      );
      if (conversationsResult.error) throw conversationsResult.error;
      if (token !== state.conversationToken) return;
      const rows = (conversationsResult.data || []).filter(row => isUUID(row.id));
      if (!rows.length) {
        state.conversations = [];
        renderConversationList();
        return;
      }

      const ids = rows.map(row => row.id);
      const [participantsResult, readStateResult, messagesResult, blocksResult] = await Promise.all([
        timed(ASDFL.supabase.from('conversation_participants').select('conversation_id,user_id').in('conversation_id', ids)),
        timed(ASDFL.supabase.from('conversation_participants').select('conversation_id,last_read_at').in('conversation_id', ids).eq('user_id', state.userId)),
        timed(ASDFL.supabase.from('messages').select('id,conversation_id,sender_id,created_at').in('conversation_id', ids).order('created_at', { ascending: false }).limit(400)),
        timed(ASDFL.supabase.from('user_blocks').select('blocked_id'))
      ]);
      if (participantsResult.error) throw participantsResult.error;
      if (readStateResult.error) throw readStateResult.error;
      if (messagesResult.error) throw messagesResult.error;
      if (blocksResult.error) throw blocksResult.error;
      if (token !== state.conversationToken) return;

      const participants = participantsResult.data || [];
      const otherIds = [...new Set(participants.filter(item => item.user_id !== state.userId && isUUID(item.user_id)).map(item => item.user_id))];
      let profiles = [];
      if (otherIds.length) {
        const profilesResult = await timed(
          ASDFL.supabase.from('public_profiles').select('id,name,role,avatar_url,avatar_position').in('id', otherIds)
        );
        if (profilesResult.error) throw profilesResult.error;
        profiles = profilesResult.data || [];
      }
      if (token !== state.conversationToken) return;

      const profileMap = new Map(profiles.map(profile => [profile.id, profile]));
      const blockedIds = new Set((blocksResult.data || []).map(item => item.blocked_id));
      const readStateMap = new Map((readStateResult.data || []).map(item => [item.conversation_id, item.last_read_at]));
      const latestMap = new Map();
      (messagesResult.data || []).forEach(message => {
        if (!latestMap.has(message.conversation_id)) latestMap.set(message.conversation_id, message);
      });

      state.conversations = rows.map(row => {
        const members = participants.filter(item => item.conversation_id === row.id);
        const lastReadAt = readStateMap.get(row.id);
        const otherMember = members.find(item => item.user_id !== state.userId) || {};
        const other = profileMap.get(otherMember.user_id) || { id: otherMember.user_id, name: 'ASDFL üyesi', role: 'Üye' };
        const latest = latestMap.get(row.id) || null;
        return {
          id: row.id,
          updatedAt: row.updated_at,
          other,
          latest,
          isBlocked: blockedIds.has(otherMember.user_id),
          isUnread: Boolean(latest && latest.sender_id !== state.userId && (!lastReadAt || new Date(latest.created_at) > new Date(lastReadAt)))
        };
      }).filter(item => isUUID(item.other?.id));

      renderConversationList();
      updateUnreadBadge();
      const selected = getSelected();
      if (selected) updateChatHeader(selected);
      else if (state.selectedId) showListView();
    } catch (error) {
      console.warn('Messenger konuşma listesi yüklenemedi.');
      if (!options.silent && state.root) {
        state.refs.list.classList.add('asdfl-mw-hidden');
        state.refs.listStatus.classList.remove('asdfl-mw-hidden');
        state.refs.listStatus.textContent = 'Konuşmalar şu anda yüklenemiyor.';
      }
    }
  }

  function renderConversationList() {
    if (!state.root) return;
    if (state.view === 'search') {
      updateUnreadBadge();
      return;
    }
    state.refs.list.replaceChildren();
    if (!state.conversations.length) {
      state.refs.list.classList.add('asdfl-mw-hidden');
      state.refs.listStatus.classList.remove('asdfl-mw-hidden');
      state.refs.listStatus.textContent = 'Henüz bir konuşmanız yok. Bir üyenin profilinden mesaj başlatabilirsiniz.';
      updateUnreadBadge();
      return;
    }
    state.refs.listStatus.classList.add('asdfl-mw-hidden');
    state.refs.list.classList.remove('asdfl-mw-hidden');

    state.conversations.forEach(conversation => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `asdfl-mw-conversation${conversation.isUnread ? ' is-unread' : ''}`;
      button.dataset.conversationId = conversation.id;
      button.setAttribute('aria-label', `${conversation.other.name || 'ASDFL üyesi'} ile konuşma`);

      const avatar = document.createElement('span');
      avatar.className = 'asdfl-mw-avatar';
      renderAvatar(avatar, conversation.other);
      const copy = document.createElement('span');
      copy.className = 'asdfl-mw-conversation-copy';
      const name = document.createElement('span');
      name.className = 'asdfl-mw-conversation-name';
      name.textContent = conversation.other.name || 'ASDFL üyesi';
      const preview = document.createElement('span');
      preview.className = 'asdfl-mw-conversation-preview';
      preview.textContent = conversation.latest
        ? (conversation.latest.sender_id === state.userId ? 'Bir mesaj gönderdiniz' : 'Yeni mesaj')
        : 'Konuşma başlatıldı';
      copy.append(name, preview);

      const meta = document.createElement('span');
      meta.className = 'asdfl-mw-conversation-meta';
      const time = document.createElement('span');
      time.textContent = formatListTime(conversation.latest?.created_at || conversation.updatedAt);
      meta.appendChild(time);
      if (conversation.isUnread) {
        const dot = document.createElement('span');
        dot.className = 'asdfl-mw-unread-dot';
        dot.title = 'Yeni mesaj';
        meta.appendChild(dot);
      }
      button.append(avatar, copy, meta);
      state.refs.list.appendChild(button);
    });
  }

  function updateUnreadBadge() {
    if (!state.root) return;
    const unread = state.conversations.filter(item => item.isUnread).length;
    state.refs.badge.textContent = unread > 99 ? '99+' : String(unread);
    state.refs.badge.classList.toggle('asdfl-mw-hidden', unread === 0);
    state.refs.launcher.setAttribute('aria-label', unread ? `Mesajları aç, ${unread} okunmamış konuşma` : 'Mesajları aç');
  }

  async function openConversation(conversationId) {
    const conversation = state.conversations.find(item => item.id === conversationId);
    if (!conversation) return;
    showPanel();
    state.view = 'chat';
    state.selectedId = conversationId;
    state.messages.clear();
    state.refs.listView.classList.add('asdfl-mw-hidden');
    state.refs.chatView.classList.remove('asdfl-mw-hidden');
    updateChatHeader(conversation);
    renderMessageStatus('Mesajlar yükleniyor…');
    await loadMessages(conversationId);
    await markRead(conversationId);
    if (!state.refs.input.disabled) state.refs.input.focus({ preventScroll: true });
  }

  function updateChatHeader(conversation) {
    if (!state.root) return;
    state.refs.chatName.textContent = conversation.other.name || 'ASDFL üyesi';
    state.refs.chatRole.textContent = conversation.other.role || 'Üye';
    renderAvatar(state.refs.chatAvatar, conversation.other);
    state.refs.threadLink.href = `mesajlar.html?conversation=${encodeURIComponent(conversation.id)}`;
    const blockLabel = conversation.isBlocked ? 'Engeli kaldır' : 'Kullanıcıyı engelle';
    state.refs.blockButton.classList.toggle('is-blocked', conversation.isBlocked);
    state.refs.blockButton.setAttribute('aria-label', blockLabel);
    state.refs.blockButton.title = blockLabel;
    state.refs.notice.classList.toggle('asdfl-mw-hidden', !conversation.isBlocked);
    state.refs.notice.textContent = conversation.isBlocked ? 'Bu kullanıcıyı engellediniz. Yeni mesaj gönderemezsiniz.' : '';
    updateComposerState();
  }

  async function loadMessages(conversationId) {
    if (!isUUID(conversationId) || !state.userId) return;
    const token = ++state.messageToken;
    try {
      const result = await timed(
        ASDFL.supabase.from('messages')
          .select('id,conversation_id,sender_id,body,created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(150)
      );
      if (result.error) throw result.error;
      if (token !== state.messageToken || state.selectedId !== conversationId) return;
      const messages = (result.data || []).reverse();
      state.messages = new Map(messages.filter(item => isUUID(item.id)).map(item => [item.id, item]));
      renderMessages(messages);
    } catch (error) {
      if (state.selectedId === conversationId) renderMessageStatus('Mesajlar şu anda yüklenemiyor.');
    }
  }

  function renderMessageStatus(copy) {
    if (!state.root) return;
    state.refs.messages.replaceChildren();
    const status = document.createElement('div');
    status.className = 'asdfl-mw-message-status';
    status.textContent = copy;
    state.refs.messages.appendChild(status);
  }

  function renderMessages(messages) {
    if (!state.root) return;
    state.refs.messages.replaceChildren();
    if (!messages.length) {
      renderMessageStatus('Henüz mesaj yok. Nazik bir merhaba ile başlayın.');
      return;
    }

    let previousDay = '';
    messages.forEach(message => {
      const date = new Date(message.created_at);
      const dayKey = Number.isNaN(date.getTime()) ? '' : date.toDateString();
      if (dayKey && dayKey !== previousDay) {
        const day = document.createElement('div');
        day.className = 'asdfl-mw-day';
        day.textContent = formatDay(date);
        state.refs.messages.appendChild(day);
        previousDay = dayKey;
      }

      const mine = message.sender_id === state.userId;
      const row = document.createElement('div');
      row.className = `asdfl-mw-message-row${mine ? ' is-mine' : ''}`;
      const bubble = document.createElement('div');
      bubble.className = 'asdfl-mw-bubble';
      const body = document.createElement('p');
      body.className = 'asdfl-mw-body';
      body.textContent = String(message.body || '');
      const time = document.createElement('time');
      time.className = 'asdfl-mw-time';
      time.dateTime = message.created_at || '';
      time.textContent = Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      bubble.append(body, time);

      if (mine) row.appendChild(bubble);
      else row.append(bubble, createReportButton(message.id));
      state.refs.messages.appendChild(row);
    });
    refreshIcons(state.refs.messages);
    requestAnimationFrame(() => { state.refs.messages.scrollTop = state.refs.messages.scrollHeight; });
  }

  function createReportButton(messageId) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'asdfl-mw-report';
    button.dataset.reportMessageId = messageId;
    button.setAttribute('aria-label', 'Mesajı şikâyet et');
    button.title = 'Mesajı şikâyet et';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'flag');
    button.appendChild(icon);
    return button;
  }

  async function markRead(conversationId) {
    if (!isUUID(conversationId) || state.selectedId !== conversationId) return;
    try {
      const result = await timed(ASDFL.supabase.rpc('mark_conversation_read', { target_conversation_id: conversationId }));
      if (result.error) throw result.error;
      const conversation = state.conversations.find(item => item.id === conversationId);
      if (conversation) conversation.isUnread = false;
      updateUnreadBadge();
      renderConversationList();
    } catch (error) {
      console.warn('Messenger okundu bilgisi güncellenemedi.');
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const conversation = getSelected();
    const body = state.refs.input.value.trim();
    if (!conversation || conversation.isBlocked || state.sending) return;
    if (body.length < 1 || body.length > MESSAGE_LIMIT) {
      showToast(`Mesaj 1 ile ${MESSAGE_LIMIT} karakter arasında olmalı.`, true);
      return;
    }

    state.sending = true;
    updateComposerState();
    try {
      const result = await timed(ASDFL.supabase.rpc('send_conversation_message', {
        target_conversation_id: conversation.id,
        message_body: body
      }));
      if (result.error) throw result.error;
      state.refs.input.value = '';
      updateComposerMetrics();
      await Promise.all([loadMessages(conversation.id), loadConversations({ silent: true })]);
      state.refs.input.focus({ preventScroll: true });
    } catch (error) {
      console.warn('Messenger mesajı gönderilemedi; ayrıntı gösterilmedi.');
      showToast('Mesaj gönderilemedi. Bu konuşma şu anda kullanılamıyor.', true);
    } finally {
      state.sending = false;
      updateComposerState();
    }
  }

  function updateComposerMetrics() {
    if (!state.root) return;
    state.refs.count.textContent = `${state.refs.input.value.length} / ${MESSAGE_LIMIT}`;
    state.refs.input.style.height = 'auto';
    const nextHeight = Math.min(state.refs.input.scrollHeight, 112);
    state.refs.input.style.height = `${nextHeight}px`;
    state.refs.input.style.overflowY = state.refs.input.scrollHeight > 112 ? 'auto' : 'hidden';
    updateComposerState();
  }

  function updateComposerState() {
    if (!state.root) return;
    const conversation = getSelected();
    const unavailable = !conversation || conversation.isBlocked;
    state.refs.input.disabled = unavailable || state.sending;
    state.refs.send.disabled = unavailable || state.sending || !state.refs.input.value.trim();
    state.refs.send.setAttribute('aria-label', state.sending ? 'Mesaj gönderiliyor' : 'Mesajı gönder');
  }

  function openBlockModal() {
    const conversation = getSelected();
    if (!conversation || !isUUID(conversation.other.id)) return;
    const shouldBlock = !conversation.isBlocked;
    state.modalAction = { type: 'block', userId: conversation.other.id, shouldBlock };
    state.refs.modalTitle.textContent = shouldBlock ? 'Kullanıcı engellensin mi?' : 'Engel kaldırılsın mı?';
    state.refs.modalCopy.textContent = shouldBlock
      ? `${conversation.other.name || 'Bu kullanıcı'} ile birbirinize yeni mesaj gönderemezsiniz.`
      : `${conversation.other.name || 'Bu kullanıcı'} ile yeniden mesajlaşabilirsiniz.`;
    state.refs.reportFields.classList.add('asdfl-mw-hidden');
    state.refs.modalConfirm.textContent = shouldBlock ? 'Engelle' : 'Engeli kaldır';
    state.refs.modalConfirm.classList.toggle('is-danger', shouldBlock);
    state.refs.modalConfirm.classList.toggle('is-primary', !shouldBlock);
    openModal();
  }

  function openReportModal(messageId) {
    const message = state.messages.get(messageId);
    if (!message || message.sender_id === state.userId) return;
    state.modalAction = { type: 'report', messageId };
    state.refs.modalTitle.textContent = 'Mesajı şikâyet et';
    state.refs.modalCopy.textContent = 'Ekibimizin durumu inceleyebilmesi için kısa bir neden yazın.';
    state.refs.reportReason.value = '';
    state.refs.reportCount.textContent = `0 / ${REPORT_LIMIT}`;
    state.refs.reportFields.classList.remove('asdfl-mw-hidden');
    state.refs.modalConfirm.textContent = 'Şikâyeti gönder';
    state.refs.modalConfirm.classList.remove('is-danger');
    state.refs.modalConfirm.classList.add('is-primary');
    openModal();
    setTimeout(() => state.refs.reportReason.focus(), 0);
  }

  function openModal() {
    state.refs.modal.classList.remove('asdfl-mw-hidden');
    state.refs.modalConfirm.disabled = false;
  }

  function closeModal() {
    if (!state.root) return;
    state.modalAction = null;
    state.refs.modal.classList.add('asdfl-mw-hidden');
  }

  async function confirmModalAction() {
    const action = state.modalAction;
    if (!action) return;
    if (action.type === 'block') await applyBlock(action);
    if (action.type === 'report') await submitReport(action);
  }

  async function applyBlock(action) {
    state.refs.modalConfirm.disabled = true;
    try {
      const result = await timed(ASDFL.supabase.rpc('set_user_block', {
        target_user_id: action.userId,
        should_block: action.shouldBlock
      }));
      if (result.error) throw result.error;
      const conversation = getSelected();
      if (conversation?.other.id === action.userId) {
        conversation.isBlocked = action.shouldBlock;
        updateChatHeader(conversation);
      }
      closeModal();
      showToast(action.shouldBlock ? 'Kullanıcı engellendi.' : 'Kullanıcı engeli kaldırıldı.');
    } catch (error) {
      state.refs.modalConfirm.disabled = false;
      showToast('Bu tercih şu anda güncellenemiyor.', true);
    }
  }

  async function submitReport(action) {
    const reason = state.refs.reportReason.value.trim();
    if (reason.length < 1 || reason.length > REPORT_LIMIT) {
      showToast(`Şikâyet nedeni 1 ile ${REPORT_LIMIT} karakter arasında olmalı.`, true);
      return;
    }
    state.refs.modalConfirm.disabled = true;
    try {
      const result = await timed(ASDFL.supabase.rpc('report_message', {
        target_message_id: action.messageId,
        report_reason: reason
      }));
      if (result.error) throw result.error;
      closeModal();
      showToast('Şikâyetiniz inceleme için gönderildi.');
    } catch (error) {
      state.refs.modalConfirm.disabled = false;
      showToast('Şikâyet şu anda gönderilemiyor.', true);
    }
  }

  function setupLiveUpdates() {
    cleanupLiveUpdates();
    startPolling();
    try {
      state.channel = ASDFL.supabase
        .channel(`messenger-widget-${state.userId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => handleRealtimeMessage(payload.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${state.userId}` }, () => loadConversations({ silent: true }))
        .subscribe(status => {
          if (status === 'SUBSCRIBED') pollUpdates();
          if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) startPolling();
        });
    } catch (error) {
      startPolling();
    }
  }

  async function handleRealtimeMessage(message) {
    if (!message || !isUUID(message.conversation_id)) return;
    await loadConversations({ silent: true });
    if (state.isOpen && state.view === 'chat' && state.selectedId === message.conversation_id) {
      await loadMessages(message.conversation_id);
      if (document.visibilityState === 'visible') await markRead(message.conversation_id);
    }
  }

  function startPolling() {
    if (state.pollTimer || !state.userId || !ASDFL.supabase) return;
    state.pollTimer = window.setInterval(pollUpdates, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (!state.pollTimer) return;
    window.clearInterval(state.pollTimer);
    state.pollTimer = null;
  }

  async function pollUpdates() {
    if (state.pollBusy || document.visibilityState === 'hidden' || !state.userId) return;
    state.pollBusy = true;
    try {
      await loadConversations({ silent: true });
      const selected = getSelected();
      if (state.isOpen && state.view === 'chat' && selected) {
        await loadMessages(selected.id);
        if (selected.isUnread) await markRead(selected.id);
      }
    } finally {
      state.pollBusy = false;
    }
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && state.userId) pollUpdates();
  }

  function cleanupLiveUpdates() {
    stopPolling();
    if (state.channel && window.ASDFL?.supabase) ASDFL.supabase.removeChannel(state.channel);
    state.channel = null;
  }

  function teardownSession() {
    state.conversationToken += 1;
    state.messageToken += 1;
    state.searchToken += 1;
    cleanupLiveUpdates();
    window.clearTimeout(state.toastTimer);
    window.clearTimeout(state.searchTimer);
    if (state.keydownHandler) document.removeEventListener('keydown', state.keydownHandler);
    state.root?.remove();
    state.userId = null;
    state.conversations = [];
    state.selectedId = null;
    state.messages.clear();
    state.root = null;
    state.refs = {};
    state.isOpen = false;
    state.view = 'list';
    state.sending = false;
    state.modalAction = null;
    state.searchTimer = null;
    state.keydownHandler = null;
  }

  function destroyWidget() {
    state.authEpoch += 1;
    window.removeEventListener('asdfl:auth-changed', syncSession);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (state.documentClickHandler) document.removeEventListener('click', state.documentClickHandler);
    state.documentClickHandler = null;
    teardownSession();
  }

  function renderAvatar(container, profile) {
    container.replaceChildren();
    const safeURL = ASDFL.safeURL(profile?.avatar_url || '');
    if (safeURL) {
      const image = document.createElement('img');
      image.src = safeURL;
      image.alt = '';
      image.loading = 'lazy';
      container.appendChild(image);
      return;
    }
    container.textContent = ASDFL.getInitials(profile?.name || 'ASDFL');
  }

  function getSelected() {
    return state.conversations.find(item => item.id === state.selectedId) || null;
  }

  function formatListTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Dün';
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  }

  function formatDay(date) {
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return 'Bugün';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Dün';
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  }

  function showToast(message, isError) {
    if (!state.root) return;
    window.clearTimeout(state.toastTimer);
    state.refs.toast.textContent = message;
    state.refs.toast.className = `asdfl-mw-toast is-visible${isError ? ' is-error' : ''}`;
    state.toastTimer = window.setTimeout(() => { state.refs.toast.className = 'asdfl-mw-toast'; }, 3200);
  }

  function timed(query) {
    return ASDFL.queryWithTimeout(query, 9000);
  }

  function isUUID(value) {
    return typeof value === 'string' && UUID_PATTERN.test(value);
  }

  function refreshIcons(root) {
    if (ASDFL.refreshIcons) ASDFL.refreshIcons(root || document);
  }
})();
