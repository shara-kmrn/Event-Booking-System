import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/authContext';
import { QRCodeSVG } from 'qrcode.react';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Mail,
  Phone,
  ShieldCheck,
  Tag,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  CreditCard,
  Lock,
  Printer,
  Ticket as TicketIcon,
  Sparkles,
  AlertCircle,
  XCircle,
  Building,
  Info
} from 'lucide-react';

const categoryColors = {
  Conference: 'from-blue-500/20 to-indigo-500/20 text-blue-300 border-blue-500/30',
  Concert: 'from-pink-500/20 to-rose-500/20 text-pink-300 border-pink-500/30',
  Workshop: 'from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-500/30',
  Tech: 'from-cyan-500/20 to-teal-500/20 text-cyan-300 border-cyan-500/30',
  Sports: 'from-emerald-500/20 to-green-500/20 text-emerald-300 border-emerald-500/30',
  General: 'from-purple-500/20 to-indigo-500/20 text-purple-300 border-purple-500/30',
};

const defaultCategoryImages = {
  Conference: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
  Concert: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
  Workshop: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80',
  Tech: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80',
  Sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80',
  General: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
};

const EventDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Booking Flow Steps: 1 = Event Details, 2 = Checkout, 3 = Payment, 4 = Confirmation
  const [currentStep, setCurrentStep] = useState(1);

  // Selection & Form states
  const [selectedTier, setSelectedTier] = useState(null);
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');

  // Payment form mock
  const [paymentMethod, setPaymentMethod] = useState('Credit/Debit Card');
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('123');

  // Validation & Checkout error states
  const [checkoutError, setCheckoutError] = useState('');

  // Email validation helper
  const isEmailValid = (email) => {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  // Phone number validation helper (Sri Lanka 10 digits starting with 0 OR +94 with 9 digits)
  const isPhoneValid = (phone) => {
    if (!phone) return false;
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (/^0/.test(cleaned)) {
      return /^0\d{9}$/.test(cleaned);
    }
    if (/^\+94/.test(cleaned)) {
      return /^\+94\d{9}$/.test(cleaned);
    }
    if (/^94/.test(cleaned)) {
      return /^94\d{9}$/.test(cleaned);
    }
    if (/^\+/.test(cleaned)) {
      return /^\+[1-9]\d{7,14}$/.test(cleaned);
    }
    return false;
  };

  useEffect(() => {
    fetchEventDetails();
  }, [id]);

  useEffect(() => {
    if (user) {
      setCustomerName(user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim());
      setCustomerEmail(user.email || '');
      setCustomerPhone(user.contactNumber || user.phone || '');
      setCardHolder(user.name || '');
    }
  }, [user]);

  const fetchEventDetails = async () => {
    try {
      setLoading(true);
      const { data } = await API.get(`/events/${id}`);
      setEvent(data);

      if (data.ticketTypes && data.ticketTypes.length > 0) {
        setSelectedTier(data.ticketTypes[0]);
      } else {
        setSelectedTier({
          name: 'General Admission',
          price: data.ticketPrice || 0,
          quantity: data.totalCapacity || 100,
          availableQuantity: data.availableTickets || 0,
        });
      }
    } catch (err) {
      console.error('Failed to load event details', err);
      setError('Event not found or failed to load.');
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToCheckout = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProceedToPayment = (e) => {
    e.preventDefault();
    setCheckoutError('');

    if (!customerName.trim()) {
      setCheckoutError('Please enter your full name.');
      return;
    }

    if (!customerEmail.trim() || !isEmailValid(customerEmail)) {
      setCheckoutError('Please enter a valid email address (e.g. name@example.com).');
      return;
    }

    if (!customerPhone.trim() || !isPhoneValid(customerPhone)) {
      setCheckoutError('Please enter a valid contact phone number (10 digits starting with 0 OR +94 with 9 digits).');
      return;
    }

    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCompletePayment = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const { data } = await API.post('/bookings', {
        eventId: event._id,
        ticketQuantity,
        ticketType: selectedTier?.name || 'General',
        customerName,
        customerEmail,
        customerPhone,
        paymentMethod,
      });

      setCompletedBooking(data.booking);
      setCurrentStep(4); // Confirmation step
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Booking failed', err);
      setError(err.response?.data?.message || 'Payment processing failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center text-slate-300">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium">Loading Event & Organizer Details...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4">
        <div className="glass-card max-w-md w-full p-8 rounded-2xl text-center border border-slate-800 space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Event Not Found</h2>
          <p className="text-slate-400 text-sm">{error || 'The requested event could not be retrieved.'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs transition cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const categoryKey = event.category && categoryColors[event.category] ? event.category : 'General';
  const badgeStyle = categoryColors[categoryKey];
  const coverImage = event.bannerUrl || defaultCategoryImages[categoryKey];

  const currentPrice = selectedTier ? selectedTier.price : event.ticketPrice;
  const subtotal = currentPrice * ticketQuantity;
  const platformFee = Math.round(subtotal * 0.05 * 100) / 100;
  const grandTotal = Math.round((subtotal + platformFee) * 100) / 100;

  const maxAvailable = selectedTier
    ? selectedTier.availableQuantity ?? event.availableTickets
    : event.availableTickets;

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 pb-20 pt-6 px-4 sm:px-6 lg:px-8">
      
      {/* Background Decorative Glows */}
      <div className="gradient-glow top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/15 pointer-events-none" />
      <div className="gradient-glow top-1/2 right-10 w-[400px] h-[400px] bg-purple-600/15 pointer-events-none" />

      <div className="max-w-6xl mx-auto">
        
        {/* Navigation Stepper Header */}
        <div className="mb-8">
          <button
            onClick={() => {
              if (currentStep > 1 && currentStep < 4) {
                setCurrentStep(currentStep - 1);
              } else {
                navigate('/');
              }
            }}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition mb-6 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            {currentStep === 1 ? 'Back to Events' : `Back to Step ${currentStep - 1}`}
          </button>

          <div className="glass-panel p-4 rounded-2xl border border-slate-800 shadow-xl">
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
              
              {/* Step 1 */}
              <div className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-2 px-3 rounded-xl transition ${
                currentStep === 1 ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40' : currentStep > 1 ? 'text-emerald-400' : 'text-slate-500'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  currentStep === 1 ? 'bg-indigo-600 text-white' : currentStep > 1 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  1
                </div>
                <span className="hidden sm:inline">Event Details</span>
              </div>

              {/* Step 2 */}
              <div className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-2 px-3 rounded-xl transition ${
                currentStep === 2 ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40' : currentStep > 2 ? 'text-emerald-400' : 'text-slate-500'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  currentStep === 2 ? 'bg-indigo-600 text-white' : currentStep > 2 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  2
                </div>
                <span className="hidden sm:inline">Checkout</span>
              </div>

              {/* Step 3 */}
              <div className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-2 px-3 rounded-xl transition ${
                currentStep === 3 ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40' : currentStep > 3 ? 'text-emerald-400' : 'text-slate-500'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  currentStep === 3 ? 'bg-indigo-600 text-white' : currentStep > 3 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  3
                </div>
                <span className="hidden sm:inline">Payment</span>
              </div>

              {/* Step 4 */}
              <div className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-2 px-3 rounded-xl transition ${
                currentStep === 4 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-500'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  currentStep === 4 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  4
                </div>
                <span className="hidden sm:inline">Confirmation</span>
              </div>

            </div>
          </div>
        </div>

        {/* STEP 1: EVENT DETAILS & ORGANIZER INFO */}
        {currentStep === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left 2 Columns: Banner, Info, Description & Organizer Details */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Cover Banner */}
              <div className="relative h-72 sm:h-96 rounded-3xl overflow-hidden glass-card border border-slate-800 shadow-2xl">
                <img
                  src={coverImage}
                  alt={event.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-[#030712]/40 to-transparent" />
                
                <div className="absolute top-4 left-4 flex gap-2">
                  <span className={`text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full border backdrop-blur-md bg-gradient-to-r ${badgeStyle}`}>
                    {event.category || 'General'}
                  </span>
                </div>

                <div className="absolute bottom-6 left-6 right-6">
                  <h1 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight mb-2">
                    {event.title}
                  </h1>
                </div>
              </div>

              {/* Quick Info Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass-card p-4 rounded-2xl border border-slate-800/80 flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-semibold uppercase">Event Date</div>
                    <div className="text-sm font-bold text-white">
                      {new Date(event.date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                </div>

                <div className="glass-card p-4 rounded-2xl border border-slate-800/80 flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-semibold uppercase">Event Time</div>
                    <div className="text-sm font-bold text-white">
                      {event.startTime || '07:00 PM'} - {event.endTime || '11:00 PM'}
                    </div>
                  </div>
                </div>

                <div className="glass-card p-4 rounded-2xl border border-slate-800/80 flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-semibold uppercase">Venue Location</div>
                    <div className="text-sm font-bold text-white truncate">{event.location}</div>
                  </div>
                </div>
              </div>

              {/* Event Description */}
              <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800/80 space-y-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Info className="w-5 h-5 text-indigo-400" />
                  About This Event
                </h3>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed whitespace-pre-line">
                  {event.description || 'No detailed description provided.'}
                </p>
              </div>

              {/* ORGANIZER DETAILS CARD (Requested Requirement) */}
              <div className="glass-card p-6 sm:p-8 rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/20 via-slate-900/60 to-slate-950 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                      <Building className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">Hosted By</span>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        {event.tenantId?.name || 'Event Organizer'}
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      </h3>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Verified Host
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Contact Email</div>
                      <div className="text-slate-200 font-medium text-xs truncate">
                        {event.contactEmail || event.tenantId?.email || 'support@eventra.com'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <Phone className="w-4 h-4 text-purple-400 shrink-0" />
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Contact Phone</div>
                      <div className="text-slate-200 font-medium text-xs">
                        {event.contactPhone || event.tenantId?.contactNumber || '+1 (800) 555-EVENT'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Ticket Selection & Price Calculation */}
            <div className="space-y-6">
              
              <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl sticky top-6 space-y-6">
                
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Select Ticket</h3>
                  <p className="text-slate-400 text-xs">Choose your preferred ticket tier & quantity.</p>
                </div>

                {/* Ticket Tiers List */}
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Available Ticket Tiers
                  </label>

                  {event.ticketTypes && event.ticketTypes.length > 0 ? (
                    event.ticketTypes.map((tier, idx) => (
                      <div
                        key={tier._id || idx}
                        onClick={() => setSelectedTier(tier)}
                        className={`p-4 rounded-2xl border transition cursor-pointer flex justify-between items-center ${
                          selectedTier?.name === tier.name
                            ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/10'
                            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-white text-sm flex items-center gap-2">
                            {tier.name}
                            {selectedTier?.name === tier.name && (
                              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {tier.availableQuantity <= 0 ? (
                              <span className="text-rose-400 font-semibold">Sold Out</span>
                            ) : (
                              `${tier.availableQuantity} remaining`
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-extrabold text-emerald-400">${tier.price}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-white text-sm">General Admission</div>
                        <div className="text-xs text-slate-400">{event.availableTickets} tickets remaining</div>
                      </div>
                      <div className="text-base font-extrabold text-emerald-400">${event.ticketPrice}</div>
                    </div>
                  )}
                </div>

                {/* Quantity Selector */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-400 uppercase">
                    <span>Quantity</span>
                    <span>Max {Math.min(10, maxAvailable)} per order</span>
                  </div>
                  
                  <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-2 rounded-2xl">
                    <button
                      onClick={() => setTicketQuantity(Math.max(1, ticketQuantity - 1))}
                      disabled={ticketQuantity <= 1}
                      className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center disabled:opacity-40 transition cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-lg font-extrabold text-white">{ticketQuantity}</span>
                    <button
                      onClick={() => setTicketQuantity(Math.min(maxAvailable, ticketQuantity + 1))}
                      disabled={ticketQuantity >= maxAvailable || ticketQuantity >= 10}
                      className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center disabled:opacity-40 transition cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Pricing Summary */}
                <div className="border-t border-slate-800 pt-4 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Ticket Price ({ticketQuantity}x)</span>
                    <span className="text-slate-200">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Platform Fee (5%)</span>
                    <span className="text-slate-200">${platformFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-slate-800">
                    <span>Total Amount</span>
                    <span className="text-emerald-400">${grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Book Ticket Button */}
                <button
                  onClick={handleProceedToCheckout}
                  disabled={maxAvailable <= 0}
                  className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 shadow-xl cursor-pointer ${
                    maxAvailable <= 0
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-[0.98]'
                  }`}
                >
                  {maxAvailable <= 0 ? (
                    'Fully Booked'
                  ) : (
                    <>
                      Book Ticket Now
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-[11px] text-slate-500 text-center flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-400" /> Guaranteed Atomic Reservation
                </p>

              </div>

            </div>

          </div>
        )}

        {/* STEP 2: CHECKOUT (CUSTOMER DETAILS) */}
        {currentStep === 2 && (
          <div className="max-w-3xl mx-auto space-y-8">
            
            <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
              
              <div className="border-b border-slate-800 pb-4">
                <h2 className="text-2xl font-extrabold text-white">Checkout & Attendee Details</h2>
                <p className="text-slate-400 text-xs mt-1">Provide customer information to generate your QR gate ticket pass.</p>
              </div>

              {/* Order Summary Box */}
              <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">Event</span>
                    <h4 className="text-base font-bold text-white">{event.title}</h4>
                    <p className="text-xs text-slate-400">{event.location}</p>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    {selectedTier?.name || 'General'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs border-t border-indigo-500/20 pt-3 text-slate-300">
                  <div>Quantity: <span className="font-bold text-white">{ticketQuantity} ticket(s)</span></div>
                  <div className="text-right">Total Payable: <span className="font-extrabold text-emerald-400">${grandTotal.toFixed(2)}</span></div>
                </div>
              </div>

              {checkoutError && (
                <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {/* Customer Details Form */}
              <form onSubmit={handleProceedToPayment} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        if (checkoutError) setCheckoutError('');
                      }}
                      placeholder="John Doe"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                      Email Address <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                      <input
                        type="email"
                        required
                        value={customerEmail}
                        onChange={(e) => {
                          setCustomerEmail(e.target.value);
                          if (checkoutError) setCheckoutError('');
                        }}
                        placeholder="john@example.com"
                        className={`w-full bg-slate-950 border rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none transition ${
                          customerEmail.length > 0
                            ? isEmailValid(customerEmail)
                              ? 'border-emerald-500/80 focus:border-emerald-400'
                              : 'border-rose-500/80 focus:border-rose-400'
                            : 'border-slate-800 focus:border-indigo-500'
                        }`}
                      />
                    </div>
                    {customerEmail.length > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] font-medium">
                        {isEmailValid(customerEmail) ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Valid email address
                          </span>
                        ) : (
                          <span className="text-rose-400 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Invalid email format (e.g. name@example.com)
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                      Phone Number <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => {
                          setCustomerPhone(e.target.value);
                          if (checkoutError) setCheckoutError('');
                        }}
                        placeholder="0771234567 or +94771234567"
                        className={`w-full bg-slate-950 border rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none transition ${
                          customerPhone.length > 0
                            ? isPhoneValid(customerPhone)
                              ? 'border-emerald-500/80 focus:border-emerald-400'
                              : 'border-rose-500/80 focus:border-rose-400'
                            : 'border-slate-800 focus:border-indigo-500'
                        }`}
                      />
                    </div>
                    {customerPhone.length > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] font-medium">
                        {isPhoneValid(customerPhone) ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Valid phone number
                          </span>
                        ) : (
                          <span className="text-rose-400 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> 10 digits starting with 0 OR +94 with 9 digits
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                    Special Requests / Attendee Notes
                  </label>
                  <textarea
                    rows={2}
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    placeholder="Optional remarks or accessibility requests..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition resize-none"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="w-1/3 py-3.5 rounded-xl font-semibold text-sm bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={
                      !customerName.trim() ||
                      !isEmailValid(customerEmail) ||
                      !isPhoneValid(customerPhone)
                    }
                    className="w-2/3 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white transition shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Proceed to Payment
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>

            </div>

          </div>
        )}

        {/* STEP 3: PAYMENT */}
        {currentStep === 3 && (
          <div className="max-w-3xl mx-auto space-y-8">
            
            <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
              
              <div className="border-b border-slate-800 pb-4 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-extrabold text-white">Payment Method</h2>
                  <p className="text-slate-400 text-xs mt-1">Enter your card details to complete instant booking.</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 uppercase font-semibold">Total Amount</div>
                  <div className="text-2xl font-black text-emerald-400">${grandTotal.toFixed(2)}</div>
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Accepted Cards Display */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
                <span className="text-slate-400 font-semibold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-400" /> Accepted Cards
                </span>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <span className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">VISA</span>
                  <span className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">Mastercard</span>
                  <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">AMEX</span>
                </div>
              </div>

              {/* Bank Card Form */}
              <form onSubmit={handleCompletePayment} className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                    Cardholder Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      value={cardHolder || customerName}
                      onChange={(e) => setCardHolder(e.target.value)}
                      placeholder="John Doe"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition shadow-inner"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                    Card Number *
                  </label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-indigo-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      maxLength={19}
                      value={cardNumber}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
                        const formatted = raw.replace(/(\d{4})/g, '$1 ').trim();
                        setCardNumber(formatted || e.target.value);
                      }}
                      placeholder="4242 4242 4242 4242"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition font-mono shadow-inner"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                      Expiry Date (MM/YY) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={5}
                      value={cardExpiry}
                      onChange={(e) => {
                        let raw = e.target.value.replace(/\D/g, '').slice(0, 4);
                        if (raw.length >= 3) {
                          raw = `${raw.slice(0, 2)}/${raw.slice(2)}`;
                        }
                        setCardExpiry(raw);
                      }}
                      placeholder="12/28"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition font-mono text-center shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                      CVV / CVC Code *
                    </label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="123"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition font-mono text-center shadow-inner"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>256-Bit SSL Encrypted Bank Payment Gateway</span>
                  </div>
                  <div className="flex items-center gap-1 font-semibold text-slate-300">
                    <Lock className="w-3 h-3 text-indigo-400" /> Encrypted
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    disabled={submitting}
                    className="w-1/3 py-3.5 rounded-xl font-semibold text-sm bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !cardNumber || !cardExpiry || !cardCvv}
                    className="w-2/3 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white transition shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {submitting ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Processing Payment...</span>
                      </div>
                    ) : (
                      <>
                        Pay & Confirm Booking (${grandTotal.toFixed(2)})
                        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      </>
                    )}
                  </button>
                </div>
              </form>

            </div>

          </div>
        )}

        {/* STEP 4: CONFIRMATION & QR TICKET PASS (Requested Requirement) */}
        {currentStep === 4 && completedBooking && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in-95">
            
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 mx-auto shadow-2xl shadow-emerald-500/30 animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-black text-white">Booking Confirmed! 🎉</h2>
              <p className="text-slate-400 text-sm">
                Your ticket has been atomically reserved. Present your QR pass at the entrance.
              </p>
            </div>

            {/* UNFORGEABLE DIGITAL QR PASS CARD */}
            <div id="qr-ticket-pass" className="glass-card rounded-3xl border-2 border-indigo-500/40 overflow-hidden shadow-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-[#030712]">
              
              {/* Ticket Top Banner */}
              <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 p-6 text-white flex justify-between items-center">
                <div>
                  <span className="text-[11px] uppercase tracking-widest font-extrabold opacity-80">Official Gate Pass</span>
                  <h3 className="text-xl font-black">{event.title}</h3>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/20 backdrop-blur-md uppercase tracking-wider">
                    {completedBooking.ticketType || selectedTier?.name || 'General'}
                  </span>
                </div>
              </div>

              {/* Ticket Details & QR Code */}
              <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center border-b border-dashed border-slate-800">
                
                {/* Left: Event Details */}
                <div className="sm:col-span-2 space-y-4">
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Attendee Name</span>
                    <div className="text-base font-bold text-white">{completedBooking.customerName || customerName}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs text-slate-300">
                    <div>
                      <span className="text-slate-500 block">Date & Time</span>
                      <span className="font-semibold text-white">
                        {new Date(event.date).toLocaleDateString()} ({event.startTime || '07:00 PM'})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Venue</span>
                      <span className="font-semibold text-white truncate block">{event.location}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs text-slate-300">
                    <div>
                      <span className="text-slate-500 block">Tickets Count</span>
                      <span className="font-semibold text-white">{completedBooking.ticketQuantity} Ticket(s)</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total Paid</span>
                      <span className="font-bold text-emerald-400">${completedBooking.totalAmount} USD</span>
                    </div>
                  </div>
                </div>

                {/* Right: QR Code */}
                <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-xl">
                  <QRCodeSVG
                    value={completedBooking.qrCodeString}
                    size={140}
                    level="H"
                  />
                  <span className="text-[10px] font-mono text-slate-800 mt-2 font-bold tracking-wider text-center break-all">
                    {completedBooking.qrCodeString}
                  </span>
                </div>

              </div>

              {/* Pass Footer */}
              <div className="p-4 bg-slate-950/80 px-6 flex justify-between items-center text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Atomic Concurrency Gate Verification</span>
                </div>
                <div className="font-mono text-[11px] text-slate-500">ID: {completedBooking._id}</div>
              </div>

            </div>

            {/* Action Buttons: My Bookings + Print + Home */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={() => navigate('/my-tickets')}
                className="w-full sm:w-1/2 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white transition shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <TicketIcon className="w-4 h-4" />
                View in My Bookings
              </button>

              <button
                onClick={() => window.print()}
                className="w-full sm:w-1/2 py-3.5 rounded-xl font-bold text-sm bg-slate-900 border border-slate-800 text-slate-200 hover:bg-slate-800 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-indigo-400" />
                Print Ticket Pass
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default EventDetails;
