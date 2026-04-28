const nodemailer  = require('nodemailer');
const aiDocumentPool = require('../config/aiDocumentDB'); // same DB as chatbot / demo tables

// ── Mailer ─────────────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.EMAIL_PORT  || '465'),
  secure: process.env.EMAIL_SECURE !== 'false',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── IST helpers ────────────────────────────────────────────────────────────────
function getISTComponents(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = type => parseInt(parts.find(p => p.type === type)?.value || '0');
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}

function fmtIST(date, opts = {}) {
  return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', ...opts });
}

// Generate IST working slots: Mon–Fri, 10 AM–5 PM, starting from tomorrow
function generateWorkingSlots(numDays = 7) {
  const slots = [];
  const todayIST = getISTComponents(new Date());
  const y0 = String(todayIST.year).padStart(4, '0');
  const m0 = String(todayIST.month).padStart(2, '0');
  const d0 = String(todayIST.day).padStart(2, '0');

  // Start of tomorrow IST as a UTC instant
  let cursor = new Date(`${y0}-${m0}-${d0}T00:00:00+05:30`);
  cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);

  let workdaysAdded = 0;
  let safety = 0;

  while (workdaysAdded < numDays && safety < numDays * 3) {
    safety++;
    const ist = getISTComponents(cursor);
    const yy = String(ist.year).padStart(4, '0');
    const mm = String(ist.month).padStart(2, '0');
    const dd = String(ist.day).padStart(2, '0');
    const dayOfWeek = new Date(`${yy}-${mm}-${dd}T12:00:00+05:30`).getDay();

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      for (let hour = 10; hour <= 16; hour++) {
        const h  = String(hour).padStart(2, '0');
        const h1 = String(hour + 1).padStart(2, '0');
        slots.push({
          start: new Date(`${yy}-${mm}-${dd}T${h}:00:00+05:30`),
          end:   new Date(`${yy}-${mm}-${dd}T${h1}:00:00+05:30`),
        });
      }
      workdaysAdded++;
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return slots;
}

