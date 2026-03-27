#!/usr/bin/env node
/**
 * Admin Dashboard API — Automated Test Runner & Report Generator
 *
 * Usage:
 *   ADMIN_TOKEN=... npm run test:admin-api
 *   ADMIN_TOKEN=... BASE_URL=http://localhost:4000 node tests/run_admin_api_tests.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const MAX_SAMPLE_BYTES = 2048;

if (!ADMIN_TOKEN) {
    console.error('❌  ADMIN_TOKEN environment variable is required.');
    console.error('   Usage: ADMIN_TOKEN=<token> npm run test:admin-api');
    process.exit(1);
}

const authHeaders = { Authorization: `Bearer ${ADMIN_TOKEN}` };

// ── Helpers ─────────────────────────────────────────────────────────────────

function truncate(obj) {
    const s = JSON.stringify(obj, null, 2);
    return s.length > MAX_SAMPLE_BYTES ? s.slice(0, MAX_SAMPLE_BYTES) + '\n... (truncated)' : s;
}

function dur(ms) { return `${ms}ms`; }

async function request(method, urlPath, { headers = {}, params = {}, data = null, label = '' } = {}) {
    const url = `${BASE_URL}${urlPath}`;
    const start = Date.now();
    try {
        const res = await axios({ method, url, headers: { ...authHeaders, ...headers }, params, data, timeout: 15000, validateStatus: () => true });
        const latency = Date.now() - start;
        return { status: res.status, data: res.data, latency, error: null };
    } catch (err) {
        const latency = Date.now() - start;
        if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
            return { status: 0, data: null, latency, error: `Connection failed: ${err.code}` };
        }
        return { status: 0, data: null, latency, error: err.message };
    }
}

// ── Test definitions ────────────────────────────────────────────────────────

const results = []; // { name, group, method, path, purpose, inputs, curl, expected, actual, pass, latency, sample, errorDetail }

function addResult(r) {
    const pf = r.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${pf}  ${r.method} ${r.path}  → ${r.actual} (${dur(r.latency)})`);
    results.push(r);
}

function buildCurl(method, urlPath, headers = {}, body = null, params = {}) {
    let curl = `curl -s -X ${method}`;
    curl += ` -H "Authorization: Bearer <ADMIN_TOKEN>"`;
    for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === 'authorization') continue;
        curl += ` -H "${k}: ${v}"`;
    }
    const qs = new URLSearchParams(params).toString();
    const fullUrl = `${BASE_URL}${urlPath}${qs ? '?' + qs : ''}`;
    curl += ` "${fullUrl}"`;
    if (body) {
        curl += ` -H "Content-Type: application/json"`;
        curl += ` -d '${JSON.stringify(body)}'`;
    }
    return curl;
}

// ── Test runner ─────────────────────────────────────────────────────────────

async function runTests() {
    console.log('\n' + '═'.repeat(70));
    console.log('  Admin Dashboard API — Automated Tests');
    console.log('  ' + new Date().toISOString());
    console.log('  Base URL: ' + BASE_URL);
    console.log('═'.repeat(70) + '\n');

    // ── Pre-flight: server reachable? ──
    console.log('⏳ Checking server connectivity...');
    const ping = await request('GET', '/api/admin/health');
    if (ping.status === 0) {
        console.error(`\n❌  Server unreachable at ${BASE_URL}`);
        console.error(`   ${ping.error}`);
        console.error('   Make sure the backend is running: npm start\n');
        process.exit(1);
    }
    console.log(`✅ Server reachable (health: ${ping.status})\n`);

    // ════════════════════════════════════════════════════════════════════════
    // A) Overview
    // ════════════════════════════════════════════════════════════════════════
    console.log('── A) Overview ──');
    {
        const r = await request('GET', '/api/admin/overview');
        addResult({
            name: 'Overview', group: 'Overview', method: 'GET', path: '/api/admin/overview',
            purpose: 'Dashboard summary: total judgments, verified/unverified counts, confidence distribution, HITL pending, blacklist count, ingestion status, today citations.',
            inputs: 'Headers: Authorization', curl: buildCurl('GET', '/api/admin/overview'),
            expected: '200 + { success: true, data: { total_judgments, ... } }',
            actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // B) HITL Queue
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── B) HITL Queue ──');
    let hitlTaskId = null;
    {
        const params = { status: 'PENDING', page: 1, pageSize: 5, sort: 'priority_desc' };
        const r = await request('GET', '/api/admin/hitl', { params });
        const pass = r.status === 200 && r.data?.success === true && Array.isArray(r.data?.data?.tasks);
        addResult({
            name: 'HITL List', group: 'HITL Queue', method: 'GET', path: '/api/admin/hitl',
            purpose: 'List HITL pending tasks with pagination, sortable by priority.',
            inputs: 'Query: status, page, pageSize, sort', curl: buildCurl('GET', '/api/admin/hitl', {}, null, params),
            expected: '200 + data.tasks array', actual: r.status, pass,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
        if (pass && r.data.data.tasks.length > 0) {
            hitlTaskId = r.data.data.tasks[0].task_id;
        }
    }

    // HITL detail
    {
        const id = hitlTaskId || '00000000-0000-0000-0000-000000000000';
        const expectedStatus = hitlTaskId ? 200 : 404;
        const r = await request('GET', `/api/admin/hitl/${id}`);
        addResult({
            name: 'HITL Detail', group: 'HITL Queue', method: 'GET', path: `/api/admin/hitl/${id}`,
            purpose: 'Get single HITL task detail by ID.',
            inputs: 'Params: taskId', curl: buildCurl('GET', `/api/admin/hitl/${id}`),
            expected: `${expectedStatus}`, actual: r.status, pass: r.status === expectedStatus,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }

    // HITL action — valid
    if (hitlTaskId) {
        const body = { action: 'APPROVED', reviewer: 'admin-test', notes: 'automated test', blacklist: false, reason: '' };
        const r = await request('POST', `/api/admin/hitl/${hitlTaskId}/action`, { data: body });
        addResult({
            name: 'HITL Action (APPROVED)', group: 'HITL Queue', method: 'POST', path: `/api/admin/hitl/${hitlTaskId}/action`,
            purpose: 'Process HITL task action (APPROVED/REJECTED/ESCALATED).',
            inputs: 'Body: { action, reviewer, notes, blacklist, reason }', curl: buildCurl('POST', `/api/admin/hitl/${hitlTaskId}/action`, {}, body),
            expected: '200', actual: r.status, pass: r.status === 200,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }

    // HITL action — invalid (validation test)
    {
        const id = hitlTaskId || '1';
        const body = { action: 'INVALID' };
        const r = await request('POST', `/api/admin/hitl/${id}/action`, { data: body });
        addResult({
            name: 'HITL Action (INVALID — expect 400)', group: 'HITL Queue', method: 'POST', path: `/api/admin/hitl/${id}/action`,
            purpose: 'Validate action body — invalid action should return 400.',
            inputs: 'Body: { action: "INVALID" }', curl: buildCurl('POST', `/api/admin/hitl/${id}/action`, {}, body),
            expected: '400', actual: r.status, pass: r.status === 400,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // C) Data Pipeline
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── C) Data Pipeline ──');
    {
        const r = await request('GET', '/api/admin/pipeline/summary');
        addResult({
            name: 'Pipeline Summary', group: 'Data Pipeline', method: 'GET', path: '/api/admin/pipeline/summary',
            purpose: 'Ingestion queue status counts grouped by status.',
            inputs: 'Headers: Authorization', curl: buildCurl('GET', '/api/admin/pipeline/summary'),
            expected: '200 + object', actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const params = { status: 'FAILED', hasError: 'true', page: 1, pageSize: 5 };
        const r = await request('GET', '/api/admin/pipeline/items', { params });
        addResult({
            name: 'Pipeline Items', group: 'Data Pipeline', method: 'GET', path: '/api/admin/pipeline/items',
            purpose: 'List ingestion queue items with filters: status, source, date range, hasError.',
            inputs: 'Query: status, hasError, page, pageSize', curl: buildCurl('GET', '/api/admin/pipeline/items', {}, null, params),
            expected: '200 + paginated list', actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const params = { limit: 5 };
        const r = await request('GET', '/api/admin/pipeline/errors', { params });
        addResult({
            name: 'Pipeline Errors', group: 'Data Pipeline', method: 'GET', path: '/api/admin/pipeline/errors',
            purpose: 'Recent ingestion errors.',
            inputs: 'Query: limit', curl: buildCurl('GET', '/api/admin/pipeline/errors', {}, null, params),
            expected: '200', actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // D) Routes & DB
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── D) Routes & DB ──');
    {
        const r = await request('GET', '/api/admin/routesdb/summary');
        addResult({
            name: 'RoutesDB Summary', group: 'Routes & DB', method: 'GET', path: '/api/admin/routesdb/summary',
            purpose: 'Total judgments, aliases, statutes, verification breakdown.',
            inputs: 'Headers: Authorization', curl: buildCurl('GET', '/api/admin/routesdb/summary'),
            expected: '200', actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const params = { limit: 5 };
        const r = await request('GET', '/api/admin/routesdb/top-cited', { params });
        addResult({
            name: 'RoutesDB Top Cited', group: 'Routes & DB', method: 'GET', path: '/api/admin/routesdb/top-cited',
            purpose: 'Top judgments by citation_frequency.',
            inputs: 'Query: limit', curl: buildCurl('GET', '/api/admin/routesdb/top-cited', {}, null, params),
            expected: '200 + array', actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const r = await request('GET', '/api/admin/routesdb/courts-breakdown');
        addResult({
            name: 'RoutesDB Courts Breakdown', group: 'Routes & DB', method: 'GET', path: '/api/admin/routesdb/courts-breakdown',
            purpose: 'Court distribution grouped by court_tier and court_code.',
            inputs: 'Headers: Authorization', curl: buildCurl('GET', '/api/admin/routesdb/courts-breakdown'),
            expected: '200', actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // E) Business Metrics
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── E) Business Metrics ──');
    {
        const r = await request('GET', '/api/admin/business/summary');
        addResult({
            name: 'Business Summary', group: 'Business Metrics', method: 'GET', path: '/api/admin/business/summary',
            purpose: 'Total reports count and average citations per report.',
            inputs: 'Headers: Authorization', curl: buildCurl('GET', '/api/admin/business/summary'),
            expected: '200', actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const params = { days: 7 };
        const r = await request('GET', '/api/admin/business/reports-per-day', { params });
        addResult({
            name: 'Business Reports/Day', group: 'Business Metrics', method: 'GET', path: '/api/admin/business/reports-per-day',
            purpose: 'Reports count per day for the last N days.',
            inputs: 'Query: days', curl: buildCurl('GET', '/api/admin/business/reports-per-day', {}, null, params),
            expected: '200 + array', actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const params = { limit: 5 };
        const r = await request('GET', '/api/admin/business/top-users', { params });
        const pass = r.status === 200 && r.data?.success === true;
        let note = '';
        if (pass && Array.isArray(r.data?.data)) {
            const hasEmail = r.data.data.some(u => u.email);
            if (!hasEmail) note = 'Note: email/username not enriched (Auth DB join may have no matching users).';
        }
        addResult({
            name: 'Business Top Users', group: 'Business Metrics', method: 'GET', path: '/api/admin/business/top-users',
            purpose: 'Top users by report count, enriched with email/username from Auth DB.',
            inputs: 'Query: limit', curl: buildCurl('GET', '/api/admin/business/top-users', {}, null, params),
            expected: '200 + array', actual: r.status, pass,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error || note || null,
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // F) User Management
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── F) User Management ──');
    let testUserId = null;
    {
        const params = { page: 1, pageSize: 5 };
        const r = await request('GET', '/api/admin/users', { params });
        const pass = r.status === 200 && r.data?.success === true && Array.isArray(r.data?.data?.users);
        addResult({
            name: 'Users List', group: 'User Management', method: 'GET', path: '/api/admin/users',
            purpose: 'List users with pagination, filterable by role, approval_status, account_type, search.',
            inputs: 'Query: page, pageSize, role, approval_status, account_type, search',
            curl: buildCurl('GET', '/api/admin/users', {}, null, params),
            expected: '200 + data.users array', actual: r.status, pass,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
        if (pass && r.data.data.users.length > 0) {
            testUserId = r.data.data.users[0].id;
        }
    }
    {
        const r = await request('GET', '/api/admin/users/pending');
        addResult({
            name: 'Users Pending', group: 'User Management', method: 'GET', path: '/api/admin/users/pending',
            purpose: 'List users with approval_status=PENDING.',
            inputs: 'Headers: Authorization', curl: buildCurl('GET', '/api/admin/users/pending'),
            expected: '200', actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
        // Prefer pending user for mutation tests
        if (r.data?.success && r.data.data?.users?.length > 0) {
            testUserId = r.data.data.users[0].id;
        }
    }
    {
        const r = await request('GET', '/api/admin/users/stats');
        addResult({
            name: 'Users Stats', group: 'User Management', method: 'GET', path: '/api/admin/users/stats',
            purpose: 'User statistics: total, active, blocked, pending, by account type.',
            inputs: 'Headers: Authorization', curl: buildCurl('GET', '/api/admin/users/stats'),
            expected: '200', actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }

    if (testUserId) {
        // Approve
        {
            const r = await request('POST', `/api/admin/users/${testUserId}/approve`);
            addResult({
                name: 'User Approve', group: 'User Management', method: 'POST', path: `/api/admin/users/${testUserId}/approve`,
                purpose: 'Approve a user: sets approval_status=APPROVED, is_active=true.',
                inputs: 'Params: id', curl: buildCurl('POST', `/api/admin/users/${testUserId}/approve`),
                expected: '200', actual: r.status, pass: r.status === 200,
                latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
            });
        }
        // Block
        {
            const r = await request('POST', `/api/admin/users/${testUserId}/block`);
            addResult({
                name: 'User Block', group: 'User Management', method: 'POST', path: `/api/admin/users/${testUserId}/block`,
                purpose: 'Block a user: sets is_blocked=true, is_active=false.',
                inputs: 'Params: id', curl: buildCurl('POST', `/api/admin/users/${testUserId}/block`),
                expected: '200', actual: r.status, pass: r.status === 200,
                latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
            });
        }
        // Unblock
        {
            const r = await request('POST', `/api/admin/users/${testUserId}/unblock`);
            addResult({
                name: 'User Unblock', group: 'User Management', method: 'POST', path: `/api/admin/users/${testUserId}/unblock`,
                purpose: 'Unblock a user: sets is_blocked=false, is_active=true.',
                inputs: 'Params: id', curl: buildCurl('POST', `/api/admin/users/${testUserId}/unblock`),
                expected: '200', actual: r.status, pass: r.status === 200,
                latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
            });
        }
    } else {
        console.log('  ⚠️  No user ID available — skipping approve/block/unblock tests');
    }

    // ════════════════════════════════════════════════════════════════════════
    // G) Authentication Negative Tests
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── G) Auth Negative Tests ──');
    {
        const r = await request('GET', '/api/admin/overview', { headers: { Authorization: '' } });
        // Override authHeaders for this call
        const url = `${BASE_URL}/api/admin/overview`;
        const start = Date.now();
        let res;
        try {
            res = await axios.get(url, { timeout: 5000, validateStatus: () => true });
        } catch (e) {
            res = { status: 0, data: null };
        }
        const latency = Date.now() - start;
        addResult({
            name: 'No Auth Header', group: 'Auth Negative', method: 'GET', path: '/api/admin/overview',
            purpose: 'Verify that missing Authorization header returns 401.',
            inputs: 'No Authorization header',
            curl: `curl -s "${url}"`,
            expected: '401', actual: res.status, pass: res.status === 401,
            latency, sample: truncate(res.data), errorDetail: null,
        });
    }
    {
        const url = `${BASE_URL}/api/admin/overview`;
        const start = Date.now();
        let res;
        try {
            res = await axios.get(url, { headers: { Authorization: 'Bearer wrong_token_12345' }, timeout: 5000, validateStatus: () => true });
        } catch (e) {
            res = { status: 0, data: null };
        }
        const latency = Date.now() - start;
        addResult({
            name: 'Wrong Token', group: 'Auth Negative', method: 'GET', path: '/api/admin/overview',
            purpose: 'Verify that wrong Bearer token returns 403.',
            inputs: 'Authorization: Bearer wrong_token',
            curl: `curl -s -H "Authorization: Bearer wrong_token" "${url}"`,
            expected: '403', actual: res.status, pass: res.status === 403,
            latency, sample: truncate(res.data), errorDetail: null,
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // Generate report
    // ════════════════════════════════════════════════════════════════════════
    generateReport();
}

// ── Report generator ────────────────────────────────────────────────────────

function generateReport() {
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    const total = results.length;
    const avgLatency = Math.round(results.reduce((s, r) => s + r.latency, 0) / total);

    console.log('\n' + '═'.repeat(70));
    console.log(`  Results: ${passed}/${total} passed, ${failed} failed, avg latency ${avgLatency}ms`);
    console.log('═'.repeat(70) + '\n');

    const timestamp = new Date().toISOString();
    let md = '';

    // Title
    md += `# Admin Dashboard API — Test Report\n\n`;
    md += `**Generated:** ${timestamp}  \n`;
    md += `**Base URL:** \`${BASE_URL}\`  \n`;
    md += `**Admin Token:** \`[REDACTED]\`  \n\n`;
    md += `---\n\n`;

    // Summary
    md += `## Summary\n\n`;
    md += `| Metric | Value |\n`;
    md += `|--------|-------|\n`;
    md += `| Total Tests | ${total} |\n`;
    md += `| ✅ Passed | ${passed} |\n`;
    md += `| ❌ Failed | ${failed} |\n`;
    md += `| Avg Latency | ${avgLatency}ms |\n\n`;

    // Summary table
    md += `### All Tests\n\n`;
    md += `| # | Method | Endpoint | Expected | Actual | Result | Latency |\n`;
    md += `|---|--------|----------|----------|--------|--------|--------|\n`;
    results.forEach((r, i) => {
        const pf = r.pass ? '✅ PASS' : '❌ FAIL';
        md += `| ${i + 1} | ${r.method} | \`${r.path}\` | ${r.expected} | ${r.actual} | ${pf} | ${dur(r.latency)} |\n`;
    });
    md += '\n---\n\n';

    // Detailed per-endpoint sections
    const groups = [...new Set(results.map(r => r.group))];
    for (const group of groups) {
        md += `## ${group}\n\n`;
        const groupResults = results.filter(r => r.group === group);
        for (const r of groupResults) {
            const pf = r.pass ? '✅ PASS' : '❌ FAIL';
            md += `### ${r.name}\n\n`;
            md += `**Purpose:** ${r.purpose}\n\n`;
            md += `**Inputs:** ${r.inputs}\n\n`;
            md += `**Example curl:**\n\`\`\`bash\n${r.curl}\n\`\`\`\n\n`;
            md += `**Test Result:** ${pf} — Status: \`${r.actual}\` — Latency: \`${dur(r.latency)}\`\n\n`;
            if (r.sample) {
                md += `<details><summary>Response sample</summary>\n\n\`\`\`json\n${r.sample}\n\`\`\`\n</details>\n\n`;
            }
            if (r.errorDetail) {
                md += `> ⚠️ **Note:** ${r.errorDetail}\n\n`;
            }
        }
        md += `---\n\n`;
    }

    // Failed tests
    const failedResults = results.filter(r => !r.pass);
    if (failedResults.length > 0) {
        md += `## ❌ Failed Tests — Debugging Hints\n\n`;
        for (const r of failedResults) {
            md += `### ${r.name} (${r.method} ${r.path})\n\n`;
            md += `- **Expected:** ${r.expected}\n`;
            md += `- **Actual:** ${r.actual}\n`;
            if (r.errorDetail) md += `- **Error:** ${r.errorDetail}\n`;
            md += `- **Hints:**\n`;
            if (r.actual === 401) md += `  - Check ADMIN_TOKEN environment variable\n`;
            else if (r.actual === 403) md += `  - Token is invalid or does not match server ADMIN_TOKEN\n`;
            else if (r.actual === 0) md += `  - Server is unreachable — is it running?\n`;
            else if (r.actual === 500) md += `  - Internal server error — check DB connectivity and server logs\n`;
            else if (r.actual === 404) md += `  - Resource not found — verify seed data exists in DB\n`;
            else md += `  - Review server logs for request ID in response\n`;
            md += '\n';
        }
        md += `---\n\n`;
    }

    md += `*End of report.*\n`;

    const reportPath = path.join(__dirname, '..', 'api_test_report.md');
    fs.writeFileSync(reportPath, md);
    console.log(`📄 Report written to: ${reportPath}`);

    if (failed > 0) {
        console.log(`\n❌ ${failed} test(s) failed. See report for details.\n`);
        process.exit(2);
    } else {
        console.log(`\n✅ All ${total} tests passed!\n`);
    }
}

// ── Run ─────────────────────────────────────────────────────────────────────
runTests().catch(err => {
    console.error('Fatal error running tests:', err);
    process.exit(1);
});
