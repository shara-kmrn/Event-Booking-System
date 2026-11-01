import Stripe from 'stripe';
import Event from '../models/event.js';
import Booking from '../models/booking.js';

// Initialize Stripe with secret key from env
const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_51MockStripeSecretKeyForDemo123456789';
const stripe = new Stripe(stripeKey, {
  apiVersion: '2023-10-16',
});

// @desc    Create Stripe PaymentIntent / Checkout session with full backend validations
// @route   POST /api/payment/create-payment-intent or /api/payment/create-checkout-session
// @access  Private
export const createPaymentIntent = async (req, res) => {
  try {
    const { eventId, locationId, ticketTierId, ticketQuantity, ticketType } = req.body;
    const quantity = Number(ticketQuantity) || 1;

    // 1. Find Event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    // 2. Server Time Validation - Ensure Event Has Not Started
    const currentTime = new Date();
    if (currentTime >= new Date(event.startDateTime)) {
      return res.status(400).json({
        message: 'Booking for this event is closed because the event has already started.',
      });
    }

    // 3. Determine price per ticket from selected location & tier
    let unitPrice = event.ticketPrice;
    let selectedTierName = ticketType || 'General';

    if (event.locations && event.locations.length > 0) {
      const loc = event.locations.find((l) => l._id?.toString() === locationId || l.name === locationId) || event.locations[0];
      const tier = loc.ticketTiers.find((t) => t._id?.toString() === ticketTierId || t.name === ticketType) || loc.ticketTiers[0];
      if (tier) {
        unitPrice = tier.price;
        selectedTierName = tier.name;
        if (tier.availableQuantity < quantity) {
          return res.status(400).json({
            message: `Only ${tier.availableQuantity} tickets are available for this ticket type.`,
          });
        }
      }
    } else if (Array.isArray(event.ticketTypes) && event.ticketTypes.length > 0) {
      const tier = event.ticketTypes.find((t) => t.name === ticketType);
      if (tier) {
        unitPrice = tier.price;
        selectedTierName = tier.name;
        if (tier.availableQuantity < quantity) {
          return res.status(400).json({
            message: `Only ${tier.availableQuantity} tickets are available for this ticket type.`,
          });
        }
      }
    }

    const subtotal = unitPrice * quantity;
    const platformFee = Math.round(subtotal * 0.05 * 100) / 100;
    const grandTotal = Math.round((subtotal + platformFee) * 100) / 100;
    const amountInCents = Math.round(grandTotal * 100);

    // Create PaymentIntent via Stripe API if key configured
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
            ticketType: selectedTierName,
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

    // Fallback sandbox intent for local testing
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

// @desc    Create Stripe Checkout Session
// @route   POST /api/payment/create-checkout-session
// @access  Private
export const createCheckoutSession = async (req, res) => {
  try {
    const { eventId, locationId, ticketTierId, ticketQuantity, ticketType } = req.body;
    const quantity = Number(ticketQuantity) || 1;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    // Server time validation
    if (new Date() >= new Date(event.startDateTime)) {
      return res.status(400).json({
        message: 'Booking for this event is closed because the event has already started.',
      });
    }

    let unitPrice = event.ticketPrice;
    let selectedTierName = ticketType || 'General';

    if (event.locations && event.locations.length > 0) {
      const loc = event.locations.find((l) => l._id?.toString() === locationId) || event.locations[0];
      const tier = loc.ticketTiers.find((t) => t._id?.toString() === ticketTierId || t.name === ticketType) || loc.ticketTiers[0];
      if (tier) {
        unitPrice = tier.price;
        selectedTierName = tier.name;
        if (tier.availableQuantity < quantity) {
          return res.status(400).json({
            message: `Only ${tier.availableQuantity} tickets are available for this ticket type.`,
          });
        }
      }
    }

    const subtotal = unitPrice * quantity;
    const platformFee = Math.round(subtotal * 0.05 * 100) / 100;
    const grandTotal = Math.round((subtotal + platformFee) * 100) / 100;

    if (process.env.STRIPE_SECRET_KEY) {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${event.title} - ${selectedTierName}`,
                description: `Ticket(s) for ${event.title}`,
              },
              unit_amount: Math.round(grandTotal * 100 / quantity),
            },
            quantity,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/my-tickets?success=true`,
        cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/?cancelled=true`,
        metadata: {
          eventId: event._id.toString(),
          customerId: req.user._id.toString(),
          quantity: quantity.toString(),
          ticketType: selectedTierName,
        },
      });

      return res.status(200).json({ sessionId: session.id, url: session.url });
    }

    res.status(200).json({
      sessionId: `cs_mock_${Date.now()}`,
      url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/my-tickets?sandbox=true`,
      isSandbox: true,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Stripe Webhook Listener
// @route   POST /api/payment/webhook
// @access  Public (Stripe Webhook Signature)
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = req.body;
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded' || event.type === 'checkout.session.completed') {
    const paymentObject = event.data.object;
    const intentId = paymentObject.id;

    // Update corresponding booking to paid & confirmed
    await Booking.findOneAndUpdate(
      { stripePaymentIntentId: intentId },
      { paymentStatus: 'paid', bookingStatus: 'CONFIRMED', ticketStatus: 'VALID' }
    );
  }

  res.status(200).json({ received: true });
};