// ── Email template ─────────────────────────────────────────────────────────────
function buildInviteHtml(booking, slot) {
  const scheduled = slot?.start_time || booking.scheduled_at;
  const dateStr = fmtIST(scheduled, { dateStyle: 'long' });
  const timeStart = fmtIST(scheduled, { timeStyle: 'short' });
  const timeEnd   = slot?.end_time ? fmtIST(slot.end_time, { timeStyle: 'short' }) : null;
  const timeStr   = timeEnd ? `${timeStart} – ${timeEnd} IST` : `${timeStart} IST`;
  const from      = process.env.EMAIL_FROM || process.env.EMAIL_USER || '';
  const year      = new Date().getFullYear();

  const companyRow = booking.company ? `
    <tr>
      <td style="padding:14px 20px;border-bottom:1px solid #e5e7eb;">
        <span style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Company</span>
        <div style="color:#111827;font-size:15px;font-weight:600;margin-top:3px;">${booking.company}</div>
      </td>
    </tr>` : '';

  const notesRow = booking.notes ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
      <p style="color:#166534;font-size:13px;margin:0;line-height:1.6;"><strong>📝 Your Notes:</strong> ${booking.notes}</p>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Demo Booking Confirmed — JuriNex</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.10);max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4338ca 0%,#6366f1 100%);padding:40px;text-align:center;">
            <div style="font-size:32px;font-weight:800;color:#fff;letter-spacing:-1px;">⚖️ JuriNex</div>
            <div style="color:#c7d2fe;font-size:12px;margin-top:8px;letter-spacing:1.5px;text-transform:uppercase;">Intelligent Legal Assistant</div>
          </td>
        </tr>

        <!-- Hero Banner -->
        <tr>
          <td style="padding:32px 40px 0;">
            <div style="background:linear-gradient(135deg,#ede9fe,#e0e7ff);border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
              <div style="font-size:36px;margin-bottom:8px;">✅</div>
              <div style="font-size:21px;font-weight:700;color:#4338ca;margin-bottom:4px;">Demo Session Confirmed!</div>
              <div style="color:#6b7280;font-size:14px;">Your JuriNex product demo has been successfully scheduled.</div>
            </div>
            <p style="color:#374151;font-size:16px;margin:0 0 16px;">Hi <strong>${booking.name}</strong>,</p>
            <p style="color:#6b7280;font-size:15px;line-height:1.75;margin:0 0 28px;">
              Thank you for your interest in <strong style="color:#4338ca;">JuriNex</strong>! We're thrilled to connect with you and walk you through our intelligent legal platform. Your demo session is now confirmed — please find your booking details below.
            </p>
          </td>
        </tr>

        <!-- Booking Details Card -->
        <tr>
          <td style="padding:0 40px 28px;">
            <div style="border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden;">
              <div style="background:#4338ca;padding:12px 20px;">
                <span style="color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">📅 Booking Details</span>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
                    <span style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Attendee</span>
                    <div style="color:#111827;font-size:15px;font-weight:600;margin-top:3px;">${booking.name}</div>
                    <div style="color:#9ca3af;font-size:12px;margin-top:1px;">${booking.email}</div>
                  </td>
                </tr>
                ${companyRow}
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
                    <span style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">📆 Date</span>
                    <div style="color:#111827;font-size:15px;font-weight:600;margin-top:3px;">${dateStr}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <span style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">🕐 Time</span>
                    <div style="color:#4338ca;font-size:17px;font-weight:700;margin-top:3px;">${timeStr}</div>
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>

        <!-- Notes (if any) -->
        ${notesRow ? `<tr><td style="padding:0 40px 8px;">${notesRow}</td></tr>` : ''}

        <!-- What to expect -->
        <tr>
          <td style="padding:0 40px 28px;">
            <p style="color:#374151;font-size:14px;font-weight:600;margin:0 0 12px;">What to expect in your demo:</p>
            <table cellpadding="0" cellspacing="0">
              ${['Overview of JuriNex intelligent document processing', 'Live Q&amp;A with legal AI features', 'Custom use-case walkthrough tailored to your firm', 'Pricing &amp; onboarding discussion'].map(item =>
                `<tr><td style="padding:5px 0;color:#6b7280;font-size:14px;">✓ &nbsp;${item}</td></tr>`
              ).join('')}
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 40px 28px;text-align:center;">
            <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:14px 18px;margin-bottom:24px;text-align:left;">
              <p style="color:#92400e;font-size:13px;margin:0;line-height:1.6;">
                <strong>⏰ Important:</strong> Our team will send you the meeting link shortly before your session. If you need to reschedule, please contact us at least 24 hours in advance at
                <a href="mailto:${from}" style="color:#92400e;font-weight:600;">${from}</a>.
              </p>
            </div>
            <a href="mailto:${from}" style="display:inline-block;background:linear-gradient(135deg,#4338ca,#6366f1);color:#fff;font-size:15px;font-weight:600;padding:14px 42px;border-radius:8px;text-decoration:none;">
              Contact Our Team
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
            <p style="color:#374151;font-size:13px;font-weight:600;margin:0 0 4px;">JuriNex — Nexintel Technologies Pvt. Ltd.</p>
            <p style="color:#9ca3af;font-size:12px;margin:0 0 6px;">We look forward to speaking with you!</p>
            <p style="color:#9ca3af;font-size:11px;margin:0;">© ${year} Nexintel Technologies. All rights reserved. This is an automated confirmation email.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Table init (runs once on startup) ────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

