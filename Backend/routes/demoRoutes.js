const express = require('express');
const adminAuth = require('../middleware/adminAuth.middleware');
const { makeControllers } = require('../controllers/demoController');

const router = (pool) => {
  const r    = express.Router();
  const auth = adminAuth(pool);
  const ctrl = makeControllers(pool);

  // Stats
  r.get('/stats', auth, ctrl.getStats);

  // Bookings
  r.get('/bookings',                  auth, ctrl.getAllBookings);
  r.get('/bookings/:id',              auth, ctrl.getBookingById);
  r.patch('/bookings/:id/status',     auth, ctrl.updateBookingStatus);
  r.post('/bookings/:id/send-invite', auth, ctrl.sendInvite);
  r.delete('/bookings/:id',           auth, ctrl.deleteBooking);

  return r;
};

module.exports = router;
