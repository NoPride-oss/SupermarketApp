const paypalService = require('../services/paypal');
const Orders = require('../models/Orders');

function jsonError(res, message) {
  return res.status(500).json({ success: false, message });
}

const PaymentController = {
  async createOrder(req, res) {
    try {
      const cart = req.session.cart || [];
      if (!cart.length) return res.status(400).json({ message: 'Cart empty' });
      const total = cart.reduce((s, i) => s + (Number(i.price) * Number(i.quantity)), 0).toFixed(2);
      const order = await paypalService.createOrder(total);
      return res.json({ id: order.id });
    } catch (err) {
      console.error('createOrder error', err);
      return jsonError(res, 'Could not create PayPal order');
    }
  },

  async captureOrder(req, res) {
    try {
      const { orderId } = req.body;
      if (!orderId) return res.status(400).json({ success: false, message: 'Missing orderId' });
      const capture = await paypalService.captureOrder(orderId);
      // Basic success check
      const status = capture.status || (capture.purchase_units && capture.purchase_units[0].payments && capture.purchase_units[0].payments.captures && capture.purchase_units[0].payments.captures[0] && capture.purchase_units[0].payments.captures[0].status);
      if (status && (status === 'COMPLETED' || status === 'COMPLETED')) {
        const userId = req.session.user && req.session.user.userId;
        const cart = req.session.cart || [];
        const items = cart.map(i => ({ productId: i.productId, quantity: Number(i.quantity), price: Number(i.price) }));
        const total = items.reduce((s, it) => s + (it.price * it.quantity), 0);
        Orders.createOrder(userId, items, total, (err, result) => {
          if (err) {
            console.error('Error saving order after capture', err);
            return res.status(500).json({ success: false, message: 'Payment captured but could not save order' });
          }
          req.session.cart = [];
          return res.json({ success: true, orderId: result.orderId });
        });
      } else {
        return res.status(400).json({ success: false, message: 'Payment not completed' });
      }
    } catch (err) {
      console.error('captureOrder error', err);
      return jsonError(res, 'Could not capture PayPal order');
    }
  }
};

module.exports = PaymentController;
