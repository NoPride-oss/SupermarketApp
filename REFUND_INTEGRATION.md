# PayPal Refund Integration - Implementation Summary

## ✅ What's Been Implemented

### 1. **Database Schema Updates**
- Added `paypal_capture_id` column to store PayPal transaction IDs
- Added `refund_id` column to track refund transactions
- Added `refund_status` column to show refund status
- Migration file: `sql/add_paypal_capture_id.sql`

**To apply the migration:**
```sql
ALTER TABLE orders ADD COLUMN paypal_capture_id VARCHAR(255) NULL DEFAULT NULL;
ALTER TABLE orders ADD COLUMN refund_id VARCHAR(255) NULL DEFAULT NULL;
ALTER TABLE orders ADD COLUMN refund_status VARCHAR(50) NULL DEFAULT NULL;
```

### 2. **Backend Updates**

#### Orders Model (`models/Orders.js`)
- Added `getById()` method to fetch single order details
- Updated `createOrder()` to accept and store `paypalCaptureId`

#### PayPal Service (`services/paypal.js`)
- Added `refundCapture(captureId, amount)` function
- Supports both full and partial refunds
- Uses PayPal REST API v2

#### App Routes (`app.js`)
- **POST `/api/paypal/capture-order`** - Now stores PayPal capture ID when creating orders
- **POST `/api/paypal/refund`** (Admin only) - Processes refunds with authentication
- **GET `/api/orders/:id`** - Retrieves order details with authorization checks

### 3. **Frontend Updates**

#### Order Details View (`views/order_details.ejs`)
- Displays PayPal payment information
- Shows stored transaction IDs
- **Refund section** (Admin only):
  - Input field for partial refund amounts
  - "Process Refund" button with confirmation
  - Real-time refund status updates
- Displays refund status if already refunded

#### Admin Orders View (`views/admin_orders.ejs`)
- Unchanged but admins can now view detailed orders with refund capability

### 4. **Security**
- Refund endpoint requires `isAdmin` middleware
- Only admins can process refunds
- Order access is validated (users see own orders, admins see all)

## 🚀 How to Use

### For Customers
1. Make a PayPal payment during checkout
2. Order is created and PayPal transaction ID is stored
3. View order details at any time

### For Admins
1. Navigate to Order Details page
2. Scroll to "Payment" section
3. Click "Process Refund" button
4. (Optional) Enter partial refund amount, or leave empty for full refund
5. Click "Process Refund" and confirm
6. Refund is processed and order is updated

## 📝 API Endpoints

### Create Order with PayPal
**POST** `/api/paypal/capture-order`
```json
Request Body:
{ "orderID": "PayPal order ID" }

Response:
{ "success": true, "orderId": 1, "paypalCaptureId": "..." }
```

### Process Refund (Admin only)
**POST** `/api/paypal/refund`
```json
Request Body:
{ 
  "captureId": "PayPal capture ID",
  "amount": 15.50,  // Optional - leave out for full refund
  "orderId": 1      // Optional - for updating order status
}

Response:
{
  "success": true,
  "refundId": "...",
  "status": "COMPLETED",
  "amount": { "currency_code": "SGD", "value": "15.50" }
}
```

### Get Order Details
**GET** `/api/orders/:id`
```json
Response:
{
  "order": {
    "id": 1,
    "paypal_capture_id": "...",
    "refund_id": "...",
    "refund_status": "COMPLETED",
    ...
  },
  "items": [...]
}
```

## 🔧 Next Steps

1. **Run the SQL migration** to add new columns to your database
2. **Test the flow**:
   - Make a test PayPal payment
   - Go to admin orders and try a full refund
   - Try a partial refund
3. **Monitor logs** for any issues

## 📋 File Changes Summary

| File | Changes |
|------|---------|
| `models/Orders.js` | Added `getById()`, updated `createOrder()` |
| `services/paypal.js` | Added `refundCapture()` function |
| `app.js` | Added refund endpoint + order API + capture ID storage |
| `views/order_details.ejs` | Added refund section for admins |
| `sql/add_paypal_capture_id.sql` | New migration file |

## ✨ Features

✅ Full and partial refunds  
✅ Admin-only access  
✅ Real-time refund status tracking  
✅ Secure transaction ID storage  
✅ User authorization checks  
✅ Audit logging in console  
