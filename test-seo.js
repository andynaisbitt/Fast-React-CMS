// test-seo.js - Diagnostic tool for SEO and canonical URL issues
import axios from 'axios';

const SITE_URL = 'https://theitapprentice.com';
const API_BASE = 'https://theitapprentice.com/api/v1';
const API_LOCAL = 'http://localhost:8100/api/v1';
const SSR_HEALTH_LOCAL = 'http://localhost:3001/health';

console.log('🔍 FastReactCMS SEO Diagnostic Tool');
console.log('=====================================\n');

let testsPassed = 0;
let testsFailed = 0;

// Test 1: Backend API Health
console.log('📡 Test 1: Backend API Health Check');
try {
  const response = await axios.get('http://localhost:8100/health', { timeout: 5000 });
  console.log('✅ Backend API is running');
  testsPassed++;
} catch (error) {
  console.log('❌ Backend API is NOT responding');
  console.log(`   Error: ${error.message}`);
  console.log('   💡 Run: sudo systemctl status fastreactcms-backend');
  testsFailed++;
}
console.log('');

// Test 2: SSR Server Health
console.log('📡 Test 2: SSR Server Health Check');
try {
  const response = await axios.get(SSR_HEALTH_LOCAL, { timeout: 5000 });
  console.log('✅ SSR Server is running');
  console.log(`   Cache size: ${response.data.cache_size}/${response.data.cache_max}`);
  console.log(`   Uptime: ${Math.floor(response.data.uptime / 60)} minutes`);
  testsPassed++;
} catch (error) {
  console.log('❌ SSR Server is NOT responding');
  console.log(`   Error: ${error.message}`);
  console.log('   💡 Run: sudo systemctl status fastreactcms-ssr');
  console.log('   💡 Start: sudo systemctl start fastreactcms-ssr');
  testsFailed++;
}
console.log('');

// Test 3: Canonical URL API Endpoint (Local)
console.log('📡 Test 3: Canonical URL API (Backend - Local)');
const testCanonical1 = 'https://theitapprentice.com/RAM-Price-Spikes';
try {
  const response = await axios.get(`${API_LOCAL}/content/by-canonical`, {
    params: { url: testCanonical1 },
    timeout: 5000,
  });
  console.log('✅ Canonical URL API is working (Local)');
  console.log(`   Found: ${response.data.type} - ${response.data.slug}`);
  console.log(`   Title: ${response.data.data.title}`);
  testsPassed++;
} catch (error) {
  if (error.response?.status === 404) {
    console.log('❌ Canonical URL not found in database');
    console.log(`   Searched for: ${testCanonical1}`);
    console.log('   💡 Check: sudo -u postgres psql fastreactcms -c "SELECT canonical_url FROM blog_posts;"');
  } else {
    console.log('❌ API Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('   💡 Backend API not running on port 8100');
    }
  }
  testsFailed++;
}
console.log('');

// Test 4: Canonical URL API Endpoint (Public)
console.log('📡 Test 4: Canonical URL API (Public - Through NGINX)');
try {
  const response = await axios.get(`${API_BASE}/content/by-canonical`, {
    params: { url: testCanonical1 },
    timeout: 5000,
  });
  console.log('✅ Canonical URL API is working (Public)');
  console.log(`   Found: ${response.data.type} - ${response.data.slug}`);
  testsPassed++;
} catch (error) {
  if (error.response?.status === 404) {
    console.log('❌ Canonical URL not found (Public)');
    console.log('   💡 Database may not have canonical_url set');
  } else {
    console.log('❌ Public API Error:', error.message);
  }
  testsFailed++;
}
console.log('');

// Test 5: Test second canonical URL
console.log('📡 Test 5: Second Canonical URL (original-post)');
const testCanonical2 = 'https://theitapprentice.com/original-post';
try {
  const response = await axios.get(`${API_LOCAL}/content/by-canonical`, {
    params: { url: testCanonical2 },
    timeout: 5000,
  });
  console.log('✅ Second canonical URL works');
  console.log(`   Found: ${response.data.type} - ${response.data.slug}`);
  console.log(`   Title: ${response.data.data.title}`);
  testsPassed++;
} catch (error) {
  if (error.response?.status === 404) {
    console.log('❌ Second canonical URL not found');
  } else {
    console.log('❌ Error:', error.message);
  }
  testsFailed++;
}
console.log('');

// Test 6: Frontend Canonical URL Resolution (RAM-Price-Spikes)
console.log('📡 Test 6: Frontend Canonical URL Resolution (/RAM-Price-Spikes)');
try {
  const response = await axios.get(`${SITE_URL}/RAM-Price-Spikes`, {
    timeout: 10000,
    maxRedirects: 0, // Don't follow redirects, we want to see what happens
    validateStatus: (status) => status < 500, // Accept any status < 500
  });

  const html = response.data;
  const titleMatch = html.match(/<title>(.*?)<\/title>/);

  if (response.status === 200) {
    console.log('✅ Canonical URL accessible');
    console.log(`   Status: ${response.status}`);
    console.log(`   Title: ${titleMatch ? titleMatch[1] : 'NOT FOUND'}`);

    // Check if it's the 404 page or actual content
    if (html.includes('404') || html.includes('Page Not Found')) {
      console.log('   ⚠️  WARNING: Getting 200 but showing 404 page');
      console.log('   💡 Frontend CanonicalResolver may not be working');
      testsFailed++;
    } else {
      testsPassed++;
    }
  } else {
    console.log(`⚠️  Got status: ${response.status}`);
    testsFailed++;
  }
} catch (error) {
  console.log('❌ Failed to access canonical URL');
  console.log(`   Error: ${error.message}`);
  testsFailed++;
}
console.log('');

