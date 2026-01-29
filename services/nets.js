const axios = require('axios');
require('dotenv').config();

exports.generateQrCode = async (req, res) => {
  const { cartTotal } = req.body;
  console.log('Generating NETS QR Code for amount:', cartTotal);
  
  try {
    const requestBody = {
      txn_id: "sandbox_nets|m|supermarket-" + Date.now(),
      amt_in_dollars: cartTotal,
      notify_mobile: 0,
    };

    console.log('NETS API Key:', process.env.NETS_API_KEY ? '✓ Set' : '✗ Not set');
    console.log('NETS Project ID:', process.env.NETS_PROJECT_ID ? '✓ Set' : '✗ Not set');

    const response = await axios.post(
      `${process.env.NETS_API_URL}/api/v1/common/payments/nets-qr/request`,
      requestBody,
      {
        headers: {
          'api-key': process.env.NETS_API_KEY,
          'project-id': process.env.NETS_PROJECT_ID,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('NETS API Response:', response.status);
    
    const qrData = response.data.result.data;
    console.log('QR Data response code:', qrData.response_code);
    console.log('QR Data txn_status:', qrData.txn_status);

    if (
      qrData.response_code === '00' &&
      qrData.txn_status === 1 &&
      qrData.qr_code
    ) {
      console.log('✓ QR code generated successfully');

      // Store transaction retrieval reference for later use
      const txnRetrievalRef = qrData.txn_retrieval_ref;
      const networkStatus = qrData.network_status;

      // Render the QR code page with required data
      return res.render('netsQr', {
        total: cartTotal,
        title: 'NETS QR Payment',
        qrCodeUrl: `data:image/png;base64,${qrData.qr_code}`,
        txnRetrievalRef: txnRetrievalRef,
        networkStatus: networkStatus,
        timer: 300, // Timer in seconds (5 minutes)
        apiKey: process.env.NETS_API_KEY,
        projectId: process.env.NETS_PROJECT_ID,
      });
    } else {
      // Handle partial or failed responses
      let errorMsg = 'An error occurred while generating the QR code.';
      if (qrData.network_status !== 0) {
        errorMsg = qrData.error_message || 'Transaction failed. Please try again.';
      }
      
      console.error('✗ QR code generation failed:', errorMsg);
      
      return res.render('netsFail', {
        title: 'Payment Error',
        responseCode: qrData.response_code || 'N.A.',
        instructions: qrData.instruction || '',
        errorMsg: errorMsg,
      });
    }
  } catch (error) {
    console.error('✗ Error in generateQrCode:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return res.status(500).json({ 
      error: 'Failed to generate QR code',
      message: error.message 
    });
  }
};

exports.queryPaymentStatus = async (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const txnRetrievalRef = req.params.txnRetrievalRef;
  let pollCount = 0;
  const maxPolls = 60; // 5 minutes if polling every 5s
  let frontendTimeoutStatus = 0;

  console.log(`Starting polling for transaction: ${txnRetrievalRef}`);

  const interval = setInterval(async () => {
    pollCount++;

    try {
      // Call the NETS query API
      const response = await axios.post(
        `${process.env.NETS_API_URL}/api/v1/common/payments/nets-qr/query`,
        { 
          txn_retrieval_ref: txnRetrievalRef, 
          frontend_timeout_status: frontendTimeoutStatus 
        },
        {
          headers: {
            'api-key': process.env.NETS_API_KEY,
            'project-id': process.env.NETS_PROJECT_ID,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`Poll ${pollCount}: response code ${response.status}`);
      
      // Send the full response to the frontend
      res.write(`data: ${JSON.stringify(response.data)}\n\n`);

      const resData = response.data.result.data;

      // Decide when to end polling and close the connection
      // Check if payment is successful
      if (resData.response_code === '00' && resData.txn_status === 1) {
        console.log('✓ Payment successful');
        // Payment success: send a success message
        res.write(`data: ${JSON.stringify({ success: true })}\n\n`);
        clearInterval(interval);
        res.end();
      } else if (
        frontendTimeoutStatus === 1 &&
        resData &&
        (resData.response_code !== '00' || resData.txn_status === 2)
      ) {
        console.log('✗ Payment failed');
        // Payment failure: send a fail message
        res.write(
          `data: ${JSON.stringify({ fail: true, ...resData })}\n\n`
        );
        clearInterval(interval);
        res.end();
      }
    } catch (err) {
      console.error('Error during polling:', err.message);
      clearInterval(interval);
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }

    // Timeout
    if (pollCount >= maxPolls) {
      console.log('✗ Polling timeout reached');
      clearInterval(interval);
      frontendTimeoutStatus = 1;
      res.write(
        `data: ${JSON.stringify({ fail: true, error: 'Timeout' })}\n\n`
      );
      res.end();
    }
  }, 5000); // Poll every 5 seconds

  req.on('close', () => {
    console.log('Client disconnected, stopping polling');
    clearInterval(interval);
  });
};
