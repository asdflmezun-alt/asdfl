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
})();
