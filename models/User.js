const db = require('../db');

const User = {
  getAll(callback) {
    db.query('SELECT * FROM users', callback);
  },
  getById(id, callback) {
    db.query('SELECT * FROM users WHERE id=?', [id], (err, results) => {
      if (err) return callback(err);
      callback(null, results[0]);
    });
  },
  getByEmailAndPassword(email, password, callback) {
    db.query('SELECT * FROM users WHERE email=? AND password=?', [email, password], (err, results) => {
      if (err) return callback(err);
      callback(null, results[0]);
    });
  },
  add(user, callback) {
    db.query(
      'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, ?, ?, ?, ?)',
      [user.name, user.email, user.password, user.address, user.contact, user.role],
      callback
    );
  },
  update(id, user, callback) {
    db.query(
      'UPDATE users SET username=?, email=?, password=?, address=?, contact=?, role=? WHERE id=?',
      [user.name, user.email, user.password, user.address, user.contact, user.role, id],
      callback
    );
  },
  delete(id, callback) {
    db.query('DELETE FROM users WHERE id=?', [id], callback);
  }
};

module.exports = User;
