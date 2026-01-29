require('dotenv').config();
const axios = require('axios');

async function testNETS() {
  console.log('Testing NETS API Connection...');
  console.log('API_KEY:', process.env.NETS_API_KEY ? '✓ Loaded' : '✗ Missing');
  console.log('PROJECT_ID:', process.env.NETS_PROJECT_ID ? '✓ Loaded' : '✗ Missing');
  console.log('API_URL:', process.env.NETS_API_URL);

  const requestBody = {
    txn_id: "sandbox_nets|m|supermarket-" + Date.now(),
    amt_in_dollars: 3.50,
    notify_mobile: 0,
  };

  try {
    console.log('\nSending request to NETS API...');
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
    
    console.log('✓ Success! Response:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('✗ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    if (error.code) {
      console.error('Code:', error.code);
    }
  }
}

testNETS();
