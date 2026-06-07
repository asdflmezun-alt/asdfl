const fs = require('fs');
const files = ['galeri.html', 'burs-mentorluk.html'];

const newModals = `<!-- LOGIN MODAL -->
<div class="modal-overlay" id="loginModal" onclick="if(event.target===this)ASDFL.closeModal('loginModal')">
  <div class="modal">
    <button class="modal-close" onclick="ASDFL.closeModal('loginModal')"><i data-lucide="x" style="width:1em;height:1em"></i></button>
    <div style="text-align:center;margin-bottom:1.5rem">
      <div style="font-size:2.5rem;margin-bottom:.5rem"><i data-lucide="microscope" style="width:1em;height:1em"></i></div>
      <h3>ASDFL'ye Hoş Geldin</h3>
      <p style="font-size:.9rem;margin-top:.25rem">E-posta ve şifrenizle giriş yapın</p>
    </div>
    <div class="form-group">
      <label class="form-label">E-posta</label>
      <input type="email" class="form-input" placeholder="ornek@email.com" id="loginEmail">
    </div>
    <div class="form-group">
      <label class="form-label">Şifre</label>
      <input type="password" class="form-input" placeholder="••••••••" id="loginPass">
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:.5rem" onclick="ASDFL.handleLogin('loginEmail', 'loginPass')">Giriş Yap</button>
    <div class="divider"></div>
    <p style="text-align:center;font-size:.88rem">Henüz üye değil misin? <a href="javascript:void(0)" onclick="ASDFL.closeModal('loginModal');ASDFL.openModal('registerModal')">Kayıt Ol</a></p>
  </div>
</div>

<!-- REGISTER MODAL -->
<div class="modal-overlay" id="registerModal" onclick="if(event.target===this)ASDFL.closeModal('registerModal')">
  <div class="modal">
    <button class="modal-close" onclick="ASDFL.closeModal('registerModal')"><i data-lucide="x" style="width:1em;height:1em"></i></button>
    <div style="text-align:center;margin-bottom:1.5rem">
      <div style="font-size:2.5rem;margin-bottom:.5rem"><i data-lucide="user-plus" style="width:1em;height:1em"></i></div>
      <h3>Aileye Katıl</h3>
      <p style="font-size:.9rem;margin-top:.25rem">Mezun, öğrenci veya öğretmen olarak kayıt ol</p>
    </div>
    
    <div class="form-group">
      <label class="form-label">Üyelik Rolü</label>
      <select class="form-select" id="regRole" onchange="toggleRegFields(this.value)">
        <option value="Mezun">Mezun</option>
        <option value="Öğrenci">Aktif Öğrenci</option>
        <option value="Öğretmen">Öğretmen / İdari Kadro</option>
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">Ad Soyad</label>
      <input type="text" class="form-input" placeholder="Adınız Soyadınız" id="regName">
    </div>

    <!-- Mezun Alanları -->
    <div id="mezunFields">
      <div class="form-group">
        <label class="form-label">Mezuniyet Yılı</label>
        <input type="number" class="form-input" placeholder="Örn: 2015" id="regGradYear">
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Meslek</label>
          <input type="text" class="form-input" placeholder="Örn: Doktor" id="regJob">
        </div>
        <div class="form-group">
          <label class="form-label">Yaşadığı Şehir</label>
          <input type="text" class="form-input" placeholder="Örn: Ankara" id="regCity">
        </div>
      </div>
    </div>

    <!-- Öğrenci Alanları -->
    <div id="ogrenciFields" class="form-group hidden">
      <label class="form-label">Sınıf</label>
      <select class="form-select" id="regGrade">
        <option value="9. Sınıf">9. Sınıf</option>
        <option value="10. Sınıf">10. Sınıf</option>
        <option value="11. Sınıf">11. Sınıf</option>
        <option value="12. Sınıf">12. Sınıf</option>
      </select>
    </div>

    <!-- Öğretmen Alanları -->
    <div id="ogretmenFields" class="hidden">
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Branş</label>
          <input type="text" class="form-input" placeholder="Örn: Matematik" id="regBranch">
        </div>
        <div class="form-group">
          <label class="form-label">Görev Yılı</label>
          <input type="number" class="form-input" placeholder="Örn: 2010" id="regTeachingYear">
        </div>
      </div>
    </div>

    <div class="form-group" style="margin-top:1rem">
      <label class="form-label">E-posta</label>
      <input type="email" class="form-input" placeholder="ornek@email.com" id="regEmail">
    </div>
    <div class="form-group">
      <label class="form-label">Şifre</label>
      <input type="password" class="form-input" placeholder="••••••••" id="regPass">
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:.5rem" onclick="ASDFL.handleRegister()">Kayıt Ol</button>
    <div class="divider"></div>
    <p style="text-align:center;font-size:.88rem">Zaten üye misin? <a href="javascript:void(0)" onclick="ASDFL.closeModal('registerModal');ASDFL.openModal('loginModal')">Giriş Yap</a></p>
  </div>
</div>

<script>
function toggleRegFields(role) {
  document.getElementById('mezunFields').classList.toggle('hidden', role !== 'Mezun');
  document.getElementById('ogrenciFields').classList.toggle('hidden', role !== 'Öğrenci');
  document.getElementById('ogretmenFields').classList.toggle('hidden', role !== 'Öğretmen');
}
</script>

`;

files.forEach(f => {
  let text = fs.readFileSync(f, 'utf8');
  // Zaten eklenmişse ekleme
  if (!text.includes('id="registerModal"')) {
    text = text.replace('<div class="toast-container"></div>', newModals + '<div class="toast-container"></div>');
    fs.writeFileSync(f, text);
    console.log('Updated ' + f);
  }
});
