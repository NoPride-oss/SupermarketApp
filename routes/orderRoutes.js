const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/OrderController');

// User: list current user's orders
router.get('/', OrderController.list);

// User: show order details
router.get('/:id', OrderController.details);

// Admin: list all orders (no id needed since route prefix is /admin/orders)
router.get('/admin/all', OrderController.listAll);

module.exports = router;
