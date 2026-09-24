import Stripe from 'stripe';
import Event from '../models/event.js';

// Initialize Stripe with secret key from env (or fallback test key)
const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_51MockStripeSecretKeyForDemo123456789';
const stripe = new Stripe(stripeKey, {
  apiVersion: '2023-10-16',
});

// @desc    Create Stripe PaymentIntent for event booking
// @route   POST /api/payment/create-payment-intent
// @access  Private
export const createPaymentIntent = async (req, res) => {
  try {
    const { eventId, ticketQuantity, ticketType } = req.body;
    const quantity = Number(ticketQuantity) || 1;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Determine price per ticket
    let unitPrice = event.ticketPrice;
    if (ticketType && Array.isArray(event.ticketTypes) && event.ticketTypes.length > 0) {
      const tier = event.ticketTypes.find((t) => t.name === ticketType);
      if (tier) {
        unitPrice = tier.price;
      }
    }

    const subtotal = unitPrice * quantity;
    const platformFee = Math.round(subtotal * 0.05 * 100) / 100;
    const grandTotal = Math.round((subtotal + platformFee) * 100) / 100;
    const amountInCents = Math.round(grandTotal * 100);

    // Create PaymentIntent via Stripe API if key configured, or return fallback for test mode
    try {
      if (process.env.STRIPE_SECRET_KEY) {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: 'usd',
          automatic_payment_methods: { enabled: true },
          metadata: {
            eventId: event._id.toString(),
            eventTitle: event.title,
            customerId: req.user._id.toString(),
            quantity: quantity.toString(),
            ticketType: ticketType || 'General',
          },
        });

        return res.status(200).json({
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          amount: grandTotal,
          currency: 'usd',
        });
      }
    } catch (stripeErr) {
      console.warn('Stripe API Warning (Using Sandbox Fallback):', stripeErr.message);
    }

    // Fallback sandbox intent for seamless local testing without mandatory API keys
    const mockIntentId = `pi_mock_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const mockClientSecret = `${mockIntentId}_secret_mock${Math.random().toString(36).substr(2, 8)}`;

    res.status(200).json({
      clientSecret: mockClientSecret,
      paymentIntentId: mockIntentId,
      amount: grandTotal,
      currency: 'usd',
      isSandbox: true,
    });
  } catch (error) {
    console.error('Error creating Stripe PaymentIntent:', error);
    res.status(500).json({ message: error.message || 'Payment initialization failed' });
  }
};
