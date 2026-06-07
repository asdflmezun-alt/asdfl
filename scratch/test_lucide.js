const fs = require('fs');
const { JSDOM } = require('jsdom');

async function main() {
  console.log('Fetching Lucide script from unpkg...');
  const res = await fetch('https://unpkg.com/lucide@latest');
  const lucideCode = await res.text();
  console.log('Lucide script fetched successfully! Length:', lucideCode.length);

  const html = fs.readFileSync('c:\\Users\\alika\\Desktop\\asdfl mezunlar derneği\\profil.html', 'utf8');
  
  const dom = new JSDOM(html, { runScripts: "dangerously" });
  const { window } = dom;
  const { document } = window;

  // Define global variables that the page script might expect to avoid errors
  window.ASDFL = {
    currentUser: {
      id: 'test',
      name: 'Ali Kağan Bayram',
      role: 'Mezun',
      email: 'ali@test.com',
      avatar_url: '',
      instagram_url: 'https://instagram.com/test'
    },
    waitForAuth: () => Promise.resolve(),
    getInitials: () => 'AKB',
    initReveal: () => {},
    toast: (msg) => console.log(`Toast: ${msg}`)
  };
  
  window.TURKISH_UNIVERSITIES = [];

  // Inject Lucide script
  const scriptEl = document.createElement('script');
  scriptEl.textContent = lucideCode;
  document.head.appendChild(scriptEl);

  console.log('window.lucide exists:', !!window.lucide);

  const instagramEl = document.getElementById('social-instagram');
  console.log('Before createIcons, instagramEl innerHTML:', instagramEl.outerHTML);

  // Run lucide.createIcons
  try {
    window.lucide.createIcons();
    console.log('After createIcons, instagramEl innerHTML:', instagramEl.outerHTML);
  } catch (err) {
    console.error('Error running createIcons:', err);
  }
}

main().catch(console.error);
