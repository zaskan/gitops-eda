import http from 'k6/http';
import { sleep } from 'k6';

  
export const options = {
  vus: 10, // Number of simulatneus users
  duration: '60m', // Test Duration
};

export default function () {
  const url = 'http://payment-payment.apps.ocp.zaskan.es/api/pay'; // Application Endpoint
  
  const payload = JSON.stringify({
    amount: 100, // Payment Quantity
    currency: 'USD' // Currency
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  http.post(url, payload, params);
  sleep(4)
}
