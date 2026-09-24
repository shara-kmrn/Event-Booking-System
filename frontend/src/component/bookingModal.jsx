import { useState } from 'react';
import API from '../api/axios';
import {
  X,
  Ticket,
  User,
  Mail,
  Phone,
  CreditCard,
  Lock,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  ArrowLeft,
  Calendar,
  MapPin,
  QrCode,
  Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const defaultCategoryImages = {
  Conference: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=600&q=80',
  Concert: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80',
  Workshop: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=600&q=80',
  Tech: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=600&q=80',
  Sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=600&q=80',
  General: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&q=80',
};

const BookingModal = ({ event, user, onClose, onBookingSuccess }) => {
  const navigate = useNavigate();

  // Step state: 1 = Event & Tickets, 2 = Customer Details, 3 = Payment, 4 = Confirmation
  const [step, setStep] = useState(1);

  const [quantity, setQuantity] = useState(1);
  const [selectedTier, setSelectedTier] = useState(
    event.ticketTypes && event.ticketTypes.length > 0 ? event.ticketTypes[0].name : 'General'
  );
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(user?.contactNumber || '');

  // Card details mock state
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('123');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  // Price calculations
  let unitPrice = event.ticketPrice;
  if (event.ticketTypes && event.ticketTypes.length > 0) {
    const tierObj = event.ticketTypes.find((t) => t.name === selectedTier);
    if (tierObj) unitPrice = tierObj.price;
  }

  const maxAvailable = event.availableTickets || 1;
  const subtotal = unitPrice * quantity;
  const platformFee = Math.round(subtotal * 0.05 * 100) / 100;
  const grandTotal = Math.round((subtotal + platformFee) * 100) / 100;

  const coverImage = event.image || defaultCategoryImages[event.category] || defaultCategoryImages.General;

  const handleStep1Next = (e) => {
    e.preventDefault();
    setStep(2);
  };

  const handleStep2Next = (e) => {
    e.preventDefault();
    if (!customerName || !customerEmail) {
      setError('Please fill in your name and email address.');
      return;
    }
    setError('');
    setStep(3);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Create Payment Intent (Stripe Sandbox)
      let intentId = `pi_demo_${Date.now()}`;
      try {
        const { data: intentRes } = await API.post('/payment/create-payment-intent', {
          eventId: event._id,
          ticketQuantity: quantity,
          ticketType: selectedTier,
        });
        if (intentRes.paymentIntentId) {
          intentId = intentRes.paymentIntentId;
        }
      } catch (pErr) {
        console.warn('Payment Intent creation fallback', pErr);
      }

      // 2. Process Atomic Booking
      const { data: bookingRes } = await API.post('/bookings', {
        eventId: event._id,
        ticketQuantity: quantity,
        ticketType: selectedTier,
        customerName,
        customerEmail,
        customerPhone,
        paymentMethod: 'Stripe Credit Card',
        stripePaymentIntentId: intentId,
      });

      setSuccessData(bookingRes.booking);
      if (onBookingSuccess) onBookingSuccess(bookingRes.booking);
      setStep(4); // Move to Confirmation Step
    } catch (err) {
      setError(err.response?.data?.message || 'Payment or reservation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const stepsList = [
    { num: 1, label: 'Event Details & Tickets' },
    { num: 2, label: 'Checkout Info' },
    { num: 3, label: 'Payment' },
    { num: 4, label: 'Confirmation' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800/80 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-indigo-400">
                <Ticket className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white leading-snug line-clamp-1">{event.title}</h3>
              <p className="text-xs text-slate-400">Atomic Booking Wizard</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Bar Header */}
        <div className="px-6 py-3 bg-slate-950/50 border-b border-slate-800/60">
          <div className="flex items-center justify-between relative">
            {stepsList.map((s, idx) => {
              const isCompleted = step > s.num;
              const isActive = step === s.num;
              return (
                <div key={s.num} className="flex items-center gap-2 z-10">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isCompleted
                        ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-md shadow-emerald-500/30'
                        : isActive
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 border border-indigo-400'
                        : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : s.num}
                  </div>
                  <span
                    className={`text-xs font-semibold hidden sm:inline ${
                      isActive ? 'text-white' : isCompleted ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {s.label}
                  </span>
                  {idx < stepsList.length - 1 && (
                    <div
                      className={`h-0.5 w-6 sm:w-10 transition-colors ${
                        step > s.num ? 'bg-emerald-500' : 'bg-slate-800'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-100">
          
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-center justify-between animate-in fade-in">
              <span>{error}</span>
              <button type="button" onClick={() => setError('')}>✕</button>
            </div>
          )}

          {/* ==================== STEP 1: EVENT DETAILS & TICKET SELECTION ==================== */}
          {step === 1 && (
            <form onSubmit={handleStep1Next} className="space-y-5 animate-in fade-in duration-300">
              
              {/* Event Cover Banner & Info */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
                <img src={coverImage} alt={event.title} className="w-full h-32 object-cover opacity-70" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 px-2.5 py-0.5 rounded-full mb-1 inline-block">
                    {event.category || 'General'}
                  </span>
                  <h4 className="text-base font-bold text-white truncate">{event.title}</h4>
                  <div className="flex items-center gap-4 text-xs text-slate-300 mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      {new Date(event.date).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="w-3.5 h-3.5 text-purple-400" />
                      {event.location}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description Preview */}
              <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                {event.description || 'Secure your ticket now with real-time atomic reservation.'}
              </p>

              {/* Ticket Tier Selection */}
              {event.ticketTypes && event.ticketTypes.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block flex items-center justify-between">
                    <span>Select Ticket Tier</span>
                    <span className="text-[10px] text-slate-400 font-normal lowercase">(Early Birds expire on deadline date)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {event.ticketTypes.map((tier) => {
                      const isExpired = tier.expiryDate && new Date(tier.expiryDate) < new Date();
                      const isSelected = selectedTier === tier.name;

                      return (
                        <button
                          key={tier.name}
                          type="button"
                          disabled={isExpired}
                          onClick={() => !isExpired && setSelectedTier(tier.name)}
                          className={`p-3 rounded-xl border text-left transition ${
                            isExpired
                              ? 'bg-slate-950/40 border-slate-800 text-slate-600 opacity-60 cursor-not-allowed'
                              : isSelected
                              ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-500/10 cursor-pointer'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 cursor-pointer'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="text-xs font-bold text-white">{tier.name}</div>
                            {isExpired && (
                              <span className="text-[9px] font-extrabold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded">
                                Expired
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-emerald-400 font-semibold mt-0.5">
                            ${tier.price}
                            {tier.expiryDate && !isExpired && (
                              <span className="text-[10px] text-amber-400 font-normal ml-2">
                                (Ends {new Date(tier.expiryDate).toLocaleDateString()})
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity Counter */}
              <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Ticket Quantity</span>
                  <span className="text-[11px] text-slate-400">${unitPrice} per ticket • {maxAvailable} left</span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm disabled:opacity-40 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-lg font-extrabold text-white w-6 text-center">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(maxAvailable, quantity + 1))}
                    disabled={quantity >= maxAvailable}
                    className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm disabled:opacity-40 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Price Preview */}
              <div className="flex items-center justify-between p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-2xl text-xs">
                <span className="text-indigo-300 font-semibold">Subtotal Preview ({quantity} Tickets):</span>
                <span className="text-base font-extrabold text-emerald-400">${subtotal.toFixed(2)} USD</span>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-sm shadow-xl shadow-indigo-600/25 transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continue to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* ==================== STEP 2: CHECKOUT / CUSTOMER DETAILS ==================== */}
          {step === 2 && (
            <form onSubmit={handleStep2Next} className="space-y-5 animate-in fade-in duration-300">
              <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-4">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-400" /> Customer Information
                </label>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1 font-medium">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="John Doe"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-medium">Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        placeholder="john@example.com"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-medium">Phone Number</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="tel"
                        placeholder="+94 7X XXX XXXX"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Summary Box */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2 text-xs">
                <span className="font-bold text-white uppercase text-[10px] tracking-wider block mb-1 text-slate-400">
                  Order Summary
                </span>
                <div className="flex justify-between text-slate-300">
                  <span>Event:</span>
                  <span className="font-semibold text-white truncate max-w-[200px]">{event.title}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Selected Tier:</span>
                  <span className="font-semibold text-white">{selectedTier}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Quantity:</span>
                  <span className="font-semibold text-white">{quantity} Ticket(s)</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs shadow-xl shadow-indigo-600/25 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Proceed to Payment</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* ==================== STEP 3: PAYMENT ==================== */}
          {step === 3 && (
            <form onSubmit={handlePaymentSubmit} className="space-y-5 animate-in fade-in duration-300">
              
              {/* Financial Calculation Summary */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Tickets Subtotal ({quantity}x ${unitPrice}):</span>
                  <span className="text-white font-semibold">${subtotal.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Platform Fee (5% Service):</span>
                  <span className="text-white font-semibold">${platformFee.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-white border-t border-slate-800/80 pt-2">
                  <span>Total Amount Due:</span>
                  <span className="text-emerald-400">${grandTotal.toFixed(2)} USD</span>
                </div>
              </div>

              {/* Card Inputs */}
              <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-400" /> Stripe Card Checkout
                  </label>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
                    Sandbox Secured
                  </span>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1 font-medium">Card Number</label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-medium">Expiry Date</label>
                    <input
                      type="text"
                      required
                      placeholder="MM/YY"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-medium">CVC / CVV</label>
                    <input
                      type="text"
                      required
                      placeholder="123"
                      maxLength="4"
                      value={cardCvc}
                      onChange={(e) => setCardCvc(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Security Badge */}
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Protected by Atomic Concurrency Lock (Zero Double-Booking Guarantee)</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={loading}
                  className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white font-bold rounded-xl text-xs shadow-xl shadow-indigo-600/25 transition duration-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Locking Seat & Processing Payment...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-emerald-300" />
                      <span>Pay ${grandTotal.toFixed(2)} USD Now</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ==================== STEP 4: CONFIRMATION (QR TICKET & MY BOOKINGS) ==================== */}
          {step === 4 && successData && (
            <div className="text-center py-6 space-y-6 animate-in zoom-in-95 duration-300">
              
              {/* Animated Success Badge */}
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
                <CheckCircle2 className="w-10 h-10 animate-bounce" />
              </div>

              <div>
                <h4 className="text-2xl font-black text-white">Booking & Payment Confirmed!</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Your seat has been atomically locked. Here is your unforgeable gate check-in pass.
                </p>
              </div>

              {/* Digital QR Pass Preview Card */}
              <div className="glass-panel border border-indigo-500/30 rounded-3xl p-6 max-w-md mx-auto bg-gradient-to-b from-indigo-950/40 via-slate-950 to-slate-950 shadow-2xl relative">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-400">QR Gate Pass</span>
                  <span className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                    PAID & VERIFIED
                  </span>
                </div>

                {/* QR Code Icon Graphic */}
                <div className="w-32 h-32 bg-white rounded-2xl p-3 mx-auto mb-4 flex items-center justify-center shadow-lg">
                  <QrCode className="w-full h-full text-slate-950" />
                </div>

                <div className="space-y-2 text-xs text-left">
                  <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                    <span className="text-slate-400">Token Ref:</span>
                    <span className="font-mono font-bold text-indigo-300 truncate max-w-[180px]">
                      {successData.qrCodeString || successData._id}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                    <span className="text-slate-400">Event Title:</span>
                    <span className="font-bold text-white truncate max-w-[180px]">{event.title}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                    <span className="text-slate-400">Attendee:</span>
                    <span className="font-semibold text-white">{customerName || user?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tickets Count:</span>
                    <span className="font-bold text-emerald-400">
                      {successData.ticketQuantity} Ticket(s) ({successData.ticketType || 'General'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Navigation Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2 max-w-md mx-auto">
                <button
                  onClick={() => {
                    onClose();
                    navigate('/my-tickets');
                  }}
                  className="w-full sm:w-auto flex-1 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl text-xs hover:shadow-lg shadow-indigo-500/25 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Ticket className="w-4 h-4" /> Go to My Bookings
                </button>
                <button
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Back to Home
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default BookingModal;
