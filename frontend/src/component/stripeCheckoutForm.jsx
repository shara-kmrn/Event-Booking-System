import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import API from '../api/axios';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Lock,
  AlertCircle,
  Sparkles
} from 'lucide-react';

// Initialize Stripe publishable key (uses env var or standard test publishable key)
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51MockStripePublishableKeyForDemo'
);

// Inner Form component that uses Stripe hooks
const InnerStripeForm = ({
  event,
  selectedTier,
  ticketQuantity,
  grandTotal,
  customerName,
  customerEmail,
  customerPhone,
  clientSecret,
  isSandbox,
  paymentIntentId,
  onPaymentSuccess,
  onBack,
}) => {
  const stripe = useStripe();
  const elements = useElements();

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [cardHolderName, setCardHolderName] = useState(customerName || '');

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    setProcessing(true);
    setError('');

    try {
      let finalIntentId = paymentIntentId;

      // If real Stripe is loaded and client secret is active (not sandbox mock)
      if (stripe && elements && clientSecret && !isSandbox) {
        const cardElement = elements.getElement(CardElement);
        const { paymentIntent, error: stripeErr } = await stripe.confirmCardPayment(
          clientSecret,
          {
            payment_method: {
              card: cardElement,
              billing_details: {
                name: cardHolderName || customerName,
                email: customerEmail,
                phone: customerPhone,
              },
            },
          }
        );

        if (stripeErr) {
          setError(stripeErr.message || 'Payment confirmation failed with Stripe.');
          setProcessing(false);
          return;
        }

        if (paymentIntent && paymentIntent.status === 'succeeded') {
          finalIntentId = paymentIntent.id;
        }
      } else {
        // Sandbox mode simulated processing delay (1.2 seconds)
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }

      // Complete booking on backend
      const { data } = await API.post('/bookings', {
        eventId: event._id,
        ticketQuantity,
        ticketType: selectedTier?.name || 'General',
        customerName,
        customerEmail,
        customerPhone,
        paymentMethod: 'Stripe Payment Gateway',
        stripePaymentIntentId: finalIntentId || `pi_stripe_${Date.now()}`,
      });

      onPaymentSuccess(data.booking);
    } catch (err) {
      console.error('Stripe booking error:', err);
      setError(
        err.response?.data?.message || 'Payment completed but ticket reservation failed. Please contact support.'
      );
    } finally {
      setProcessing(false);
    }
  };

  const CARD_ELEMENT_OPTIONS = {
    style: {
      base: {
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSmoothing: 'antialiased',
        fontSize: '14px',
        '::placeholder': {
          color: '#64748b',
        },
        iconColor: '#818cf8',
      },
      invalid: {
        color: '#f87171',
        iconColor: '#f87171',
      },
    },
  };

  return (
    <form onSubmit={handleSubmitPayment} className="space-y-6">
      
      {/* Stripe Payment Header Badge */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-indigo-950/60 to-purple-950/40 border border-indigo-500/30">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/40">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              Stripe Secure Payment Gateway
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-[11px] text-slate-400">Official End-to-End Encrypted Card Processor</div>
          </div>
        </div>
        {isSandbox && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
            Stripe Sandbox Mode
          </span>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Cardholder Name */}
      <div>
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">
          Cardholder Name *
        </label>
        <input
          type="text"
          required
          value={cardHolderName}
          onChange={(e) => setCardHolderName(e.target.value)}
          placeholder="John Doe"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition shadow-inner"
        />
      </div>

      {/* Stripe Card Element Input Box */}
      <div>
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">
          Credit or Debit Card Details *
        </label>
        <div className="bg-slate-950 border border-slate-800 focus-within:border-indigo-500 rounded-xl p-4 transition shadow-inner">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
      </div>

      {/* Security Note */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Powered by Stripe 256-Bit SSL Encryption</span>
        </div>
        <div className="flex items-center gap-1 font-semibold text-slate-300">
          <Lock className="w-3 h-3 text-indigo-400" /> Secure
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={processing}
          className="w-1/3 py-3.5 rounded-xl font-semibold text-sm bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 transition cursor-pointer"
        >
          Back
        </button>

        <button
          type="submit"
          disabled={processing}
          className="w-2/3 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white transition shadow-xl shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {processing ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Processing via Stripe...</span>
            </div>
          ) : (
            <>
              Pay ${grandTotal.toFixed(2)} with Stripe
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </>
          )}
        </button>
      </div>

    </form>
  );
};

// Wrapper Component that initializes PaymentIntent clientSecret
const StripeCheckoutForm = ({
  event,
  selectedTier,
  ticketQuantity,
  grandTotal,
  customerName,
  customerEmail,
  customerPhone,
  onPaymentSuccess,
  onBack,
}) => {
  const [clientSecret, setClientSecret] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [isSandbox, setIsSandbox] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [initError, setInitError] = useState('');

  useEffect(() => {
    initPaymentIntent();
  }, [event._id, ticketQuantity, selectedTier]);

  const initPaymentIntent = async () => {
    try {
      setInitLoading(true);
      setInitError('');
      const { data } = await API.post('/payment/create-payment-intent', {
        eventId: event._id,
        ticketQuantity,
        ticketType: selectedTier?.name || 'General',
      });

      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
      setIsSandbox(!!data.isSandbox);
    } catch (err) {
      console.error('Failed to init Stripe intent', err);
      setInitError(err.response?.data?.message || 'Failed to connect to Stripe server.');
    } finally {
      setInitLoading(false);
    }
  };

  if (initLoading) {
    return (
      <div className="py-12 text-center space-y-3 text-slate-400">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold">Connecting to Stripe Payment Gateway...</p>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="p-6 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <p className="text-sm text-rose-200 font-semibold">{initError}</p>
        <button
          onClick={initPaymentIntent}
          className="px-4 py-2 bg-slate-900 border border-slate-700 text-xs font-bold rounded-xl text-white hover:bg-slate-800 transition"
        >
          Retry Stripe Connection
        </button>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <InnerStripeForm
        event={event}
        selectedTier={selectedTier}
        ticketQuantity={ticketQuantity}
        grandTotal={grandTotal}
        customerName={customerName}
        customerEmail={customerEmail}
        customerPhone={customerPhone}
        clientSecret={clientSecret}
        isSandbox={isSandbox}
        paymentIntentId={paymentIntentId}
        onPaymentSuccess={onPaymentSuccess}
        onBack={onBack}
      />
    </Elements>
  );
};

export default StripeCheckoutForm;
