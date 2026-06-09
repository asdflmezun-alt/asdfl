const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/alika/Desktop/asdfl mezunlar derneği';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace <script src="js/app.js"></script> or <script src="js/app.js?v=..." with js/app.js?v=1.3
  const regex = /<script src="js\/app\.js(?:\?v=[\d\.]+)?"><\/script>/g;
  if (regex.test(content)) {
    content = content.replace(regex, '<script src="js/app.js?v=1.3"></script>');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
