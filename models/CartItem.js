const db = require('../db');

const CartItems = {
    getByUserId(userId, callback) {
        // Join products so views can show names/prices without extra queries
        const sql = `
            SELECT ci.userId, ci.productId, ci.quantity,
                   p.productName AS name, p.price
            FROM cart_items ci
            JOIN products p ON p.id = ci.productId
            WHERE ci.userId = ?`;
        db.query(sql, [userId], callback);
    },
    add(userId, productId, quantity = 1, callback) {
        // Use INSERT ... ON DUPLICATE KEY UPDATE to add or update quantity
        db.query(
            `INSERT INTO cart_items (userId, productId, quantity)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
            [userId, productId, quantity],
            callback
        );
    },
    update(userId, productId, quantity, callback) {
        db.query('UPDATE cart_items SET quantity = ? WHERE userId = ? AND productId = ?', [quantity, userId, productId], callback);
    },
    remove(userId, productId, callback) {
        db.query('DELETE FROM cart_items WHERE userId = ? AND productId = ?', [userId, productId], callback);
    },
    clear(userId, callback) {
        db.query('DELETE FROM cart_items WHERE userId = ?', [userId], callback);
    },
    // If you really want bulk, use productIds:
    removeBulk(userId, productIds, callback) {
        if (!productIds || !productIds.length) return callback(null);
        const placeholders = productIds.map(() => '?').join(',');
        const sql = `DELETE FROM cart_items WHERE userId = ? AND productId IN (${placeholders})`;
        db.query(sql, [userId, ...productIds], callback);
    }
};

module.exports = CartItems;
