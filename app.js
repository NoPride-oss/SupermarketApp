const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
// Use existing MySQL connection module
const db = require('./db');
const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');
const orderRoutes = require('./routes/orderRoutes');
const cartRoutes = require('./routes/cartRoutes');

const app = express();

//engine
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));

// Configure multer for image uploads to public/images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'public', 'images'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    cb(null, Date.now() + ext);
  }
});
const upload = multer({ storage });

// Session with inactivity timeout (15 minutes)
app.use(session({
  secret: 'supermarket-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 15 * 60 * 1000 } // 15 min
}));

// Authentication Middleware
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect('/users/login');
}
function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') return next();
  return res.status(403).send('Forbidden: Admins only');
}

// Apply authentication middleware for orders only
app.use('/orders', isAuthenticated, orderRoutes);

// Product routes
const productRouter = express.Router();
productRouter.get('/', require('./controllers/ProductController').list);
productRouter.get('/add', isAuthenticated, isAdmin, require('./controllers/ProductController').showCreateForm);
productRouter.post('/add', isAuthenticated, isAdmin, upload.single('image'), require('./controllers/ProductController').create);
// compatibility: support /products/create as well as /products/add
productRouter.get('/create', isAuthenticated, isAdmin, require('./controllers/ProductController').showCreateForm);
productRouter.post('/create', isAuthenticated, isAdmin, upload.single('image'), require('./controllers/ProductController').create);
productRouter.get('/edit/:id', isAuthenticated, isAdmin, require('./controllers/ProductController').showEditForm);
productRouter.post('/edit/:id', isAuthenticated, isAdmin, require('./controllers/ProductController').update);
productRouter.post('/restock/:id', isAuthenticated, isAdmin, require('./controllers/ProductController').restock);
productRouter.post('/delete/:id', isAuthenticated, isAdmin, require('./controllers/ProductController').delete);
// Any user can view product list and detail, and add to cart 
productRouter.post('/buy', require('./controllers/ProductController').addToCart); // buy, with quantity selection
app.use('/products', productRouter);

// User routes. Only admin can create/edit/delete users (except login/register/logout)
const userRouter = express.Router();
userRouter.get('/login', require('./controllers/UserController').showLogin);
userRouter.post('/login', require('./controllers/UserController').login);
userRouter.get('/register', require('./controllers/UserController').showRegister);
userRouter.post('/register', require('./controllers/UserController').register);
userRouter.get('/logout', require('./controllers/UserController').logout);
userRouter.get('/', isAuthenticated, isAdmin, require('./controllers/UserController').list);
userRouter.get('/:id/orders', isAuthenticated, isAdmin, require('./controllers/UserController').viewUserOrders);
userRouter.get('/add', isAuthenticated, isAdmin, require('./controllers/UserController').showCreateForm);
userRouter.post('/add', isAuthenticated, isAdmin, require('./controllers/UserController').create);
userRouter.get('/edit/:id', isAuthenticated, isAdmin, require('./controllers/UserController').showEditForm);
userRouter.post('/edit/:id', isAuthenticated, isAdmin, require('./controllers/UserController').update);
userRouter.post('/delete/:id', isAuthenticated, isAdmin, require('./controllers/UserController').delete);
app.use('/users', userRouter);

// Cart routes - auth only required for checkout
const cartRouter = express.Router();
cartRouter.get('/', require('./controllers/CartItemsController').view);
cartRouter.post('/add', require('./controllers/CartItemsController').add);
cartRouter.post('/update', require('./controllers/CartItemsController').update);
cartRouter.post('/remove', require('./controllers/CartItemsController').remove);
cartRouter.post('/clear', require('./controllers/CartItemsController').clear);
cartRouter.post('/checkout', isAuthenticated, require('./controllers/CartItemsController').checkout);
app.use('/cart', cartRouter);

app.get('/', (req, res) => res.redirect('/products'));

// Admin dashboard
app.get('/admin', isAuthenticated, isAdmin, require('./controllers/AdminController').dashboard);

// Admin: manage all orders
const orderAdminRouter = express.Router();
orderAdminRouter.get('/', isAuthenticated, isAdmin, require('./controllers/OrderController').listAll);
orderAdminRouter.post('/:id/status', isAuthenticated, isAdmin, require('./controllers/OrderController').updateStatus);
orderAdminRouter.post('/:id/delete', isAuthenticated, isAdmin, require('./controllers/OrderController').deleteOrder);
app.use('/admin/orders', orderAdminRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
