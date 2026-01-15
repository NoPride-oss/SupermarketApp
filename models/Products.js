const db = require('../db');

const Product = {
  getAll(callback) {
    db.query('SELECT * FROM products', callback);
  },
  getFiltered(search, category, callback) {
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    if (search && search.trim()) {
      sql += ' AND productName LIKE ?';
      params.push('%' + search.trim() + '%');
    }
    if (category && category !== 'All') {
      sql += ' AND category = ?';
      params.push(category);
    }
    db.query(sql, params, callback);
  },
  getCategories(callback) {
    db.query('SELECT DISTINCT category FROM products', (err, results) => {
      if (err) return callback(err);
      const categories = (results || []).map(r => r.category).filter(Boolean);
      callback(null, categories);
    });
  },
  reduceStock(productId, amount, callback) {
    // Atomically decrease stock only if enough quantity exists
    const sql = 'UPDATE products SET quantity = quantity - ? WHERE id = ? AND quantity >= ?';
    db.query(sql, [amount, productId, amount], (err, result) => {
      if (err) return callback(err);
      // affectedRows === 1 means the reduction succeeded
      if (result && result.affectedRows === 1) return callback(null, true);
      return callback(null, false); // not enough stock
    });
  },
  increaseStock(productId, amount, callback) {
    const sql = 'UPDATE products SET quantity = quantity + ? WHERE id = ?';
    db.query(sql, [amount, productId], (err, result) => {
      if (err) return callback(err);
      return callback(null, result.affectedRows === 1);
    });
  },
  getById(id, callback) {
    db.query('SELECT * FROM products WHERE id = ?', [id], (err, results) => {
      if (err) return callback(err);
      callback(null, results[0]);
    });
  },
  add(product, callback) {
    db.query(
      'INSERT INTO products (productName, quantity, price, discountPercentage, offerMessage, image, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [product.name, product.quantity, product.price, product.discountPercentage, product.offerMessage, product.image, product.category],
      callback
    );
  },
  update(id, product, callback) {
    db.query(
      'UPDATE products SET productName=?, quantity=?, price=?, discountPercentage=?, offerMessage=?, image=?, category=? WHERE id=?',
      [product.name, product.quantity, product.price, product.discountPercentage, product.offerMessage, product.image, product.category, id],
      callback
    );
  },
  delete(id, callback) {
    db.query('DELETE FROM products WHERE id = ?', [id], callback);
  }
};

module.exports = Product;
