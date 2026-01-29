-- Add paypal_capture_id column to orders table for refund functionality
ALTER TABLE orders ADD COLUMN paypal_capture_id VARCHAR(255) NULL DEFAULT NULL;
ALTER TABLE orders ADD COLUMN refund_id VARCHAR(255) NULL DEFAULT NULL;
ALTER TABLE orders ADD COLUMN refund_status VARCHAR(50) NULL DEFAULT NULL;
