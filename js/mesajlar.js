(function () {
  'use strict';

  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const POLL_INTERVAL_MS = 30000;
  const MAX_MESSAGE_LENGTH = 2000;
  const MAX_REPORT_LENGTH = 500;

  const state = {
    user: null,
    conversations: [],
    selectedId: null,
    messages: new Map(),
    search: '',
    sending: false,
    reportingMessageId: null,
    realtimeChannel: null,
    pollTimer: null,
    pollingBusy: false,
    conversationLoadToken: 0,
    messageLoadToken: 0,
    initializedUserId: null,
    toastTimer: null
  };

  const el = {};

  document.addEventListener('DOMContentLoaded', initialize);

  async function initialize() {
    cacheElements();
    bindEvents();
    refreshIcons();
    showLoadingGate();

    window.addEventListener('asdfl:auth-changed', handleAuthChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', cleanupLiveUpdates, { once: true });

    await ASDFL.waitForAuth();
    await initializeForCurrentSession();
    document.documentElement.classList.remove('no-transitions');
  }

  function cacheElements() {
    [
      'messagesGate', 'messagesApp', 'conversationCount', 'conversationSearch',
      'conversationListStatus', 'conversationList', 'threadEmpty', 'threadActive',
      'mobileThreadBack', 'threadAvatar', 'threadName', 'threadRole', 'blockUserButton',
      'threadNotice', 'messageList', 'messageForm', 'messageInput', 'messageCharCount',
      'sendMessageButton', 'messagesToast', 'blockDialog', 'blockDialogTitle',
      'blockDialogCopy', 'confirmBlockButton', 'reportDialog', 'reportForm',
      'reportReason', 'reportReasonCount', 'closeReportButton', 'cancelReportButton',
      'submitReportButton'
    ].forEach(id => { el[id] = document.getElementById(id); });
  }

  function bindEvents() {
    el.conversationSearch.addEventListener('input', event => {
      state.search = event.target.value.trim().toLocaleLowerCase('tr-TR');
      renderConversationList();
    });

    el.conversationList.addEventListener('click', event => {
      const item = event.target.closest('[data-conversation-id]');
      const conversationId = item?.dataset.conversationId;
      if (isUUID(conversationId)) activateConversation(conversationId);
    });

    el.mobileThreadBack.addEventListener('click', showConversationList);
    el.blockUserButton.addEventListener('click', openBlockDialog);
    el.blockDialog.addEventListener('close', () => {
      if (el.blockDialog.returnValue === 'confirm') applyBlockPreference();
      el.blockDialog.returnValue = '';
    });

    el.messageForm.addEventListener('submit', sendMessage);
    el.messageInput.addEventListener('input', updateComposerMetrics);
    el.messageInput.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        el.messageForm.requestSubmit();
      }
    });

    el.messageList.addEventListener('click', event => {
      const button = event.target.closest('[data-report-message-id]');
      const messageId = button?.dataset.reportMessageId;
      if (isUUID(messageId)) openReportDialog(messageId);
    });

    el.reportReason.addEventListener('input', updateReportMetrics);
    el.reportForm.addEventListener('submit', submitReport);
    el.closeReportButton.addEventListener('click', closeReportDialog);
    el.cancelReportButton.addEventListener('click', closeReportDialog);
  }

  async function handleAuthChange() {
    if (ASDFL.currentUser?.id === state.initializedUserId) return;
    cleanupLiveUpdates();
    resetState();
    await initializeForCurrentSession();
  }

  async function initializeForCurrentSession() {
    if (!ASDFL.currentUser?.id) {
      showGate({
        icon: 'lock-keyhole',
        title: 'Mesajlarını görmek için giriş yap',
        copy: 'Bire bir mesajlar yalnızca doğrulanmış ASDFL üyelerine açıktır.',
        action: { label: 'Ana sayfaya dön', href: 'index.html' }
      });
      return;
    }

    if (!ASDFL.supabase) {
      showGate({
        icon: 'cloud-off',
        title: 'Mesajlaşma şu anda kullanılamıyor',
        copy: 'Özel mesajlar güvenlik nedeniyle bu cihazda yerel olarak saklanmaz. Bağlantı yeniden kurulduğunda tekrar deneyin.',
        action: { label: 'Topluluğa dön', href: 'topluluk.html' }
      });
      return;
    }

    state.user = { id: ASDFL.currentUser.id };
    state.initializedUserId = ASDFL.currentUser.id;
    el.messagesGate.classList.add('hidden');
    el.messagesApp.classList.remove('hidden');

    await loadConversations();
    await handleInitialTarget();
    setupLiveUpdates();
  }

  function resetState() {
    state.user = null;
    state.conversations = [];
    state.selectedId = null;
    state.messages.clear();
    state.sending = false;
    state.reportingMessageId = null;
    state.initializedUserId = null;
    el.messagesApp.classList.add('hidden');
    el.messagesApp.classList.remove('thread-open');
    el.threadActive.classList.add('hidden');
    el.threadEmpty.classList.remove('hidden');
  }

  function showLoadingGate() {
    el.messagesGate.classList.add('is-loading');
  }

  function showGate({ icon, title, copy, action }) {
    el.messagesGate.classList.remove('hidden', 'is-loading');
    el.messagesApp.classList.add('hidden');
    el.messagesGate.replaceChildren();

    const iconWrap = document.createElement('div');
    iconWrap.className = 'messages-gate-icon';
    const iconNode = document.createElement('i');
    iconNode.setAttribute('data-lucide', icon);
    iconWrap.appendChild(iconNode);

    const heading = document.createElement('h1');
    heading.textContent = title;
    const paragraph = document.createElement('p');
    paragraph.textContent = copy;
    el.messagesGate.append(iconWrap, heading, paragraph);

    if (action) {
      const link = document.createElement('a');
      link.className = 'gate-action';
      link.href = action.href;
      link.textContent = action.label;
      el.messagesGate.appendChild(link);
    }
    refreshIcons(el.messagesGate);
  }

  async function loadConversations(options = {}) {
    if (!state.user || !ASDFL.supabase) return;
    const token = ++state.conversationLoadToken;
    if (!options.silent) {
      el.conversationListStatus.hidden = false;
      el.conversationListStatus.textContent = 'Konuşmalar yükleniyor…';
    }

    try {
      const conversationsResult = await timed(
        ASDFL.supabase
          .from('conversations')
          .select('id,updated_at')
          .order('updated_at', { ascending: false })
          .limit(60)
      );
      if (conversationsResult.error) throw conversationsResult.error;
      if (token !== state.conversationLoadToken) return;

      const conversations = (conversationsResult.data || []).filter(row => isUUID(row.id));
      if (!conversations.length) {
        state.conversations = [];
        renderConversationList();
        return;
      }

      const ids = conversations.map(row => row.id);
      const [participantsResult, messagesResult, blocksResult] = await Promise.all([
        timed(ASDFL.supabase
          .from('conversation_participants')
          .select('conversation_id,user_id,last_read_at')
          .in('conversation_id', ids)),
        timed(ASDFL.supabase
          .from('messages')
          .select('id,conversation_id,sender_id,body,created_at')
          .in('conversation_id', ids)
          .order('created_at', { ascending: false })
          .limit(600)),
        timed(ASDFL.supabase.from('user_blocks').select('blocked_id'))
      ]);
      if (participantsResult.error) throw participantsResult.error;
      if (messagesResult.error) throw messagesResult.error;
      if (blocksResult.error) throw blocksResult.error;
      if (token !== state.conversationLoadToken) return;

      const participants = participantsResult.data || [];
      const otherIds = [...new Set(participants
        .filter(row => row.user_id !== state.user.id && isUUID(row.user_id))
        .map(row => row.user_id))];

      let profileRows = [];
      if (otherIds.length) {
        const profilesResult = await timed(
          ASDFL.supabase
            .from('public_profiles')
            .select('id,name,role,avatar_url,avatar_position')
            .in('id', otherIds)
        );
        if (profilesResult.error) throw profilesResult.error;
        profileRows = profilesResult.data || [];
      }
      if (token !== state.conversationLoadToken) return;

      const profilesById = new Map(profileRows.map(profile => [profile.id, profile]));
      const blockedIds = new Set((blocksResult.data || []).map(row => row.blocked_id));
      const latestByConversation = new Map();
      (messagesResult.data || []).forEach(message => {
        if (!latestByConversation.has(message.conversation_id)) {
          latestByConversation.set(message.conversation_id, message);
        }
      });

      state.conversations = conversations.map(conversation => {
        const members = participants.filter(row => row.conversation_id === conversation.id);
        const ownParticipant = members.find(row => row.user_id === state.user.id) || {};
        const otherParticipant = members.find(row => row.user_id !== state.user.id) || {};
        const otherProfile = profilesById.get(otherParticipant.user_id) || {
          id: otherParticipant.user_id,
          name: 'ASDFL üyesi',
          role: 'Üye'
        };
        const latestMessage = latestByConversation.get(conversation.id) || null;
        const isUnread = Boolean(
          latestMessage &&
          latestMessage.sender_id !== state.user.id &&
          (!ownParticipant.last_read_at || new Date(latestMessage.created_at) > new Date(ownParticipant.last_read_at))
        );
        return {
          id: conversation.id,
          updatedAt: conversation.updated_at,
          other: otherProfile,
          latestMessage,
          isUnread,
          isBlocked: blockedIds.has(otherParticipant.user_id)
        };
      }).filter(conversation => isUUID(conversation.other?.id));

      renderConversationList();
      if (state.selectedId) {
        const selected = getSelectedConversation();
        if (selected) updateThreadHeader(selected);
        else showConversationList();
      }
    } catch (error) {
      console.error('Konuşmalar yüklenemedi:', error);
      if (!options.silent) {
        el.conversationListStatus.hidden = false;
        el.conversationListStatus.textContent = 'Konuşmalar şu anda yüklenemiyor. Lütfen yeniden deneyin.';
      }
    }
  }

  function renderConversationList() {
    const filtered = state.conversations.filter(conversation => {
      if (!state.search) return true;
      const haystack = `${conversation.other.name || ''} ${conversation.other.role || ''}`.toLocaleLowerCase('tr-TR');
      return haystack.includes(state.search);
    });

    el.conversationList.replaceChildren();
    el.conversationCount.textContent = String(state.conversations.length);
    el.conversationCount.setAttribute('aria-label', `${state.conversations.length} konuşma`);

    if (!filtered.length) {
      el.conversationListStatus.hidden = false;
      el.conversationListStatus.textContent = state.search
        ? 'Aramanızla eşleşen bir konuşma yok.'
        : 'Henüz bir konuşmanız yok. Bir üyenin profilinden mesaj başlatabilirsiniz.';
      return;
    }
    el.conversationListStatus.hidden = true;

    filtered.forEach(conversation => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `conversation-item${conversation.id === state.selectedId ? ' active' : ''}`;
      button.dataset.conversationId = conversation.id;
      button.setAttribute('aria-label', `${conversation.other.name || 'ASDFL üyesi'} ile konuşma`);

      const avatar = document.createElement('span');
      avatar.className = 'message-avatar';
      renderAvatar(avatar, conversation.other);

      const copy = document.createElement('span');
      copy.className = 'conversation-copy';
      const nameRow = document.createElement('span');
      nameRow.className = 'conversation-name-row';
      const name = document.createElement('span');
      name.className = 'conversation-name';
      name.textContent = conversation.other.name || 'ASDFL üyesi';
      nameRow.appendChild(name);
      const preview = document.createElement('span');
      preview.className = 'conversation-preview';
      preview.textContent = conversation.latestMessage
        ? `${conversation.latestMessage.sender_id === state.user.id ? 'Siz: ' : ''}${conversation.latestMessage.body}`
        : 'Konuşma başlatıldı';
      copy.append(nameRow, preview);

      const meta = document.createElement('span');
      meta.className = 'conversation-meta';
      const time = document.createElement('span');
      time.textContent = formatListTime(conversation.latestMessage?.created_at || conversation.updatedAt);
      meta.appendChild(time);
      if (conversation.isUnread) {
        const unread = document.createElement('span');
        unread.className = 'unread-pill';
        unread.title = 'Yeni mesaj';
        meta.appendChild(unread);
      } else if (conversation.isBlocked) {
        const blocked = document.createElement('span');
        blocked.className = 'blocked-mini';
        blocked.textContent = 'Engelli';
        meta.appendChild(blocked);
      }

      button.append(avatar, copy, meta);
      el.conversationList.appendChild(button);
    });
  }

  async function handleInitialTarget() {
    const params = new URLSearchParams(window.location.search);
    const targetUserId = params.get('user');
    const targetConversationId = params.get('conversation');

    if (targetUserId) {
      await startDirectConversation(targetUserId);
      return;
    }
    if (targetConversationId) {
      if (isUUID(targetConversationId) && state.conversations.some(item => item.id === targetConversationId)) {
        await activateConversation(targetConversationId, { syncUrl: false });
      } else {
        showToast('Bu konuşma şu anda açılamıyor.', 'error');
        replaceLocationQuery(null);
      }
    }
  }

  async function startDirectConversation(targetUserId) {
    if (!isUUID(targetUserId) || targetUserId === state.user?.id) {
      showToast('Bu konuşma şu anda başlatılamıyor.', 'error');
      replaceLocationQuery(null);
      return;
    }

    try {
      const result = await timed(ASDFL.supabase.rpc('start_direct_conversation', {
        target_user_id: targetUserId
      }));
      if (result.error || !isUUID(result.data)) throw result.error || new Error('Geçersiz konuşma yanıtı');
      await loadConversations({ silent: true });
      const conversation = state.conversations.find(item => item.id === result.data);
      if (!conversation) throw new Error('Konuşma listede bulunamadı');
      replaceLocationQuery({ conversation: result.data });
      await activateConversation(result.data, { syncUrl: false });
    } catch (error) {
      console.warn('Konuşma başlatılamadı; güvenlik nedeniyle ayrıntı gösterilmedi.');
      showToast('Bu konuşma şu anda başlatılamıyor.', 'error');
      replaceLocationQuery(null);
    }
  }

  async function activateConversation(conversationId, options = {}) {
    const conversation = state.conversations.find(item => item.id === conversationId);
    if (!conversation) {
      showToast('Bu konuşma şu anda açılamıyor.', 'error');
      return;
    }

    state.selectedId = conversationId;
    state.messages.clear();
    el.threadEmpty.classList.add('hidden');
    el.threadActive.classList.remove('hidden');
    el.messagesApp.classList.add('thread-open');
    renderConversationList();
    updateThreadHeader(conversation);
    renderMessageLoading();
    if (options.syncUrl !== false) replaceLocationQuery({ conversation: conversationId });
    await loadMessages(conversationId);
    await markConversationRead(conversationId);
  }

  function showConversationList() {
    state.selectedId = null;
    state.messages.clear();
    el.messagesApp.classList.remove('thread-open');
    el.threadActive.classList.add('hidden');
    el.threadEmpty.classList.remove('hidden');
    replaceLocationQuery(null);
    renderConversationList();
  }

  function updateThreadHeader(conversation) {
    el.threadName.textContent = conversation.other.name || 'ASDFL üyesi';
    el.threadRole.textContent = conversation.other.role || 'Üye';
    renderAvatar(el.threadAvatar, conversation.other);

    const buttonLabel = conversation.isBlocked ? 'Engeli kaldır' : 'Engelle';
    el.blockUserButton.querySelector('span').textContent = buttonLabel;
    el.blockUserButton.setAttribute('aria-label', buttonLabel);
    el.blockUserButton.classList.toggle('is-blocked', conversation.isBlocked);

    el.threadNotice.classList.toggle('hidden', !conversation.isBlocked);
    el.threadNotice.textContent = conversation.isBlocked
      ? 'Bu kullanıcıyı engellediniz. Yeni mesaj gönderemezsiniz.'
      : '';
    updateComposerState();
  }

  async function loadMessages(conversationId) {
    if (!isUUID(conversationId) || !state.user) return;
    const token = ++state.messageLoadToken;
    try {
      const result = await timed(
        ASDFL.supabase
          .from('messages')
          .select('id,conversation_id,sender_id,body,created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(300)
      );
      if (result.error) throw result.error;
      if (token !== state.messageLoadToken || state.selectedId !== conversationId) return;
      const messages = (result.data || []).reverse();
      state.messages = new Map(messages.filter(message => isUUID(message.id)).map(message => [message.id, message]));
      renderMessages(messages);
    } catch (error) {
      console.error('Mesajlar yüklenemedi:', error);
      if (state.selectedId === conversationId) renderMessageState('Mesajlar şu anda yüklenemiyor.');
    }
  }

  function renderMessageLoading() {
    renderMessageState('Mesajlar yükleniyor…');
  }

  function renderMessageState(copy) {
    el.messageList.replaceChildren();
    const status = document.createElement('div');
    status.className = 'message-list-state';
    status.textContent = copy;
    el.messageList.appendChild(status);
  }

  function renderMessages(messages) {
    el.messageList.replaceChildren();
    if (!messages.length) {
      renderMessageState('Henüz mesaj yok. Nazik bir merhaba ile başlayın.');
      return;
    }

    let previousDay = '';
    messages.forEach(message => {
      const createdAt = new Date(message.created_at);
      const dayKey = Number.isNaN(createdAt.getTime()) ? '' : createdAt.toDateString();
      if (dayKey && dayKey !== previousDay) {
        const day = document.createElement('div');
        day.className = 'message-day';
        day.textContent = formatMessageDay(createdAt);
        el.messageList.appendChild(day);
        previousDay = dayKey;
      }

      const mine = message.sender_id === state.user.id;
      const row = document.createElement('div');
      row.className = `message-row${mine ? ' mine' : ''}`;
      row.dataset.messageId = message.id;

      const bubble = document.createElement('div');
      bubble.className = 'message-bubble';
      const body = document.createElement('p');
      body.className = 'message-body';
      body.textContent = String(message.body || '');
      const time = document.createElement('time');
      time.className = 'message-time';
      time.dateTime = message.created_at || '';
      time.textContent = formatMessageTime(createdAt);
      bubble.append(body, time);

      if (mine) {
        row.appendChild(bubble);
      } else {
        row.append(bubble, createReportButton(message.id));
      }
      el.messageList.appendChild(row);
    });
    refreshIcons(el.messageList);
    requestAnimationFrame(() => { el.messageList.scrollTop = el.messageList.scrollHeight; });
  }

  function createReportButton(messageId) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'report-message';
    button.dataset.reportMessageId = messageId;
    button.setAttribute('aria-label', 'Mesajı şikâyet et');
    button.title = 'Mesajı şikâyet et';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'flag');
    button.appendChild(icon);
    return button;
  }

  async function markConversationRead(conversationId) {
    if (!isUUID(conversationId) || state.selectedId !== conversationId) return;
    try {
      const result = await timed(ASDFL.supabase.rpc('mark_conversation_read', {
        target_conversation_id: conversationId
      }));
      if (result.error) throw result.error;
      const conversation = state.conversations.find(item => item.id === conversationId);
      if (conversation) conversation.isUnread = false;
      renderConversationList();
    } catch (error) {
      console.warn('Okundu bilgisi güncellenemedi:', error?.message || error);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const conversation = getSelectedConversation();
    const body = el.messageInput.value.trim();
    if (!conversation || state.sending || conversation.isBlocked) return;
    if (body.length < 1 || body.length > MAX_MESSAGE_LENGTH) {
      showToast(`Mesaj 1 ile ${MAX_MESSAGE_LENGTH} karakter arasında olmalı.`, 'error');
      el.messageInput.focus();
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
      el.messageInput.value = '';
      updateComposerMetrics();
      await Promise.all([
        loadMessages(conversation.id),
        loadConversations({ silent: true })
      ]);
      el.messageInput.focus();
    } catch (error) {
      console.warn('Mesaj gönderilemedi; güvenlik nedeniyle ayrıntı gösterilmedi.');
      showToast('Mesaj gönderilemedi. Bu konuşma şu anda kullanılamıyor.', 'error');
    } finally {
      state.sending = false;
      updateComposerState();
    }
  }

  function updateComposerMetrics() {
    const length = el.messageInput.value.length;
    el.messageCharCount.textContent = `${length} / ${MAX_MESSAGE_LENGTH}`;
    el.messageInput.style.height = 'auto';
    const nextHeight = Math.min(el.messageInput.scrollHeight, 140);
    el.messageInput.style.height = `${nextHeight}px`;
    el.messageInput.style.overflowY = el.messageInput.scrollHeight > 140 ? 'auto' : 'hidden';
    updateComposerState();
  }

  function updateComposerState() {
    const conversation = getSelectedConversation();
    const unavailable = !conversation || conversation.isBlocked;
    el.messageInput.disabled = unavailable || state.sending;
    el.sendMessageButton.disabled = unavailable || state.sending || !el.messageInput.value.trim();
    el.sendMessageButton.querySelector('span').textContent = state.sending ? 'Gönderiliyor' : 'Gönder';
    el.sendMessageButton.setAttribute('aria-label', state.sending ? 'Mesaj gönderiliyor' : 'Mesajı gönder');
  }

  function openBlockDialog() {
    const conversation = getSelectedConversation();
    if (!conversation) return;
    const willBlock = !conversation.isBlocked;
    el.blockDialogTitle.textContent = willBlock
      ? `${conversation.other.name || 'Bu kullanıcı'} engellensin mi?`
      : `${conversation.other.name || 'Bu kullanıcı'} için engel kaldırılsın mı?`;
    el.blockDialogCopy.textContent = willBlock
      ? 'Engellediğinizde birbirinize yeni mesaj gönderemezsiniz. Bu tercihi daha sonra kaldırabilirsiniz.'
      : 'Engeli kaldırdığınızda yeniden mesaj gönderebilirsiniz.';
    el.confirmBlockButton.textContent = willBlock ? 'Engelle' : 'Engeli kaldır';
    el.confirmBlockButton.classList.toggle('danger', willBlock);
    el.confirmBlockButton.classList.toggle('primary', !willBlock);
    el.blockDialog.showModal();
  }

  async function applyBlockPreference() {
    const conversation = getSelectedConversation();
    if (!conversation || !isUUID(conversation.other.id)) return;
    const shouldBlock = !conversation.isBlocked;
    el.blockUserButton.disabled = true;
    try {
      const result = await timed(ASDFL.supabase.rpc('set_user_block', {
        target_user_id: conversation.other.id,
        should_block: shouldBlock
      }));
      if (result.error) throw result.error;
      conversation.isBlocked = shouldBlock;
      updateThreadHeader(conversation);
      renderConversationList();
      showToast(shouldBlock ? 'Kullanıcı engellendi.' : 'Kullanıcı engeli kaldırıldı.');
    } catch (error) {
      console.warn('Engelleme tercihi güncellenemedi:', error?.message || error);
      showToast('Bu tercih şu anda güncellenemiyor.', 'error');
    } finally {
      el.blockUserButton.disabled = false;
    }
  }

  function openReportDialog(messageId) {
    const message = state.messages.get(messageId);
    if (!message || message.sender_id === state.user?.id) return;
    state.reportingMessageId = messageId;
    el.reportReason.value = '';
    updateReportMetrics();
    el.reportDialog.showModal();
    setTimeout(() => el.reportReason.focus(), 0);
  }

  function closeReportDialog() {
    state.reportingMessageId = null;
    if (el.reportDialog.open) el.reportDialog.close();
  }

  function updateReportMetrics() {
    el.reportReasonCount.textContent = `${el.reportReason.value.length} / ${MAX_REPORT_LENGTH}`;
  }

  async function submitReport(event) {
    event.preventDefault();
    const messageId = state.reportingMessageId;
    const reason = el.reportReason.value.trim();
    if (!isUUID(messageId) || reason.length < 1 || reason.length > MAX_REPORT_LENGTH) {
      showToast(`Şikâyet nedeni 1 ile ${MAX_REPORT_LENGTH} karakter arasında olmalı.`, 'error');
      el.reportReason.focus();
      return;
    }

    el.submitReportButton.disabled = true;
    el.submitReportButton.textContent = 'Gönderiliyor…';
    try {
      const result = await timed(ASDFL.supabase.rpc('report_message', {
        target_message_id: messageId,
        report_reason: reason
      }));
      if (result.error) throw result.error;
      closeReportDialog();
      showToast('Şikâyetiniz inceleme için gönderildi.');
    } catch (error) {
      console.warn('Mesaj şikâyeti gönderilemedi:', error?.message || error);
      showToast('Şikâyet şu anda gönderilemiyor.', 'error');
    } finally {
      el.submitReportButton.disabled = false;
      el.submitReportButton.textContent = 'Gönder';
    }
  }

  function setupLiveUpdates() {
    cleanupLiveUpdates();
    startPolling();
    try {
      state.realtimeChannel = ASDFL.supabase
        .channel(`direct-messages-${state.user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
          handleMessageRealtime(payload.new);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${state.user.id}` }, () => {
          loadConversations({ silent: true });
        })
        .subscribe(status => {
          if (status === 'SUBSCRIBED') pollUpdates();
          if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) startPolling();
        });
    } catch (error) {
      console.warn('Anlık mesaj bağlantısı kurulamadı:', error?.message || error);
      startPolling();
    }
  }

  async function handleMessageRealtime(message) {
    if (!message || !isUUID(message.conversation_id)) return;
    await loadConversations({ silent: true });
    if (state.selectedId === message.conversation_id) {
      await loadMessages(message.conversation_id);
      if (document.visibilityState === 'visible') await markConversationRead(message.conversation_id);
    }
  }

  function startPolling() {
    if (state.pollTimer || !state.user || !ASDFL.supabase) return;
    state.pollTimer = window.setInterval(pollUpdates, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (!state.pollTimer) return;
    window.clearInterval(state.pollTimer);
    state.pollTimer = null;
  }

  async function pollUpdates() {
    if (state.pollingBusy || document.visibilityState === 'hidden') return;
    state.pollingBusy = true;
    try {
      await loadConversations({ silent: true });
      if (state.selectedId) {
        await loadMessages(state.selectedId);
        if (getSelectedConversation()?.isUnread) await markConversationRead(state.selectedId);
      }
    } finally {
      state.pollingBusy = false;
    }
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && state.user) pollUpdates();
  }

  function cleanupLiveUpdates() {
    stopPolling();
    if (state.realtimeChannel && ASDFL.supabase) {
      ASDFL.supabase.removeChannel(state.realtimeChannel);
    }
    state.realtimeChannel = null;
  }

  function renderAvatar(container, profile) {
    container.replaceChildren();
    const safeAvatar = ASDFL.safeURL(profile?.avatar_url || '');
    if (safeAvatar) {
      const image = document.createElement('img');
      image.src = safeAvatar;
      image.alt = '';
      image.loading = 'lazy';
      container.appendChild(image);
      return;
    }
    container.textContent = ASDFL.getInitials(profile?.name || 'ASDFL');
  }

  function getSelectedConversation() {
    return state.conversations.find(item => item.id === state.selectedId) || null;
  }

  function formatListTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Dün';
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  }

  function formatMessageDay(date) {
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return 'Bugün';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Dün';
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatMessageTime(date) {
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  function replaceLocationQuery(query) {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    if (query?.conversation && isUUID(query.conversation)) {
      url.searchParams.set('conversation', query.conversation);
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }

  function showToast(message, type = 'success') {
    window.clearTimeout(state.toastTimer);
    el.messagesToast.textContent = message;
    el.messagesToast.className = `messages-toast show${type === 'error' ? ' error' : ''}`;
    state.toastTimer = window.setTimeout(() => {
      el.messagesToast.className = 'messages-toast';
    }, 3500);
  }

  function timed(query) {
    return ASDFL.queryWithTimeout(query, 9000);
  }

  function isUUID(value) {
    return typeof value === 'string' && UUID_PATTERN.test(value);
  }

  function refreshIcons(root) {
    if (ASDFL.refreshIcons) ASDFL.refreshIcons(root || document);
    else if (window.lucide) window.lucide.createIcons({ attrs: {}, nameAttr: 'data-lucide' });
  }
})();
