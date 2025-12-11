// test-seo.js - Diagnostic tool for SEO and canonical URL issues
import axios from 'axios';

const SITE_URL = 'https://theitapprentice.com';
const API_BASE = 'https://theitapprentice.com/api/v1';
const SSR_HEALTH = 'https://theitapprentice.com:3001/health';

console.log('🔍 FastReactCMS SEO Diagnostic Tool\n');

// Test 1: SSR Server Health
console.log('📡 Test 1: SSR Server Health Check');
try {
  const response = await axios.get(SSR_HEALTH, { timeout: 5000 });
  console.log('✅ SSR Server is running');
  console.log(`   Cache size: ${response.data.cache_size}/${response.data.cache_max}`);
  console.log(`   Uptime: ${Math.floor(response.data.uptime / 60)} minutes\n`);
} catch (error) {
  console.log('❌ SSR Server is NOT responding');
  console.log(`   Error: ${error.message}`);
  console.log('   💡 Run: pm2 start server.js --name ssr-server\n');
}

// Test 2: Canonical URL API Endpoint
console.log('📡 Test 2: Canonical URL API Test');
const testCanonical = 'https://theitapprentice.com/RAM-Price-Spikes';
try {
  const response = await axios.get(`${API_BASE}/content/by-canonical`, {
    params: { url: testCanonical },
    timeout: 5000,
  });
  console.log('✅ Canonical URL API is working');
  console.log(`   Found: ${response.data.type} - ${response.data.slug}`);
  console.log(`   Title: ${response.data.data.title}\n`);
} catch (error) {
  if (error.response?.status === 404) {
    console.log('❌ Canonical URL not found in database');
    console.log(`   Searched for: ${testCanonical}`);
    console.log('   💡 Check the canonical URL field in your post/page editor\n');
  } else {
    console.log('❌ API Error:', error.message, '\n');
  }
}

// Test 3: Test blog post meta tags (as crawler)
console.log('📡 Test 3: Blog Post Meta Tags (Crawler View)');
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
  } else {
    console.log('⚠️  SSR header not present');
    console.log(`   Title: ${titleMatch ? titleMatch[1] : 'NOT FOUND'}`);
    console.log('   💡 Check NGINX crawler detection and SSR routing\n');
  }
} catch (error) {
  console.log('❌ Failed to fetch page:', error.message, '\n');
}

// Test 4: Test blog post meta tags (as regular user)
console.log('\n📡 Test 4: Blog Post Meta Tags (Regular User View)');
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
    console.log('   💡 React Helmet will update meta tags after page load\n');
  } else {
    console.log('⚠️  Regular users are getting SSR (unexpected)');
    console.log('   💡 Check NGINX crawler detection logic\n');
  }
} catch (error) {
  console.log('❌ Failed to fetch page:', error.message, '\n');
}

console.log('📋 Summary:');
console.log('─────────────────────────────────────────────────────');
console.log('For SEO to work properly you need:');
console.log('1. ✅ SSR server running (pm2 start server.js)');
console.log('2. ✅ Canonical URLs set in posts/pages');
console.log('3. ✅ NGINX routing crawlers to SSR server');
console.log('4. ✅ API endpoint /content/by-canonical working');
console.log('\nFor regular users:');
console.log('- Initial HTML has default meta tags (normal)');
console.log('- React Helmet updates tags after load (normal)');
console.log('- "View Source" shows default tags (expected)');
console.log('\nFor crawlers (SEO):');
console.log('- SSR injects proper meta tags (important for SEO)');
console.log('- Crawlers see correct title/description/image');
