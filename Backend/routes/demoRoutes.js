const express = require('express');
const adminAuth = require('../middleware/adminAuth.middleware');
const { makeControllers, initDemoTables } = require('../controllers/demoController');

const router = (pool) => {
  const r = express.Router();
  const auth = adminAuth(pool);
  const ctrl = makeControllers(pool);

  // Auto-create tables on first load
  initDemoTables(pool);

  // Stats
  r.get('/stats',    auth, ctrl.getStats);

  // Bookings
  r.get('/bookings',                    auth, ctrl.getAllBookings);
  r.get('/bookings/:id',                auth, ctrl.getBookingById);
  r.patch('/bookings/:id/status',       auth, ctrl.updateBookingStatus);
  r.post('/bookings/:id/send-invite',   auth, ctrl.sendInvite);
  r.delete('/bookings/:id',             auth, ctrl.deleteBooking);

  // Slots — generate must come before /:id to avoid route collision
  r.get('/slots',           auth, ctrl.getAllSlots);
  r.post('/slots/generate', auth, ctrl.generateSlots);
  r.post('/slots',          auth, ctrl.addSlot);
  r.delete('/slots/:id',    auth, ctrl.deleteSlot);

  return r;
};

module.exports = router;
