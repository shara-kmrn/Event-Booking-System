import Stripe from 'stripe';
import { requireStripeConfig } from '../config/bookingSecurity.js';

let client;
let configuredKey;
// Tests replace this gateway method; application code never returns mock payments.
export const stripeGateway = {
  client() {
    requireStripeConfig();
    if (!client || configuredKey !== process.env.STRIPE_SECRET_KEY) {
      configuredKey = process.env.STRIPE_SECRET_KEY;
      client = new Stripe(configuredKey, { maxNetworkRetries: 2, timeout: 15000 });
    }
    return client;
  },
};
export const expectsLiveMode = () => process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') === true;
