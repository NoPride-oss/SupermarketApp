require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const netsQr= require("./services/nets");
const axios = require('axios');
// Use existing MySQL connection module
const db = require('./db');
const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');
const orderRoutes = require('./routes/orderRoutes');
const cartRoutes = require('./routes/cartRoutes');
const paypal = require('./services/paypal');


const app = express();

//engine
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json()); // Add JSON parser for PayPal API calls

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
cartRouter.get('/checkout', isAuthenticated, require('./controllers/CartItemsController').showCheckout);
cartRouter.post('/checkout', isAuthenticated, require('./controllers/CartItemsController').checkout);
app.use('/cart', cartRouter);

// PayPal API endpoints
// PayPal: Create Order
app.post('/api/paypal/create-order', async (req, res) => {
  try {
    const { amount } = req.body;
    console.log('Received amount:', amount, 'Type:', typeof amount);
    
    const numAmount = Number(amount);
    console.log('Converted amount:', numAmount, 'Type:', typeof numAmount, 'isNaN:', isNaN(numAmount));
    
    if (isNaN(numAmount) || numAmount <= 0) {
      console.error('Invalid amount received:', amount, 'numAmount:', numAmount);
      return res.status(400).json({ error: 'Invalid amount', received: amount, numAmount: numAmount });
    }
    const order = await paypal.createOrder(numAmount);
    if (order && order.id) {
      res.json({ id: order.id });
    } else {
      res.status(500).json({ error: 'Failed to create PayPal order', details: order });
    }
  } catch (err) {
    console.error('PayPal create-order error:', err.message);
    res.status(500).json({ error: 'Failed to create PayPal order', message: err.message });
  }
});

// PayPal: Capture Order
app.post('/api/paypal/capture-order', async (req, res) => {
  try {
    const { orderID } = req.body;
    console.log('Session:', req.session);
    console.log('Session user:', req.session?.user);
    console.log('Session user ID:', req.session?.user?.userId);
    
    const userId = req.session?.user?.userId;
    if (!userId) {
      console.error('Missing userId in session');
      return res.status(401).json({ error: 'Unauthorized', debug: { sessionExists: !!req.session, userExists: !!req.session?.user, userIdExists: !!req.session?.user?.userId } });
    }
    if (!orderID) {
      return res.status(400).json({ error: 'Missing orderID' });
    }
    const capture = await paypal.captureOrder(orderID);
    console.log('PayPal captureOrder response:', capture);

    if (capture.status === "COMPLETED") {
      // Create order in database with PayPal transaction details
      const cart = req.session.cart || [];
      if (!cart.length) {
        return res.status(400).json({ error: 'Cart is empty' });
      }
      const items = cart.map(i => ({ productId: i.productId, quantity: Number(i.quantity), price: Number(i.price) }));
      const total = items.reduce((s, it) => s + (it.price * it.quantity), 0);
      
      const Orders = require('./models/Orders');
      Orders.createOrder(userId, items, total, (err, result) => {
        if (err) {
          console.error('Order creation error:', err);
          return res.status(500).json({ error: 'Order creation failed', message: err.message });
        }
        req.session.cart = [];
        res.json({ success: true, message: 'Payment completed and order created', orderId: result });
      });
    } else {
      res.status(400).json({ error: 'Payment not completed', status: capture.status });
    }
  } catch (err) {
    console.error('PayPal capture-order error:', err.message);
    res.status(500).json({ error: 'Failed to capture PayPal order', message: err.message });
  }
});

//NETS QR Functions
app.post('/api/nets-qr/generate', netsQr.generateQrCode);
app.get("/nets-qr/success", (req, res) => {
    res.render('netsSuccess', { message: 'Transaction Successful!' });
});
app.get("/nets-qr/fail", (req, res) => {
    res.render('netsFail', { message: 'Transaction Failed. Please try again.' });
});




//errors
app.get('/401', (req, res) => {
    res.render('401', { errors: req.flash('error') });
});

//Endpoint in your backend which is a Server-Sent Events (SSE) endpoint that allows your frontend (browser) 
//to receive real-time updates about the payment status of a NETS QR transaction.
app.get('/sse/payment-status/:txnRetrievalRef', async (req, res) => {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    const txnRetrievalRef = req.params.txnRetrievalRef;
    let pollCount = 0;
    const maxPolls = 60; // 5 minutes if polling every 5s
    let frontendTimeoutStatus = 0;

    const interval = setInterval(async () => {
        pollCount++;

        try {
            // Call the NETS query API
            const response = await axios.post(
                'https://sandbox.nets.openapipaas.com/api/v1/common/payments/nets-qr/query',
                { txn_retrieval_ref: txnRetrievalRef, frontend_timeout_status: frontendTimeoutStatus },
                {
                    headers: {
                        'api-key': process.env.API_KEY,
                        'project-id': process.env.PROJECT_ID,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log("Polling response:", response.data);
            const resData = response.data.result.data;

            // Check if payment is successful (response_code "00" means transaction was found and processed)
            if (resData.response_code === "00" && resData.txn_status === 1) {
                // Payment success
                console.log("✓ Payment successful!");
                res.write(`data: ${JSON.stringify({ success: true })}\n\n`);
                clearInterval(interval);
                res.end();
            } 
            // Check for actual payment failure (txn_status 2 = failed)
            else if (resData.response_code === "00" && resData.txn_status === 2) {
                // Payment failed
                console.log("✗ Payment failed!");
                res.write(`data: ${JSON.stringify({ fail: true })}\n\n`);
                clearInterval(interval);
                res.end();
            }
            // For any other response code, just send the data - payment is still pending
            else {
                console.log("Payment pending, response_code:", resData.response_code);
                res.write(`data: ${JSON.stringify(response.data)}\n\n`);
            }

        } catch (err) {
            console.error("Error querying NETS:", err.message);
            clearInterval(interval);
            res.write(`data: ${JSON.stringify({ fail: true, error: err.message })}\n\n`);
            res.end();
        }


        // Timeout
        if (pollCount >= maxPolls) {
            clearInterval(interval);
            frontendTimeoutStatus = 1;
            res.write(`data: ${JSON.stringify({ fail: true, error: "Timeout" })}\n\n`);
            res.end();
        }
    }, 5000);

    req.on('close', () => {
        clearInterval(interval);
    });
});

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
