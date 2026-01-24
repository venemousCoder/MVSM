const axios = require('axios');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const paystack = {
  initializePayment: async (form) => {
    try {
      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        form,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Paystack Initialize Error:', error.response ? error.response.data : error.message);
      throw error;
    }
  },

  verifyPayment: async (reference) => {
    try {
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Paystack Verify Error:', error.response ? error.response.data : error.message);
      throw error;
    }
  }
};

module.exports = paystack;
