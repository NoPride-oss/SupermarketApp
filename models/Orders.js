const db = require('../db');

const Orders = {
  // items: [{ productId, quantity, price }]
  createOrder(userId, items, total, callback) {
    if (!items || !items.length) return callback(new Error('No items'));

    db.beginTransaction(err => {
      if (err) return callback(err);

      const createdAt = new Date();
      // Note: schema uses `user_id` and `created_at` column names
      db.query('INSERT INTO orders (user_id, total, created_at) VALUES (?, ?, ?)', [userId, total, createdAt], (err, result) => {
        if (err) {
          return db.rollback(() => callback(err));
        }
        const orderId = result.insertId;

        // process items sequentially to ensure stock checks
        let i = 0;
        function next() {
          if (i >= items.length) {
            return db.commit(commitErr => {
              if (commitErr) return db.rollback(() => callback(commitErr));
              return callback(null, { orderId });
            });
          }
          const it = items[i++];
          // decrement stock atomically: only if enough quantity exists
          db.query('UPDATE products SET quantity = quantity - ? WHERE id = ? AND quantity >= ?', [it.quantity, it.productId, it.quantity], (uErr, uRes) => {
            if (uErr) return db.rollback(() => callback(uErr));
            if (!uRes || uRes.affectedRows === 0) {
              return db.rollback(() => callback(new Error('Insufficient stock for product ' + it.productId)));
            }
            // insert order item (schema uses order_id, product_id)
            db.query('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)', [orderId, it.productId, it.quantity, it.price], (oiErr) => {
              if (oiErr) return db.rollback(() => callback(oiErr));
              next();
            });
          });
        }
        next();
      });
    });
  },

  getByUserId(userId, callback) {
    // schema uses user_id and created_at
    db.query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, results) => {
      if (err) return callback(err);
      callback(null, results || []);
    });
  },

  getItems(orderId, callback) {
    db.query('SELECT oi.*, p.productName FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?', [orderId], (err, results) => {
      if (err) return callback(err);
      callback(null, results || []);
    });
  }
};

module.exports = Orders;
