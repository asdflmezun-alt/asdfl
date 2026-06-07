const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));

const oldRegCityBlock = `<div class="form-group">
        <label class="form-label">Yaşadığı Şehir</label>
        <input type="text" class="form-input" placeholder="Örn: Ankara" id="regCity">
      </div>`;

const newRegCityBlock = `<div class="form-group">
        <label class="form-label">Yaşadığı Şehir</label>
        <select class="form-select" id="regCity"><option value="" disabled selected>Şehir Seçin</option></select>
      </div>`;

const oldEditCityBlock = `<div class="form-group role-field role-mezun">
          <label class="form-label">Yaşadığı Şehir</label>
          <input type="text" class="form-input" id="editCity" placeholder="Örn: Ankara">
        </div>`;

const newEditCityBlock = `<div class="form-group role-field role-mezun">
          <label class="form-label">Yaşadığı Şehir</label>
          <select class="form-select" id="editCity"><option value="" disabled selected>Şehir Seçin</option></select>
        </div>`;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let updated = false;

  // Normalize newlines for robust matching
  const cleanContent = content.replace(/\r\n/g, '\n');
  const cleanOldReg = oldRegCityBlock.replace(/\r\n/g, '\n');
  const cleanNewReg = newRegCityBlock.replace(/\r\n/g, '\n');
  const cleanOldEdit = oldEditCityBlock.replace(/\r\n/g, '\n');
  const cleanNewEdit = newEditCityBlock.replace(/\r\n/g, '\n');

  let temp = cleanContent;
  if (temp.includes(cleanOldReg)) {
    temp = temp.replace(cleanOldReg, cleanNewReg);
    updated = true;
  }
  if (temp.includes(cleanOldEdit)) {
    temp = temp.replace(cleanOldEdit, cleanNewEdit);
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(file, temp, 'utf8');
    console.log(`Updated city fields to dropdown in ${file}`);
  } else {
    console.log(`Skipped ${file} (no match or already updated)`);
  }
});
