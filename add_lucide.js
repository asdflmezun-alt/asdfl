const fs = require('fs');

const files = ['index.html', 'mezunlar.html', 'etkinlikler.html', 'galeri.html', 'burs-mentorluk.html'];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (!content.includes('unpkg.com/lucide@0.577.0')) {
    content = content.replace('</head>', '<script src="assets/vendor/lucide.js"></script>\n</head>');
    fs.writeFileSync(f, content);
  }
});

console.log('Lucide script added to all files.');
