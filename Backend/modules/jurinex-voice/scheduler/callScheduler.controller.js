/**
 * Admin endpoints for the Outbound Call Scheduler.
 *
 *   GET    /admin/jurinex-voice/scheduler/calls
 *   POST   /admin/jurinex-voice/scheduler/calls
 *   PATCH  /admin/jurinex-voice/scheduler/calls/:id
 *   DELETE /admin/jurinex-voice/scheduler/calls/:id        (cancels — soft, status='cancelled')
 *   POST   /admin/jurinex-voice/scheduler/calls/bulk-import (multipart CSV)
 *
 * The voice-agent runtime (separate service) reads this table and
 * UPDATEs `status` / `attempts` / `twilio_call_sid` / `last_error` as
 * it dials. Admin side never touches those fields after creation.
 */

const crypto = require('crypto');
const pool = require('../db/jurinexVoiceDB');

const E164 = /^\+?[1-9]\d{6,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTRY_DEFAULT = process.env.JURINEX_VOICE_DEFAULT_COUNTRY_CODE || '+91';

const normalizePhone = (raw) => {
  const value = String(raw || '').replace(/[\s\-()]/g, '').trim();
  if (!value) return null;
  if (value.startsWith('+')) return E164.test(value) ? value : null;
  // Bare 10-digit phone → assume default country
  if (/^\d{10}$/.test(value)) return `${COUNTRY_DEFAULT}${value}`;
  // 11-digit starting with country digits → prepend + if it parses
  if (/^\d{11,15}$/.test(value)) return `+${value}`;
  return null;
};

const parseScheduledAt = (raw, timezone) => {
  if (!raw) return null;
  // ISO with offset → use directly
  const iso = String(raw).trim();
  const d = new Date(iso);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return null;
};

// ── List ──────────────────────────────────────────────────────────
const list = async (req, res) => {
  try {
    const params = [];
    const where = [];
    if (req.query.agent_id) {
      params.push(req.query.agent_id);
      where.push(`s.agent_id = $${params.length}::uuid`);
    }
    if (req.query.status) {
      params.push(req.query.status);
      where.push(`s.status = $${params.length}`);
    }
    if (req.query.batch_id) {
      params.push(req.query.batch_id);
      where.push(`s.batch_id = $${params.length}::uuid`);
    }
    if (req.query.from) {
      params.push(req.query.from);
      where.push(`s.scheduled_at >= $${params.length}::timestamptz`);
    }
    if (req.query.to) {
      params.push(req.query.to);
      where.push(`s.scheduled_at <= $${params.length}::timestamptz`);
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    params.push(limit, offset);

    const sql = `
      SELECT s.id, s.agent_id, a.name AS agent_name, a.display_name AS agent_display_name,
             s.recipient_name, s.recipient_phone, s.recipient_email,
             s.scheduled_at, s.timezone, s.status, s.attempts, s.max_attempts,
             s.last_attempt_at, s.last_error, s.twilio_call_sid, s.call_id,
             s.notes, s.metadata, s.batch_id, s.source, s.created_by,
             s.created_at, s.updated_at
        FROM voice_call_schedules s
        LEFT JOIN voice_agents a ON a.id = s.agent_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY s.scheduled_at ASC, s.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const { rows } = await pool.query(sql, params);

    const countSql = `
      SELECT count(*)::int AS n FROM voice_call_schedules s
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    `;
    const countResult = await pool.query(countSql, params.slice(0, params.length - 2));

    res.json({ success: true, calls: rows, total: countResult.rows[0]?.n || 0 });
  } catch (err) {
    console.error('[scheduler.list] failed', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Create one ────────────────────────────────────────────────────
const create = async (req, res) => {
  try {
    const body = req.body || {};
    const phone = normalizePhone(body.recipient_phone);
    if (!body.agent_id) return res.status(400).json({ success: false, error: 'agent_id is required' });
    if (!phone) return res.status(400).json({ success: false, error: 'recipient_phone is invalid (use E.164 or 10-digit local).' });
    if (body.recipient_email && !EMAIL_RE.test(body.recipient_email)) {
      return res.status(400).json({ success: false, error: 'recipient_email looks malformed.' });
    }
    const scheduledAt = parseScheduledAt(body.scheduled_at, body.timezone);
    if (!scheduledAt) {
      return res.status(400).json({ success: false, error: 'scheduled_at must be a valid ISO 8601 timestamp with timezone.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO voice_call_schedules
         (agent_id, recipient_name, recipient_phone, recipient_email,
          scheduled_at, timezone, max_attempts, notes, metadata,
          source, created_by)
       VALUES ($1::uuid, $2, $3, $4, $5::timestamptz, $6, $7, $8, $9::jsonb, $10, $11)
       RETURNING *`,
      [
        body.agent_id,
        String(body.recipient_name || '').trim() || null,
        phone,
        String(body.recipient_email || '').trim() || null,
        scheduledAt,
        String(body.timezone || 'Asia/Kolkata').trim(),
        Number(body.max_attempts) || 3,
        String(body.notes || '').trim() || null,
        JSON.stringify(body.metadata || {}),
        String(body.source || 'manual'),
        body.created_by || (req.user && (req.user.email || req.user.name)) || null,
      ]
    );
    res.status(201).json({ success: true, call: rows[0] });
  } catch (err) {
    console.error('[scheduler.create] failed', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Update ────────────────────────────────────────────────────────
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['recipient_name', 'recipient_phone', 'recipient_email', 'scheduled_at', 'timezone', 'notes', 'max_attempts', 'metadata', 'status'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        let value = req.body[key];
        if (key === 'recipient_phone') {
          const norm = normalizePhone(value);
          if (!norm) return res.status(400).json({ success: false, error: 'recipient_phone invalid' });
          value = norm;
        }
        if (key === 'metadata') value = JSON.stringify(value || {});
        params.push(value);
        sets.push(`${key} = $${params.length}${key === 'metadata' ? '::jsonb' : ''}`);
      }
    }
    if (!sets.length) return res.status(400).json({ success: false, error: 'no editable fields supplied' });
    params.push(id);
    const { rows } = await pool.query(
      `UPDATE voice_call_schedules SET ${sets.join(', ')}, updated_at = now()
        WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'not found' });
    res.json({ success: true, call: rows[0] });
  } catch (err) {
    console.error('[scheduler.update] failed', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Cancel (soft) ─────────────────────────────────────────────────
const cancel = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `UPDATE voice_call_schedules
          SET status = 'cancelled', updated_at = now()
        WHERE id = $1 AND status IN ('pending','queued')
        RETURNING *`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'not found or already in progress' });
    res.json({ success: true, call: rows[0] });
  } catch (err) {
    console.error('[scheduler.cancel] failed', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── CSV bulk import ───────────────────────────────────────────────
//
// Accepts a single multipart "file" field. CSV format (header REQUIRED):
//   recipient_phone,recipient_name,recipient_email,scheduled_at,notes
//   +917875827090,Vishal Bainade,vishal@example.com,2026-05-10T11:00:00+05:30,Demo follow-up
//   +919812345678,Asha,,,Reminder call
//
// Required: recipient_phone, scheduled_at
// Optional: recipient_name, recipient_email, notes
//
// Body fields (form-data, alongside the file):
//   agent_id      — REQUIRED, uuid of the agent that will dial
//   timezone      — optional, default Asia/Kolkata (used when CSV scheduled_at has no offset)
//   default_scheduled_at — optional ISO timestamp; rows missing scheduled_at fall back to this

const parseCsv = (text) => {
  const out = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; continue; }
      if (ch === '"') { inQuotes = false; continue; }
      cell += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(cell); cell = ''; continue; }
    if (ch === '\n') {
      row.push(cell);
      out.push(row);
      row = [];
      cell = '';
      continue;
    }
    if (ch === '\r') continue;
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out.filter((r) => r.some((c) => String(c).trim() !== ''));
};

const bulkImport = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'CSV file is required as multipart "file" field.' });
    }
    const agentId = req.body.agent_id;
    if (!agentId) {
      return res.status(400).json({ success: false, error: 'agent_id is required.' });
    }
    const timezone = String(req.body.timezone || 'Asia/Kolkata').trim();
    const defaultScheduledAt = req.body.default_scheduled_at
      ? parseScheduledAt(req.body.default_scheduled_at, timezone)
      : null;
    const text = req.file.buffer.toString('utf8').replace(/^﻿/, '');
    const rows = parseCsv(text);
    if (rows.length < 2) {
      return res.status(400).json({ success: false, error: 'CSV must have a header row and at least one data row.' });
    }
    const header = rows[0].map((h) => String(h).trim().toLowerCase().replace(/\s+/g, '_'));
    const idx = (key) => header.indexOf(key);
    if (idx('recipient_phone') === -1 && idx('phone') === -1) {
      return res.status(400).json({ success: false, error: 'CSV must contain a "recipient_phone" (or "phone") column.' });
    }
    const phoneIdx = idx('recipient_phone') !== -1 ? idx('recipient_phone') : idx('phone');
    const nameIdx = idx('recipient_name') !== -1 ? idx('recipient_name') : idx('name');
    const emailIdx = idx('recipient_email') !== -1 ? idx('recipient_email') : idx('email');
    const schedIdx = idx('scheduled_at') !== -1 ? idx('scheduled_at') : idx('scheduled_time');
    const notesIdx = idx('notes');

    const batchId = crypto.randomUUID();
    const inserted = [];
    const skipped = [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 1; i < rows.length; i += 1) {
        const r = rows[i];
        const phone = normalizePhone(r[phoneIdx]);
        const sched = schedIdx !== -1 ? parseScheduledAt(r[schedIdx], timezone) : defaultScheduledAt;
        if (!phone || !sched) {
          skipped.push({
            line: i + 1,
            reason: !phone ? 'invalid_phone' : 'invalid_scheduled_at',
            raw: r,
          });
          continue;
        }
        const email = emailIdx !== -1 ? String(r[emailIdx] || '').trim() : '';
        if (email && !EMAIL_RE.test(email)) {
          skipped.push({ line: i + 1, reason: 'invalid_email', raw: r });
          continue;
        }
        const name = nameIdx !== -1 ? String(r[nameIdx] || '').trim() : '';
        const notes = notesIdx !== -1 ? String(r[notesIdx] || '').trim() : '';

        const { rows: insertedRows } = await client.query(
          `INSERT INTO voice_call_schedules
             (agent_id, recipient_name, recipient_phone, recipient_email,
              scheduled_at, timezone, notes, source, batch_id, created_by)
           VALUES ($1::uuid, $2, $3, $4, $5::timestamptz, $6, $7, 'csv', $8::uuid, $9)
           RETURNING id, recipient_phone, recipient_name, scheduled_at`,
          [
            agentId,
            name || null,
            phone,
            email || null,
            sched,
            timezone,
            notes || null,
            batchId,
            (req.user && (req.user.email || req.user.name)) || null,
          ]
        );
        inserted.push(insertedRows[0]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      batch_id: batchId,
      inserted_count: inserted.length,
      skipped_count: skipped.length,
      inserted,
      skipped,
    });
  } catch (err) {
    console.error('[scheduler.bulkImport] failed', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { list, create, update, cancel, bulkImport };
