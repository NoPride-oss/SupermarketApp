const User = require('../models/User');
const db = require('../db');

// Helper: safe flash fallback (same pattern used in other controllers)
function consumeFlash(req, type) {
  const fromFlash = typeof req.flash === 'function' ? req.flash(type)?.[0] : null;
  if (fromFlash) return fromFlash;
  const fromSession = req.session._flash?.[type] || null;
  if (req.session._flash) {
    delete req.session._flash[type];
    if (Object.keys(req.session._flash).length === 0) delete req.session._flash;
  }
  return fromSession;
}

const AdminController = {
  dashboard(req, res) {
    // load users and orders (orders may not exist in DB, so handle gracefully)
    User.getAll((uErr, users) => {
      if (uErr) {
        console.error('Error loading users for admin dashboard', uErr);
        users = [];
      }

      // Attempt to load orders if the table exists; join to users for name
      db.query(
        `SELECT o.id, o.total, o.createdat, o.status, u.username as userName
         FROM orders o
         LEFT JOIN users u ON o.userid = u.id
         ORDER BY o.createdat DESC LIMIT 100`,
        (oErr, orders) => {
          if (oErr) {
            // If orders table doesn't exist or query fails, warn and continue with empty list
            console.warn('Could not load orders for admin dashboard:', oErr.message || oErr);
            orders = [];
          }
          const success = consumeFlash(req, 'success');
          const error = consumeFlash(req, 'error');
          res.render('adminDashboard', { users: users || [], orders: orders || [], user: req.session.user, success, error });
        }
      );
    });
  }
};

module.exports = AdminController;