// Test 7: Frontend Canonical URL Resolution (original-post)
console.log('📡 Test 7: Frontend Canonical URL Resolution (/original-post)');
try {
  const response = await axios.get(`${SITE_URL}/original-post`, {
    timeout: 10000,
    maxRedirects: 0,
    validateStatus: (status) => status < 500,
  });

  if (response.status === 200) {
    const html = response.data;
    if (html.includes('404') || html.includes('Page Not Found')) {
      console.log('⚠️  Getting 200 but showing 404 page');
      testsFailed++;
    } else {
      console.log('✅ Second canonical URL accessible');
      testsPassed++;
    }
  } else {
    console.log(`⚠️  Got status: ${response.status}`);
    testsFailed++;
  }
} catch (error) {
  console.log('❌ Failed to access second canonical URL');
  testsFailed++;
}
console.log('');

// Test 8: Blog Post Meta Tags (as crawler)
console.log('📡 Test 8: Blog Post Meta Tags (Crawler View)');
try {
  const response = await axios.get(`${SITE_URL}/blog/ram-has-gone-mad-2025-price-crisis`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    },
    timeout: 10000,
  });

  const html = response.data;
  const hasSSR = response.headers['x-rendered-by'] === 'SSR';
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  const ogTitleMatch = html.match(/<meta property="og:title" content="(.*?)" \/>/);

  if (hasSSR) {
    console.log('✅ SSR is serving proper meta tags to crawlers');
    console.log(`   Title: ${titleMatch ? titleMatch[1] : 'NOT FOUND'}`);
    console.log(`   OG Title: ${ogTitleMatch ? ogTitleMatch[1] : 'NOT FOUND'}`);
    testsPassed++;
  } else {
    console.log('⚠️  SSR header not present');
    console.log(`   Title: ${titleMatch ? titleMatch[1] : 'NOT FOUND'}`);
    console.log('   💡 Check NGINX crawler detection and SSR routing');
    testsFailed++;
  }
} catch (error) {
  console.log('❌ Failed to fetch page:', error.message);
  testsFailed++;
}
console.log('');

// Test 9: Blog Post Meta Tags (as regular user)
console.log('📡 Test 9: Blog Post Meta Tags (Regular User View)');
try {
  const response = await axios.get(`${SITE_URL}/blog/ram-has-gone-mad-2025-price-crisis`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    timeout: 10000,
  });

  const html = response.data;
  const hasSSR = response.headers['x-rendered-by'] === 'SSR';
  const titleMatch = html.match(/<title>(.*?)<\/title>/);

  if (!hasSSR) {
    console.log('✅ Regular users get SPA (correct)');
    console.log(`   Initial title: ${titleMatch ? titleMatch[1] : 'NOT FOUND'}`);
    console.log('   💡 React Helmet will update meta tags after page load');
    testsPassed++;
  } else {
    console.log('⚠️  Regular users are getting SSR (unexpected)');
    console.log('   💡 Check NGINX crawler detection logic');
    testsFailed++;
  }
} catch (error) {
  console.log('❌ Failed to fetch page:', error.message);
  testsFailed++;
}
console.log('');

// Summary
console.log('=====================================');
console.log('📊 Test Results Summary');
console.log('=====================================');
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log(`📋 Total:  ${testsPassed + testsFailed}`);
console.log('');

if (testsFailed > 0) {
  console.log('🔧 Action Items:');
  console.log('─────────────────────────────────────');

  console.log('\n1. Check Services:');
  console.log('   sudo systemctl status fastreactcms-backend');
  console.log('   sudo systemctl status fastreactcms-ssr');
  console.log('   sudo systemctl status nginx');

  console.log('\n2. Check Database:');
  console.log('   sudo -u postgres psql fastreactcms -c "SELECT id, title, canonical_url FROM blog_posts WHERE canonical_url IS NOT NULL;"');

  console.log('\n3. Check Logs:');
  console.log('   sudo journalctl -u fastreactcms-backend -n 50 --no-pager');
  console.log('   sudo journalctl -u fastreactcms-ssr -n 50 --no-pager');
  console.log('   sudo tail -n 50 /var/log/nginx/theitapprentice.error.log');

  console.log('\n4. Rebuild Frontend (if needed):');
  console.log('   cd /var/www/fastreactcms/Frontend');
  console.log('   npm run build');
  console.log('   sudo systemctl reload nginx');
  console.log('');
} else {
  console.log('🎉 All tests passed! Your SEO setup is working correctly.');
  console.log('');
}

console.log('📋 How SEO Works:');
console.log('─────────────────────────────────────');
console.log('For Regular Users:');
console.log('  • Get SPA with default meta tags (fast)');
console.log('  • React Helmet updates tags after load');
console.log('  • "View Source" shows default tags (normal)');
console.log('');
console.log('For Crawlers (Google, Facebook, Twitter):');
console.log('  • SSR injects proper meta tags');
console.log('  • Crawlers see correct title/description/image');
console.log('  • This is what matters for SEO!');
console.log('');
console.log('Test Your SEO:');
console.log('  • Facebook: https://developers.facebook.com/tools/debug/');
console.log('  • Twitter:  https://cards-dev.twitter.com/validator');
console.log('  • LinkedIn: https://www.linkedin.com/post-inspector/');
console.log('');
