const express = require('express');
const CartController = require('../controllers/CartItemsController');
const router = express.Router();

// Cart routes for viewing and managing items
router.get('/', CartController.view);
router.post('/add', CartController.add);
router.post('/update', CartController.update);
router.post('/remove', CartController.remove);
router.post('/clear', CartController.clear);
router.post('/checkout', CartController.checkout);

module.exports = router;
