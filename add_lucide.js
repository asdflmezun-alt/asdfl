const fs = require('fs');

const files = ['index.html', 'mezunlar.html', 'etkinlikler.html', 'galeri.html', 'burs-mentorluk.html'];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (!content.includes('unpkg.com/lucide@latest')) {
    content = content.replace('</head>', '<script src="https://unpkg.com/lucide@latest"></script>\n</head>');
    fs.writeFileSync(f, content);
  }
});

console.log('Lucide script added to all files.');
