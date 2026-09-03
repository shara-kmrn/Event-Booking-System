import { Calendar, MapPin, Tag } from 'lucide-react';

const EventCard = ({ event, onBook }) => {
  const isSoldOut = event.availableTickets <= 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition">
      <div>
        <div className="flex justify-between items-start mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider bg-indigo-950 text-indigo-400 px-2.5 py-1 rounded">
            {event.category || 'General'}
          </span>
          <span className="text-lg font-bold text-emerald-400">
            ${event.ticketPrice}
          </span>
        </div>

        <h3 className="text-xl font-bold text-white mb-2">{event.title}</h3>
        <p className="text-slate-400 text-sm mb-4 line-clamp-2">{event.description}</p>

        <div className="space-y-1.5 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>{new Date(event.date).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-indigo-400" />
            <span>{event.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-400" />
            <span>{event.availableTickets} tickets remaining</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => onBook(event)}
        disabled={isSoldOut}
        className={`w-full mt-5 py-2.5 rounded-lg font-medium text-sm transition cursor-pointer ${
          isSoldOut
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
        }`}
      >
        {isSoldOut ? 'Sold Out' : 'Book Ticket'}
      </button>
    </div>
  );
};

export default EventCard;