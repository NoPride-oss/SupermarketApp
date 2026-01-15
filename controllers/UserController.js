const User = require("../models/User");

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

const UsersController = {
  showLogin(req, res) {
    res.render("login", { user: null, error: null, formData: {} });
  },

  login(req, res) {
    const { email, password } = req.body;
    User.getByEmailAndPassword(email, password, (err, user) => {
      if (user) {
        req.session.user = {
          userId: user.id,
          role: user.role,
          email: user.email,
        };
        res.redirect("/");
      } else {
        res.render("login", {
          user: null,
          error: "Invalid credentials",
          formData: { email }
        });
      }
    });
  },

  showRegister(req, res) {
    res.render("register", { user: null, error: null, success: null, formData: {} });
  },

  // CORRECTED register controller:
  register(req, res) {
    const { email, password, name, address, contact } = req.body; // include address and contact!
    User.add({ email, password, name, address, contact, role: 'user' }, (err) => {
      if (err) {
        console.log(err);
        res.render("register", {
          user: null,
          error: "Could not register",
          success: null,
          formData: { email, name, address, contact }
        });
        return;
      }
      // Redirect to login page after successful registration
      res.redirect("/users/login");
    });
  },

  logout(req, res) {
    req.session.destroy(() => res.redirect("/users/login"));
  },

  list(req, res) {
    if (!req.session.user || req.session.user.role !== "admin") return res.status(403).send("Forbidden");
    User.getAll((err, users) => {
      if (err) return res.status(500).send("Error retrieving users");
      
      // Get order counts for each user
      const db = require('../db');
      db.query('SELECT user_id, COUNT(*) as order_count FROM orders GROUP BY user_id', (countErr, counts) => {
        const countMap = {};
        if (!countErr && counts) {
          counts.forEach(c => {
            countMap[c.user_id] = c.order_count;
          });
        }
        // Add order count to each user
        users.forEach(u => {
          u.orderCount = countMap[u.id] || 0;
        });
        
        const success = consumeFlash(req, 'success');
        const error = consumeFlash(req, 'error');
        res.render("list", { users, user: req.session.user, success, error });
      });
    });
  },

  showCreateForm(req, res) {
    if (!req.session.user || req.session.user.role !== "admin") return res.status(403).send("Forbidden");
    const error = consumeFlash(req, 'error');
    const success = consumeFlash(req, 'success');
    res.render('createUser', { user: req.session.user, error, success, formData: {} });
  },

  create(req, res) {
    if (!req.session.user || req.session.user.role !== "admin") return res.status(403).send("Forbidden");
    const { email, password, name, address, contact, role } = req.body;
    const roleToSave = role || 'user';
    User.add({ email, password, name, address, contact, role: roleToSave }, (err) => {
      if (err) {
        console.error('Error creating user', err);
        setFlash(req, 'error', 'Could not create user');
        return res.redirect('/users');
      }
      setFlash(req, 'success', 'User created');
      res.redirect('/users');
    });
  },

  showEditForm(req, res) {
    if (!req.session.user || req.session.user.role !== "admin") return res.status(403).send("Forbidden");
    User.getById(req.params.id, (err, user) => {
      if (err || !user) return res.status(404).send("User not found");
      const error = consumeFlash(req, 'error');
      res.render("edit", { user, admin: req.session.user, error });
    });
  },

  update(req, res) {
    if (!req.session.user || req.session.user.role !== "admin") return res.status(403).send("Forbidden");
    const userId = req.params.id;
    const { name, email, password, address, contact, role } = req.body;
    User.getById(userId, (err, existing) => {
      if (err || !existing) return res.status(404).send("User not found");
      const passwordToSave = password && password.trim() ? password : existing.password;
      User.update(userId, { name, email, password: passwordToSave, address, contact, role }, (updateErr) => {
        if (updateErr) {
          setFlash(req, 'error', 'Could not update user');
          return res.redirect(`/users/edit/${userId}`);
        }
        setFlash(req, 'success', 'User updated');
        res.redirect("/users");
      });
    });
  },

  delete(req, res) {
    if (!req.session.user || req.session.user.role !== "admin") return res.status(403).send("Forbidden");
    const userId = req.params.id;
    
    // First check if user is an admin
    User.getById(userId, (err, targetUser) => {
      if (err || !targetUser) {
        setFlash(req, 'error', 'User not found');
        return res.redirect("/users");
      }
      
      // Prevent deleting admin users
      if (targetUser.role === 'admin') {
        setFlash(req, 'error', 'Cannot delete admin users');
        return res.redirect("/users");
      }
      
      // Check if user has any orders
      const db = require('../db');
      db.query('SELECT COUNT(*) as orderCount FROM orders WHERE user_id = ?', [userId], (countErr, results) => {
        if (countErr) {
          setFlash(req, 'error', 'Error checking user orders');
          return res.redirect("/users");
        }
        
        const orderCount = results[0].orderCount;
        if (orderCount > 0) {
          setFlash(req, 'error', 'Cannot delete user with existing orders');
          return res.redirect("/users");
        }
        
        // Safe to delete
        User.delete(userId, (deleteErr) => {
          if (deleteErr) {
            setFlash(req, 'error', 'Could not delete user');
          } else {
            setFlash(req, 'success', 'User deleted successfully');
          }
          res.redirect("/users");
        });
      });
    });
  },

  // Admin: view all orders for a specific user
  viewUserOrders(req, res) {
    if (!req.session.user || req.session.user.role !== "admin") return res.status(403).send("Forbidden");
    const userId = req.params.id;
    const db = require('../db');
    
    // Get user details
    User.getById(userId, (err, targetUser) => {
      if (err || !targetUser) return res.status(404).send("User not found");
      
      // Build query with filters
      let sql = 'SELECT * FROM orders WHERE user_id = ?';
      const params = [userId];
      
      // Filter by status
      if (req.query.status && req.query.status.trim()) {
        sql += ' AND status = ?';
        params.push(req.query.status);
      }
      
      // Filter by date range
      if (req.query.fromDate && req.query.fromDate.trim()) {
        sql += ' AND DATE(created_at) >= ?';
        params.push(req.query.fromDate);
      }
      if (req.query.toDate && req.query.toDate.trim()) {
        sql += ' AND DATE(created_at) <= ?';
        params.push(req.query.toDate);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      // Get filtered orders for this user
      db.query(sql, params, (oErr, orders) => {
        if (oErr) {
          console.error('Error loading user orders', oErr);
          orders = [];
        }
        const success = consumeFlash(req, 'success');
        const error = consumeFlash(req, 'error');
        res.render('user_orders', { targetUser, orders, user: req.session.user, success, error, request: req });
      });
    });
  }
};

module.exports = UsersController;