async function initDemoTables() {
  try {
    await aiDocumentPool.query(`
      CREATE TABLE IF NOT EXISTS demo_slots (
        id         SERIAL PRIMARY KEY,
        start_time TIMESTAMP NOT NULL,
        end_time   TIMESTAMP NOT NULL,
        is_booked  BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT demo_slots_start_uniq UNIQUE (start_time)
      );
      CREATE TABLE IF NOT EXISTS demo_bookings (
        id           SERIAL PRIMARY KEY,
        name         VARCHAR(100) NOT NULL,
        email        VARCHAR(150) NOT NULL,
        company      VARCHAR(150),
        slot_id      INT REFERENCES demo_slots(id) ON DELETE SET NULL,
        scheduled_at TIMESTAMP NOT NULL,
        status       VARCHAR(20) DEFAULT 'pending',
        notes        TEXT,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Demo tables ready (demo_slots, demo_bookings)');
  } catch (err) {
    console.error('❌ Failed to init demo tables:', err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Controller factory (receives pool) ───────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function makeControllers() {

  // GET /api/admin/demo/stats
  const getStats = async (req, res) => {
    try {
      const [bRes, sRes] = await Promise.all([
        aiDocumentPool.query(`SELECT status, COUNT(*)::int AS count FROM demo_bookings GROUP BY status`),
        aiDocumentPool.query(`
          SELECT
            COUNT(*)::int                                       AS total,
            COUNT(*) FILTER (WHERE is_booked = FALSE)::int     AS available,
            COUNT(*) FILTER (WHERE is_booked = TRUE)::int      AS booked
          FROM demo_slots`),
      ]);
      const bookings = { total: 0, pending: 0, confirmed: 0, cancelled: 0, completed: 0 };
      bRes.rows.forEach(r => { bookings[r.status] = r.count; bookings.total += r.count; });
      return res.json({ success: true, bookings, slots: sRes.rows[0] });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  // GET /api/admin/demo/bookings
  const getAllBookings = async (req, res) => {
    try {
      const { page = 1, limit = 20, status = 'all', search = '' } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const conditions = [];
      const params = [];

      if (status !== 'all') {
        params.push(status);
        conditions.push(`b.status = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        conditions.push(`(b.name ILIKE $${params.length} OR b.email ILIKE $${params.length} OR b.company ILIKE $${params.length})`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await aiDocumentPool.query(`SELECT COUNT(*) FROM demo_bookings b ${where}`, params);
      params.push(parseInt(limit), offset);

      const { rows } = await aiDocumentPool.query(
        `SELECT b.id, b.name, b.email, b.company, b.slot_id,
                b.scheduled_at, b.status, b.notes, b.created_at, b.updated_at,
                s.start_time, s.end_time
         FROM demo_bookings b
         LEFT JOIN demo_slots s ON s.id = b.slot_id
         ${where}
         ORDER BY b.scheduled_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      return res.json({
        success: true,
        total:   parseInt(countRes.rows[0].count),
        page:    parseInt(page),
        limit:   parseInt(limit),
        bookings: rows,
      });
    } catch (err) {
      console.error('demo getAllBookings:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  // GET /api/admin/demo/bookings/:id
  const getBookingById = async (req, res) => {
    try {
      const { rows } = await aiDocumentPool.query(
        `SELECT b.*, s.start_time, s.end_time
         FROM demo_bookings b
         LEFT JOIN demo_slots s ON s.id = b.slot_id
         WHERE b.id = $1`,
        [req.params.id]
      );
      if (!rows.length) return res.status(404).json({ success: false, error: 'Booking not found' });
      return res.json({ success: true, booking: rows[0] });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  // PATCH /api/admin/demo/bookings/:id/status
  const updateBookingStatus = async (req, res) => {
    try {
      const { status } = req.body;
      if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }
      const { rows } = await aiDocumentPool.query(
        `UPDATE demo_bookings SET status = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [status, req.params.id]
      );
      if (!rows.length) return res.status(404).json({ success: false, error: 'Booking not found' });
      return res.json({ success: true, booking: rows[0] });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  // POST /api/admin/demo/bookings/:id/send-invite
  const sendInvite = async (req, res) => {
    try {
      const { rows } = await aiDocumentPool.query(
        `SELECT b.*, s.start_time, s.end_time
         FROM demo_bookings b
         LEFT JOIN demo_slots s ON s.id = b.slot_id
         WHERE b.id = $1`,
        [req.params.id]
      );
      if (!rows.length) return res.status(404).json({ success: false, error: 'Booking not found' });

      const booking = rows[0];
      const from    = process.env.EMAIL_FROM || process.env.EMAIL_USER;
      const html    = buildInviteHtml(booking, booking.start_time ? booking : null);

      await transporter.sendMail({
        from:    `"JuriNex Team" <${from}>`,
        to:      booking.email,
        subject: `✅ Your JuriNex Demo is Confirmed — ${fmtIST(booking.scheduled_at, { dateStyle: 'long' })}`,
        html,
      });

      if (booking.status === 'pending') {
        await aiDocumentPool.query(
          `UPDATE demo_bookings SET status = 'confirmed', updated_at = NOW() WHERE id = $1`,
          [booking.id]
        );
      }

      return res.json({ success: true, message: `Invite sent to ${booking.email}` });
    } catch (err) {
      console.error('demo sendInvite:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  // DELETE /api/admin/demo/bookings/:id
  const deleteBooking = async (req, res) => {
    try {
      const { rows } = await aiDocumentPool.query(`SELECT slot_id FROM demo_bookings WHERE id = $1`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ success: false, error: 'Booking not found' });
      const slotId = rows[0].slot_id;
      await aiDocumentPool.query(`DELETE FROM demo_bookings WHERE id = $1`, [req.params.id]);
      if (slotId) {
        await aiDocumentPool.query(`UPDATE demo_slots SET is_booked = FALSE WHERE id = $1`, [slotId]);
      }
      return res.json({ success: true, message: 'Booking deleted' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  // GET /api/admin/demo/slots
  const getAllSlots = async (req, res) => {
    try {
      const { filter = 'all', page = 1, limit = 100 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const conditions = [];
      const params = [];

      if (filter === 'available') conditions.push('s.is_booked = FALSE');
      else if (filter === 'booked') conditions.push('s.is_booked = TRUE');
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await aiDocumentPool.query(`SELECT COUNT(*) FROM demo_slots s ${where}`, params);
      params.push(parseInt(limit), offset);

      const { rows } = await aiDocumentPool.query(
        `SELECT s.id, s.start_time, s.end_time, s.is_booked, s.created_at,
                b.id AS booking_id, b.name AS booked_by_name, b.email AS booked_by_email
         FROM demo_slots s
         LEFT JOIN demo_bookings b ON b.slot_id = s.id
         ${where}
         ORDER BY s.start_time ASC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      return res.json({ success: true, total: parseInt(countRes.rows[0].count), slots: rows });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  // POST /api/admin/demo/slots
  const addSlot = async (req, res) => {
    try {
      const { start_time, end_time } = req.body;
      if (!start_time || !end_time) {
        return res.status(400).json({ success: false, error: 'start_time and end_time are required' });
      }
      const { rows } = await aiDocumentPool.query(
        `INSERT INTO demo_slots (start_time, end_time) VALUES ($1, $2) RETURNING *`,
        [start_time, end_time]
      );
      return res.status(201).json({ success: true, slot: rows[0] });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ success: false, error: 'A slot at this time already exists' });
      }
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  // POST /api/admin/demo/slots/generate
  const generateSlots = async (req, res) => {
    try {
      const numDays = Math.min(Math.max(parseInt(req.body.days) || 7, 1), 30);
      const toCreate = generateWorkingSlots(numDays);
      if (!toCreate.length) return res.json({ success: true, created: 0 });

      // Filter out already-existing start_times
      const times = toCreate.map(s => s.start.toISOString());
      const existRes = await aiDocumentPool.query(
        `SELECT start_time::text FROM demo_slots WHERE start_time = ANY($1::timestamptz[])`,
        [times]
      );
      const existSet = new Set(existRes.rows.map(r => new Date(r.start_time).toISOString()));
      const newSlots = toCreate.filter(s => !existSet.has(s.start.toISOString()));

      if (!newSlots.length) {
        return res.json({ success: true, created: 0, skipped: toCreate.length, message: 'All slots already exist' });
      }

      const values = newSlots.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
      const params = newSlots.flatMap(s => [s.start.toISOString(), s.end.toISOString()]);

      const { rowCount } = await aiDocumentPool.query(
        `INSERT INTO demo_slots (start_time, end_time) VALUES ${values}`,
        params
      );

      return res.json({
        success: true,
        created:  rowCount,
        skipped:  toCreate.length - rowCount,
        total_attempted: toCreate.length,
      });
    } catch (err) {
      console.error('demo generateSlots:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  // DELETE /api/admin/demo/slots/:id
  const deleteSlot = async (req, res) => {
    try {
      const { rows } = await aiDocumentPool.query(`SELECT is_booked FROM demo_slots WHERE id = $1`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ success: false, error: 'Slot not found' });
      if (rows[0].is_booked) {
        return res.status(400).json({ success: false, error: 'Cannot delete a booked slot' });
      }
      await aiDocumentPool.query(`DELETE FROM demo_slots WHERE id = $1`, [req.params.id]);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  return {
    getStats, getAllBookings, getBookingById,
    updateBookingStatus, sendInvite, deleteBooking,
    getAllSlots, addSlot, generateSlots, deleteSlot,
  };
}

module.exports = { makeControllers, initDemoTables };
