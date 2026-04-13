import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import Venue from "../models/Venue.js";
import Movie from "../models/Movie.js";
import User from "../models/User.js";

export const getPartnerBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 5,
      search = "",
      customerFilter = "",
      status = "ALL",
      date = "",
      source = "ALL",        // NEW: "ONLINE" | "OFFLINE" | "ALL"
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page,  10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const skip     = (pageNum - 1) * limitNum;

    // ── Partner's shows ───────────────────────────────────────────────────────
    const partnerShows = await Show.find({ createdBy: req.user.id });

    if (partnerShows.length === 0) {
      return res.json({
        bookings: [],
        totalBookings: 0,
        totalPages: 0,
        currentPage: pageNum,
        summary: { total: 0, confirmed: 0, cancelled: 0, pending: 0, totalRevenue: 0 },
      });
    }

    // Filter shows by date if provided
    let filteredShows = partnerShows;
    if (date) {
      filteredShows = partnerShows.filter((s) => s.showDate === date);
    }

    let showIds = filteredShows.map((s) => String(s._id));

    // Pre-load movies + venues for show-level filtering
    const allMovieIds = [...new Set(partnerShows.map((s) => String(s.movieId)))];
    const allVenueIds = [...new Set(partnerShows.map((s) => String(s.venueId)))];

    const movies = await Movie.find({ _id: { $in: allMovieIds } });
    const venues = await Venue.find({ _id: { $in: allVenueIds } });

    const movieMap = new Map(movies.map((m) => [String(m._id), m]));
    const venueMap = new Map(venues.map((v) => [String(v._id), v]));
    const showMap  = new Map(partnerShows.map((s) => [String(s._id), s]));

    // Filter showIds by search (movie title / venue name)
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      showIds = showIds.filter((id) => {
        const show  = showMap.get(id);
        if (!show) return false;
        const movie = movieMap.get(String(show.movieId));
        const venue = venueMap.get(String(show.venueId));
        return (
          movie?.title?.toLowerCase().includes(q) ||
          venue?.name?.toLowerCase().includes(q)
        );
      });
    }

    // Build booking query
    const bookingQuery = { showId: { $in: showIds } };
    if (status && status !== "ALL") bookingQuery.status = status;
    if (source && source !== "ALL") bookingQuery.source = source;   // NEW

    // Fetch all matching bookings (pre-pagination) for summary + customer filter
    let allBookings = await Booking.find(bookingQuery).sort({ createdAt: -1 });

    // Load users (for online bookings with userId)
    const userIds = [
      ...new Set(
        allBookings
          .map((b) => b.userId)
          .filter(Boolean)
          .map((id) => String(id))
      ),
    ];
    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } }).select("name email")
      : [];
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    // Load bookedBy agents (for offline bookings)
    const bookedByIds = [
      ...new Set(
        allBookings
          .map((b) => b.bookedBy)
          .filter(Boolean)
          .map((id) => String(id))
      ),
    ];
    const agents = bookedByIds.length
      ? await User.find({ _id: { $in: bookedByIds } }).select("name email")
      : [];
    const agentMap = new Map(agents.map((u) => [String(u._id), u]));

    // Apply customer filter (booking code + user name/email + customerName + customerPhone)
    if (customerFilter.trim()) {
      const qc = customerFilter.trim().toLowerCase();
      allBookings = allBookings.filter((b) => {
        const user = userMap.get(String(b.userId));
        return (
          String(b.bookingCode).toLowerCase().includes(qc) ||
          user?.name?.toLowerCase().includes(qc)           ||
          user?.email?.toLowerCase().includes(qc)          ||
          b.customerName?.toLowerCase().includes(qc)       ||   // walk-in name
          b.customerPhone?.includes(qc)                         // phone
        );
      });
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    const summary = {
      total:        allBookings.length,
      confirmed:    allBookings.filter((b) => b.status === "CONFIRMED").length,
      cancelled:    allBookings.filter((b) => b.status === "CANCELLED").length,
      pending:      allBookings.filter((b) => b.status === "PENDING").length,
      totalRevenue: allBookings
        .filter((b) => b.status === "CONFIRMED")
        .reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0),
    };

    const totalBookings = allBookings.length;
    const totalPages    = Math.max(1, Math.ceil(totalBookings / limitNum));

    // ── Paginate ──────────────────────────────────────────────────────────────
    const pageBookings = allBookings.slice(skip, skip + limitNum);

    // ── Shape each booking for the frontend ───────────────────────────────────
    const result = pageBookings.map((booking) => {
      const show    = showMap.get(String(booking.showId));
      const venue   = show ? venueMap.get(String(show.venueId)) : null;
      const movie   = show ? movieMap.get(String(show.movieId)) : null;
      const user    = userMap.get(String(booking.userId));
      const agent   = agentMap.get(String(booking.bookedBy));

      // For offline bookings: prefer customerName, fallback to user name
      const isOffline    = booking.source === "OFFLINE";
      const displayName  = isOffline
        ? (booking.customerName || user?.name || "Walk-in Customer")
        : (user?.name || "Unknown User");
      const displayEmail = isOffline ? "" : (user?.email || "");

      return {
        bookingId:     String(booking.bookingCode),
        source:        booking.source || "ONLINE",           // NEW
        // Customer info
        userName:      displayName,
        userEmail:     displayEmail,
        customerName:  booking.customerName || "",           // NEW – raw walk-in name
        customerPhone: booking.customerPhone || "",          // NEW
        // Booked-by agent (offline)
        bookedByName:  agent?.name  || "",                  // NEW
        bookedByEmail: agent?.email || "",                  // NEW
        // Show / movie / venue
        movieTitle:    movie?.title   || "Unknown Movie",
        venueName:     venue?.name    || "Unknown Venue",
        showDate:      show?.showDate || "",
        showTime:      show?.showTime || "",
        seats:         Array.isArray(booking.seats) ? booking.seats.length : 0,
        seatNumbers:   booking.seats || [],
        amount:        Number(booking.totalAmount) || 0,
        // Status
        status:        booking.status        || "PENDING",
        paymentStatus: booking.paymentStatus || "PENDING",
        paymentMethod: booking.paymentMethod || "",          // NEW
        createdAt:     booking.createdAt,
      };
    });

    res.json({
      bookings: result,
      totalBookings,
      totalPages,
      currentPage: pageNum,
      summary,
    });
  } catch (error) {
    console.error("getPartnerBookings error:", error);
    res.status(500).json({ message: error.message });
  }
};