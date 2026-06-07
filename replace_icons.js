const fs = require('fs');
const path = require('path');

const htmlFiles = ['index.html', 'mezunlar.html', 'etkinlikler.html', 'galeri.html', 'burs-mentorluk.html'];
const jsFiles = ['js/app.js', 'js/home.js', 'js/mezunlar.js', 'js/etkinlikler.js', 'js/galeri.js', 'js/burs.js'];

const replacements = {
  '🏠': '<i data-lucide="home" style="width:1.2rem;height:1.2rem"></i>',
  '👥': '<i data-lucide="users" style="width:1.2rem;height:1.2rem"></i>',
  '📢': '<i data-lucide="megaphone" style="width:1.2rem;height:1.2rem"></i>',
  '📸': '<i data-lucide="image" style="width:1.2rem;height:1.2rem"></i>',
  '🏆': '<i data-lucide="award" style="width:1.2rem;height:1.2rem"></i>',
  '🔬': '<i data-lucide="microscope" style="width:1em;height:1em"></i>',
  '🎓': '<i data-lucide="graduation-cap" style="width:1em;height:1em"></i>',
  '📅': '<i data-lucide="calendar" style="width:1em;height:1em"></i>',
  '🤝': '<i data-lucide="handshake" style="width:1em;height:1em"></i>',
  '✨': '<i data-lucide="sparkles" style="width:1em;height:1em"></i>',
  '📋': '<i data-lucide="clipboard-list" style="width:1em;height:1em"></i>',
  '📊': '<i data-lucide="bar-chart" style="width:1em;height:1em"></i>',
  '📞': '<i data-lucide="phone" style="width:1em;height:1em"></i>',
  '💝': '<i data-lucide="heart-handshake" style="width:1em;height:1em"></i>',
  '💰': '<i data-lucide="coins" style="width:1em;height:1em"></i>',
  '📚': '<i data-lucide="book-open" style="width:1em;height:1em"></i>',
  '⭐': '<i data-lucide="star" style="width:1em;height:1em"></i>',
  '🔍': '<i data-lucide="search" style="width:1em;height:1em"></i>',
  '📁': '<i data-lucide="folder" style="width:1em;height:1em"></i>',
  '🏫': '<i data-lucide="school" style="width:1em;height:1em"></i>',
  '⚽': '<i data-lucide="dribbble" style="width:1em;height:1em"></i>',
  '🌍': '<i data-lucide="globe" style="width:1em;height:1em"></i>',
  '📷': '<i data-lucide="camera" style="width:1em;height:1em"></i>',
  '🎉': '<i data-lucide="party-popper" style="width:1em;height:1em"></i>',
  '♟️': '<i data-lucide="puzzle" style="width:1em;height:1em"></i>',
  '🏃': '<i data-lucide="activity" style="width:1em;height:1em"></i>',
  '🌉': '<i data-lucide="bridge" style="width:1em;height:1em"></i>',
  '📍': '<i data-lucide="map-pin" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i>',
  '💼': '<i data-lucide="briefcase" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i>',
  '🕐': '<i data-lucide="clock" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i>',
  '👤': '<i data-lucide="user" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i>',
  '❤️': '<i data-lucide="heart" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i>',
  '💬': '<i data-lucide="message-circle" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i>',
  '📌': '<i data-lucide="pin" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i>',
  '⬇️': '<i data-lucide="download" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i>',
  '🔖': '<i data-lucide="bookmark" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i>',
  '✅': '<i data-lucide="check-circle" style="width:1.2rem;height:1.2rem"></i>',
  '⚠️': '<i data-lucide="alert-triangle" style="width:1.2rem;height:1.2rem"></i>',
  '❌': '<i data-lucide="x-circle" style="width:1.2rem;height:1.2rem"></i>',
  'ℹ️': '<i data-lucide="info" style="width:1.2rem;height:1.2rem"></i>',
  '›': '<i data-lucide="chevron-right" style="width:1.2rem;height:1.2rem"></i>',
  '🗓️': '<i data-lucide="calendar-check" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i>',
  '📭': '<i data-lucide="mailbox" style="width:1em;height:1em"></i>',
  '✕': '<i data-lucide="x" style="width:1em;height:1em"></i>',
  '↓': '<i data-lucide="arrow-down" style="width:1em;height:1em"></i>',
  '→': '<i data-lucide="arrow-right" style="width:1em;height:1em"></i>'
};

[...htmlFiles, ...jsFiles].forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  for (const [emoji, iconHtml] of Object.entries(replacements)) {
    content = content.split(emoji).join(iconHtml);
  }
  fs.writeFileSync(f, content);
});

// app.js dosyasına lucide.createIcons(); çağrısını ekle
let appJsContent = fs.readFileSync('js/app.js', 'utf8');
if (!appJsContent.includes('lucide.createIcons()')) {
  appJsContent = appJsContent.replace('this.setActiveNav();', 'this.setActiveNav();\n    lucide.createIcons();');
  fs.writeFileSync('js/app.js', appJsContent);
}

// diğer JS dosyalarında render sonraları da lucide.createIcons() lazım
const refreshLucideScripts = ['js/home.js', 'js/mezunlar.js', 'js/etkinlikler.js', 'js/galeri.js', 'js/burs.js'];
refreshLucideScripts.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (!content.includes('lucide.createIcons()')) {
    content = content.replace(/ASDFL\.initReveal\(\);/g, 'ASDFL.initReveal();\n    setTimeout(() => lucide.createIcons(), 10);');
    fs.writeFileSync(f, content);
  }
});

console.log('Icons replaced successfully.');
