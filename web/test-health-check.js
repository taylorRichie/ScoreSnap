#!/usr/bin/env node

/**
 * Health Check Script for ScoreSnap
 *
 * PREVENTS STYLING REGRESSIONS: This script verifies that the Next.js
 * development server is properly serving static assets (CSS, JS) to prevent
 * the common issue where pages load as plain HTML without styles.
 *
 * PROBLEM SOLVED: Multiple Next.js instances, stale cache, or server startup
 * issues can cause 404 errors for CSS/JS assets, making the app appear broken.
 *
 * USAGE:
 * - Run after starting dev server: npm run health-check
 * - Run in CI/CD pipelines to catch deployment issues
 * - Run when you suspect styling problems
 *
 * WHAT IT CHECKS:
 * ✅ Server connectivity
 * ✅ Critical pages load (/, /dashboard, /auth/login)
 * ✅ CSS assets are served (/layout.css)
 * ✅ JS chunks are served (/main-app.js)
 *
 * EXIT CODES:
 * 0 - All checks passed
 * 1 - One or more checks failed
 *
 * PREVENTION: Run this script whenever you restart the dev server or
 * encounter styling issues to quickly identify and resolve asset serving problems.
 */

const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:3000';

// Test cases to verify
const TESTS = [
  {
    name: 'Root page loads',
    url: '/',
    expectedStatus: 200,
    description: 'Main landing page should be accessible'
  },
  {
    name: 'Dashboard page loads',
    url: '/dashboard',
    expectedStatus: 200,
    description: 'Dashboard page should be accessible'
  },
  {
    name: 'CSS assets are served',
    url: '/_next/static/css/app/layout.css',
    expectedStatus: 200,
    description: 'Main layout CSS should be served'
  },
  {
    name: 'JavaScript chunks are served',
    url: '/_next/static/chunks/main-app.js',
    expectedStatus: 200,
    description: 'Main app JavaScript should be served'
  },
  {
    name: 'Login page loads',
    url: '/auth/login',
    expectedStatus: 200,
    description: 'Authentication pages should be accessible'
  }
];

let passed = 0;
let failed = 0;

function makeRequest(url, expectedStatus, testName, description) {
  return new Promise((resolve) => {
    const client = url.startsWith('https:') ? https : http;

    const req = client.get(url, (res) => {
      const statusCode = res.statusCode;

      if (statusCode === expectedStatus) {
        console.log(`✅ PASS: ${testName}`);
        console.log(`   ${description}`);
        console.log(`   Status: ${statusCode} (expected ${expectedStatus})`);
        console.log(`   URL: ${url}`);
        console.log('');
        passed++;
      } else {
        console.log(`❌ FAIL: ${testName}`);
        console.log(`   ${description}`);
        console.log(`   Status: ${statusCode} (expected ${expectedStatus})`);
        console.log(`   URL: ${url}`);
        console.log('');
        failed++;
      }
      resolve();
    });

    req.on('error', (err) => {
      console.log(`❌ FAIL: ${testName}`);
      console.log(`   ${description}`);
      console.log(`   Error: ${err.message}`);
      console.log(`   URL: ${url}`);
      console.log('');
      failed++;
      resolve();
    });

    req.setTimeout(5000, () => {
      console.log(`❌ FAIL: ${testName}`);
      console.log(`   ${description}`);
      console.log(`   Error: Request timeout (5s)`);
      console.log(`   URL: ${url}`);
      console.log('');
      failed++;
      resolve();
    });
  });
}

async function runTests() {
  console.log('🏥 ScoreSnap Health Check');
  console.log('========================');
  console.log('');

  console.log('⏳ Starting health checks...');
  console.log(`📍 Testing server at: ${BASE_URL}`);
  console.log('');

  for (const test of TESTS) {
    const fullUrl = BASE_URL + test.url;
    await makeRequest(fullUrl, test.expectedStatus, test.name, test.description);
  }

  console.log('📊 Results Summary');
  console.log('==================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total:  ${passed + failed}`);
  console.log('');

  if (failed === 0) {
    console.log('🎉 All health checks passed!');
    console.log('🚀 ScoreSnap is ready for development.');
    process.exit(0);
  } else {
    console.log('💥 Some health checks failed!');
    console.log('🔧 Please ensure the Next.js development server is running:');
    console.log('   cd web && npm run dev');
    console.log('');
    console.log('🔍 Common issues:');
    console.log('   - Next.js server not started');
    console.log('   - Port 3000 already in use');
    console.log('   - Build cache corruption (.next directory)');
    process.exit(1);
  }
}

// Check if server is running first
console.log('🔍 Checking if Next.js server is running...');
makeRequest(BASE_URL, 200, 'Server connectivity', 'Next.js development server should be running')
  .then(() => {
    console.log('');
    return runTests();
  })
  .catch(() => {
    console.log('❌ FAIL: Cannot connect to Next.js server');
    console.log('🔧 Please start the server: cd web && npm run dev');
    console.log('');
    process.exit(1);
  });
