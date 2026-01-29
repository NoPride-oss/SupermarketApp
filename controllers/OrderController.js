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
    
    // Get order details first
    Orders.getById(orderId, (err, order) => {
      if (err || !order) {
        return res.status(404).send('Order not found');
      }
      
      // Check authorization: user can view own order, admins can view any
      if (order.user_id !== userId && req.session.user.role !== 'admin') {
        return res.status(403).send('Unauthorized');
      }
      
      // Get order items
      Orders.getItems(orderId, (itemErr, items) => {
        if (itemErr) return res.status(500).send('Error loading order items');
        
        // Get user info for display
        const db = require('../db');
        db.query('SELECT username, email FROM users WHERE id = ?', [order.user_id], (userErr, userResults) => {
          const orderData = {
            ...order,
            username: userResults && userResults[0] ? userResults[0].username : 'Unknown',
            email: userResults && userResults[0] ? userResults[0].email : 'N/A'
          };
          const message = consumeFlash(req, 'success');
          const error = consumeFlash(req, 'error');
          res.render('order_details', { 
            order: orderData, 
            items, 
            user: req.session.user,
            message,
            error
          });
        });
      });
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
