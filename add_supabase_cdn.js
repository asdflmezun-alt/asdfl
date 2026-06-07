const fs = require('fs');
const files = ['index.html', 'mezunlar.html', 'etkinlikler.html', 'galeri.html', 'burs-mentorluk.html'];

files.forEach(f => {
  let text = fs.readFileSync(f, 'utf8');
  if (!text.includes('@supabase/supabase-js')) {
    text = text.replace('<script src="js/app.js"></script>', '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n<script src="js/app.js"></script>');
    fs.writeFileSync(f, text);
    console.log('Added Supabase CDN to ' + f);
  }
});
