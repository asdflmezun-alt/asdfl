const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));

const oldNavbarLink = `<li><a href="burs-mentorluk.html"><i data-lucide="award" style="width:1.2rem;height:1.2rem"></i> Burs &amp; Mentörlük</a></li>`;
const newNavbarLink = `<li><a href="burs-mentorluk.html"><i data-lucide="award" style="width:1.2rem;height:1.2rem"></i> Burs &amp; Mentörlük</a></li>
    <li><a href="kariyer.html"><i data-lucide="briefcase" style="width:1.2rem;height:1.2rem"></i> Kariyer Ağı</a></li>`;

const oldNavbarLink2 = `<li><a href="burs-mentorluk.html"><i data-lucide="award" style="width:1.2rem;height:1.2rem"></i> Burs &amp; Mentörlük</a></li>`;
const newNavbarLink2 = `<li><a href="burs-mentorluk.html"><i data-lucide="award" style="width:1.2rem;height:1.2rem"></i> Burs &amp; Mentörlük</a></li>\n    <li><a href="kariyer.html"><i data-lucide="briefcase" style="width:1.2rem;height:1.2rem"></i> Kariyer Ağı</a></li>`;

// Footer links variations
const oldFooterLink = `<li><a href="burs-mentorluk.html">Burs Programı</a></li>`;
const newFooterLink = `<li><a href="burs-mentorluk.html">Burs Programı</a></li>
          <li><a href="kariyer.html">Kariyer Ağı</a></li>`;

const oldFooterLink2 = `<li><a href="burs-mentorluk.html#basvuru">Burs Başvurusu</a></li>`;
const newFooterLink2 = `<li><a href="burs-mentorluk.html#basvuru">Burs Başvurusu</a></li>
          <li><a href="kariyer.html">Kariyer Ağı</a></li>`;

const oldFooterLink3 = `<li><a href="burs-mentorluk.html">Burs Programı</a></li>`;
const newFooterLink3 = `<li><a href="burs-mentorluk.html">Burs Programı</a></li>\n          <li><a href="kariyer.html">Kariyer Ağı</a></li>`;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let updated = false;

  // Clean CR for uniform matching
  const cleanContent = content.replace(/\r\n/g, '\n');
  
  let temp = cleanContent;
  
  if (temp.includes(oldNavbarLink.replace(/\r\n/g, '\n'))) {
    temp = temp.replace(oldNavbarLink.replace(/\r\n/g, '\n'), newNavbarLink.replace(/\r\n/g, '\n'));
    updated = true;
  }
  
  if (temp.includes(oldFooterLink.replace(/\r\n/g, '\n'))) {
    temp = temp.replace(oldFooterLink.replace(/\r\n/g, '\n'), newFooterLink.replace(/\r\n/g, '\n'));
    updated = true;
  } else if (temp.includes(oldFooterLink2.replace(/\r\n/g, '\n'))) {
    temp = temp.replace(oldFooterLink2.replace(/\r\n/g, '\n'), newFooterLink2.replace(/\r\n/g, '\n'));
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(file, temp, 'utf8');
    console.log(`Injected Career Network links in ${file}`);
  } else {
    console.log(`Skipped ${file} (already updated or no match found)`);
  }
});
