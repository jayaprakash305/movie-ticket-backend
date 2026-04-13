import Booking from "../models/Booking.js"
import Show from "../models/Show.js"
import Venue from "../models/Venue.js"
import Movie from "../models/Movie.js"

export const getPartnerDashboard = async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

    // ── Get all partner shows ────────────────────────────────────────────────
    const allShows = await Show.find({ createdBy: req.user.id })
    const showIds  = allShows.map(s => String(s._id))

    // ── Today's shows ────────────────────────────────────────────────────────
    const todayShows = allShows.filter(s => s.showDate === today && s.isActive)

    // ── Tomorrow's shows ─────────────────────────────────────────────────────
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)
    const tomorrowShows = allShows.filter(s => s.showDate === tomorrowStr && s.isActive)

    // ── All bookings for partner shows ───────────────────────────────────────
    const allBookings = await Booking.find({
      showId: { $in: showIds },
      status: { $in: ["CONFIRMED", "CANCELLED"] },
    }).sort({ createdAt: -1 })

    const confirmedAll = allBookings.filter(b => b.status === "CONFIRMED")

    // ── Today's bookings ─────────────────────────────────────────────────────
    const todayStart = new Date(today + "T00:00:00.000Z")
    const todayEnd   = new Date(today + "T23:59:59.999Z")

    const todayBookings = allBookings.filter(b => {
      const created = new Date(b.createdAt)
      return created >= todayStart && created <= todayEnd
    })
    const todayConfirmed  = todayBookings.filter(b => b.status === "CONFIRMED")
    const todayRevenue    = todayConfirmed.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0)
    const todayCancelled  = todayBookings.filter(b => b.status === "CANCELLED").length
    const todaySeatsSold  = todayConfirmed.reduce((s, b) => s + (Array.isArray(b.seats) ? b.seats.length : 0), 0)

    // ── Total stats ──────────────────────────────────────────────────────────
    const totalRevenue   = confirmedAll.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0)
    const totalBookings  = allBookings.length
    const totalVenues    = new Set(allShows.map(s => String(s.venueId))).size

    // ── Last 7 days revenue trend ────────────────────────────────────────────
    const trend = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr  = d.toISOString().slice(0, 10)
      const dayStart = new Date(dateStr + "T00:00:00.000Z")
      const dayEnd   = new Date(dateStr + "T23:59:59.999Z")
      const dayBooks = allBookings.filter(b => {
        const c = new Date(b.createdAt)
        return c >= dayStart && c <= dayEnd && b.status === "CONFIRMED"
      })
      trend.push({
        date:     dateStr,
        name:     d.toLocaleDateString("en-IN", { weekday:"short" }),
        revenue:  dayBooks.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0),
        bookings: dayBooks.length,
      })
    }

    // ── Recent bookings (last 8) ─────────────────────────────────────────────
    const recentRaw = allBookings.slice(0, 8)
    const recentShowIds  = [...new Set(recentRaw.map(b => String(b.showId)))]
    const recentVenueIds = [...new Set(recentRaw.map(b => String(b.venueId)))]

    const recentShows  = await Show.find({ _id: { $in: recentShowIds } })
    const recentVenues = await Venue.find({ _id: { $in: recentVenueIds } })
    const movieIds     = [...new Set(recentShows.map(s => String(s.movieId)))]
    const recentMovies = await Movie.find({ _id: { $in: movieIds } })

    const showMap  = new Map(recentShows.map(s => [String(s._id), s]))
    const venueMap = new Map(recentVenues.map(v => [String(v._id), v]))
    const movieMap = new Map(recentMovies.map(m => [String(m._id), m]))

    const recentBookings = recentRaw.map(b => {
      const show  = showMap.get(String(b.showId))
      const venue = venueMap.get(String(b.venueId))
      const movie = show ? movieMap.get(String(show.movieId)) : null
      return {
        id:         String(b._id),
        movieTitle: movie?.title || "Unknown",
        venueName:  venue?.name  || "Unknown",
        showDate:   show?.showDate  || "",
        showTime:   show?.showTime  || "",
        seats:      Array.isArray(b.seats) ? b.seats.length : 0,
        amount:     Number(b.totalAmount) || 0,
        status:     b.status,
        createdAt:  b.createdAt,
      }
    })

    // ── Upcoming shows (today + tomorrow) ────────────────────────────────────
    const upcomingShowIds  = [...todayShows, ...tomorrowShows].map(s => String(s._id))
    const upcomingMovieIds = [...new Set([...todayShows, ...tomorrowShows].map(s => String(s.movieId)))]
    const upcomingVenueIds = [...new Set([...todayShows, ...tomorrowShows].map(s => String(s.venueId)))]

    const upMovies = await Movie.find({ _id: { $in: upcomingMovieIds } })
    const upVenues = await Venue.find({ _id: { $in: upcomingVenueIds } })
    const upMovieMap = new Map(upMovies.map(m => [String(m._id), m]))
    const upVenueMap = new Map(upVenues.map(v => [String(v._id), v]))

    const mapShow = (show, label) => ({
      id:         String(show._id),
      movieTitle: upMovieMap.get(String(show.movieId))?.title || "Unknown",
      posterUrl:  upMovieMap.get(String(show.movieId))?.posterUrl || "",
      venueName:  upVenueMap.get(String(show.venueId))?.name  || "Unknown",
      showDate:   show.showDate,
      showTime:   show.showTime,
      price:      show.price,
      totalSeats: show.totalSeats,
      availableSeats: show.availableSeats,
      label,
    })

    const upcomingShows = [
      ...todayShows.map(s => mapShow(s, "today")),
      ...tomorrowShows.map(s => mapShow(s, "tomorrow")),
    ].sort((a, b) => a.showTime.localeCompare(b.showTime))

    res.json({
      today: {
        date:         today,
        revenue:      todayRevenue,
        bookings:     todayBookings.length,
        confirmed:    todayConfirmed.length,
        cancelled:    todayCancelled,
        seatsSold:    todaySeatsSold,
        showsRunning: todayShows.length,
      },
      totals: {
        revenue:   totalRevenue,
        bookings:  totalBookings,
        shows:     allShows.filter(s => s.isActive).length,
        venues:    totalVenues,
      },
      revenueTrend:    trend,
      recentBookings,
      upcomingShows,
    })
  } catch (err) {
    console.error("getPartnerDashboard error:", err)
    res.status(500).json({ message: err.message })
  }
}