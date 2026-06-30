// ========================================
// ASDFL MEZUNLAR DERNEĞİ — DATA & APP STATE
// ========================================

// Demo data stored in localStorage on first load
const ASDFL = {
  version: '1.0.0',
  listPageSize: 100,
  maxImageBytes: 5 * 1024 * 1024,
  allowedImageTypes: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  _queryCache: new Map(),
  legalDocumentVersion: '2026-06-18',
  legalDocumentLinks: [
    ['kvkk-aydinlatma.html', 'KVKK'], ['acik-riza.html', 'Açık Rıza'],
    ['gizlilik-politikasi.html', 'Gizlilik'], ['cerez-politikasi.html', 'Çerezler'],
    ['kullanim-kosullari.html', 'Kullanım Koşulları'], ['topluluk-kurallari.html', 'Topluluk Kuralları'],
    ['veri-basvuru-silme.html', 'Veri Başvurusu']
  ],

  ensureLegalFooter() {
    let footer = document.querySelector('footer');
    if (!footer) {
      footer = document.createElement('footer');
      footer.className = 'footer';
      footer.style.marginTop = '4rem';
      footer.innerHTML = '<div class="container"><div class="footer-bottom"><span>© 2026 ASDFL Mezunlar Derneği</span></div></div>';
      document.body.appendChild(footer);
    }
    if (footer.querySelector('.site-legal-links')) return;
    const links = document.createElement('div');
    links.className = 'site-legal-links';
    links.setAttribute('aria-label', 'Hukuki belgeler');
    links.innerHTML = this.legalDocumentLinks.map(([href, label]) => `<a href="${href}">${label}</a>`).join('');
    const container = footer.querySelector('.container') || footer;
    container.appendChild(links);
    if (!document.querySelector('link[href="css/legal.css"]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet'; style.href = 'css/legal.css'; document.head.appendChild(style);
    }
  },

  // Timeout wrapper for database queries to prevent page freezes if database is blocked or slow
  async queryWithTimeout(queryPromise, timeoutMs = 2500) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Query timeout')), timeoutMs);
    });
    try {
      const result = await Promise.race([queryPromise, timeoutPromise]);
      clearTimeout(timeoutId);
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  },

  async cachedQuery(key, loader, ttlMs = 30000) {
    const cached = this._queryCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.promise;
    const promise = Promise.resolve().then(loader).catch(error => {
      this._queryCache.delete(key);
      throw error;
    });
    this._queryCache.set(key, { promise, expiresAt: Date.now() + ttlMs });
    return promise;
  },

  invalidateQueryCache(prefix = '') {
    for (const key of this._queryCache.keys()) {
      if (!prefix || key.startsWith(prefix)) this._queryCache.delete(key);
    }
  },

  // ---- Supabase API Fetchers ----
  async fetchAlumni({ limit = this.listPageSize, before = null, refresh = false } = {}) {
    this.lastAlumniError = null;
    if (this.supabase) {
      try {
        const safeLimit = Math.min(Math.max(Number(limit) || this.listPageSize, 1), 200);
        const cacheKey = `alumni:${safeLimit}:${before || 'first'}`;
        if (refresh) this.invalidateQueryCache('alumni:');
        const { data, error } = await this.cachedQuery(cacheKey, async () => {
          let query = this.supabase
            .from('public_profiles')
            .select('id,role,name,grad_year,job,city,mentor,grade,branch,bio,avatar_url,avatar_position,linkedin_url,github_url,instagram_url,class_section,company,university,academic_title,specialization,target_university,target_job,created_at,email,phone')
            .order('created_at', { ascending: false })
            .limit(safeLimit);
          if (before) query = query.lt('created_at', before);
          return this.queryWithTimeout(query, 8000);
        });
        if (!error && data) {
          return data.map(d => ({
            ...d,
            share_email: Boolean(d.email),
            share_phone: Boolean(d.phone),
            initials: this.getInitials(d.name)
          }));
        }
        this.lastAlumniError = error || new Error('Mezun verisi alınamadı');
        console.warn('Supabase fetch alumni error:', error);
      } catch (err) {
        this.lastAlumniError = err;
        console.warn('Exception fetching alumni from Supabase:', err);
      }
      return [];
    }

    // Fallback to local storage
    try {
      let localAlumni = JSON.parse(localStorage.getItem('asdfl_alumni') || '[]');
      if (localAlumni.length === 0 || !localAlumni[0].avatar_url) {
        localAlumni = [
          { id: '1', name: 'Alika Yıldız', email: 'alika@example.com', phone: '0555 123 45 67', role: 'Admin', grad_year: 2012, mentor: true, job: 'Kıdemli Yazılım Mühendisi', company: 'Google', university: 'ORTA DOĞU TEKNİK ÜNİVERSİTESİ', city: 'İstanbul', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80', academic_title: 'Dr.', specialization: 'Otomasyon ve Yapay Zeka' },
          { id: '2', name: 'Burak Yılmaz', email: 'burak@example.com', phone: '0532 987 65 43', role: 'Mezun', grad_year: 2008, mentor: true, job: 'Dahiliye Uzmanı', company: 'Ankara Şehir Hastanesi', university: 'HACETTEPE ÜNİVERSİTESİ', city: 'Ankara', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&h=200&q=80', academic_title: 'Uzm. Dr.', specialization: 'Dahiliye' },
          { id: '3', name: 'Ceren Demir', email: 'ceren@example.com', phone: '0544 555 66 77', role: 'Öğrenci', grad_year: 2026, mentor: false, job: 'Öğrenci', company: '', university: 'HACETTEPE ÜNİVERSİTESİ', city: 'Afyon', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80', target_university: 'Hacettepe Üniversitesi', target_job: 'Doktor' }
        ];
        localStorage.setItem('asdfl_alumni', JSON.stringify(localAlumni));
      }
      return localAlumni.map(d => ({ ...d, initials: this.getInitials(d.name) }));
    } catch (e) {
      console.warn('Error reading alumni from localStorage:', e);
      return [];
    }
  },

  async fetchEvents() {
    if (!this.supabase) return [];
    try {
      const { data, error } = await this.queryWithTimeout(
        this.supabase.from('events').select('id,title,event_date,event_time,location,type,description,upcoming,created_at').order('event_date', { ascending: true }).limit(100)
      );
      if (error || !data) { if (error) console.error('Error fetching events:', error); return []; }
      // Convert to camelCase to match previous demo structures if needed
      return data.map(d => ({ ...d, date: d.event_date, time: d.event_time }));
    } catch (err) {
      console.warn('Exception fetching events from Supabase:', err);
      return [];
    }
  },

  async fetchPosts() {
    if (!this.supabase) return [];
    try {
      const { data, error } = await this.queryWithTimeout(
        this.supabase.from('posts').select('id,author_id,content,likes_count,target_year,target_section,created_at,profiles!author_id(name,role,avatar_url,avatar_position,grad_year,academic_title,specialization)').order('created_at', { ascending: false }).limit(50)
      );
      if (error || !data) { if (error) console.error('Error fetching posts:', error); return []; }
      return data.map(p => ({
        ...p,
        author: (p.profiles?.academic_title ? p.profiles.academic_title + ' ' : '') + (p.profiles?.name || 'Kullanıcı'),
        authorYear: p.profiles?.grad_year,
        initials: this.getInitials(p.profiles?.name || 'U')
      }));
    } catch (err) {
      console.warn('Exception fetching posts from Supabase:', err);
      return [];
    }
  },

  async fetchScholarships() {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.from('scholarships').select('id,title,amount,deadline,description,sponsor,active,created_at').order('created_at', { ascending: false }).limit(100);
        if (!error && data) return data;
        console.warn('Supabase fetch scholarships error, falling back to LocalStorage:', error);
      } catch (err) {
        console.warn('Exception fetching scholarships from Supabase, falling back to LocalStorage:', err);
      }
    }

    // Fallback to local storage
    try {
      let localScholarships = JSON.parse(localStorage.getItem('asdfl_scholarships') || '[]');
      if (localScholarships.length === 0) {
        localScholarships = [
          {
            id: 's1',
            title: 'ASDFL Mezunları Yüksek Öğrenim Bursu',
            amount: '₺3.000 / Ay',
            deadline: new Date(Date.now() + 3600000 * 24 * 30).toISOString(),
            description: 'Üniversitede eğitimine devam eden ve maddi desteğe ihtiyaç duyan başarılı ASDFL mezunu öğrencilerine yöneliktir.',
            sponsor: 'Dernek Yönetimi',
            active: true
          },
          {
            id: 's2',
            title: 'Dr. Ahmet Yılmaz Başarı Bursu',
            amount: '₺4.500 / Ay',
            deadline: new Date(Date.now() + 3600000 * 24 * 15).toISOString(),
            description: 'Tıp, Diş Hekimliği veya Sağlık Bilimleri fakültelerinde okuyan, derslerinde üstün başarı gösteren öğrencilere özel destektir.',
            sponsor: 'Ahmet Yılmaz (1998 Mezunu)',
            active: true
          }
        ];
        localStorage.setItem('asdfl_scholarships', JSON.stringify(localScholarships));
      }
      return localScholarships;
    } catch (e) {
      console.warn('Error reading scholarships from localStorage:', e);
      return [];
    }
  },

  async fetchGallery() {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase.from('gallery').select('id,uploader_id,image_url,title,category,year,description,created_at,profiles(name,avatar_url)').order('created_at', { ascending: false }).limit(100);
    if (error) { console.error('Error fetching gallery:', error); return []; }
    return data;
  },

  async fetchLogoAnnouncements() {
    if (this.supabase) {
      try {
        const { data, error } = await this.queryWithTimeout(
          this.supabase
            .from('logo_announcements')
            .select('id,title,subtitle,icon')
            .order('id', { ascending: true })
        );
        if (!error && data && data.length > 0) {
          return data;
        }
        console.warn('Supabase fetch logo announcements returned empty or error, falling back to LocalStorage:', error);
      } catch (err) {
        console.warn('Exception fetching logo announcements from Supabase, falling back to LocalStorage:', err);
      }
    }
    
    // Fallback/Local storage mode
    let localAnnouncements = [];
    try {
      const stored = localStorage.getItem('asdfl_logo_announcements');
      if (stored) {
        localAnnouncements = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Error parsing logo announcements from localStorage:', e);
      localAnnouncements = [];
    }

    if (!localAnnouncements || !Array.isArray(localAnnouncements) || localAnnouncements.length === 0) {
      localAnnouncements = [
        { id: 1, title: '2025 Mezunları', subtitle: '128 yeni mezun', icon: 'graduation-cap' },
        { id: 2, title: 'Burs Başvurusu', subtitle: 'Son 5 gün!', icon: 'award' },
        { id: 3, title: 'Yaz Turnuvası', subtitle: '20 Temmuz 2025', icon: 'calendar' }
      ];
      try {
        localStorage.setItem('asdfl_logo_announcements', JSON.stringify(localAnnouncements));
      } catch (e) {
        console.warn('Error saving default logo announcements to localStorage:', e);
      }
    }
    return localAnnouncements;
  },

  async updateLogoAnnouncement(id, title, subtitle, icon) {
    let supabaseSuccess = false;
    let dbErrorMsg = '';

    if (this.supabase) {
      try {
        const { error } = await this.supabase
          .from('logo_announcements')
          .update({ title, subtitle, icon })
          .eq('id', id);
        if (!error) {
          supabaseSuccess = true;
        } else {
          console.warn('Error updating logo announcement in Supabase, will fall back to LocalStorage:', error);
          dbErrorMsg = error.message;
        }
      } catch (err) {
        console.warn('Exception updating logo announcement in Supabase, will fall back to LocalStorage:', err);
        dbErrorMsg = err.message;
      }
    }
    
    // Always sync with LocalStorage
    let localAnnouncements = [];
    try {
      localAnnouncements = JSON.parse(localStorage.getItem('asdfl_logo_announcements') || '[]');
    } catch (e) {
      console.warn('Error reading logo announcements from localStorage:', e);
      localAnnouncements = [];
    }
    if (localAnnouncements.length === 0) {
      localAnnouncements = [
        { id: 1, title: '2025 Mezunları', subtitle: '128 yeni mezun', icon: 'graduation-cap' },
        { id: 2, title: 'Burs Başvurusu', subtitle: 'Son 5 gün!', icon: 'award' },
        { id: 3, title: 'Yaz Turnuvası', subtitle: '20 Temmuz 2025', icon: 'calendar' }
      ];
    }
    localAnnouncements = localAnnouncements.map(item => item.id == id ? { ...item, title, subtitle, icon } : item);
    
    let localSuccess = false;
    try {
      localStorage.setItem('asdfl_logo_announcements', JSON.stringify(localAnnouncements));
      localSuccess = true;
    } catch (e) {
      console.warn('Error writing updated logo announcements to localStorage:', e);
    }
    
    if (this.supabase && !supabaseSuccess) {
      // If we have Supabase but DB update failed, show warning but return true since local storage worked
      this.toast('Duyuru yerel olarak güncellendi! (Supabase Tablosu Eksik: Lütfen SQL şemasını kurun)', 'warning');
      return true;
    }

    if (localSuccess || supabaseSuccess) {
      this.toast('Logo duyurusu güncellendi!', 'success');
      return true;
    }
    
    this.toast('Duyuru güncellenemedi.', 'error');
    return false;
  },

  // ---- Mentorship Portal API ----
  async fetchMentorships() {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('mentorships')
          .select('*, mentor:profiles!mentor_id(name,role,grad_year,job,city,avatar_url,avatar_position,academic_title,specialization), student:profiles!student_id(name,role,grad_year,grade,city,avatar_url,avatar_position,academic_title,specialization)');
        if (!error && data) return data;
        console.warn('Supabase fetch mentorships error, falling back to LocalStorage:', error);
      } catch (err) {
        console.warn('Exception fetching mentorships from Supabase, falling back to LocalStorage:', err);
      }
    }

    // Local fallback
    try {
      let localMentorships = JSON.parse(localStorage.getItem('asdfl_mentorships') || '[]');
      if (localMentorships.length === 0) {
        // Seed some mock data
        localMentorships = [
          {
            id: 'm1',
            mentor_id: '1', // Alika Yıldız (Admin/Mentor)
            student_id: '3', // Ceren Demir (Student)
            status: 'Pending',
            notes: 'Mühendislik kariyeri ve üniversite hazırlığı konusunda destek istiyorum.',
            created_at: new Date().toISOString(),
            mentor: { name: 'Alika Yıldız', email: 'alika@example.com', role: 'Admin', grad_year: 2012, job: 'Yazılım Geliştirici', city: 'İstanbul' },
            student: { name: 'Ceren Demir', email: 'ceren@example.com', role: 'Öğrenci', grade: '12. Sınıf', city: 'Afyon' }
          }
        ];
        localStorage.setItem('asdfl_mentorships', JSON.stringify(localMentorships));
      }
      return localMentorships;
    } catch (e) {
      console.warn('Error reading mentorships from localStorage:', e);
      return [];
    }
  },

  async createMentorshipRequest(mentorId, notes) {
    if (!this.currentUser) {
      this.toast('Talep göndermek için giriş yapmalısınız.', 'warning');
      return false;
    }
    
    if (this.supabase) {
      try {
        const { error } = await this.supabase
          .from('mentorships')
          .insert({
            mentor_id: mentorId,
            student_id: this.currentUser.id,
            status: 'Pending',
            notes: notes
          });
        if (!error) {
          this.toast('Mentörlük başvurusu gönderildi! 🌟', 'success');
          return true;
        }
        console.warn('Supabase insert mentorship error, falling back to LocalStorage:', error);
      } catch (err) {
        console.warn('Exception inserting mentorship in Supabase, falling back to LocalStorage:', err);
      }
    }

    // Local storage fallback
    try {
      let localMentorships = JSON.parse(localStorage.getItem('asdfl_mentorships') || '[]');
      if (localMentorships.some(m => m.mentor_id === mentorId && m.student_id === this.currentUser.id)) {
        this.toast('Bu mentöre zaten başvurmuşsunuz.', 'warning');
        return false;
      }

      // Find mentor name
      let mentorName = 'Seçilen Mentör';
      let mentorDetails = { name: mentorName };
      try {
        const alumni = JSON.parse(localStorage.getItem('asdfl_alumni') || '[]');
        const m = alumni.find(a => a.id === mentorId);
        if (m) {
          mentorName = m.name;
          mentorDetails = { name: m.name, email: m.email, role: m.role, grad_year: m.grad_year, job: m.job, city: m.city };
        }
      } catch(e) {}

      const newRequest = {
        id: Math.random().toString(36).substring(2),
        mentor_id: mentorId,
        student_id: this.currentUser.id,
        status: 'Pending',
        notes: notes,
        created_at: new Date().toISOString(),
        mentor: mentorDetails,
        student: { name: this.currentUser.name, email: this.currentUser.email, role: this.currentUser.role, grade: this.currentUser.grade || '12. Sınıf', city: this.currentUser.city || 'Afyon' }
      };

      localMentorships.unshift(newRequest);
      localStorage.setItem('asdfl_mentorships', JSON.stringify(localMentorships));
      this.toast('Mentörlük başvurusu gönderildi! (Yerel)', 'success');
      return true;
    } catch (e) {
      console.warn('Error saving mentorship request locally:', e);
      this.toast('Başvuru gönderilirken bir hata oluştu.', 'error');
      return false;
    }
  },

  async updateMentorshipStatus(relationshipId, status) {
    if (this.supabase) {
      try {
        const { error } = await this.supabase
          .from('mentorships')
          .update({ status: status })
          .eq('id', relationshipId);
        if (!error) {
          this.toast('Talep güncellendi!', 'success');
          return true;
        }
        console.warn('Supabase update mentorship error, falling back to LocalStorage:', error);
      } catch (err) {
        console.warn('Exception updating mentorship in Supabase, falling back to LocalStorage:', err);
      }
    }

    // Local storage fallback
    try {
      let localMentorships = JSON.parse(localStorage.getItem('asdfl_mentorships') || '[]');
      localMentorships = localMentorships.map(m => m.id === relationshipId ? { ...m, status: status } : m);
      localStorage.setItem('asdfl_mentorships', JSON.stringify(localMentorships));
      this.toast('Talep güncellendi! (Yerel)', 'success');
      return true;
    } catch (e) {
      console.warn('Error updating mentorship status locally:', e);
      return false;
    }
  },

  async fetchMentorshipAppointments() {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('mentorship_appointments')
          .select('*, mentor:profiles!mentor_id(name, avatar_url, avatar_position, academic_title), student:profiles!student_id(name, avatar_url, avatar_position, academic_title)');
        if (!error && data) return data;
        console.warn('Supabase fetch appointments error, falling back to LocalStorage:', error);
      } catch (err) {
        console.warn('Exception fetching appointments from Supabase, falling back to LocalStorage:', err);
      }
    }

    // Local storage fallback
    try {
      let localApps = JSON.parse(localStorage.getItem('asdfl_mentorship_appointments') || '[]');
      if (localApps.length === 0) {
        // Seed some mock appointments for current month
        const today = new Date();
        const dateString = (dayOffset) => {
          const d = new Date();
          d.setDate(today.getDate() + dayOffset);
          return d.toISOString().split('T')[0];
        };

        localApps = [
          {
            id: 'a1',
            mentor_id: '1', // Alika Yıldız
            student_id: '3', // Ceren Demir
            appointment_date: dateString(2), // 2 gün sonra
            appointment_time: '14:30',
            duration: 45,
            status: 'Scheduled',
            notes: 'İlk tanışma görüşmesi ve hedeflerin belirlenmesi.',
            mentor: { name: 'Alika Yıldız' },
            student: { name: 'Ceren Demir' }
          },
          {
            id: 'a2',
            mentor_id: '1', // Alika Yıldız
            student_id: '3', // Ceren Demir
            appointment_date: dateString(-3), // 3 gün önce
            appointment_time: '16:00',
            duration: 60,
            status: 'Completed',
            notes: 'CV incelemesi yapıldı, staj arayışları planlandı.',
            mentor: { name: 'Alika Yıldız' },
            student: { name: 'Ceren Demir' }
          }
        ];
        localStorage.setItem('asdfl_mentorship_appointments', JSON.stringify(localApps));
      }
      return localApps;
    } catch (e) {
      console.warn('Error reading appointments from localStorage:', e);
      return [];
    }
  },

  async createAppointment(mentorId, studentId, date, time, duration, notes) {
    if (this.supabase) {
      try {
        const { error } = await this.supabase
          .from('mentorship_appointments')
          .insert({
            mentor_id: mentorId,
            student_id: studentId,
            appointment_date: date,
            appointment_time: time,
            duration: parseInt(duration),
            notes: notes,
            status: 'Scheduled'
          });
        if (!error) {
          this.toast('Randevu oluşturuldu! 🗓️', 'success');
          return true;
        }
        console.warn('Supabase insert appointment error, falling back to LocalStorage:', error);
      } catch (err) {
        console.warn('Exception inserting appointment in Supabase, falling back to LocalStorage:', err);
      }
    }

    // Local storage fallback
    try {
      let localApps = JSON.parse(localStorage.getItem('asdfl_mentorship_appointments') || '[]');
      
      // Get mentor and student names
      let mentorName = 'Mentör';
      let studentName = 'Öğrenci';
      try {
        const alumni = JSON.parse(localStorage.getItem('asdfl_alumni') || '[]');
        const m = alumni.find(a => a.id === mentorId);
        if (m) mentorName = m.name;
        
        const s = alumni.find(a => a.id === studentId);
        if (s) studentName = s.name;
        else if (this.currentUser && this.currentUser.id === studentId) studentName = this.currentUser.name;
      } catch(e) {}

      const newApp = {
        id: Math.random().toString(36).substring(2),
        mentor_id: mentorId,
        student_id: studentId,
        appointment_date: date,
        appointment_time: time,
        duration: parseInt(duration),
        notes: notes,
        status: 'Scheduled',
        mentor: { name: mentorName },
        student: { name: studentName }
      };

      localApps.unshift(newApp);
      localStorage.setItem('asdfl_mentorship_appointments', JSON.stringify(localApps));
      this.toast('Randevu başarıyla oluşturuldu! (Yerel)', 'success');
      return true;
    } catch (e) {
      console.warn('Error saving appointment locally:', e);
      this.toast('Randevu oluşturulurken hata oluştu.', 'error');
      return false;
    }
  },

  async updateAppointmentStatus(appointmentId, status) {
    if (this.supabase) {
      try {
        const { error } = await this.supabase
          .from('mentorship_appointments')
          .update({ status: status })
          .eq('id', appointmentId);
        if (!error) {
          this.toast('Randevu durumu güncellendi!', 'success');
          return true;
        }
        console.warn('Supabase update appointment error, falling back to LocalStorage:', error);
      } catch (err) {
        console.warn('Exception updating appointment in Supabase, falling back to LocalStorage:', err);
      }
    }

    // Local storage fallback
    try {
      let localApps = JSON.parse(localStorage.getItem('asdfl_mentorship_appointments') || '[]');
      localApps = localApps.map(a => a.id === appointmentId ? { ...a, status: status } : a);
      localStorage.setItem('asdfl_mentorship_appointments', JSON.stringify(localApps));
      this.toast('Randevu durumu güncellendi! (Yerel)', 'success');
      return true;
    } catch (e) {
      console.warn('Error updating appointment status locally:', e);
      return false;
    }
  },


  // ---- Career Network API ----
  async fetchJobPostings() {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('job_postings')
        .select('*, profiles!employer_id(name, role, grad_year, city, job, company, avatar_url, avatar_position, academic_title, specialization)')
        .order('created_at', { ascending: false });
      if (error) { console.error('Error fetching job postings:', error); return []; }
      return data.map(jp => ({
        ...jp,
        employerName: (jp.profiles?.academic_title ? jp.profiles.academic_title + ' ' : '') + (jp.profiles?.name || 'Mezun'),
        employerRole: jp.profiles?.role || 'Mezun',
        employerYear: jp.profiles?.grad_year,
        employerAvatarUrl: jp.profiles?.avatar_url || '',
        employerAvatarPosition: jp.profiles?.avatar_position || '',
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
        .select('*, job_postings(*), profiles!applicant_id(name,role,grad_year,avatar_url,avatar_position,academic_title,specialization)')
        .order('created_at', { ascending: false });
      if (error) { console.error('Error fetching applications:', error); return []; }
      return data.map(app => ({
        ...app,
        jobTitle: app.job_postings?.title,
        companyName: app.job_postings?.company,
        employerId: app.job_postings?.employer_id,
        applicantName: (app.profiles?.academic_title ? app.profiles.academic_title + ' ' : '') + (app.profiles?.name || 'Üye'),
        applicantRole: app.profiles?.role || 'Öğrenci',
        applicantYear: app.profiles?.grad_year,
        applicantEmail: app.profiles?.email,
        applicantPhone: app.profiles?.phone,
        applicantAvatarUrl: app.profiles?.avatar_url || '',
        applicantAvatarPosition: app.profiles?.avatar_position || '',
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
        .select('*, profiles!student_id(name, role, grad_year, city, grade, class_section, avatar_url, avatar_position, academic_title, specialization)')
        .order('created_at', { ascending: false });
      if (error) { console.error('Error fetching internship requests:', error); return []; }
      return data.map(ir => ({
        ...ir,
        studentName: (ir.profiles?.academic_title ? ir.profiles.academic_title + ' ' : '') + (ir.profiles?.name || 'Öğrenci'),
        studentRole: ir.profiles?.role || 'Öğrenci',
        studentGrade: ir.profiles?.grade,
        studentClassSection: ir.profiles?.class_section,
        studentAvatarUrl: ir.profiles?.avatar_url || '',
        studentAvatarPosition: ir.profiles?.avatar_position || '',
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
    if (!(file instanceof File) || !this.allowedImageTypes.has(file.type) || file.size > this.maxImageBytes) {
      this.toast('Yalnızca JPG, PNG, WebP veya GIF; en fazla 5 MB dosya yükleyebilirsiniz.', 'error');
      return null;
    }
    const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
    const fileExt = extensions[file.type];
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

  openScholarshipModal(scholarshipTitle = '', scholarshipId = '') {
    if (!this.currentUser) {
      this.toast('Burs başvurusu yapabilmek için giriş yapmalısınız.', 'warning');
      this.openModal('loginModal');
      return;
    }
    
    // Check if modal already exists in body, if not create it
    let modal = document.getElementById('unifiedScholarshipModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.id = 'unifiedScholarshipModal';
      modal.onclick = (e) => {
        if (e.target === modal) this.closeModal('unifiedScholarshipModal');
      };
      
      modal.innerHTML = `
        <div class="modal" style="max-width: 550px; width: 100%;">
          <button class="modal-close" onclick="ASDFL.closeModal('unifiedScholarshipModal')"><i data-lucide="x" style="width:1em;height:1em"></i></button>
          <div style="text-align:center;margin-bottom:1.5rem">
            <div style="font-size:2.5rem;margin-bottom:.5rem;color:var(--gold-500)"><i data-lucide="graduation-cap" style="width:1em;height:1em"></i></div>
            <h3>Burs Başvuru Formu</h3>
            <p style="font-size:.9rem;margin-top:.25rem;color:var(--text-secondary)" id="uniScholarshipSubtitle"></p>
          </div>
          
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Ad Soyad</label>
              <input type="text" class="form-input" id="uniScholarshipName" placeholder="Adınız Soyadınız">
            </div>
            <div class="form-group">
              <label class="form-label">Sınıf / Mezuniyet</label>
              <input type="text" class="form-input" id="uniScholarshipGrade" placeholder="Örn: 12. Sınıf">
            </div>
          </div>
          
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">E-posta</label>
              <input type="email" class="form-input" id="uniScholarshipEmail" placeholder="ornek@email.com">
            </div>
            <div class="form-group">
              <label class="form-label">Telefon</label>
              <input type="tel" class="form-input" id="uniScholarshipPhone" placeholder="0555 555 55 55">
            </div>
          </div>
          
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Not Ortalaması</label>
              <input type="text" class="form-input" id="uniScholarshipGpa" placeholder="Örn: 92.5 veya 3.82">
            </div>
            <div class="form-group">
              <label class="form-label">Burs Türü / Programı</label>
              <input type="text" class="form-input" id="uniScholarshipType" placeholder="Burs programı adı">
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">Başvuru Gerekçesi ve Kendinizi Tanıtın</label>
            <textarea class="form-input" id="uniScholarshipBio" rows="4" placeholder="Neden bu bursa başvuruyorsunuz? Kendinizden ve hedeflerinizden bahsedin..."></textarea>
          </div>
          
          <div class="form-group">
            <label class="form-label">Belge Bağlantısı (Transkript, Gelir Belgesi vb. Drive/PDF Linki)</label>
            <input type="url" class="form-input" id="uniScholarshipDocUrl" placeholder="https://drive.google.com/file/... veya PDF URL">
          </div>
          
          <button class="btn btn-primary" style="width:100%;margin-top:.5rem" onclick="ASDFL.submitUnifiedScholarship()">Başvuruyu Tamamla</button>
        </div>
      `;
      document.body.appendChild(modal);
    }
    
    // Populate details
    const subtitleEl = document.getElementById('uniScholarshipSubtitle');
    if (subtitleEl) {
      subtitleEl.textContent = scholarshipTitle ? `Program: ${scholarshipTitle}` : 'ASDFL Mezunlar Derneği Burs Programı';
    }
    
    const nameInput = document.getElementById('uniScholarshipName');
    const gradeInput = document.getElementById('uniScholarshipGrade');
    const emailInput = document.getElementById('uniScholarshipEmail');
    const phoneInput = document.getElementById('uniScholarshipPhone');
    const typeInput = document.getElementById('uniScholarshipType');
    const gpaInput = document.getElementById('uniScholarshipGpa');
    const bioInput = document.getElementById('uniScholarshipBio');
    const docInput = document.getElementById('uniScholarshipDocUrl');
    
    // Reset values
    if (gpaInput) gpaInput.value = '';
    if (bioInput) bioInput.value = '';
    if (docInput) docInput.value = '';
    
    // Prefill name, grade, email, phone if logged in
    const user = this.currentUser;
    if (nameInput) {
      nameInput.value = user.name || '';
      if (user.role === 'Öğrenci') nameInput.disabled = true;
    }
    if (gradeInput) {
      gradeInput.value = user.grade || (user.grad_year || user.gradYear ? `${user.grad_year || user.gradYear} Mezunu` : '');
      if (user.role === 'Öğrenci') gradeInput.disabled = true;
    }
    if (emailInput) {
      emailInput.value = user.email || '';
      if (user.role === 'Öğrenci') emailInput.disabled = true;
    }
    if (phoneInput) {
      phoneInput.value = user.phone || '';
      if (user.role === 'Öğrenci' && user.phone) phoneInput.disabled = true;
    }
    if (typeInput) {
      typeInput.value = scholarshipTitle || 'Genel Burs';
      typeInput.disabled = !!scholarshipTitle;
    }
    
    this.openModal('unifiedScholarshipModal');
    this.refreshIcons();
  },

  async submitUnifiedScholarship() {
    const name = document.getElementById('uniScholarshipName')?.value;
    const grade = document.getElementById('uniScholarshipGrade')?.value;
    const email = document.getElementById('uniScholarshipEmail')?.value;
    const phone = document.getElementById('uniScholarshipPhone')?.value;
    const gpa = document.getElementById('uniScholarshipGpa')?.value;
    const type = document.getElementById('uniScholarshipType')?.value;
    const bio = document.getElementById('uniScholarshipBio')?.value;
    const docUrl = document.getElementById('uniScholarshipDocUrl')?.value;
    
    if (!gpa || !bio || !docUrl) {
      this.toast('Lütfen Not Ortalaması, Gerekçe ve Belge Bağlantısı alanlarını doldurun.', 'warning');
      return;
    }
    
    const details = {
      name,
      grade,
      email,
      phone,
      gpa,
      bio,
      document_url: docUrl
    };
    
    const success = await this.createApplication('Burs', type, details);
    if (success) {
      this.closeModal('unifiedScholarshipModal');
      // If we are on ogrenci.html page, we should trigger loadDashboardData() to refresh list immediately
      if (window.location.pathname.includes('ogrenci.html') && typeof loadDashboardData === 'function') {
        loadDashboardData();
      }
    }
  },

  // ---- App State ----
  state: {
    currentPage: 'home',
    alumniFilter: { year: 'all', city: 'all', search: '' },
    eventFilter: 'all',
  },

  // ---- Utility Functions ----
  escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  escapeAttr(value) {
    return this.escapeHTML(value);
  },

  safeURL(value, { allowBlob = false } = {}) {
    const input = String(value || '').trim();
    if (!input) return ''; // boş string → hemen çık (new URL('', origin) base URL döndürür)
    // Allow base64 data: image URLs (stored directly in DB)
    if (/^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(input)) return input;
    try {
      const url = new URL(input, window.location.origin);
      // Mutlaka bir path/host içermeli, sadece base origin olmamalı
      if (url.href === window.location.origin + '/' && !input.startsWith('/')) return '';
      if (url.protocol === 'https:' || url.protocol === 'http:' || (allowBlob && url.protocol === 'blob:')) {
        return url.href;
      }
    } catch (e) {}
    return '';
  },

  refreshIcons(root = document) {
    if (!window.lucide) return;
    const nodes = root.querySelectorAll ? root.querySelectorAll('i[data-lucide]') : [];
    if (nodes.length) lucide.createIcons({ nodes });
  },

  jsString(value) {
    return `'${String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')}'`;
  },

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
    const iconWrap = document.createElement('span');
    iconWrap.innerHTML = icons[type] || icons.info;
    const textWrap = document.createElement('span');
    textWrap.textContent = msg;
    t.append(iconWrap, textWrap);
    container.appendChild(t);
    this.refreshIcons();
    setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(),300); }, 3500);
  },

  openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add('open');
    // iOS Safari scroll lock: body'yi fixed yap, scroll atlamasını önle
    const scrollY = window.scrollY;
    document.body.style.top = `-${scrollY}px`;
    document.body.classList.add('modal-open');
  },

  closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('open');
    // Başka açık modal var mı kontrol et
    const anyOpen = document.querySelector('.modal-overlay.open');
    if (!anyOpen) {
      // Scroll pozisyonunu geri yükle
      const scrollY = Math.abs(parseInt(document.body.style.top || '0', 10));
      document.body.classList.remove('modal-open');
      document.body.style.top = '';
      window.scrollTo(0, scrollY);
    }
  },

  getAvatarHTML(user, sizeClass = '', extraStyle = '') {
    if (!user) return `<div class="${this.escapeAttr(sizeClass)}" style="${this.escapeAttr(extraStyle)}">?</div>`;
    const avatarUrl = this.safeURL(user.avatar_url || user.avatarUrl, { allowBlob: true });
    const initials = this.escapeHTML(user.initials || this.getInitials(user.name || 'U'));
    const position = user.avatar_position || user.avatarPosition || '50% 50%';

    const isAdminPage = window.location.pathname.includes('yonetim.html');
    let finalClass = sizeClass;
    if (!isAdminPage && sizeClass.includes('avatar') && !sizeClass.includes('profile-avatar')) {
      finalClass = 'photo-frame ' + sizeClass;
    }

    if (avatarUrl) {
      let transformStr = '';
      let objPosStr = 'object-position: center;';
      if (!isAdminPage && position.includes(',')) {
        const [scale, x, y] = position.split(',');
        transformStr = `transform: scale(${scale}) translate(${x}, ${y}); transform-origin: center center;`;
        objPosStr = '';
      } else if (!position.includes(',')) {
        objPosStr = `object-position: ${position};`;
      }
      // data-initials attribute — fallback initials için JS event delegation kullanılıyor
      return `
        <div class="${this.escapeAttr(finalClass)}" style="position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; ${this.escapeAttr(extraStyle)}">
          <img src="${this.escapeAttr(avatarUrl)}" data-initials="${initials}" class="avatar-img" style="width: 100%; height: 100%; object-fit: cover; ${this.escapeAttr(objPosStr)} ${this.escapeAttr(transformStr)}">
        </div>
      `;
    }
    return `<div class="${this.escapeAttr(finalClass)}" style="display: flex; align-items: center; justify-content: center; ${this.escapeAttr(extraStyle)}">${initials}</div>`;
  },

  setAvatarElement(element, user) {
    if (!element) return;
    const avatarUrl = user?.avatar_url || user?.avatarUrl;
    const position = user?.avatar_position || user?.avatarPosition || '50% 50%';
    
    const isAdminPage = window.location.pathname.includes('yonetim.html');
    if (!isAdminPage && !element.classList.contains('profile-avatar')) {
      element.classList.add('photo-frame');
    }

    if (avatarUrl) {
      element.style.backgroundImage = '';
      element.style.position = 'relative';
      element.style.overflow = 'hidden';
      element.style.display = 'flex';
      element.style.alignItems = 'center';
      element.style.justifyContent = 'center';
      element.textContent = '';
      
      let transformStr = '';
      let objPosStr = 'object-position: center;';
      if (!isAdminPage && position.includes(',')) {
        const [scale, x, y] = position.split(',');
        transformStr = `transform: scale(${scale}) translate(${x}, ${y}); transform-origin: center center;`;
        objPosStr = '';
      } else if (!position.includes(',')) {
        objPosStr = `object-position: ${position};`;
      }
      
      const img = document.createElement('img');
      img.src = this.safeURL(avatarUrl, { allowBlob: true }) || avatarUrl;
      img.className = 'avatar-img';
      img.setAttribute('data-initials', user ? (user.initials || this.getInitials(user.name)) : '?');
      img.style.cssText = `width: 100%; height: 100%; object-fit: cover; ${objPosStr} ${transformStr}`;
      const fallbackInitials = user ? (user.initials || this.getInitials(user.name)) : '?';
      img.onerror = () => {
        img.style.display = 'none';
        const span = document.createElement('span');
        span.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-family:Outfit,sans-serif;font-weight:700;';
        span.textContent = fallbackInitials;
        element.appendChild(span);
      };
      element.replaceChildren(img);
    } else {
      element.style.backgroundImage = '';
      element.style.display = 'flex';
      element.style.alignItems = 'center';
      element.style.justifyContent = 'center';
      element.textContent = user ? (user.initials || this.getInitials(user.name)) : '?';
    }
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });
  },

  getInitials(name) {
    if (!name) return 'U';
    return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  },

  // Scroll reveal
  initReveal() {
    const els = document.querySelectorAll('.reveal:not(.visible),.reveal-left:not(.visible),.reveal-right:not(.visible),.reveal-scale:not(.visible)');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if(e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(el => observer.observe(el));
  },

  // Navbar scroll effect
  initNavbar() {
    const nav = document.querySelector('.navbar');
    if(!nav) return;
    let ticking = false;
    let lastScrolled = null;
    const handleScroll = () => {
      ticking = false;
      const shouldBeScrolled = window.scrollY > 60;
      if (shouldBeScrolled !== lastScrolled) {
        nav.classList.toggle('scrolled', shouldBeScrolled);
        lastScrolled = shouldBeScrolled;
      }
    };
    const scheduleScrollUpdate = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(handleScroll);
    };
    window.addEventListener('scroll', scheduleScrollUpdate, { passive: true });
    // Scroll pozisyonunu geçiş animasyonu OLMADAN belirle
    handleScroll();
    // Küçük gecikme sonrası no-transitions kaldır: artık kullanıcı scroll'unda animasyon aktif
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove('no-transitions');
      });
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
    if (!counters.length) return;
    if (!('IntersectionObserver' in window)) {
      counters.forEach(c => {
        if (!c.dataset.counted) {
          c.dataset.counted = true;
          this.animateCounter(c, parseInt(c.dataset.count));
        }
      });
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if(e.isIntersecting && !e.target.dataset.counted) {
          e.target.dataset.counted = true;
          this.animateCounter(e.target, parseInt(e.target.dataset.count));
          observer.unobserve(e.target);
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
  // Safari Private mode'da localStorage erişimi kısıtlı olabilir.
  // Güvenli localStorage wrapper: hata durumunda sessionStorage veya memory'ye düşer.
  _storage: (() => {
    const memStore = {};
    try { localStorage.setItem('__sb_test__', '1'); localStorage.removeItem('__sb_test__'); return localStorage; } catch(e) {}
    try { sessionStorage.setItem('__sb_test__', '1'); sessionStorage.removeItem('__sb_test__'); return sessionStorage; } catch(e) {}
    return { getItem: k => memStore[k] ?? null, setItem: (k,v) => { memStore[k]=v; }, removeItem: k => { delete memStore[k]; } };
  })(),
  supabase: (() => {
    if (!window.supabase) return null;
    const memStore = {};
    let customStorage = null;
    try { localStorage.setItem('__sb_test__', '1'); localStorage.removeItem('__sb_test__'); customStorage = localStorage; } catch(e) {}
    if (!customStorage) {
      try { sessionStorage.setItem('__sb_test__', '1'); sessionStorage.removeItem('__sb_test__'); customStorage = sessionStorage; } catch(e) {}
    }
    if (!customStorage) {
      customStorage = { getItem: k => memStore[k] ?? null, setItem: (k,v) => { memStore[k]=v; }, removeItem: k => { delete memStore[k]; } };
    }
    try {
      return window.supabase.createClient(
        'https://refpyezcxkkofpkwaqny.supabase.co',
        'sb_publishable_NlYWAPtmP6F6LRlAiXyIxw_hm1OoP9m',
        { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: customStorage } }
      );
    } catch (e) {
      console.error('Supabase initialization failed:', e);
      return null;
    }
  })(),
  authReady: false,
  waitForAuth() {
    return new Promise(resolve => {
      let resolved = false;
      const check = setInterval(() => {
        if (this.authReady) {
          clearInterval(check);
          resolved = true;
          resolve();
        }
      }, 50);

      // Safety timeout: resolve after 1.5 seconds no matter what to prevent blank page freezes
      setTimeout(() => {
        if (!resolved) {
          clearInterval(check);
          resolved = true;
          console.warn('Auth check timed out, resolving anyway.');
          resolve();
        }
      }, 1500);
    });
  },

  // Auth Functions
  async verifyAdminSession() {
    if (!this.supabase) {
      // Offline/Mock mode (dev convenience)
      const userStr = this._storage.getItem('asdfl_user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          return user && user.role === 'Admin';
        } catch (e) {}
      }
      return false;
    }
    try {
      // Securely fetches the user object from Supabase Auth API using the current JWT token
      const { data: { user }, error } = await this.supabase.auth.getUser();
      if (error || !user) return false;
      
      // Query the actual profile database table for the true database role
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
        
      return profile && profile.role === 'Admin';
    } catch (err) {
      console.error('Admin session verification failed:', err);
      return false;
    }
  },

  async checkAuth() {
    // Synchronous local session check to avoid initial page-load login state flicker/flashes
    const userStr = this._storage.getItem('asdfl_user');
    if (userStr) {
      try {
        this.currentUser = JSON.parse(userStr);
        this.updateUIForAuth();
      } catch (e) {
        console.warn('Error parsing cached user:', e);
      }
    }

    if (!this.supabase) {
      this.authReady = true;
      this.updateUIForAuth();
      return;
    }
    
    let session = null;
    try {
      const { data } = await this.queryWithTimeout(this.supabase.auth.getSession(), 2000);
      session = data?.session;
    } catch (err) {
      console.error('Error fetching session:', err);
    }

    if (session) {
      let dbRole = session.user.user_metadata?.role || 'Kullanıcı';
      let dbAvatarUrl = session.user.user_metadata?.avatar_url || '';
      let dbAvatarPosition = session.user.user_metadata?.avatar_position || '50% 50%';
      try {
        const { data: profile } = await this.queryWithTimeout(
          this.supabase
            .from('profiles')
            .select('role, avatar_url, avatar_position')
            .eq('id', session.user.id)
            .single(),
          2000
        );
        if (profile?.role) {
          dbRole = profile.role;
        }
        if (profile?.avatar_url) {
          dbAvatarUrl = profile.avatar_url;
        }
        if (profile?.avatar_position) {
          dbAvatarPosition = profile.avatar_position;
        }
      } catch (e) {
        console.error('Error fetching live role:', e);
      }

      this.currentUser = {
        ...session.user.user_metadata,  // spread first so dbRole below wins
        id: session.user.id,
        name: session.user.user_metadata?.name || session.user.email.split('@')[0],
        email: session.user.email,
        role: dbRole,  // always use fresh DB role, not stale metadata
        avatar_url: dbAvatarUrl,
        avatar_position: dbAvatarPosition
      };
      // Keep cached session up-to-date
      this._storage.setItem('asdfl_user', JSON.stringify(this.currentUser));
    } else {
      this.currentUser = null;
      this._storage.removeItem('asdfl_user');
    }

    // IMPORTANT: authReady is set AFTER the DB role is fetched, not before.
    // This ensures waitForAuth() only resolves once currentUser.role is correct.
    this.authReady = true;

    this.supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (session) {
          let dbRole = session.user.user_metadata?.role || 'Kullanıcı';
          let dbAvatarUrl = session.user.user_metadata?.avatar_url || '';
          let dbAvatarPosition = session.user.user_metadata?.avatar_position || '50% 50%';
          try {
            const { data: profile } = await this.supabase
              .from('profiles')
              .select('role, avatar_url, avatar_position')
              .eq('id', session.user.id)
              .single();
            if (profile?.role) {
              dbRole = profile.role;
            }
            if (profile?.avatar_url) {
              dbAvatarUrl = profile.avatar_url;
            }
            if (profile?.avatar_position) {
              dbAvatarPosition = profile.avatar_position;
            }
          } catch (e) {
            console.error('Error fetching live role on change:', e);
          }

          this.currentUser = {
            ...session.user.user_metadata,  // spread first so dbRole below wins
            id: session.user.id,
            name: session.user.user_metadata?.name || session.user.email.split('@')[0],
            email: session.user.email,
            role: dbRole,  // always use fresh DB role, not stale metadata
            avatar_url: dbAvatarUrl,
            avatar_position: dbAvatarPosition
          };
          this._storage.setItem('asdfl_user', JSON.stringify(this.currentUser));
        }
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this._storage.removeItem('asdfl_user');
      }
      this.updateUIForAuth();
    });

    this.updateUIForAuth();
  },

  updateUIForAuth() {
    const navCta = document.querySelector('.nav-cta');
    if (!navCta) return;

    if (this.currentUser && this.currentUser.role === 'Öğrenci') {
      const isIndex = window.location.pathname === '/' || 
                      window.location.pathname.endsWith('index.html') || 
                      window.location.pathname.endsWith('/');
      if (isIndex) {
        window.location.href = 'ogrenci.html';
        return;
      }
      
      const brand = document.querySelector('.nav-brand');
      if (brand) brand.href = 'ogrenci.html';
      
      const homeLink = document.querySelector('.nav-links a[href="index.html"]');
      if (homeLink) {
        homeLink.href = 'ogrenci.html';
        homeLink.innerHTML = '<i data-lucide="layout-dashboard" style="width:1.2rem;height:1.2rem"></i> Öğrenci Paneli';
      }
    }

    if (this.currentUser) {
      const avatarUrl = this.currentUser.avatar_url || this.currentUser.avatarUrl || '';
      const name = this.currentUser.name || '';
      const role = this.currentUser.role || '';
      const cacheKey = `${name}|${role}|${avatarUrl}`;
      
      // Eğer inline script zaten navbar'ı çizdiyse ama cache key set etmediyse,
      // yeniden yazmaktan kaçın — sadece cache key'i set et
      if (!navCta.dataset.userCache && navCta.querySelector('.user-profile')) {
        navCta.dataset.userCache = cacheKey;
      }
      
      if (navCta.dataset.userCache !== cacheKey) {
        navCta.dataset.userCache = cacheKey;
        const initials = this.getInitials(name);
        const avatarHTML = avatarUrl 
          ? `<div class="profile-avatar" style="background-image: url('${this.escapeAttr(avatarUrl)}'); background-size: cover; background-position: center; border: 1.5px solid var(--gold-500);"></div>`
          : `<div class="profile-avatar">${this.escapeHTML(initials)}</div>`;
        navCta.innerHTML = `
          <div class="user-profile" onclick="this.classList.toggle('open')">
            <button class="profile-btn">
              ${avatarHTML}
              <span class="user-name-span">${this.escapeHTML(name)}</span>
              <i data-lucide="chevron-down" style="width:14px;height:14px"></i>
            </button>
            <div class="profile-menu">
              <div style="padding:.5rem 1rem;border-bottom:1px solid var(--glass-border);margin-bottom:.25rem">
                <strong style="color:var(--text-primary);display:block">${this.escapeHTML(name)}</strong>
                <span style="font-size:.75rem;color:var(--text-muted)">${this.escapeHTML(role)}</span>
              </div>
              <a href="profil.html" style="display:flex;align-items:center;gap:.5rem;padding:.5rem 1rem;color:var(--text-secondary);text-decoration:none;transition:all .2s"><i data-lucide="user" style="width:16px;height:16px"></i> Profilim</a>
              <button onclick="ASDFL.logout()" class="logout"><i data-lucide="log-out" style="width:16px;height:16px"></i> Çıkış Yap</button>
            </div>
          </div>
          <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
        `;
        setTimeout(() => this.refreshIcons(), 10);
      }
    } else {
      // Inline script zaten "Giriş Yap" butonunu çizdiyse, yeniden yazma
      if (!navCta.dataset.userCache && navCta.querySelector('.btn-primary')) {
        navCta.dataset.userCache = 'logged-out';
      }
      if (navCta.dataset.userCache !== 'logged-out') {
        navCta.dataset.userCache = 'logged-out';
        navCta.innerHTML = `
          <button class="btn btn-primary btn-sm" onclick="ASDFL.openModal('loginModal')">Giriş Yap</button>
          <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
        `;
        setTimeout(() => this.refreshIcons(), 10);
      }
    }
    
    const navLinks = document.getElementById('navLinks');
    if (navLinks) {
      const existingAdminLink = navLinks.querySelector('a[href="yonetim.html"]');
      const existingMentorLink = navLinks.querySelector('a[href="mentorluk.html"]');
      
      if (this.currentUser) {
        let changed = false;
        if (!existingMentorLink) {
          const liMentor = document.createElement('li');
          liMentor.innerHTML = '<a href="mentorluk.html"><i data-lucide="sparkles" style="width:1.2rem;height:1.2rem"></i> Mentörlük Paneli</a>';
          navLinks.appendChild(liMentor);
          changed = true;
        }

        if (this.currentUser.role === 'Admin') {
          if (!existingAdminLink) {
            const liAdmin = document.createElement('li');
            liAdmin.innerHTML = '<a href="yonetim.html"><i data-lucide="shield-check" style="width:1.2rem;height:1.2rem"></i> Yönetim</a>';
            navLinks.appendChild(liAdmin);
            changed = true;
          }
        } else {
          if (existingAdminLink) {
            existingAdminLink.parentElement.remove();
            changed = true;
          }
        }
        if (changed) {
          setTimeout(() => this.refreshIcons(), 10);
        }
      } else {
        let changed = false;
        if (existingMentorLink) {
          existingMentorLink.parentElement.remove();
          changed = true;
        }
        if (existingAdminLink) {
          existingAdminLink.parentElement.remove();
          changed = true;
        }
        if (changed) {
          setTimeout(() => this.refreshIcons(), 10);
        }
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
    setTimeout(() => this.refreshIcons(), 10);
  },

  async logout() {
    this._storage.removeItem('asdfl_user');
    if (this.supabase) {
      await this.supabase.auth.signOut();
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
    const university = document.getElementById('regUniversity')?.value || '';
    const grade = document.getElementById('regGrade')?.value;
    const branch = document.getElementById('regBranch')?.value;
    const teachingYear = document.getElementById('regTeachingYear')?.value;
    const academicTitle = document.getElementById('regAcademicTitle')?.value || '';
    const specialization = document.getElementById('regSpecialization')?.value || '';

    const classSectionAlumni = document.getElementById('regClassSectionAlumni')?.value;
    const classSectionStudent = document.getElementById('regClassSectionStudent')?.value;
    const classSection = role === 'Mezun' ? classSectionAlumni : (role === 'Öğrenci' ? classSectionStudent : '');

    const phone = document.getElementById('regPhone')?.value || '';
    const sharePhone = document.getElementById('regSharePhone')?.checked || false;
    const shareEmail = document.getElementById('regShareEmail')?.checked || false;
    const kvkkNotice = document.getElementById('regKvkkNotice')?.checked || false;
    const termsAccepted = document.getElementById('regTerms')?.checked || false;
    const optionalConsent = document.getElementById('regOptionalConsent')?.checked || false;

    const targetUniversity = document.getElementById('regTargetUniversity')?.value || '';
    const targetJob = document.getElementById('regTargetJob')?.value || '';

    if (!name || !email || !pass) {
      this.toast('Lütfen zorunlu alanları doldurun.', 'warning');
      return;
    }
    if (!kvkkNotice) {
      this.toast('Kayıt için KVKK Aydınlatma Metni bildirimi zorunludur.', 'warning');
      return;
    }
    if (!termsAccepted) {
      this.toast('Kullanım Koşulları ve Topluluk Kuralları kabul edilmelidir.', 'warning');
      return;
    }
    if ((sharePhone || shareEmail) && !optionalConsent) {
      this.toast('İletişim bilgisi paylaşmak için isteğe bağlı açık rıza kutusunu işaretleyin veya paylaşım tercihlerini kapatın.', 'warning');
      return;
    }

    const submitBtn = document.getElementById('registerSubmitBtn');
    if (submitBtn?.disabled) return;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Kayıt oluşturuluyor...'; }

    const metadata = { 
      role, 
      name, 
      classSection: classSection ? classSection.toUpperCase() : '',
      phone,
      sharePhone,
      shareEmail,
      legalDocumentVersion: this.legalDocumentVersion,
      kvkkNoticeAccepted: kvkkNotice,
      termsAccepted,
      optionalConsent
    };
    
    if (role === 'Mezun') {
      metadata.gradYear = gradYear; metadata.job = job; metadata.city = city; metadata.company = company; metadata.university = university;
      metadata.academicTitle = academicTitle; metadata.specialization = specialization;
    } else if (role === 'Öğrenci') {
      metadata.grade = grade;
      metadata.targetUniversity = targetUniversity;
      metadata.targetJob = targetJob;
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
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Kayıt Ol'; }
        return;
      }
      if (data?.session?.user?.id) {
        const { data: savedConsents, error: consentError } = await this.supabase
          .from('user_legal_consents').select('id').eq('user_id', data.session.user.id).eq('document_version', this.legalDocumentVersion);
        if (consentError || (savedConsents || []).length < 3) {
          console.error('Legal consent persistence verification failed:', consentError || 'Missing consent rows');
          this.toast('Üyelik oluşturuldu ancak onay kaydı doğrulanamadı. Lütfen yönetimle iletişime geçin.', 'warning');
        }
      }
    } else {
      const newUser = {
        id: Math.random().toString(36).substring(2),
        email,
        ...metadata,
        mentor: false,
        grad_year: gradYear ? parseInt(gradYear) : null,
        class_section: classSection,
        university: university,
        academic_title: academicTitle,
        specialization: specialization,
        target_university: targetUniversity,
        target_job: targetJob
      };
      this._storage.setItem('asdfl_user', JSON.stringify(newUser));
      this.currentUser = newUser;
      
      // Also add to local alumni list for immediate directory visibility
      try {
        const localAlumni = JSON.parse(this._storage.getItem('asdfl_alumni') || '[]');
        localAlumni.push(newUser);
        this._storage.setItem('asdfl_alumni', JSON.stringify(localAlumni));
      } catch (e) {
        console.warn('Could not add to local alumni list:', e);
      }
      const localConsents = JSON.parse(this._storage.getItem('asdfl_legal_consents') || '[]');
      const acceptedAt = new Date().toISOString();
      localConsents.push(
        { user_id: newUser.id, document_type: 'kvkk_notice', document_version: this.legalDocumentVersion, accepted: true, accepted_at: acceptedAt, source: 'registration' },
        { user_id: newUser.id, document_type: 'terms_and_community', document_version: this.legalDocumentVersion, accepted: true, accepted_at: acceptedAt, source: 'registration' },
        { user_id: newUser.id, document_type: 'optional_contact_sharing', document_version: this.legalDocumentVersion, accepted: optionalConsent, accepted_at: acceptedAt, source: 'registration' }
      );
      this._storage.setItem('asdfl_legal_consents', JSON.stringify(localConsents));
    }
    
    this.closeModal('registerModal');
    this.updateUIForAuth();
    this.toast('Aramıza hoş geldin, ' + name + '! 🎉', 'success');
    setTimeout(() => window.location.reload(), 1000);
  },

  async quickLogin(email = 'admin@admin.com', pass = 'admin') {
    if (!email || !pass) { this.toast('Lütfen tüm alanları doldurun.', 'warning'); return; }
    
    if (this.supabase) {
      const { data, error } = await this.supabase.auth.signInWithPassword({ email, password: pass });
      if (error) {
        this.toast('Giriş başarısız: ' + error.message, 'error');
        return;
      }
      
      // Cache session data instantly before reload to avoid race conditions!
      if (data.session) {
        const session = data.session;
        let dbRole = session.user.user_metadata?.role || 'Kullanıcı';
        let dbAvatarUrl = session.user.user_metadata?.avatar_url || '';
        let dbAvatarPosition = session.user.user_metadata?.avatar_position || '50% 50%';
        try {
          const { data: profile } = await this.supabase
            .from('profiles')
            .select('role, avatar_url, avatar_position')
            .eq('id', session.user.id)
            .single();
          if (profile?.role) dbRole = profile.role;
          if (profile?.avatar_url) dbAvatarUrl = profile.avatar_url;
          if (profile?.avatar_position) dbAvatarPosition = profile.avatar_position;
        } catch (e) {
          console.error('Error fetching role during login:', e);
        }
        
        this.currentUser = {
          ...session.user.user_metadata,
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email.split('@')[0],
          email: session.user.email,
          role: dbRole,
          avatar_url: dbAvatarUrl,
          avatar_position: dbAvatarPosition
        };
        this._storage.setItem('asdfl_user', JSON.stringify(this.currentUser));
      }
    } else {
      let user = { id: Math.random().toString(36).substring(2), role: 'Kullanıcı', name: email.split('@')[0], email: email };
      if (email === 'admin@admin.com' && pass === 'admin') {
        user = { id: '1', role: 'Admin', name: 'Sistem Yöneticisi', email: 'admin@admin.com', mentor: true };
      } else {
        try {
          const alumni = JSON.parse(this._storage.getItem('asdfl_alumni') || '[]');
          const matched = alumni.find(a => a.email.toLowerCase() === email.toLowerCase());
          if (matched) {
            user = { ...matched };
          }
        } catch(e) {}
      }
      this._storage.setItem('asdfl_user', JSON.stringify(user));
      this.currentUser = user;
    }
    
    this.updateUIForAuth();
    this.toast('Giriş başarılı!', 'success');
    setTimeout(() => window.location.reload(), 500);
  },

  async handleLogin(emailId, passId) {
    const emailEl = document.getElementById(emailId);
    const passEl = document.getElementById(passId);
    if (!emailEl || !passEl) return;
    const email = emailEl.value;
    const pass = passEl.value;
    if (!email || !pass) { this.toast('Lütfen tüm alanları doldurun.', 'warning'); return; }
    
    await this.quickLogin(email, pass);
    this.closeModal('loginModal');
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
    const jobInputs = document.querySelectorAll('#regJob, #editJob');
    const companyInputs = document.querySelectorAll('#regCompany, #editCompany');
    if (!jobInputs.length && !companyInputs.length) return;

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

    this._autocompleteAlumniPromise = this._autocompleteAlumniPromise || this.fetchAlumni();
    const alumni = await this._autocompleteAlumniPromise;
    if (alumni && alumni.length > 0) {
      const uniqueJobs = [...new Set(alumni.map(a => a.job).filter(Boolean))].sort();
      const uniqueCompanies = [...new Set(alumni.map(a => a.company).filter(Boolean))].sort();

      jobsDatalist.innerHTML = uniqueJobs.map(j => `<option value="${this.escapeAttr(j)}">`).join('');
      companiesDatalist.innerHTML = uniqueCompanies.map(c => `<option value="${this.escapeAttr(c)}">`).join('');
    }

    jobInputs.forEach(el => el.setAttribute('list', 'jobsDatalist'));
    companyInputs.forEach(el => el.setAttribute('list', 'companiesDatalist'));
  },

  async ensureUniversitiesLoaded() {
    if (window.TURKISH_UNIVERSITIES) return;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'js/universities.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Universities script failed to load'));
      document.head.appendChild(script);
    });
  },

  async setupSearchableDropdowns() {
    const dropdownWrappers = document.querySelectorAll('.searchable-select-wrapper');
    if (dropdownWrappers.length === 0) return;

    try {
      await this.ensureUniversitiesLoaded();
    } catch (e) {
      console.warn('Could not load universities list:', e);
    }

    const unis = window.TURKISH_UNIVERSITIES || [];
    const universitySearchIndex = unis.map(uni => ({
      value: uni,
      normalized: uni.toLocaleUpperCase('tr')
    }));
    
    dropdownWrappers.forEach(wrapper => {
      const triggerInput = wrapper.querySelector('.searchable-select-trigger');
      const dropdown = wrapper.querySelector('.searchable-select-dropdown');
      const searchInput = wrapper.querySelector('.searchable-select-search-input');
      const itemsList = wrapper.querySelector('.searchable-select-items');
      
      if (!triggerInput || !dropdown || !searchInput || !itemsList) return;
      
      // Prevent double binding
      if (wrapper.dataset.bound === 'true') return;
      wrapper.dataset.bound = 'true';

      function renderList(query = '') {
        const uppercaseQuery = query.toLocaleUpperCase('tr');
        
        let filtered = universitySearchIndex;
        if (uppercaseQuery) {
          filtered = universitySearchIndex.filter(uni => 
            uni.normalized.includes(uppercaseQuery)
          );
        }
        
        let html = '';
        
        // Show "Add custom" option if the query doesn't match any university exactly
        const exactMatch = universitySearchIndex.some(uni => uni.normalized === uppercaseQuery);
        if (uppercaseQuery && !exactMatch) {
          const safeQuery = ASDFL.escapeHTML(query);
          html += `<li class="searchable-select-item custom-add" data-value="${ASDFL.escapeAttr(query)}"><i data-lucide="plus" style="width:12px;height:12px;display:inline-block;margin-right:4px;"></i> Ekle: "${safeQuery}"</li>`;
        }
        
        if (filtered.length === 0 && !uppercaseQuery) {
          html += '<li class="searchable-select-item no-results">Liste yüklenemedi veya boş.</li>';
        } else if (filtered.length === 0 && uppercaseQuery) {
          if (exactMatch) {
            html += '<li class="searchable-select-item no-results">Sonuç bulunamadı.</li>';
          }
        } else {
          filtered.forEach(uni => {
            const value = ASDFL.escapeAttr(uni.value);
            html += `<li class="searchable-select-item" data-value="${value}">${ASDFL.escapeHTML(uni.value)}</li>`;
          });
        }
        
        itemsList.innerHTML = html;
        
        if (window.lucide) {
          lucide.createIcons({
            attrs: {
              class: 'lucide-icon'
            }
          });
        }
        
      }

      itemsList.onclick = function(e) {
        const item = e.target.closest('.searchable-select-item');
        if (!item || item.classList.contains('no-results')) return;
        e.stopPropagation();
        const val = item.getAttribute('data-value');
        triggerInput.value = val;
        closeDropdown();
        triggerInput.dispatchEvent(new Event('change'));
      };
      
      function openDropdown() {
        document.querySelectorAll('.searchable-select-dropdown').forEach(el => {
          if (el !== dropdown) el.style.display = 'none';
        });
        
        dropdown.style.display = 'flex';
        searchInput.value = '';
        renderList('');
        setTimeout(() => searchInput.focus(), 50);
      }
      
      function closeDropdown() {
        dropdown.style.display = 'none';
      }
      
      triggerInput.onclick = function(e) {
        e.stopPropagation();
        openDropdown();
      };
      
      let searchRenderFrame = null;
      searchInput.oninput = function() {
        const value = this.value;
        if (searchRenderFrame) cancelAnimationFrame(searchRenderFrame);
        searchRenderFrame = requestAnimationFrame(() => {
          searchRenderFrame = null;
          renderList(value);
        });
      };
      
      dropdown.onclick = function(e) {
        e.stopPropagation();
      };
    });
    
    // Close dropdowns when clicking outside
    if (!window.searchableDropdownOutsideClickBound) {
      window.searchableDropdownOutsideClickBound = true;
      document.addEventListener('click', () => {
        document.querySelectorAll('.searchable-select-dropdown').forEach(el => {
          el.style.display = 'none';
        });
      });
    }
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
    this.ensureLegalFooter();
    this.checkAuth();
    this.initCities();
    this.initAutocomplete();
    this.setupSearchableDropdowns();

    const diagApp = document.getElementById('diag-app-js');
    if (diagApp) diagApp.innerHTML = '- app.js Yüklenme Durumu: <span style="color:#2ecc71">Yüklendi (Ok)</span>';
  }
};

