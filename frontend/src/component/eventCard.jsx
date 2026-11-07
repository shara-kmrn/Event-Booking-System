import { Calendar, MapPin, Tag, ArrowRight, Zap, AlertCircle, Clock } from 'lucide-react';

const defaultCategoryImages = {
  Conference: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=600&q=80',
  Concert: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80',
  Workshop: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=600&q=80',
  Tech: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=600&q=80',
  Sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=600&q=80',
  General: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&q=80',
};

const EventCard = ({ event, onBook }) => {
  const isSoldOut = event.availableTickets <= 0;
  const categoryKey = event.category && defaultCategoryImages[event.category] ? event.category : 'General';
  const coverImage = event.bannerUrl || event.image || defaultCategoryImages[categoryKey];

  const totalTickets = event.totalCapacity || event.totalTickets || 100;
  const remainingTickets = event.availableTickets ?? 0;
  const bookedPercent = Math.min(100, Math.max(0, Math.round(((totalTickets - remainingTickets) / totalTickets) * 100)));

  const eventStatus = event.eventStatus || 'UPCOMING';
  const isOngoing = eventStatus === 'ONGOING';
  const isCompleted = eventStatus === 'COMPLETED';
  const isBookingAllowed = event.bookingAllowed !== false && eventStatus === 'UPCOMING' && !isSoldOut;

  const statusStyles = {
    COMPLETED: { backgroundColor: 'var(--error-bg)', color: 'var(--error-text)', border: '1px solid var(--error-border)' },
    ONGOING: { backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' },
    UPCOMING: { backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' },
  };

  return (
    <div
      className="group rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 relative ev-card"
    >
      {/* Banner Image */}
      <div className="relative h-48 w-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <img
          src={coverImage}
          alt={event.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-85"
          loading="lazy"
        />

        {/* Category & Status Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span
            className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full"
            style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--accent-text)', border: '1px solid var(--primary-border)' }}
          >
            {event.category || 'General'}
          </span>
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full" style={statusStyles[eventStatus] || statusStyles.UPCOMING}>
            {eventStatus}
          </span>
        </div>

        {/* Price Badge */}
        <div className="absolute top-3 right-3">
          <div
            className="px-3 py-1 rounded-full flex items-center gap-1"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--primary-border)' }}
          >
            <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>USD</span>
            <span className="text-base font-extrabold" style={{ color: 'var(--accent-text)' }}>${event.ticketPrice}</span>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-bold mb-2 line-clamp-1 group-hover:text-accent transition-colors" style={{ color: 'var(--text-heading)' }}>
            {event.title}
          </h3>
          <p className="text-sm mb-4 line-clamp-2 leading-relaxed" style={{ color: 'var(--text-subtle)' }}>
            {event.description || 'Experience an unmissable live event with real-time atomic seat reservation.'}
          </p>

          {/* Metadata */}
          <div className="space-y-2 text-xs pt-3 mb-4" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <div className="p-1 rounded" style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--accent-text)' }}>
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <span className="font-medium" style={{ color: 'var(--text-heading)' }}>
                {new Date(event.startDateTime || event.date).toLocaleDateString(undefined, {
                  weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                })}
              </span>
              <span style={{ color: 'var(--text-subtle)' }}>({event.startDateTime ? new Date(event.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : event.startTime || 'Time TBA'})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1 rounded" style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--accent-text)' }}>
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <span className="truncate" style={{ color: 'var(--text-body)' }}>{event.location}</span>
            </div>
          </div>
        </div>

        {/* Availability Bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="flex items-center gap-1 font-medium" style={{ color: 'var(--text-subtle)' }}>
              <Tag className="w-3 h-3" style={{ color: 'var(--accent-text)' }} /> Availability
            </span>
            <span className="font-medium" style={{ color: isSoldOut ? 'var(--error-text)' : 'var(--text-body)' }}>
              {isSoldOut ? 'Sold Out' : `${remainingTickets} left`}
            </span>
          </div>

          <div className="w-full h-1.5 rounded-full overflow-hidden mb-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${isSoldOut ? 100 : Math.max(8, 100 - bookedPercent)}%`,
                backgroundColor: (isSoldOut || isCompleted) ? 'var(--error-text)' : (isOngoing || bookedPercent > 80) ? 'var(--warning-text)' : 'var(--primary)',
              }}
            />
          </div>

          {/* Action Button */}
          <button
            onClick={() => isBookingAllowed && onBook(event)}
            disabled={!isBookingAllowed}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
            style={{
              backgroundColor: !isBookingAllowed ? 'var(--bg-secondary)' : 'var(--primary)',
              color: !isBookingAllowed ? 'var(--text-subtle)' : 'var(--text-on-primary)',
              border: !isBookingAllowed ? '1px solid var(--border)' : 'none',
              cursor: !isBookingAllowed ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={e => { if (isBookingAllowed) e.currentTarget.style.backgroundColor = 'var(--primary-hover)'; }}
            onMouseLeave={e => { if (isBookingAllowed) e.currentTarget.style.backgroundColor = 'var(--primary)'; }}
          >
            {isCompleted ? (
              <><Clock className="w-4 h-4" /> Event Ended</>
            ) : isOngoing || event.bookingAllowed === false ? (
              <><AlertCircle className="w-4 h-4" /> Booking Closed</>
            ) : isSoldOut ? (
              <><AlertCircle className="w-4 h-4" /> Sold Out</>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Book Now
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventCard;