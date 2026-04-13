import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
// import Venue from "../models/Venue.js";
import Movie from "../models/Movie.js";

export const getPartnerAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, days: daysParam } = req.query;

    const showFilter = { createdBy: req.user.id };

    if (startDate || endDate) {
      showFilter.showDate = {};
      if (startDate) showFilter.showDate.$gte = startDate;
      if (endDate)   showFilter.showDate.$lte = endDate;
    }

    const shows = await Show.find(showFilter);

    if (!shows.length) {
      return res.json({
        totalRevenue: 0, totalBookings: 0, totalShows: 0, totalVenues: 0,
        cancelledCount: 0, totalSeats: 0, seatsSold: 0, occupancyRate: 0,
        estimatedProfit: 0, estimatedCost: 0,
        onlineBookings: 0, offlineBookings: 0,
        onlineRevenue: 0,  offlineRevenue: 0,
        dailyRevenue: [], topMovies: [], movieTitles: [],
      });
    }

    const showIds  = shows.map((s) => String(s._id));
    const venueIds = [...new Set(shows.map((s) => String(s.venueId)))];
    const movieIds = [...new Set(shows.map((s) => String(s.movieId)))];

    const bookings = await Booking.find({
      showId: { $in: showIds },
      status: { $in: ["CONFIRMED", "CANCELLED"] },
    });

    const movies = await Movie.find({ _id: { $in: movieIds } });

    const showMap  = new Map(shows.map((s) => [String(s._id), s]));
    const movieMap = new Map(movies.map((m) => [String(m._id), m]));

    const confirmedBookings = bookings.filter((b) => b.status === "CONFIRMED");
    const cancelledBookings = bookings.filter((b) => b.status === "CANCELLED");

    const totalRevenue   = confirmedBookings.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
    const totalBookings  = bookings.length;
    const cancelledCount = cancelledBookings.length;
    const totalShows     = shows.length;
    const totalVenues    = venueIds.length;

    // totalSeats = unique screen capacity (not summed per show)
    const uniqueScreens = new Map();
    shows.forEach((s) => {
      const key = `${String(s.venueId)}_${String(s.screenId || s.venueId)}`;
      if (!uniqueScreens.has(key)) {
        uniqueScreens.set(key, Number(s.totalSeats) || 0);
      }
    });
    const totalSeats = Array.from(uniqueScreens.values()).reduce((sum, seats) => sum + seats, 0);
    const seatsSold  = confirmedBookings.reduce((sum, b) => {
      if (Array.isArray(b.seats)) return sum + b.seats.length;
      return sum;
    }, 0);

    const occupancyRate = totalSeats > 0
      ? Number(((seatsSold / totalSeats) * 100).toFixed(1))
      : 0;

    const estimatedCost   = Math.round(totalRevenue * 0.3);
    const estimatedProfit = Math.max(0, totalRevenue - estimatedCost);

    // ── Online vs Offline split ───────────────────────────────────────────────
    const onlineBookings  = confirmedBookings.filter(b => b.source === "ONLINE").length;
    const offlineBookings = confirmedBookings.filter(b => b.source === "OFFLINE").length;

    const onlineRevenue  = confirmedBookings
      .filter(b => b.source === "ONLINE")
      .reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);

    const offlineRevenue = confirmedBookings
      .filter(b => b.source === "OFFLINE")
      .reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);

    // ── Daily revenue with per-movie breakdown ────────────────────────────────
    const dailyMap = new Map();

    // Seed show dates
    shows.forEach((show) => {
      const day = show.showDate;
      if (day && !dailyMap.has(day)) {
        dailyMap.set(day, { date: day, cancelled: 0, bookings: 0, revenue: 0, movies: new Map() });
      }
    });

    bookings.forEach((booking) => {
      const show = showMap.get(String(booking.showId));
      if (!show) return;
      const day = show.showDate;
      if (!day) return;

      if (!dailyMap.has(day)) {
        dailyMap.set(day, { date: day, cancelled: 0, bookings: 0, revenue: 0, movies: new Map() });
      }

      const row   = dailyMap.get(day);
      const movie = movieMap.get(String(show.movieId));
      const title = movie?.title || "Unknown Movie";

      row.bookings += 1;
      if (booking.status === "CANCELLED") row.cancelled += 1;

      if (booking.status === "CONFIRMED") {
        const amt = Number(booking.totalAmount) || 0;
        row.revenue += amt;

        if (!row.movies.has(title)) {
          row.movies.set(title, { revenue: 0, bookings: 0 });
        }
        const mv = row.movies.get(title);
        mv.revenue  += amt;
        mv.bookings += 1;
      }
    });

    // ── Dynamic days slice ────────────────────────────────────────────────────
    const days = daysParam ? Math.max(1, parseInt(daysParam, 10)) : 7;

    const allMovieTitles = new Set();
    dailyMap.forEach(row => row.movies.forEach((_, title) => allMovieTitles.add(title)));

    const dailyRevenue = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-days)
      .map(row => {
        const entry = {
          date:      row.date,
          cancelled: row.cancelled,
          bookings:  row.bookings,
          revenue:   row.revenue,
        };
        allMovieTitles.forEach(title => {
          const mv = row.movies.get(title);
          entry[title] = mv ? mv.revenue : 0;
        });
        return entry;
      });

    // ── Top movies ────────────────────────────────────────────────────────────
    const movieStatsMap = new Map();

    confirmedBookings.forEach((booking) => {
      const show  = showMap.get(String(booking.showId));
      if (!show) return;
      const movie = movieMap.get(String(show.movieId));
      const title = movie?.title || "Unknown Movie";

      if (!movieStatsMap.has(title)) {
        movieStatsMap.set(title, { title, revenue: 0, bookings: 0 });
      }
      const row = movieStatsMap.get(title);
      row.bookings += 1;
      row.revenue  += Number(booking.totalAmount) || 0;
    });

    const topMovies = Array.from(movieStatsMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    res.json({
      totalRevenue, totalBookings, totalShows, totalVenues,
      cancelledCount, totalSeats, seatsSold, occupancyRate,
      estimatedProfit, estimatedCost,
      onlineBookings, offlineBookings,
      onlineRevenue,  offlineRevenue,
      dailyRevenue,
      topMovies,
      movieTitles: Array.from(allMovieTitles),
    });

  } catch (error) {
    console.error("getPartnerAnalytics error:", error);
    res.status(500).json({ message: error.message });
  }
};