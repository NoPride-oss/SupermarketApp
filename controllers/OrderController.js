const Orders = require('../models/Orders');

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

const OrderController = {
  list(req, res) {
    const userId = req.session.user && req.session.user.userId;
    if (!userId) return res.status(401).send('Unauthorized');
    Orders.getByUserId(userId, (err, orders) => {
      if (err) {
        console.error('Error loading orders', err);
        orders = [];
      }
      const success = consumeFlash(req, 'success');
      const error = consumeFlash(req, 'error');
      res.render('orders', { orders, user: req.session.user, success, error });
    });
  },

  details(req, res) {
    const userId = req.session.user && req.session.user.userId;
    if (!userId) return res.status(401).send('Unauthorized');
    const orderId = req.params.id;
    
    // Check if we came from a user's orders page (admin viewing a specific user's orders)
    const referrer = req.get('referer') || '';
    let backUrl = '/orders'; // default back to current user's orders
    
    // If referrer contains /users/ and /orders, it's from admin viewing user's orders
    if (referrer.includes('/users/') && referrer.includes('/orders')) {
      const match = referrer.match(/\/users\/(\d+)\/orders/);
      if (match && match[1]) {
        backUrl = `/users/${match[1]}/orders`;
      }
    }
    
    Orders.getItems(orderId, (err, items) => {
      if (err) return res.status(500).send('Error loading order items');
      res.render('order_details', { items, user: req.session.user, backUrl });
    });
  },

  // Admin: view all orders
  listAll(req, res) {
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.status(403).send('Forbidden');
    }
    const db = require('../db');
    db.query('SELECT o.*, u.username, u.email FROM orders o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC', (err, orders) => {
      if (err) {
        console.error('Error loading all orders', err);
        orders = [];
      }
      const success = consumeFlash(req, 'success');
      const error = consumeFlash(req, 'error');
      res.render('admin_orders', { orders, user: req.session.user, success, error });
    });
  },

  // Admin: update order status
  updateStatus(req, res) {
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.status(403).send('Forbidden');
    }
    const orderId = req.params.id;
    const status = req.body.status;
    const db = require('../db');
    db.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId], (err) => {
      if (err) {
        console.error('Error updating order status', err);
        return res.redirect('/admin/orders');
      }
      res.redirect('/admin/orders');
    });
  },

  // Admin: delete order
  deleteOrder(req, res) {
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.status(403).send('Forbidden');
    }
    const orderId = req.params.id;
    const db = require('../db');
    db.query('DELETE FROM orders WHERE id = ?', [orderId], (err) => {
      if (err) {
        console.error('Error deleting order', err);
      }
      res.redirect('/admin/orders');
    });
  }
};

module.exports = OrderController;