// Expose ASDFL globally so that inline event handlers (like onclick) on any page can access it
window.ASDFL = ASDFL;

document.addEventListener('DOMContentLoaded', () => ASDFL.init());

/* ================================================
   SAYFA GEÇİŞ SİSTEMİ — Smooth Page Transitions
   ================================================ */
(function() {
  const EXIT_DURATION = 220; // ms — pageExit animasyonuyla eşleşmeli

  function isInternalLink(el) {
    if (!el || el.tagName !== 'A') return false;
    const href = el.getAttribute('href');
    if (!href) return false;
    // Anchor, javascript:, mailto:, tel:, http: dışındaki dış linkler hariç
    if (href.startsWith('#') || href.startsWith('javascript:') ||
        href.startsWith('mailto:') || href.startsWith('tel:')) return false;
    if (href.startsWith('http://') || href.startsWith('https://')) {
      // Aynı domain'se geçiş yap
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return false;
      } catch { return false; }
    }
    return true;
  }

  function navigateWithTransition(href, target) {
    document.body.classList.add('page-exit');
    setTimeout(() => {
      if (target && target !== '_self') {
        window.open(href, target);
        document.body.classList.remove('page-exit');
      } else {
        window.location.href = href;
      }
    }, EXIT_DURATION);
  }

  document.addEventListener('click', function(e) {
    // Modifier tuşlarla açılan linkler (yeni sekme vb.) hariç
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (e.button !== 0) return; // Sadece sol tıklama

    const link = e.target.closest('a');
    if (!isInternalLink(link)) return;

    // Modal içindeki linkleri hariç tut (modal kapanırken link tıklanabilir)
    if (link.closest('.modal')) return;

    // Çıkış butonu değilse (logout gibi) geçiş yap
    const href = link.getAttribute('href');
    const target = link.getAttribute('target');

    // Zaten bu sayfadaysak geçiş yapma
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    if (href === currentPage || href === '#') return;

    e.preventDefault();
    navigateWithTransition(href, target);
  });

  // Tarayıcı geri/ileri navigasyonunda da giriş animasyonu tetikle
  window.addEventListener('pageshow', function(e) {
    if (e.persisted) {
      // bfcache'den geliyorsa animasyonu yeniden tetikle
      document.body.classList.remove('page-exit');
      document.body.style.animation = 'none';
      requestAnimationFrame(() => {
        document.body.style.animation = '';
      });
    }
  });
})();

// ================================================================
// GLOBAL AVATAR IMAGE ERROR HANDLER (event delegation)
// avatar-img class'ına sahip img yüklenemezse initials göster
// ================================================================
document.addEventListener('error', function(e) {
  const img = e.target;
  if (!img || img.tagName !== 'IMG' || !img.classList.contains('avatar-img')) return;
  const initials = img.getAttribute('data-initials') || '?';
  img.style.display = 'none';
  const parent = img.parentElement;
  if (parent) {
    const span = document.createElement('span');
    span.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-family:Outfit,sans-serif;font-weight:700;';
    span.textContent = initials;
    parent.appendChild(span);
  }
}, true); // capture=true: error eventi bubble etmez, capture gerekli
