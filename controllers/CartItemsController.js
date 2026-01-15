const CartItems = require("../models/CartItem");
const Product = require("../models/Products");

function setFlash(req, type, message) {
  if (typeof req.flash === 'function') {
    req.flash(type, message);
  } else {
    req.session._flash = req.session._flash || {};
    req.session._flash[type] = message;
  }
}

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

const CartController = {
  view(req, res) {
    const userId = req.session.user && req.session.user.userId;
    if (!userId) return res.status(401).send("Unauthorized");
    // Read cart from session
    const cartItems = req.session.cart || [];
    const success = consumeFlash(req, 'success');
    const error = consumeFlash(req, 'error');
    res.render('cart', { cart: cartItems, user: req.session.user, success, error });
  },
  add(req, res) {
    const userId = req.session.user && req.session.user.userId;
    if (!userId) return res.status(401).send("Unauthorized");
    const { productId } = req.body;
    const quantity = Number(req.body.quantity) || 1;
    Product.getById(productId, (err, product) => {
      if (err || !product) {
        setFlash(req, 'error', 'Product not found');
        return res.redirect('/cart');
      }
      const available = Number(product.quantity) || 0;
      req.session.cart = req.session.cart || [];
      const existing = req.session.cart.find(i => String(i.productId) === String(productId));
      const existingQty = existing ? Number(existing.quantity) : 0;
      if (available < existingQty + quantity) {
        setFlash(req, 'error', `Not enough stock available. Only ${available - existingQty} left.`);
        return res.redirect('/cart');
      }
      if (existing) {
        existing.quantity = Number(existing.quantity) + quantity;
      } else {
        req.session.cart.push({ productId: productId, name: product.productName, price: product.price, quantity });
      }
      setFlash(req, 'success', 'Added to cart');
      res.redirect('/cart');
    });
  },
  update(req, res) {
    const userId = req.session.user && req.session.user.userId;
    if (!userId) return res.status(401).send("Unauthorized");
    const { productId } = req.body;
    const quantity = Number(req.body.quantity) || 1;
    req.session.cart = req.session.cart || [];
    const existing = req.session.cart.find(i => String(i.productId) === String(productId));
    if (existing) {
      // validate against current stock
      Product.getById(productId, (err, product) => {
        if (err || !product) {
          setFlash(req, 'error', 'Product not found');
          return res.redirect('/cart');
        }
        const available = Number(product.quantity) || 0;
        if (quantity > available) {
          setFlash(req, 'error', `Only ${available} items available`);
          return res.redirect('/cart');
        }
        existing.quantity = quantity;
        setFlash(req, 'success', 'Cart updated');
        return res.redirect('/cart');
      });
    } else {
      res.redirect('/cart');
    }
  },
  remove(req, res) {
    const userId = req.session.user && req.session.user.userId;
    if (!userId) return res.status(401).send("Unauthorized");
    const { productId } = req.body;
    req.session.cart = req.session.cart || [];
    req.session.cart = req.session.cart.filter(i => String(i.productId) !== String(productId));
    setFlash(req, 'success', 'Removed from cart');
    res.redirect('/cart');
  },
  clear(req, res) {
    const userId = req.session.user && req.session.user.userId;
    if (!userId) return res.status(401).send("Unauthorized");
    req.session.cart = [];
    setFlash(req, 'success', 'Cart cleared');
    res.redirect('/cart');
  },
  checkout(req, res) {
    const userId = req.session.user && req.session.user.userId;
    if (!userId) return res.status(401).send('Unauthorized');
    const cart = req.session.cart || [];
    if (!cart.length) {
      setFlash(req, 'error', 'Your cart is empty');
      return res.redirect('/cart');
    }
    // Build items for order model
    const items = cart.map(i => ({ productId: i.productId, quantity: Number(i.quantity), price: Number(i.price) }));
    const total = items.reduce((s, it) => s + (it.price * it.quantity), 0);

    const Orders = require('../models/Orders');
    Orders.createOrder(userId, items, total, (err, result) => {
      if (err) {
        console.error('Checkout error:', err);
        setFlash(req, 'error', err.message || 'Could not complete checkout');
        return res.redirect('/cart');
      }
      req.session.cart = [];
      setFlash(req, 'success', 'Checkout completed successfully');
      return res.redirect('/orders');
    });
  },
};

module.exports = CartController;
