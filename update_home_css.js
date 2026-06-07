const fs = require('fs');
let css = fs.readFileSync('css/home.css', 'utf8');
css = css.replace('.school-badge-inner { text-align: center; }', '.school-badge-inner { display: none !important; }');
css = css.replace('.school-badge {\n  position: absolute;\n  top: 50%;\n  left: 50%;\n  transform: translate(-50%, -50%);\n  width: 160px;\n  height: 160px;\n  border-radius: 50%;\n  background: linear-gradient(135deg, var(--navy-700), var(--navy-800));\n  border: 2px solid rgba(244,168,54,.3);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  box-shadow: 0 0 60px rgba(244,168,54,.15), var(--shadow-lg);\n  animation: glow 3s ease-in-out infinite;\n  z-index: 2;\n}', '.school-badge {\n  position: absolute;\n  top: 50%;\n  left: 50%;\n  transform: translate(-50%, -50%);\n  width: 160px;\n  height: 160px;\n  border-radius: 50%;\n  background: url(\'../assets/images/logo.png\') center/contain no-repeat, var(--navy-800);\n  border: 2px solid rgba(244,168,54,.3);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  box-shadow: 0 0 60px rgba(244,168,54,.15), var(--shadow-lg);\n  animation: glow 3s ease-in-out infinite;\n  z-index: 2;\n}');
// If regex failed, let's do a simpler replace for the background only
if (!css.includes('logo.png')) {
  css = css.replace('background: linear-gradient(135deg, var(--navy-700), var(--navy-800));', 'background: url(\'../assets/images/logo.png\') center/contain no-repeat, var(--navy-800);');
}
fs.writeFileSync('css/home.css', css);
console.log('Logo updated in home.css');
