const Product = require("../models/Products");
const CartItems = require("../models/CartItem");

// Helper to set a flash-like message whether or not connect-flash is installed
function setFlash(req, type, message) {
  if (typeof req.flash === 'function') {
    req.flash(type, message);
  } else {
    req.session._flash = req.session._flash || {};
    req.session._flash[type] = message;
  }
}

// Helper to read and consume a flash-like message
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

const ProductsController = {
  list(req, res) {
    const search = req.query.search || '';
    const category = req.query.category || 'All';
    // get categories for dropdown, then get filtered products
    Product.getCategories((catErr, categories) => {
      if (catErr) {
        console.error('Error fetching categories', catErr);
        categories = [];
      }
      Product.getFiltered(search, category, (err, products) => {
        if (err) return res.status(500).send("Error retrieving products");
        // Build cart from session if present
        const sessionCart = req.session.cart || [];
        const cart = {};
        sessionCart.forEach(item => {
          cart[item.productId] = {
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          };
        });
        const success = consumeFlash(req, 'success');
        const error = consumeFlash(req, 'error');
        // ensure 'All' appears first in categories list
        const uniqueCats = ['All', ...(categories || [])];
        res.render('products', { products, cart, user: req.session.user, success, error, categories: uniqueCats, activeCategory: category, search });
      });
    });
  },

  getDetails(req, res) {
    const productId = req.params.id;
    Product.getById(productId, (err, product) => {
      if (err || !product) return res.status(404).send("Product not found");
      const sessionCart = req.session.cart || [];
      const cart = {};
      sessionCart.forEach(item => {
        cart[item.productId] = {
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        };
      });
      const success = consumeFlash(req, 'success');
      const error = consumeFlash(req, 'error');
      res.render("products/detail", { product, cart, user: req.session.user, success, error });
    });
  },

  showCreateForm(req, res) {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).send("Forbidden");
    }
    // fetch categories to populate dropdown
    Product.getCategories((catErr, categories) => {
      if (catErr) {
        console.error('Error fetching categories for create form', catErr);
        categories = [];
      }
      const success = consumeFlash(req, 'success');
      const error = consumeFlash(req, 'error');
      // ensure 'General' is available as a fallback option
      const cats = Array.from(new Set([ 'General', ...(categories || []) ]));
      res.render("products/create", { user: req.session.user, success, error, categories: cats });
    });
  },

  create(req, res) {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).send("Forbidden");
    }
    const { name, quantity, price, discountPercentage, offerMessage, category } = req.body;
    // if multer saved a file, req.file will be present; use its filename
    let imageFilename = null;
    if (req.file && req.file.filename) {
      imageFilename = req.file.filename;
    } else if (req.body.image) {
      // fallback: allow textual image field
      imageFilename = req.body.image;
    }

    Product.add(
      {
        name,
        quantity,
        price,
        discountPercentage: discountPercentage || 0,
        offerMessage,
        image: imageFilename,
        category: category || "General",
      },
      (err) => {
        if (err) {
          console.error('Error creating product:', err);
          setFlash(req, 'error', 'Could not create product');
          return res.redirect("/products/create");
        }
        setFlash(req, 'success', 'Product created');
        res.redirect("/products");
      }
    );
  },

  showEditForm(req, res) {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).send("Forbidden");
    }
    const productId = req.params.id;
    Product.getById(productId, (err, product) => {
      if (err || !product) return res.status(404).send("Product not found");
      const success = consumeFlash(req, 'success');
      const error = consumeFlash(req, 'error');
      res.render("products/edit", { product, user: req.session.user, success, error });
    });
  },

  update(req, res) {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).send("Forbidden");
    }
    const productId = req.params.id;
    const { name, quantity, price, discountPercentage, offerMessage, image, category } = req.body;
    Product.update(
      productId,
      {
        name,
        quantity,
        price,
        discountPercentage: discountPercentage || 0,
        offerMessage,
        image,
        category: category || "General",
      },
      (err) => {
        if (err) {
          setFlash(req, 'error', 'Could not update product');
          return res.redirect(`/products/${productId}/edit`);
        }
        setFlash(req, 'success', 'Product updated');
        res.redirect("/products");
      }
    );
  },

  delete(req, res) {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).send("Forbidden");
    }
    const productId = req.params.id;
    Product.delete(productId, (err) => {
      if (err) {
        setFlash(req, 'error', 'Could not delete product');
        return res.redirect("/products");
      }
      setFlash(req, 'success', 'Product deleted');
      res.redirect("/products");
    });
  },

  restock(req, res) {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Forbidden');
    const productId = req.params.id;
    const amount = Number(req.body.amount) || 0;
    if (amount <= 0) {
      setFlash(req, 'error', 'Invalid restock amount');
      return res.redirect(`/products/edit/${productId}`);
    }
    Product.increaseStock(productId, amount, (err, ok) => {
      if (err || !ok) {
        setFlash(req, 'error', 'Could not restock product');
        return res.redirect(`/products/edit/${productId}`);
      }
      setFlash(req, 'success', `Increased stock by ${amount}`);
      return res.redirect(`/products/edit/${productId}`);
    });
  },

  addToCart(req, res) {
    // Check if user is logged in
    if (!req.session.user) {
      setFlash(req, 'error', 'Please log in to add products to your cart');
      return res.redirect('/users/login');
    }
    
    const productId = req.body.productId || req.body.id;
    const quantity = Number(req.body.quantity) || 1;
    Product.getById(productId, (err, product) => {
      if (err || !product) {
        setFlash(req, 'error', 'Product not found');
        return res.redirect('/products');
      }
      // Check available stock
      const available = Number(product.quantity) || 0;
      req.session.cart = req.session.cart || [];
      const existing = req.session.cart.find(i => String(i.productId) === String(productId));
      const existingQty = existing ? Number(existing.quantity) : 0;
      if (available < existingQty + quantity) {
        setFlash(req, 'error', `Not enough stock available. Only ${available - existingQty} left.`);
        return res.redirect('/products');
      }
      if (existing) {
        existing.quantity = Number(existing.quantity) + quantity;
      } else {
        req.session.cart.push({ productId: productId, name: product.productName, price: product.price, quantity });
      }
      setFlash(req, 'success', 'Added to cart');
      res.redirect('/products');
    });
  },

  updateCart(req, res) {
    const productId = req.body.productId;
    const quantity = Number(req.body.quantity) || 1;
    req.session.cart = req.session.cart || [];
    const existing = req.session.cart.find(i => String(i.productId) === String(productId));
    if (existing) {
      existing.quantity = quantity;
      setFlash(req, 'success', 'Cart updated');
    }
    res.redirect('/cart');
  },

  removeFromCart(req, res) {
    const productId = req.body.productId;
    req.session.cart = req.session.cart || [];
    req.session.cart = req.session.cart.filter(i => String(i.productId) !== String(productId));
    setFlash(req, 'success', 'Removed from cart');
    res.redirect('/cart');
  },

  clearCart(req, res) {
    req.session.cart = [];
    setFlash(req, 'success', 'Cart cleared');
    res.redirect('/cart');
  },

  checkout(req, res) {
    const cartItems = req.session.cart || [];
    const error = consumeFlash(req, 'error');
    res.render('products/checkout', { cart: cartItems, user: req.session.user, error });
  },
};

module.exports = ProductsController;
