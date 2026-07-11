const nodemailer = require('nodemailer');

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
function fmtIST(date, opts = {}) {
  return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', ...opts });
}

// ── Email template ─────────────────────────────────────────────────────────────
function buildInviteHtml(booking) {
  const scheduled = booking.scheduled_at;
  const dateStr   = fmtIST(scheduled, { dateStyle: 'long' });
  const timeStr   = fmtIST(scheduled, { timeStyle: 'short' }) + ' IST';
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
      <p style="color:#166534;font-size:13px;margin:0;line-height:1.6;"><strong>📝 Notes:</strong> ${booking.notes}</p>
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
        <tr>
          <td style="background:linear-gradient(135deg,#4338ca 0%,#6366f1 100%);padding:40px;text-align:center;">
            <div style="font-size:32px;font-weight:800;color:#fff;letter-spacing:-1px;">⚖️ JuriNex</div>
            <div style="color:#c7d2fe;font-size:12px;margin-top:8px;letter-spacing:1.5px;text-transform:uppercase;">Intelligent Legal Assistant</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px 0;">
            <div style="background:linear-gradient(135deg,#ede9fe,#e0e7ff);border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
              <div style="font-size:36px;margin-bottom:8px;">✅</div>
              <div style="font-size:21px;font-weight:700;color:#4338ca;margin-bottom:4px;">Demo Session Confirmed!</div>
              <div style="color:#6b7280;font-size:14px;">Your JuriNex product demo has been successfully scheduled.</div>
            </div>
            <p style="color:#374151;font-size:16px;margin:0 0 16px;">Hi <strong>${booking.name}</strong>,</p>
            <p style="color:#6b7280;font-size:15px;line-height:1.75;margin:0 0 28px;">
              Thank you for your interest in <strong style="color:#4338ca;">JuriNex</strong>! Your demo session is now confirmed.
            </p>
          </td>
        </tr>
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
                    ${booking.phone ? `<div style="color:#9ca3af;font-size:12px;margin-top:1px;">📞 ${booking.phone}</div>` : ''}
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
        ${notesRow ? `<tr><td style="padding:0 40px 8px;">${notesRow}</td></tr>` : ''}
        <tr>
          <td style="padding:0 40px 28px;text-align:center;">
            <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:14px 18px;margin-bottom:24px;text-align:left;">
              <p style="color:#92400e;font-size:13px;margin:0;line-height:1.6;">
                <strong>⏰ Important:</strong> Our team will send you the meeting link shortly before your session. To reschedule, contact us at
                <a href="mailto:${from}" style="color:#92400e;font-weight:600;">${from}</a>.
              </p>
            </div>
            <a href="mailto:${from}" style="display:inline-block;background:linear-gradient(135deg,#4338ca,#6366f1);color:#fff;font-size:15px;font-weight:600;padding:14px 42px;border-radius:8px;text-decoration:none;">
              Contact Our Team
            </a>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
            <p style="color:#374151;font-size:13px;font-weight:600;margin:0 0 4px;">JuriNex — Nexintel Technologies Pvt. Ltd.</p>
            <p style="color:#9ca3af;font-size:11px;margin:0;">© ${year} Nexintel Technologies. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

function makeControllers(pool) {

  // GET /api/admin/demo/stats
  const getStats = async (_req, res) => {
    try {
      const bRes = await pool.query(
        `SELECT status, COUNT(*)::int AS count FROM demo_bookings GROUP BY status`
      );
      const bookings = { total: 0, lead: 0, pending: 0, confirmed: 0, cancelled: 0, completed: 0 };
      bRes.rows.forEach(r => { bookings[r.status] = r.count; bookings.total += r.count; });
      return res.json({ success: true, bookings });
    } catch (err) {
      console.error('demo getStats:', err.message);
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
        conditions.push(`status = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        conditions.push(
          `(name ILIKE $${params.length} OR email ILIKE $${params.length} OR COALESCE(company,'') ILIKE $${params.length} OR COALESCE(phone,'') ILIKE $${params.length})`
        );
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await pool.query(`SELECT COUNT(*) FROM demo_bookings ${where}`, params);

      params.push(parseInt(limit), offset);
      const { rows } = await pool.query(
        `SELECT id, name, email, phone, company, slot_id,
                scheduled_at, status, notes, created_at, updated_at
         FROM demo_bookings
         ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      return res.json({
        success:  true,
        total:    parseInt(countRes.rows[0].count),
        page:     parseInt(page),
        limit:    parseInt(limit),
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
      const { rows } = await pool.query(
        `SELECT * FROM demo_bookings WHERE id = $1`,
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
      if (!['lead', 'pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }
      const { rows } = await pool.query(
        `UPDATE demo_bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
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
      const { rows } = await pool.query(
        `SELECT * FROM demo_bookings WHERE id = $1`,
        [req.params.id]
      );
      if (!rows.length) return res.status(404).json({ success: false, error: 'Booking not found' });

      const booking = rows[0];
      const from    = process.env.EMAIL_FROM || process.env.EMAIL_USER;

      await transporter.sendMail({
        from:    `"JuriNex Team" <${from}>`,
        to:      booking.email,
        subject: `✅ Your JuriNex Demo is Confirmed — ${fmtIST(booking.scheduled_at, { dateStyle: 'long' })}`,
        html:    buildInviteHtml(booking),
      });

      if (booking.status === 'lead' || booking.status === 'pending') {
        await pool.query(
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
      const { rows } = await pool.query(`SELECT id FROM demo_bookings WHERE id = $1`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ success: false, error: 'Booking not found' });
      await pool.query(`DELETE FROM demo_bookings WHERE id = $1`, [req.params.id]);
      return res.json({ success: true, message: 'Booking deleted' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  return {
    getStats, getAllBookings, getBookingById,
    updateBookingStatus, sendInvite, deleteBooking,
  };
}

module.exports = { makeControllers };
