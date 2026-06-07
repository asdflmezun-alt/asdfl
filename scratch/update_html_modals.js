const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));

const oldBlock = `<div class="grid-2">
        <div class="form-group">
          <label class="form-label">Meslek</label>
          <input type="text" class="form-input" placeholder="Örn: Doktor" id="regJob">
        </div>
        <div class="form-group">
          <label class="form-label">Yaşadığı Şehir</label>
          <input type="text" class="form-input" placeholder="Örn: Ankara" id="regCity">
        </div>
      </div>`;

const newBlock = `<div class="grid-2">
        <div class="form-group">
          <label class="form-label">Meslek</label>
          <input type="text" class="form-input" placeholder="Örn: Doktor" id="regJob">
        </div>
        <div class="form-group">
          <label class="form-label">Çalıştığı Kurum / Şirket</label>
          <input type="text" class="form-input" placeholder="Örn: Hacettepe Üni. / Şehir Hastanesi" id="regCompany">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Yaşadığı Şehir</label>
        <input type="text" class="form-input" placeholder="Örn: Ankara" id="regCity">
      </div>`;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('id="regJob"') && !content.includes('id="regCompany"')) {
    if (content.includes(oldBlock)) {
      content = content.replace(oldBlock, newBlock);
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Successfully updated ${file}`);
    } else {
      // In case of slight whitespace variations, attempt a more robust search
      const normalizedContent = content.replace(/\s+/g, ' ');
      const normalizedOld = oldBlock.replace(/\s+/g, ' ');
      
      if (normalizedContent.includes(normalizedOld)) {
        // Fallback robust replace
        console.log(`Whitespace variance found in ${file}. Attempting robust inline replace.`);
        // Let's do a simple regex or substring replacement
        const targetStr = 'id="regJob"';
        const targetIndex = content.indexOf(targetStr);
        if (targetIndex !== -1) {
          // Find the parent div grid-2 or form-group closing
          // For simplicity, we can do it via a simpler block search
          const simplerOld = `<div class="form-group">
          <label class="form-label">Meslek</label>
          <input type="text" class="form-input" placeholder="Örn: Doktor" id="regJob">
        </div>`;
          const simplerNew = `<div class="form-group">
          <label class="form-label">Meslek</label>
          <input type="text" class="form-input" placeholder="Örn: Doktor" id="regJob">
        </div>
        <div class="form-group">
          <label class="form-label">Çalıştığı Kurum / Şirket</label>
          <input type="text" class="form-input" placeholder="Örn: Hacettepe Üni. / Şehir Hastanesi" id="regCompany">
        </div>`;
          if (content.includes(simplerOld)) {
            // Also need to adjust the grid-2 container wrapping it to flex or make it grid-3 or full-width city
            // The original structure has:
            // <div class="grid-2"> <form-group regJob> <form-group regCity> </div class="grid-2">
            // If we replace regJob group with regJob + regCompany, they are both in grid-2, and we move regCity outside.
            // Let's do a precise multi-line replacement by ignoring carriage returns (\r)
            const cleanContent = content.replace(/\r\n/g, '\n');
            const cleanOld = oldBlock.replace(/\r\n/g, '\n');
            const cleanNew = newBlock.replace(/\r\n/g, '\n');
            if (cleanContent.includes(cleanOld)) {
              content = cleanContent.replace(cleanOld, cleanNew);
              fs.writeFileSync(file, content, 'utf8');
              console.log(`Robust newline update successful in ${file}`);
            } else {
              console.log(`Could not automatically match registration block in ${file}.`);
            }
          }
        }
      }
    }
  } else {
    console.log(`Skipped ${file} (already updated or no regJob field found)`);
  }
});
