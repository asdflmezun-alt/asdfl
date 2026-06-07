const supabaseUrl = 'https://refpyezcxkkofpkwaqny.supabase.co';
const apiKey = 'sb_publishable_NlYWAPtmP6F6LRlAiXyIxw_hm1OoP9m';

async function checkData() {
  const headers = {
    'apikey': apiKey,
    'Authorization': `Bearer ${apiKey}`
  };

  console.log('Querying scholarships via REST API...');
  try {
    const sRes = await fetch(`${supabaseUrl}/rest/v1/scholarships?select=*`, { headers });
    const scholarships = await sRes.json();
    console.log('Scholarships status:', sRes.status);
    console.log('Scholarships count:', Array.isArray(scholarships) ? scholarships.length : 'Not an array');
    console.log('Scholarships:', scholarships);
  } catch (err) {
    console.error('Scholarships Fetch Error:', err);
  }

  console.log('\nQuerying profiles via REST API...');
  try {
    const pRes = await fetch(`${supabaseUrl}/rest/v1/profiles?select=*`, { headers });
    const profiles = await pRes.json();
    console.log('Profiles status:', pRes.status);
    console.log('Profiles count:', Array.isArray(profiles) ? profiles.length : 'Not an array');
    if (Array.isArray(profiles)) {
      console.log('Mentors count:', profiles.filter(p => p.mentor).length);
      console.log('Sample profiles:', profiles.slice(0, 3).map(p => ({
        id: p.id,
        name: p.name,
        role: p.role,
        mentor: p.mentor,
        avatar_url: p.avatar_url ? p.avatar_url.substring(0, 50) + '...' : null
      })));
    } else {
      console.log('Profiles response:', profiles);
    }
  } catch (err) {
    console.error('Profiles Fetch Error:', err);
  }
}

checkData().catch(console.error);
