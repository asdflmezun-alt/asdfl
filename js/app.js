// ========================================
// ASDFL MEZUNLAR DERNEĞİ — DATA & APP STATE
// ========================================

// Demo data stored in localStorage on first load
const ASDFL = {
  version: '1.0.0',

  // ---- Supabase API Fetchers ----
  async fetchAlumni() {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Error fetching alumni:', error); return []; }
    return data.map(d => ({ ...d, initials: this.getInitials(d.name) }));
  },

  async fetchEvents() {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase.from('events').select('*').order('event_date', { ascending: true });
    if (error) { console.error('Error fetching events:', error); return []; }
    // Convert to camelCase to match previous demo structures if needed
    return data.map(d => ({ ...d, date: d.event_date, time: d.event_time }));
  },

  async fetchPosts() {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase.from('posts').select('*, profiles!author_id(name, role, avatar_url, grad_year)').order('created_at', { ascending: false });
    if (error) { console.error('Error fetching posts:', error); return []; }
    return data.map(p => ({
      ...p,
      author: p.profiles?.name || 'Kullanıcı',
      authorYear: p.profiles?.grad_year,
      initials: this.getInitials(p.profiles?.name || 'U')
    }));
  },

  async fetchScholarships() {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase.from('scholarships').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Error fetching scholarships:', error); return []; }
    return data;
  },

  async fetchGallery() {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase.from('gallery').select('*, profiles(name, avatar_url)').order('created_at', { ascending: false });
    if (error) { console.error('Error fetching gallery:', error); return []; }
    return data;
  },

  // ---- Career Network API ----
  async fetchJobPostings() {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('job_postings')
        .select('*, profiles!employer_id(name, role, grad_year, city, job, company)')
        .order('created_at', { ascending: false });
      if (error) { console.error('Error fetching job postings:', error); return []; }
      return data.map(jp => ({
        ...jp,
        employerName: jp.profiles?.name || 'Mezun',
        employerRole: jp.profiles?.role || 'Mezun',
        employerYear: jp.profiles?.grad_year,
        initials: this.getInitials(jp.profiles?.name || 'M')
      }));
    } else {
      let localJobs = JSON.parse(localStorage.getItem('asdfl_jobs') || '[]');
      if (localJobs.length === 0) {
        localJobs = [
          {
            id: 'job-1',
            employer_id: 'demo-employer-1',
            title: 'Yazılım Geliştirici Stajyeri',
            type: 'Staj',
            company: 'Memak Profesyonel Çikolata',
            location: 'Konya',
            description: 'Üretim takip otomasyonumuzun frontend geliştirmelerinde görev alacak, HTML, CSS ve JavaScript temellerine hâkim stajyer arıyoruz.',
            status: 'Active',
            employerName: 'Muhammet Eker',
            employerRole: 'Mezun',
            employerYear: 2018,
            initials: 'ME',
            created_at: new Date(Date.now() - 3600000 * 24).toISOString()
          },
          {
            id: 'job-2',
            employer_id: 'demo-employer-2',
            title: 'Yapay Zeka & Veri Analisti',
            type: 'İş',
            company: 'InnoAI Yazılım',
            location: 'Ankara',
            description: 'Python ve veri analizi kütüphanelerine (Pandas, NumPy) hâkim, tercihen SQL deneyimi olan yeni mezun çalışma arkadaşları arıyoruz.',
            status: 'Active',
            employerName: 'Ali Kağan Bayram',
            employerRole: 'Mezun',
            employerYear: 2015,
            initials: 'AK',
            created_at: new Date(Date.now() - 3600000 * 48).toISOString()
          }
        ];
        localStorage.setItem('asdfl_jobs', JSON.stringify(localJobs));
      }
      return localJobs;
    }
  },

  async fetchJobApplications() {
    if (this.supabase) {
      if (!this.currentUser) return [];
      const { data, error } = await this.supabase
        .from('job_applications')
        .select('*, job_postings(*), profiles!applicant_id(name, role, grad_year, email, phone)')
        .order('created_at', { ascending: false });
      if (error) { console.error('Error fetching applications:', error); return []; }
      return data.map(app => ({
        ...app,
        jobTitle: app.job_postings?.title,
        companyName: app.job_postings?.company,
        employerId: app.job_postings?.employer_id,
        applicantName: app.profiles?.name || 'Üye',
        applicantRole: app.profiles?.role || 'Öğrenci',
        applicantYear: app.profiles?.grad_year,
        applicantEmail: app.profiles?.email,
        applicantPhone: app.profiles?.phone,
        initials: this.getInitials(app.profiles?.name || 'U')
      }));
    } else {
      let localApps = JSON.parse(localStorage.getItem('asdfl_job_apps') || '[]');
      const jobs = await this.fetchJobPostings();
      return localApps.map(app => {
        const job = jobs.find(j => j.id === app.posting_id);
        const user = this.currentUser || { name: 'Ziyaretçi', role: 'Öğrenci' };
        return {
          ...app,
          jobTitle: job ? job.title : 'Bilinmeyen İlan',
          companyName: job ? job.company : 'Bilinmeyen Şirket',
          employerId: job ? job.employer_id : '',
          applicantName: user.name,
          applicantRole: user.role,
          applicantYear: user.gradYear,
          applicantEmail: user.email,
          applicantPhone: user.phone || '0555 555 55 55',
          initials: this.getInitials(user.name)
        };
      });
    }
  },

  async fetchInternshipRequests() {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('internship_requests')
        .select('*, profiles!student_id(name, role, grad_year, city, grade, class_section)')
        .order('created_at', { ascending: false });
      if (error) { console.error('Error fetching internship requests:', error); return []; }
      return data.map(ir => ({
        ...ir,
        studentName: ir.profiles?.name || 'Öğrenci',
        studentRole: ir.profiles?.role || 'Öğrenci',
        studentGrade: ir.profiles?.grade,
        studentClassSection: ir.profiles?.class_section,
        initials: this.getInitials(ir.profiles?.name || 'Ö')
      }));
    } else {
      let localReqs = JSON.parse(localStorage.getItem('asdfl_intern_reqs') || '[]');
      if (localReqs.length === 0) {
        localReqs = [
          {
            id: 'req-1',
            student_id: 'demo-student-1',
            title: 'Endüstri 4.0 & IoT Staj Arayışı',
            field: 'Mühendislik',
            details: 'ASDFL 12. Sınıf öğrencisiyim. Robotik ve IoT sistemlerine büyük ilgim var. Python ve Arduino geliştirme yapıyorum. Yaz stajı arıyorum.',
            status: 'Active',
            studentName: 'Ahmet Mert Yılmaz',
            studentRole: 'Öğrenci',
            studentGrade: '12. Sınıf',
            studentClassSection: 'B',
            initials: 'AM',
            created_at: new Date(Date.now() - 3600000 * 12).toISOString()
          },
          {
            id: 'req-2',
            student_id: 'demo-student-2',
            title: 'Mobil Uygulama (Flutter) Staj Arayışı',
            field: 'Yazılım',
            details: '11. Sınıf öğrencisiyim. Flutter ile 2 adet basit mobil uygulama geliştirdim. Kendimi geliştirmek için uzaktan staj veya mentörlük desteği arıyorum.',
            status: 'Active',
            studentName: 'Sude Nur Yıldız',
            studentRole: 'Öğrenci',
            studentGrade: '11. Sınıf',
            studentClassSection: 'A',
            initials: 'SN',
            created_at: new Date(Date.now() - 3600000 * 36).toISOString()
          }
        ];
        localStorage.setItem('asdfl_intern_reqs', JSON.stringify(localReqs));
      }
      return localReqs;
    }
  },

  async createJobPosting(title, type, company, location, description) {
    if (!this.currentUser) {
      this.toast('İlan vermek için giriş yapmalısınız.', 'warning');
      return false;
    }
    if (this.supabase) {
      const { error } = await this.supabase
        .from('job_postings')
        .insert({
          employer_id: this.currentUser.id,
          title,
          type,
          company,
          location,
          description,
          status: 'Active'
        });
      if (error) { console.error('Error posting job:', error); this.toast('İlan verilemedi: ' + error.message, 'error'); return false; }
    } else {
      let localJobs = JSON.parse(localStorage.getItem('asdfl_jobs') || '[]');
      localJobs.unshift({
        id: Math.random().toString(36).substring(2),
        employer_id: this.currentUser.id,
        title,
        type,
        company,
        location,
        description,
        status: 'Active',
        employerName: this.currentUser.name,
        employerRole: this.currentUser.role,
        employerYear: this.currentUser.gradYear,
        initials: this.getInitials(this.currentUser.name),
        created_at: new Date().toISOString()
      });
      localStorage.setItem('asdfl_jobs', JSON.stringify(localJobs));
    }
    this.toast('İlanınız başarıyla yayınlandı! 🚀', 'success');
    return true;
  },

  async deleteJobPosting(postingId) {
    if (!this.currentUser) return false;
    if (this.supabase) {
      const { error } = await this.supabase
        .from('job_postings')
        .delete()
        .eq('id', postingId);
      if (error) { console.error('Error deleting posting:', error); this.toast('İlan silinemedi: ' + error.message, 'error'); return false; }
    } else {
      let localJobs = JSON.parse(localStorage.getItem('asdfl_jobs') || '[]');
      localJobs = localJobs.filter(job => job.id !== postingId);
      localStorage.setItem('asdfl_jobs', JSON.stringify(localJobs));
      
      let localApps = JSON.parse(localStorage.getItem('asdfl_job_apps') || '[]');
      localApps = localApps.filter(app => app.posting_id !== postingId);
      localStorage.setItem('asdfl_job_apps', JSON.stringify(localApps));
    }
    this.toast('İlan başarıyla silindi.', 'success');
    return true;
  },


  async applyToJob(postingId, resumeUrl, coverLetter) {
    if (!this.currentUser) {
      this.toast('Başvuru yapmak için giriş yapmalısınız.', 'warning');
      return false;
    }
    if (this.supabase) {
      const { error } = await this.supabase
        .from('job_applications')
        .insert({
          posting_id: postingId,
          applicant_id: this.currentUser.id,
          resume_url: resumeUrl,
          cover_letter: coverLetter,
          status: 'Pending'
        });
      if (error) { console.error('Error applying to job:', error); this.toast('Başvuru yapılamadı: ' + error.message, 'error'); return false; }
    } else {
      let localApps = JSON.parse(localStorage.getItem('asdfl_job_apps') || '[]');
      if (localApps.some(app => app.posting_id === postingId && app.applicant_id === this.currentUser.id)) {
        this.toast('Bu ilana zaten başvurmuşsunuz.', 'warning');
        return false;
      }
      localApps.unshift({
        id: Math.random().toString(36).substring(2),
        posting_id: postingId,
        applicant_id: this.currentUser.id,
        resume_url: resumeUrl,
        cover_letter: coverLetter,
        status: 'Pending',
        created_at: new Date().toISOString()
      });
      localStorage.setItem('asdfl_job_apps', JSON.stringify(localApps));
    }
    this.toast('Başvurunuz başarıyla iletildi! 📂', 'success');
    return true;
  },

  async createInternshipRequest(title, field, details) {
    if (!this.currentUser) {
      this.toast('Talep oluşturmak için giriş yapmalısınız.', 'warning');
      return false;
    }
    if (this.supabase) {
      const { error } = await this.supabase
        .from('internship_requests')
        .insert({
          student_id: this.currentUser.id,
          title,
          field,
          details,
          status: 'Active'
        });
      if (error) { console.error('Error request intern:', error); this.toast('Talep gönderilemedi: ' + error.message, 'error'); return false; }
    } else {
      let localReqs = JSON.parse(localStorage.getItem('asdfl_intern_reqs') || '[]');
      localReqs.unshift({
        id: Math.random().toString(36).substring(2),
        student_id: this.currentUser.id,
        title,
        field,
        details,
        status: 'Active',
        studentName: this.currentUser.name,
        studentRole: this.currentUser.role,
        studentGrade: this.currentUser.grade || '12. Sınıf',
        studentClassSection: this.currentUser.classSection || 'A',
        initials: this.getInitials(this.currentUser.name),
        created_at: new Date().toISOString()
      });
      localStorage.setItem('asdfl_intern_reqs', JSON.stringify(localReqs));
    }
    this.toast('Staj arayış talebiniz yayınlandı! 🎓', 'success');
    return true;
  },

  async updateApplicationStatus(appId, status) {
    if (!this.currentUser) return false;
    if (this.supabase) {
      const { error } = await this.supabase
        .from('job_applications')
        .update({ status })
        .eq('id', appId);
      if (error) { console.error('Error updating status:', error); this.toast('Durum güncellenemedi: ' + error.message, 'error'); return false; }
    } else {
      let localApps = JSON.parse(localStorage.getItem('asdfl_job_apps') || '[]');
      const idx = localApps.findIndex(app => app.id === appId);
      if (idx !== -1) {
        localApps[idx].status = status;
        localStorage.setItem('asdfl_job_apps', JSON.stringify(localApps));
      }
    }
    this.toast(status === 'Approved' ? 'Başvuru onaylandı!' : 'Başvuru reddedildi.', 'success');
    return true;
  },

  async uploadImage(file, bucketName = 'gallery') {
    if (!this.supabase) return null;
    if (!this.currentUser) {
      this.toast('Fotoğraf yüklemek için giriş yapmalısınız.', 'warning');
      return null;
    }
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `${this.currentUser.id}/${fileName}`;

    const { error: uploadError } = await this.supabase.storage
      .from(bucketName)
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      this.toast('Resim yüklenirken hata oluştu.', 'error');
      return null;
    }

    const { data } = this.supabase.storage.from(bucketName).getPublicUrl(filePath);
    return data.publicUrl;
  },

  async createPost(content) {
    if (!this.supabase) return false;
    if (!this.currentUser) {
      this.toast('Paylaşım yapmak için giriş yapmalısınız.', 'warning');
      return false;
    }
    const { error } = await this.supabase.from('posts').insert({
      author_id: this.currentUser.id,
      content: content
    });
    if (error) {
      console.error('Post error:', error);
      this.toast('Paylaşım yapılamadı.', 'error');
      return false;
    }
    this.toast('Paylaşıldı!', 'success');
    return true;
  },

  async createApplication(type, title, details) {
    if (!this.currentUser) {
      this.toast('Başvuru yapmak için giriş yapmalısınız.', 'warning');
      return false;
    }
    if (this.supabase) {
      const { error } = await this.supabase.from('applications').insert({
        user_id: this.currentUser.id,
        type: type,
        title: title,
        details: details,
        status: 'Pending'
      });
      if (error) {
        console.error('Application error:', error);
        this.toast('Başvuru gönderilirken hata oluştu: ' + error.message, 'error');
        return false;
      }
    } else {
      let localApps = JSON.parse(localStorage.getItem('asdfl_applications') || '[]');
      localApps.push({
        id: Math.random().toString(36).substring(2),
        user_id: this.currentUser.id,
        type: type,
        title: title,
        details: details,
        status: 'Pending',
        created_at: new Date().toISOString()
      });
      localStorage.setItem('asdfl_applications', JSON.stringify(localApps));
    }
    this.toast('Başvurunuz başarıyla alındı! 🎉', 'success');
    return true;
  },

  // ---- App State ----
  state: {
    currentPage: 'home',
    alumniFilter: { year: 'all', city: 'all', search: '' },
    eventFilter: 'all',
  },

  // ---- Utility Functions ----
  toast(msg, type = 'success') {
    const container = document.querySelector('.toast-container') || (() => {
      const c = document.createElement('div');
      c.className = 'toast-container';
      document.body.appendChild(c);
      return c;
    })();
    const t = document.createElement('div');
    const icons = { success: '<i data-lucide="check-circle" style="width:1.2rem;height:1.2rem"></i>', warning: '<i data-lucide="alert-triangle" style="width:1.2rem;height:1.2rem"></i>', error: '<i data-lucide="x-circle" style="width:1.2rem;height:1.2rem"></i>', info: '<i data-lucide="info" style="width:1.2rem;height:1.2rem"></i>' };
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${icons[type]||'<i data-lucide="info" style="width:1.2rem;height:1.2rem"></i>'}</span><span>${msg}</span>`;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(),300); }, 3500);
  },

  openModal(id) {
    const m = document.getElementById(id);
    if(m) m.classList.add('open');
  },

  closeModal(id) {
    const m = document.getElementById(id);
    if(m) m.classList.remove('open');
  },

  formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });
  },

  getInitials(name) {
    return name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  },

  // Scroll reveal
  initReveal() {
    const els = document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.reveal-scale');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if(e.isIntersecting) { e.target.classList.add('visible'); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(el => observer.observe(el));
  },

  // Navbar scroll effect
  initNavbar() {
    const nav = document.querySelector('.navbar');
    if(!nav) return;
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 60);
    });
    // hamburger
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');
    if(hamburger && navLinks) {
      hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = navLinks.classList.toggle('open');
        hamburger.classList.toggle('active', isOpen);
        document.body.classList.toggle('nav-open', isOpen);
      });
    }

    // Dismiss drawer on click outside or on link select
    document.addEventListener('click', (e) => {
      const activeNavLinks = document.getElementById('navLinks');
      const activeHamburger = document.getElementById('hamburger');
      if (activeNavLinks && activeNavLinks.classList.contains('open')) {
        const clickedLink = e.target.closest('a');
        const clickedOutside = !activeNavLinks.contains(e.target) && (!activeHamburger || !activeHamburger.contains(e.target));
        if (clickedOutside || clickedLink) {
          activeNavLinks.classList.remove('open');
          if (activeHamburger) activeHamburger.classList.remove('active');
          document.body.classList.remove('nav-open');
        }
      }
    });
  },

  // Animated counter
  animateCounter(el, target, duration = 1500) {
    let start = null;
    const step = (ts) => {
      if(!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      el.textContent = Math.floor(progress * target).toLocaleString('tr-TR');
      if(progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  initCounters() {
    const counters = document.querySelectorAll('[data-count]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if(e.isIntersecting && !e.target.dataset.counted) {
          e.target.dataset.counted = true;
          this.animateCounter(e.target, parseInt(e.target.dataset.count));
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(c => observer.observe(c));
  },

  // Active nav link
  setActiveNav() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(a => {
      const href = a.getAttribute('href');
      a.classList.toggle('active', href === path || (path === '' && href === 'index.html'));
    });
  },

  // ---- Auth State ----
  currentUser: null,
  supabase: window.supabase ? window.supabase.createClient('https://refpyezcxkkofpkwaqny.supabase.co', 'sb_publishable_NlYWAPtmP6F6LRlAiXyIxw_hm1OoP9m') : null,
  authReady: false,
  waitForAuth() {
    return new Promise(resolve => {
      const check = setInterval(() => {
        if (this.authReady) {
          clearInterval(check);
          resolve();
        }
      }, 50);
    });
  },

  // Auth Functions
  async checkAuth() {
    if (!this.supabase) {
      const userStr = localStorage.getItem('asdfl_user');
      if (userStr) this.currentUser = JSON.parse(userStr);
      this.authReady = true;
      this.updateUIForAuth();
      return;
    }
    
    const { data: { session } } = await this.supabase.auth.getSession();
    if (session) {
      let dbRole = session.user.user_metadata?.role || 'Kullanıcı';
      try {
        const { data: profile } = await this.supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        if (profile?.role) {
          dbRole = profile.role;
        }
      } catch (e) {
        console.error('Error fetching live role:', e);
      }

      this.currentUser = {
        ...session.user.user_metadata,  // spread first so dbRole below wins
        id: session.user.id,
        name: session.user.user_metadata?.name || session.user.email.split('@')[0],
        email: session.user.email,
        role: dbRole  // always use fresh DB role, not stale metadata
      };
    } else {
      this.currentUser = null;
    }

    // IMPORTANT: authReady is set AFTER the DB role is fetched, not before.
    // This ensures waitForAuth() only resolves once currentUser.role is correct.
    this.authReady = true;

    this.supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (session) {
          let dbRole = session.user.user_metadata?.role || 'Kullanıcı';
          try {
            const { data: profile } = await this.supabase
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .single();
            if (profile?.role) {
              dbRole = profile.role;
            }
          } catch (e) {
            console.error('Error fetching live role on change:', e);
          }

          this.currentUser = {
            ...session.user.user_metadata,  // spread first so dbRole below wins
            id: session.user.id,
            name: session.user.user_metadata?.name || session.user.email.split('@')[0],
            email: session.user.email,
            role: dbRole  // always use fresh DB role, not stale metadata
          };
        }
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
      }
      this.updateUIForAuth();
    });

    this.updateUIForAuth();
  },

  updateUIForAuth() {
    const navCta = document.querySelector('.nav-cta');
    if (!navCta) return;

    if (this.currentUser) {
      const initials = this.getInitials(this.currentUser.name);
      navCta.innerHTML = `
        <div class="user-profile" onclick="this.classList.toggle('open')">
          <button class="profile-btn">
            <div class="profile-avatar">${initials}</div>
            <span style="display:none;@media(min-width:768px){display:inline}">${this.currentUser.name}</span>
            <i data-lucide="chevron-down" style="width:14px;height:14px"></i>
          </button>
          <div class="profile-menu">
            <div style="padding:.5rem 1rem;border-bottom:1px solid var(--glass-border);margin-bottom:.25rem">
              <strong style="color:var(--text-primary);display:block">${this.currentUser.name}</strong>
              <span style="font-size:.75rem;color:var(--text-muted)">${this.currentUser.role}</span>
            </div>
            <a href="profil.html" style="display:flex;align-items:center;gap:.5rem;padding:.5rem 1rem;color:var(--text-secondary);text-decoration:none;transition:all .2s"><i data-lucide="user" style="width:16px;height:16px"></i> Profilim</a>
            <button onclick="ASDFL.logout()" class="logout"><i data-lucide="log-out" style="width:16px;height:16px"></i> Çıkış Yap</button>
          </div>
        </div>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
      `;
    } else {
      navCta.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="ASDFL.openModal('loginModal')">Giriş Yap</button>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
      `;
    }
    
    const navLinks = document.getElementById('navLinks');
    if (navLinks) {
      const existingAdminLink = navLinks.querySelector('a[href="yonetim.html"]');
      if (existingAdminLink) {
        existingAdminLink.parentElement.remove();
      }
      
      if (this.currentUser && this.currentUser.role === 'Admin') {
        const li = document.createElement('li');
        li.innerHTML = '<a href="yonetim.html"><i data-lucide="shield-check" style="width:1.2rem;height:1.2rem"></i> Yönetim</a>';
        navLinks.appendChild(li);
      }
    }

    const hamburger = document.getElementById('hamburger');
    if(hamburger && navLinks) {
      hamburger.replaceWith(hamburger.cloneNode(true));
      const newHamburger = document.getElementById('hamburger');
      if (navLinks.classList.contains('open')) {
        newHamburger.classList.add('active');
      }
      newHamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = navLinks.classList.toggle('open');
        newHamburger.classList.toggle('active', isOpen);
        document.body.classList.toggle('nav-open', isOpen);
      });
    }
    setTimeout(() => lucide.createIcons(), 10);
  },

  async logout() {
    if (this.supabase) {
      await this.supabase.auth.signOut();
    } else {
      localStorage.removeItem('asdfl_user');
    }
    this.currentUser = null;
    this.toast('Çıkış yapıldı.', 'info');
    this.updateUIForAuth();
    setTimeout(() => window.location.reload(), 500);
  },

  async handleRegister() {
    const role = document.getElementById('regRole').value;
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPass').value;
    
    const gradYear = document.getElementById('regGradYear')?.value;
    const job = document.getElementById('regJob')?.value;
    const company = document.getElementById('regCompany')?.value || '';
    const city = document.getElementById('regCity')?.value;
    const grade = document.getElementById('regGrade')?.value;
    const branch = document.getElementById('regBranch')?.value;
    const teachingYear = document.getElementById('regTeachingYear')?.value;

    const classSectionAlumni = document.getElementById('regClassSectionAlumni')?.value;
    const classSectionStudent = document.getElementById('regClassSectionStudent')?.value;
    const classSection = role === 'Mezun' ? classSectionAlumni : (role === 'Öğrenci' ? classSectionStudent : '');

    const phone = document.getElementById('regPhone')?.value || '';
    const sharePhone = document.getElementById('regSharePhone')?.checked || false;
    const shareEmail = document.getElementById('regShareEmail')?.checked || false;

    if (!name || !email || !pass) {
      this.toast('Lütfen zorunlu alanları doldurun.', 'warning');
      return;
    }

    const metadata = { 
      role, 
      name, 
      classSection: classSection ? classSection.toUpperCase() : '',
      phone,
      sharePhone,
      shareEmail
    };
    
    if (role === 'Mezun') {
      metadata.gradYear = gradYear; metadata.job = job; metadata.city = city; metadata.company = company;
    } else if (role === 'Öğrenci') {
      metadata.grade = grade;
    } else if (role === 'Öğretmen') {
      metadata.branch = branch; metadata.teachingYear = teachingYear;
    }

    if (this.supabase) {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password: pass,
        options: { data: metadata }
      });
      if (error) {
        this.toast('Kayıt hatası: ' + error.message, 'error');
        return;
      }
    } else {
      localStorage.setItem('asdfl_user', JSON.stringify({ email, ...metadata }));
      this.currentUser = { email, ...metadata };
    }
    
    this.closeModal('registerModal');
    this.updateUIForAuth();
    this.toast('Aramıza hoş geldin, ' + name + '! 🎉', 'success');
    setTimeout(() => window.location.reload(), 1000);
  },

  async handleLogin(emailId, passId) {
    const email = document.getElementById(emailId).value;
    const pass = document.getElementById(passId).value;
    if (!email || !pass) { this.toast('Lütfen tüm alanları doldurun.', 'warning'); return; }
    
    if (this.supabase) {
      const { data, error } = await this.supabase.auth.signInWithPassword({ email, password: pass });
      if (error) {
        this.toast('Giriş başarısız: ' + error.message, 'error');
        return;
      }
    } else {
      let user = { role: 'Kullanıcı', name: email.split('@')[0], email: email };
      if (email === 'admin@admin.com' && pass === 'admin') {
        user = { role: 'Admin', name: 'Sistem Yöneticisi', email: 'admin@admin.com' };
      }
      localStorage.setItem('asdfl_user', JSON.stringify(user));
      this.currentUser = user;
    }
    
    this.closeModal('loginModal');
    this.updateUIForAuth();
    this.toast('Giriş başarılı!', 'success');
    setTimeout(() => window.location.reload(), 500);
  },

  initCities() {
    const TURKEY_CITIES = [
      "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya", "Artvin", "Aydın", "Balıkesir",
      "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli",
      "Diyarbakır", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari",
      "Hatay", "Isparta", "Mersin", "İstanbul", "İzmir", "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir",
      "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş", "Nevşehir",
      "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Tekirdağ", "Tokat",
      "Trabzon", "Tunceli", "Şanlıurfa", "Uşak", "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman",
      "Kırıkkale", "Batman", "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük", "Kilis", "Osmaniye", "Düzce"
    ].sort((a, b) => a.localeCompare(b, 'tr'));

    const selects = document.querySelectorAll('#regCity, #editCity');
    selects.forEach(selectEl => {
      if (selectEl.children.length <= 1) {
        const currentValue = selectEl.value;
        selectEl.innerHTML = '<option value="" disabled selected>Şehir Seçin</option>' + 
          TURKEY_CITIES.map(c => `<option value="${c}">${c}</option>`).join('');
        if (currentValue) {
          selectEl.value = currentValue;
        }
      }
    });
  },

  async initAutocomplete() {
    let jobsDatalist = document.getElementById('jobsDatalist');
    if (!jobsDatalist) {
      jobsDatalist = document.createElement('datalist');
      jobsDatalist.id = 'jobsDatalist';
      document.body.appendChild(jobsDatalist);
    }
    let companiesDatalist = document.getElementById('companiesDatalist');
    if (!companiesDatalist) {
      companiesDatalist = document.createElement('datalist');
      companiesDatalist.id = 'companiesDatalist';
      document.body.appendChild(companiesDatalist);
    }

    const alumni = await this.fetchAlumni();
    if (alumni && alumni.length > 0) {
      const uniqueJobs = [...new Set(alumni.map(a => a.job).filter(Boolean))].sort();
      const uniqueCompanies = [...new Set(alumni.map(a => a.company).filter(Boolean))].sort();

      jobsDatalist.innerHTML = uniqueJobs.map(j => `<option value="${j}">`).join('');
      companiesDatalist.innerHTML = uniqueCompanies.map(c => `<option value="${c}">`).join('');
    }

    document.querySelectorAll('#regJob, #editJob').forEach(el => el.setAttribute('list', 'jobsDatalist'));
    document.querySelectorAll('#regCompany, #editCompany').forEach(el => el.setAttribute('list', 'companiesDatalist'));
  },

  init() {
    // Dynamically inject the hidden utility style to bypass aggressive browser caching globally!
    const style = document.createElement('style');
    style.textContent = '.hidden { display: none !important; }';
    document.head.appendChild(style);

    // Guarantee toggleRegFields aligns with the active dropdown role on load
    const regRole = document.getElementById('regRole');
    if (regRole && typeof toggleRegFields === 'function') {
      toggleRegFields(regRole.value);
    }

    this.initNavbar();
    this.initReveal();
    this.initCounters();
    this.setActiveNav();
    this.checkAuth();
    this.initCities();
    this.initAutocomplete();
  }
};

document.addEventListener('DOMContentLoaded', () => ASDFL.init());
