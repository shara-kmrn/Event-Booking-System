import { Calendar, MapPin, Tag, ArrowRight, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

const categoryColors = {
  Conference: 'from-blue-500/20 to-indigo-500/20 text-blue-300 border-blue-500/30',
  Concert: 'from-pink-500/20 to-rose-500/20 text-pink-300 border-pink-500/30',
  Workshop: 'from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-500/30',
  Tech: 'from-cyan-500/20 to-teal-500/20 text-cyan-300 border-cyan-500/30',
  Sports: 'from-emerald-500/20 to-green-500/20 text-emerald-300 border-emerald-500/30',
  General: 'from-purple-500/20 to-indigo-500/20 text-purple-300 border-purple-500/30',
};

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
  const categoryKey = event.category && categoryColors[event.category] ? event.category : 'General';
  const badgeStyle = categoryColors[categoryKey];
  const coverImage = event.bannerUrl || defaultCategoryImages[categoryKey];

  const totalTickets = event.totalTickets || 100;
  const remainingTickets = event.availableTickets ?? 0;
  const bookedPercent = Math.min(100, Math.max(0, Math.round(((totalTickets - remainingTickets) / totalTickets) * 100)));

  return (
    <div className="group glass-card rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-indigo-500/15 relative">
      
      {/* Top Banner Image with Gradient Overlay */}
      <div
        onClick={() => onBook(event)}
        className="relative h-48 w-full overflow-hidden bg-slate-900 cursor-pointer"
      >
        <img
          src={coverImage}
          alt={event.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        
        {/* Category Badge */}
        <div className="absolute top-3 left-3">
          <span className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border backdrop-blur-md bg-gradient-to-r ${badgeStyle}`}>
            {event.category || 'General'}
          </span>
        </div>

        {/* Price Tag Badge */}
        <div className="absolute top-3 right-3">
          <div className="bg-slate-950/80 backdrop-blur-md border border-emerald-500/40 px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
            <span className="text-xs text-slate-400 font-medium">USD</span>
            <span className="text-base font-extrabold text-emerald-400">${event.ticketPrice}</span>
          </div>
        </div>
      </div>

      {/* Card Content Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3
            onClick={() => onBook(event)}
            className="text-xl font-bold text-white mb-2 line-clamp-1 group-hover:text-indigo-300 transition-colors cursor-pointer"
          >
            {event.title}
          </h3>
          <p className="text-slate-400 text-sm mb-4 line-clamp-2 leading-relaxed">
            {event.description || 'Experience an unmissable live event with real-time atomic seat reservation.'}
          </p>

          {/* Details Metadata */}
          <div className="space-y-2 text-xs text-slate-300 border-t border-slate-800/80 pt-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-indigo-500/10 text-indigo-400">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <span className="font-medium text-slate-200">
                {new Date(event.date).toLocaleDateString(undefined, {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-purple-500/10 text-purple-400">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <span className="truncate text-slate-300">{event.location}</span>
            </div>
          </div>
        </div>

        {/* Live Seat Availability Bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400 flex items-center gap-1 font-medium">
              <Tag className="w-3 h-3 text-indigo-400" /> Availability
            </span>
            <span className={isSoldOut ? 'text-rose-400 font-bold' : 'text-slate-300 font-medium'}>
              {isSoldOut ? 'Sold Out' : `${remainingTickets} left`}
            </span>
          </div>
          
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
            <div
              className={`h-full transition-all duration-500 ${
                isSoldOut
                  ? 'bg-rose-500'
                  : bookedPercent > 80
                  ? 'bg-amber-400'
                  : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400'
              }`}
              style={{ width: `${isSoldOut ? 100 : Math.max(8, 100 - bookedPercent)}%` }}
            />
          </div>

          {/* Action Button */}
          <button
            onClick={() => onBook(event)}
            disabled={isSoldOut}
            className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-md cursor-pointer ${
              isSoldOut
                ? 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-[0.98]'
            }`}
          >
            {isSoldOut ? (
              <>
                <AlertCircle className="w-4 h-4" /> Fully Booked
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                Book Ticket Now
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
};

export default EventCard;