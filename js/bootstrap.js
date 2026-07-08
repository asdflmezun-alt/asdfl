(function bootstrapSecurityHelpers() {
  window.safeHTML = function safeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  window.safeURL = function safeURL(value) {
    const input = String(value || '');
    if (/^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(input)) return input;
    try {
      const url = new URL(input, window.location.origin);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
    } catch (error) {
      return '';
    }
  };

  if ('serviceWorker' in navigator) {
    const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    window.addEventListener('load', () => {
      if (isLocalDev) {
        // Yerel geliştirmede SW devre dışı: eski kayıt ve önbellekler bayat dosya
        // servis etmesin diye temizlenir.
        navigator.serviceWorker.getRegistrations()
          .then(regs => regs.forEach(reg => reg.unregister()))
          .catch(() => {});
        if (window.caches) {
          caches.keys()
            .then(keys => keys.forEach(key => { if (key.startsWith('asdfl-')) caches.delete(key); }))
            .catch(() => {});
        }
        return;
      }
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  // ---- PWA Install Prompt for Mobile Users ----
  let deferredPrompt;
  
  // 1. Android/Chrome/Edge support via beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent default browser install prompt
    e.preventDefault();
    deferredPrompt = e;
    
    // Check if user is on mobile/tablet viewport or device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
      || (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
      
    if (!isMobile) return;
    
    // Do not show if they previously dismissed it
    if (localStorage.getItem('asdfl_pwa_dismissed') === 'true') {
      return;
    }
    
    showInstallPromotion();
  });

  // 2. iOS Safari support via userAgent and standalone checks
  window.addEventListener('load', () => {
    // Check if user is on iOS device (iPhone/iPad/iPod or iPadOS 13+ Macintosh touch points)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.platform) 
      || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /Macintosh/.test(navigator.userAgent));
    
    // Check if running as standalone PWA already
    const isStandalone = window.navigator.standalone === true 
      || window.matchMedia('(display-mode: standalone)').matches;

    if (isIOS && !isStandalone) {
      // Do not show if they previously dismissed it
      if (localStorage.getItem('asdfl_pwa_dismissed') === 'true') {
        return;
      }
      // Show iOS smart banner after 2.5 seconds
      setTimeout(showIOSInstallPromotion, 2500);
    }
  });
  
  function showInstallPromotion() {
    if (document.getElementById('pwaInstallPrompt')) return;
    
    const banner = document.createElement('div');
    banner.id = 'pwaInstallPrompt';
    banner.style.cssText = `
      position: fixed;
      bottom: 1.5rem;
      left: 0;
      right: 0;
      margin: 0 auto;
      background: var(--navy-800, #0a0f24);
      border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
      border-radius: 50px;
      padding: 0.6rem 1rem 0.6rem 1.2rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), 0 0 15px rgba(244,168,54,0.1);
      z-index: 99999;
      animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      width: max-content;
      max-width: 90vw;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    `;
    
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;" id="pwaInstallTrigger">
        <div style="width:28px;height:28px;background:linear-gradient(135deg,#f4a836,#b87c1c);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#05111e;flex-shrink:0;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download-cloud"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/></svg>
        </div>
        <span style="color:#fff;font-size:0.82rem;font-weight:600;font-family:'Inter',sans-serif;white-space:nowrap;">Uygulamayı Ana Ekrana Ekle</span>
      </div>
      <button id="pwaInstallClose" style="background:transparent;border:none;color:#8f9cae;cursor:pointer;padding:0.2rem;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:all 0.2s;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    `;
    
    document.documentElement.appendChild(banner);
    
    document.getElementById('pwaInstallTrigger').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      banner.remove();
    });
    
    const closeBtn = document.getElementById('pwaInstallClose');
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255,255,255,0.05)';
      closeBtn.style.color = '#fff';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'transparent';
      closeBtn.style.color = '#8f9cae';
    });
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      localStorage.setItem('asdfl_pwa_dismissed', 'true');
      banner.style.opacity = '0';
      banner.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      banner.style.transform = 'translateY(20px)';
      setTimeout(() => banner.remove(), 300);
    });
  }

  function showIOSInstallPromotion() {
    if (document.getElementById('pwaInstallPrompt')) return;
    
    const banner = document.createElement('div');
    banner.id = 'pwaInstallPrompt';
    banner.style.cssText = `
      position: fixed;
      bottom: 1.5rem;
      left: 0;
      right: 0;
      margin: 0 auto;
      background: var(--navy-800, #0a0f24);
      border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
      border-radius: var(--radius-lg, 16px);
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), 0 0 15px rgba(244,168,54,0.1);
      z-index: 99999;
      animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      width: 320px;
      max-width: 90vw;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    `;
    
    banner.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <div style="width:24px;height:24px;background:linear-gradient(135deg,#f4a836,#b87c1c);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#05111e;flex-shrink:0;">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download-cloud"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/></svg>
          </div>
          <span style="color:#fff;font-size:0.85rem;font-weight:700;font-family:'Outfit',sans-serif;">ASDFL Mobil Uygulama</span>
        </div>
        <button id="pwaInstallClose" style="background:transparent;border:none;color:#8f9cae;cursor:pointer;padding:0.2rem;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:all 0.2s;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <p style="margin:0;color:#cdd5e0;font-size:0.78rem;line-height:1.4;font-family:'Inter',sans-serif;">
        Uygulamayı ana ekranınıza eklemek için tarayıcınızın <strong>Paylaş</strong> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;color:#f4a836;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> simgesine ve ardından <strong>Ana Ekrana Ekle</strong> seçeneğine dokunun.
      </p>
    `;
    
    document.documentElement.appendChild(banner);
    
    const closeBtn = document.getElementById('pwaInstallClose');
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255,255,255,0.05)';
      closeBtn.style.color = '#fff';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'transparent';
      closeBtn.style.color = '#8f9cae';
    });
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      localStorage.setItem('asdfl_pwa_dismissed', 'true');
      banner.style.opacity = '0';
      banner.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      banner.style.transform = 'translateY(20px)';
      setTimeout(() => banner.remove(), 300);
    });
  }
  
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const banner = document.getElementById('pwaInstallPrompt');
    if (banner) banner.remove();
  });
})();
