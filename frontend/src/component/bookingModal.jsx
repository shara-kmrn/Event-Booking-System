import { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { bookingAttempt, canDisplayTicket, validCheckoutUrl } from '../api/bookingState.js';
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
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Calendar,
  MapPin,
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

  // Multi-location state
  const locations = event.locations && event.locations.length > 0 ? event.locations : [
    {
      _id: event._id,
      name: event.location || 'Main Venue',
      ticketTiers: event.ticketTypes || [
        { name: 'General', price: event.ticketPrice || 0, availableQuantity: event.availableTickets || 0, totalQuantity: event.totalCapacity || 100 }
      ],
    }
  ];

  const [selectedLocationId, setSelectedLocationId] = useState(locations[0]?._id?.toString() || locations[0]?.name);

  // Active location object
  const activeLocation = locations.find(
    (loc) => loc._id?.toString() === selectedLocationId || loc.name === selectedLocationId
  ) || locations[0];

  const activeTiers = activeLocation?.ticketTiers && activeLocation.ticketTiers.length > 0
    ? activeLocation.ticketTiers
    : (event.ticketTypes || []);

  // Find first available tier
  const firstAvailTier = activeTiers.find((t) => (t.availableQuantity ?? (t.totalQuantity - (t.soldQuantity || 0))) > 0) || activeTiers[0];

  const [selectedTierId, setSelectedTierId] = useState(firstAvailTier?._id?.toString() || firstAvailTier?.name || 'General');
  const [selectedTierName, setSelectedTierName] = useState(firstAvailTier?.name || 'General');

  const activeTierObj = activeTiers.find(
    (t) => t._id?.toString() === selectedTierId || t.name === selectedTierId || t.name === selectedTierName
  ) || activeTiers[0];

  const maxAvailable = Math.max(0, activeTierObj?.availableQuantity ??
    (activeTierObj ? activeTierObj.totalQuantity - (activeTierObj.soldQuantity || 0) : event.availableTickets ?? 0));
  const isTierSoldOut = maxAvailable <= 0;

  // Check if ALL tiers in selected location are sold out
  const allLocationTiersSoldOut = activeTiers.every(
    (t) => (t.availableQuantity ?? (t.totalQuantity - (t.soldQuantity || 0))) <= 0
  );

  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(user?.contactNumber || '');

  const attemptRef = useRef(null);
  const submittingRef = useRef(false);
  const handleLocationSelect = (location) => {
    const available = location.ticketTiers.find((tier) => tier.availableQuantity > 0) || location.ticketTiers[0];
    setSelectedLocationId(location._id.toString());
    setSelectedTierId(available?._id?.toString() || available?.name || '');
    setSelectedTierName(available?.name || '');
    setQuantity(1);
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  const unitPrice = activeTierObj?.price ?? event.ticketPrice ?? 0;
  const subtotal = unitPrice * quantity;
  const platformFee = Math.round(subtotal * 0.05 * 100) / 100;
  const grandTotal = Math.round((subtotal + platformFee) * 100) / 100;

  const coverImage = event.bannerUrl || event.image || defaultCategoryImages[event.category] || defaultCategoryImages.General;

  const handleStep1Next = (e) => {
    e.preventDefault();
    if (allLocationTiersSoldOut || isTierSoldOut || quantity > maxAvailable || quantity < 1) {
      setError('Selected ticket tier is sold out. Please select another tier or location.');
      return;
    }
    setError('');
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
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError('');
    try {
      if (user?.role !== 'customer') throw new Error('Sign in with a Customer account to book tickets.');
      const payload = {
        eventId: event._id, locationId: activeLocation._id, ticketTierId: activeTierObj._id,
        ticketQuantity: quantity, customerName, customerEmail, customerPhone,
      };
      attemptRef.current = bookingAttempt(attemptRef.current, payload);
      const { data } = await API.post('/bookings', payload, {
        headers: { 'Idempotency-Key': attemptRef.current.key },
      });
      let booking = data.booking;
      if (!canDisplayTicket(booking)) {
        const response = await API.post('/payment/create-checkout-session', { bookingId: booking._id });
        booking = response.data.booking;
        if (validCheckoutUrl(response.data.url)) {
          window.location.assign(response.data.url);
          return;
        }
      }
      if (!canDisplayTicket(booking)) throw new Error('Payment is not confirmed. Check My Bookings before trying again.');
      setSuccessData(booking);
      onBookingSuccess?.(booking);
      setStep(4);
    } catch (err) {
      if (err.response?.data?.code === 'RESERVATION_EXPIRED') attemptRef.current = null;
      setError(err.response?.data?.message || err.message || 'Unable to start payment. Please try again.');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const stepsList = [
    { num: 1, label: 'Location & Tickets' },
    { num: 2, label: 'Checkout Info' },
    { num: 3, label: 'Payment' },
    { num: 4, label: 'Confirmation' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-card border border-border rounded-3xl overflow-hidden max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-border bg-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary p-0.5">
              <div className="w-full h-full bg-card rounded-[10px] flex items-center justify-center text-accent">
                <Ticket className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-heading leading-snug line-clamp-1">{event.title}</h3>
              <p className="text-xs text-body">Atomic Seat Reservation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-body hover:text-heading rounded-xl hover:bg-secondary transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Bar Header */}
        <div className="px-6 py-3 bg-card border-b border-border">
          <div className="flex items-center justify-between relative">
            {stepsList.map((s, idx) => {
              const isCompleted = step > s.num;
              const isActive = step === s.num;
              return (
                <div key={s.num} className="flex items-center gap-2 z-10">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isCompleted
                        ? 'bg-primary text-on-primary font-extrabold  '
                        : isActive
                        ? 'bg-primary text-on-primary   border border-primary-border'
                        : 'bg-secondary text-subtle border border-border'
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : s.num}
                  </div>
                  <span
                    className={`text-xs font-semibold hidden sm:inline ${
                      isActive ? 'text-heading' : isCompleted ? 'text-accent' : 'text-subtle'
                    }`}
                  >
                    {s.label}
                  </span>
                  {idx < stepsList.length - 1 && (
                    <div
                      className={`h-0.5 w-6 sm:w-10 transition-colors ${
                        step > s.num ? 'bg-primary' : 'bg-secondary'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-heading">
          
          {error && (
            <div className="p-3.5 bg-error-soft border border-error-border text-danger rounded-xl text-xs flex items-center justify-between animate-in fade-in">
              <span>{error}</span>
              <button type="button" onClick={() => setError('')}>✕</button>
            </div>
          )}

          {/* ==================== STEP 1: LOCATION & TICKET SELECTION ==================== */}
          {step === 1 && (
            <form onSubmit={handleStep1Next} className="space-y-5 animate-in fade-in duration-300">
              
              {/* Event Cover Banner & Info */}
              <div className="relative rounded-2xl overflow-hidden border border-border bg-card">
                <img src={coverImage} alt={event.title} className="w-full h-32 object-cover opacity-70" />

                <div className="relative p-4 bg-card">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-primary-soft text-accent border border-primary-border px-2.5 py-0.5 rounded-full mb-1 inline-block">
                    {event.category || 'General'}
                  </span>
                  <h4 className="text-base font-bold text-heading truncate">{event.title}</h4>
                  <div className="flex items-center gap-4 text-xs text-body mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-accent" />
                      {new Date(activeLocation?.startDateTime || activeLocation?.date || event.startDateTime || event.date).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="w-3.5 h-3.5 text-accent" />
                      {activeLocation?.name || event.location}
                    </span>
                  </div>
                </div>
              </div>

              {/* LOCATION SELECTION (If Multiple Locations Exist) */}
              {locations.length > 1 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-body flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-accent" /> Select Venue / Location
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {locations.map((loc) => {
                      const locId = loc._id?.toString() || loc.name;
                      const isLocSelected = selectedLocationId === locId;
                      return (
                        <button
                          key={locId}
                          type="button"
                          onClick={() => handleLocationSelect(loc)}
                          className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                            isLocSelected
                              ? 'bg-primary-soft border-primary-border text-heading  '
                              : 'bg-card border-border text-body hover:border-border'
                          }`}
                        >
                          <div className="text-xs font-bold text-heading truncate">{loc.name}</div>
                          <div className="text-[10px] text-body mt-0.5">{loc.startTime || '07:00 PM'}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TICKET TIER SELECTION FOR SELECTED LOCATION */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-body flex items-center justify-between">
                  <span>Ticket Types ({activeLocation?.name || 'Venue'})</span>
                  <span className="text-[10px] text-body font-normal">Per-location capacity</span>
                </label>

                {allLocationTiersSoldOut ? (
                  <div className="p-4 bg-error-soft border border-error-border rounded-xl text-center text-xs text-danger font-bold">
                    All tickets for this location are sold out.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeTiers.map((tier) => {
                      const tierId = tier._id?.toString() || tier.name;
                      const tierAvail = Math.max(0, tier.availableQuantity ?? (tier.totalQuantity - (tier.soldQuantity || 0)));
                      const isSoldOut = tierAvail <= 0;
                      const isSelected = selectedTierId === tierId || selectedTierName === tier.name;

                      return (
                        <button
                          key={tierId}
                          type="button"
                          disabled={isSoldOut}
                          onClick={() => {
                            if (!isSoldOut) {
                              setSelectedTierId(tierId);
                              setSelectedTierName(tier.name);
                              setQuantity(1);
                            }
                          }}
                          className={`p-3 rounded-xl border text-left transition ${
                            isSoldOut
                              ? 'bg-card border-border text-subtle opacity-60 cursor-not-allowed'
                              : isSelected
                              ? 'bg-primary-soft border-primary-border text-heading   cursor-pointer'
                              : 'bg-card border-border text-body hover:border-border cursor-pointer'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-heading">{tier.name}</span>
                            {isSoldOut ? (
                              <span className="text-[9px] font-extrabold uppercase bg-error-soft text-danger border border-error-border px-1.5 py-0.5 rounded">
                                SOLD OUT
                              </span>
                            ) : (
                              <span className="text-[10px] text-accent font-semibold">
                                Available: {tierAvail}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-accent font-extrabold mt-1">
                            ${tier.price} USD
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* QUANTITY COUNTER */}
              {!allLocationTiersSoldOut && (
                <div className="glass-panel p-4 rounded-2xl border border-border flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-heading block">Ticket Quantity</span>
                    <span className="text-[11px] text-body">
                      ${unitPrice} per ticket • {isTierSoldOut ? '0 left (SOLD OUT)' : `${maxAvailable} left`}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={isTierSoldOut || quantity <= 1}
                      className="w-9 h-9 rounded-xl bg-secondary hover:bg-secondary text-heading font-bold text-sm disabled:opacity-40 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-lg font-extrabold text-heading w-6 text-center">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.min(maxAvailable, quantity + 1))}
                      disabled={isTierSoldOut || quantity >= maxAvailable}
                      className="w-9 h-9 rounded-xl bg-secondary hover:bg-secondary text-heading font-bold text-sm disabled:opacity-40 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* Price Preview */}
              <div className="flex items-center justify-between p-4 bg-primary-soft border border-primary-border rounded-2xl text-xs">
                <span className="text-accent font-semibold">Subtotal Preview ({quantity} Tickets):</span>
                <span className="text-base font-extrabold text-accent">${subtotal.toFixed(2)} USD</span>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={allLocationTiersSoldOut || isTierSoldOut}
                className="w-full py-3.5 bg-primary text-on-primary font-bold rounded-xl text-sm transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>{allLocationTiersSoldOut || isTierSoldOut ? 'Sold Out for this selection' : 'Continue to Checkout'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* ==================== STEP 2: CHECKOUT / CUSTOMER DETAILS ==================== */}
          {step === 2 && (
            <form onSubmit={handleStep2Next} className="space-y-5 animate-in fade-in duration-300">
              <div className="glass-panel p-4 rounded-2xl border border-border space-y-4">
                <label className="text-xs font-bold uppercase tracking-wider text-body flex items-center gap-2">
                  <User className="w-4 h-4 text-accent" /> Customer Information
                </label>

                <div>
                  <label className="text-[11px] text-body block mb-1 font-medium">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-subtle absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="John Doe"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2.5 text-xs text-heading focus:outline-none focus:border-primary-border"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-body block mb-1 font-medium">Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-subtle absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        placeholder="john@example.com"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2.5 text-xs text-heading focus:outline-none focus:border-primary-border"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-body block mb-1 font-medium">Phone Number</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-subtle absolute left-3 top-3" />
                      <input
                        type="tel"
                        placeholder="+94 7X XXX XXXX"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2.5 text-xs text-heading focus:outline-none focus:border-primary-border"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Summary Box */}
              <div className="bg-card border border-border p-4 rounded-2xl space-y-2 text-xs">
                <span className="font-bold text-heading uppercase text-[10px] tracking-wider block mb-1 text-body">
                  Order Summary
                </span>
                <div className="flex justify-between text-body">
                  <span>Event:</span>
                  <span className="font-semibold text-heading truncate max-w-[200px]">{event.title}</span>
                </div>
                <div className="flex justify-between text-body">
                  <span>Venue Location:</span>
                  <span className="font-semibold text-heading">{activeLocation?.name}</span>
                </div>
                <div className="flex justify-between text-body">
                  <span>Selected Tier:</span>
                  <span className="font-semibold text-heading">{selectedTierName}</span>
                </div>
                <div className="flex justify-between text-body">
                  <span>Quantity:</span>
                  <span className="font-semibold text-heading">{quantity} Ticket(s)</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-3 bg-secondary hover:bg-secondary text-body font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-primary text-on-primary font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2"
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
              <div className="bg-card border border-border p-4 rounded-2xl space-y-2.5 text-xs">
                <div className="flex justify-between text-body">
                  <span>Tickets Subtotal ({quantity}x ${unitPrice}):</span>
                  <span className="text-heading font-semibold">${subtotal.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between text-body">
                  <span>Platform Fee (5% Service):</span>
                  <span className="text-heading font-semibold">${platformFee.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-heading border-t border-border pt-2">
                  <span>Total Amount Due:</span>
                  <span className="text-accent">${grandTotal.toFixed(2)} USD</span>
                </div>
              </div>

              <div className="glass-panel p-4 rounded-2xl border border-border space-y-3">
                <p className="text-sm font-bold text-heading flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-accent" /> Secure Stripe Checkout
                </p>
                <p className="text-xs text-body">
                  Continue to Stripe to enter payment details. Your booking becomes confirmed only after the server verifies payment.
                  The backend validates the final price and reservation deadline.
                </p>
              </div>

              {/* Security Badge */}
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-subtle">
                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                <span>Inventory reserved by the backend; confirmation follows verified payment</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={loading}
                  className="px-5 py-3.5 bg-secondary hover:bg-secondary text-body font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3.5 bg-primary text-on-primary font-bold rounded-xl text-xs transition duration-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-border border-t-transparent rounded-full animate-spin" />
                      <span>Reserving tickets and opening Stripe...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-accent" />
                      <span>Continue to Stripe (${grandTotal.toFixed(2)} USD)</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ==================== STEP 4: CONFIRMATION (QR TICKET & MY BOOKINGS) ==================== */}
          {step === 4 && canDisplayTicket(successData) && (
            <div className="text-center py-6 space-y-6 animate-in zoom-in-95 duration-300">
              
              {/* Animated Success Badge */}
              <div className="w-16 h-16 bg-primary-soft border border-primary-border text-accent rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h4 className="text-2xl font-black text-heading">Booking & Payment Confirmed!</h4>
                <p className="text-xs text-body mt-1 max-w-md mx-auto">
                  Your seat has been atomically locked. Here is your unforgeable gate check-in pass.
                </p>
              </div>

              {/* Digital QR Pass Preview Card */}
              <div className="glass-panel border border-primary-border rounded-3xl p-6 max-w-md mx-auto bg-card relative">
                <div className="flex justify-between items-center border-b border-border pb-3 mb-4">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-accent">QR Gate Pass</span>
                  <span className="text-[11px] text-accent font-bold bg-primary-soft border border-primary-border px-2.5 py-0.5 rounded-full">
                    PAID & VERIFIED
                  </span>
                </div>

                {/* QR Code Icon Graphic */}
                <div className="w-32 h-32 bg-qr-paper rounded-2xl p-3 mx-auto mb-4 flex items-center justify-center">
                  <QRCodeSVG value={successData.qrToken} size={104} level="H" />
                </div>

                <div className="space-y-2 text-xs text-left">
                  <div className="flex justify-between border-b border-border pb-1.5">
                    <span className="text-body">Token Ref / Booking ID:</span>
                    <span className="font-mono font-bold text-accent truncate max-w-[180px]">
                      {successData.qrToken}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-border pb-1.5">
                    <span className="text-body">Event Title:</span>
                    <span className="font-bold text-heading truncate max-w-[180px]">{event.title}</span>
                  </div>
                  <div className="flex justify-between border-b border-border pb-1.5">
                    <span className="text-body">Venue Location:</span>
                    <span className="font-semibold text-heading">{successData.locationName || activeLocation?.name}</span>
                  </div>
                  <div className="flex justify-between border-b border-border pb-1.5">
                    <span className="text-body">Attendee:</span>
                    <span className="font-semibold text-heading">{customerName || user?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body">Tickets Count:</span>
                    <span className="font-bold text-accent">
                      {successData.ticketQuantity} Ticket(s) ({successData.ticketType || selectedTierName})
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
                  className="w-full sm:w-auto flex-1 px-6 py-3.5 bg-primary text-on-primary font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Ticket className="w-4 h-4" /> Go to My Bookings
                </button>
                <button
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-3.5 bg-secondary hover:bg-secondary text-body font-bold rounded-xl text-xs transition cursor-pointer"
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

