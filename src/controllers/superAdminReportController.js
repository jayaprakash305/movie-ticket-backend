import User from "../models/User.js"
import Venue from "../models/Venue.js"
import Show from "../models/Show.js"
import Booking from "../models/Booking.js"

// ── helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10)

const currentTimeStr = () => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
}

const isRunningNow = (show) => {
  const today = todayStr()
  const nowTime = currentTimeStr()
  if (!show?.showDate || !show?.showTime || !show?.showEndTime) return false
  if (show.showDate !== today) return false
  return show.showTime <= nowTime && nowTime <= show.showEndTime
}

const isUpcoming = (show) => {
  const today = todayStr()
  const nowTime = currentTimeStr()
  if (!show?.showDate || !show?.showTime) return false
  if (show.showDate > today) return true
  if (show.showDate === today && show.showTime > nowTime) return true
  return false
}

/** Parse optional booking window from query. Default: all time (no date filter). */
const parseBookingStatsPeriod = (query) => {
  const fromRaw = query.from != null ? String(query.from).trim() : ""
  const toRaw = query.to != null ? String(query.to).trim() : ""
  const hasRange = Boolean(fromRaw || toRaw)

  if (hasRange) {
    let start = null
    let end = null
    if (fromRaw) {
      start = new Date(fromRaw)
      if (Number.isNaN(start.getTime())) {
        return { error: "Invalid `from` date (use YYYY-MM-DD)" }
      }
      start.setHours(0, 0, 0, 0)
    }
    if (toRaw) {
      end = new Date(toRaw)
      if (Number.isNaN(end.getTime())) {
        return { error: "Invalid `to` date (use YYYY-MM-DD)" }
      }
      end.setHours(23, 59, 59, 999)
    }
    return { mode: "range", start, end, days: null }
  }

  if (query.days != null && String(query.days).trim() !== "") {
    const n = Number.parseInt(String(query.days), 10)
    if (Number.isNaN(n) || n < 1) {
      return { error: "`days` must be a positive integer" }
    }
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - (n - 1))
    return { mode: "days", start, end: null, days: n }
  }

  return { mode: "all", start: null, end: null, days: null }
}

const buildBookingDateFilter = (period) => {
  const f = {}
  if (period.start) f.$gte = period.start
  if (period.end) f.$lte = period.end
  return Object.keys(f).length ? f : null
}

const emptyStats = () => ({
  totalBookings: 0, totalTickets: 0, totalRevenue: 0,
  onlineBookings: 0, onlineTickets: 0, onlineRevenue: 0,
  offlineBookings: 0, offlineTickets: 0, offlineRevenue: 0,
})

const addStats = (acc, s) => {
  acc.totalBookings   += s.totalBookings   || 0
  acc.totalTickets    += s.totalTickets    || 0
  acc.totalRevenue    += s.totalRevenue    || 0
  acc.onlineBookings  += s.onlineBookings  || 0
  acc.onlineTickets   += s.onlineTickets   || 0
  acc.onlineRevenue   += s.onlineRevenue   || 0
  acc.offlineBookings += s.offlineBookings || 0
  acc.offlineTickets  += s.offlineTickets  || 0
  acc.offlineRevenue  += s.offlineRevenue  || 0
}

// ── main report ──────────────────────────────────────────────────────────────
export const getPartnerTheatreHierarchyReport = async (req, res) => {
  try {
    const period = parseBookingStatsPeriod(req.query)
    if (period.error) {
      return res.status(400).json({ message: period.error })
    }
    const createdAtFilter = buildBookingDateFilter(period)

    // 1) Load all approved partners
    const partners = await User.find({ role: "MANAGER", isActive: true })
      .select("name email role createdAt")
      .sort({ createdAt: -1 })

    // 2) Load all active venues
    const venues = await Venue.find({ isActive: true })
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 })

    // 3) Load all active shows
    const shows = await Show.find({ isActive: true })
      .populate("movieId", "title posterUrl duration genre language")
      .sort({ showDate: 1, showTime: 1 })

    // 4) Load confirmed+paid bookings (optional window: ?days=7 or ?from=&to=)
    const bookingQuery = {
      status: "CONFIRMED",
      paymentStatus: "PAID",
    }
    if (createdAtFilter) bookingQuery.createdAt = createdAtFilter
    const bookings = await Booking.find(bookingQuery).select(
      "showId venueId totalAmount seats source createdAt"
    )

    // 5) Build stats map: showId → stats (with online/offline split)
    const bookingStatsByShowId = new Map()

    for (const booking of bookings) {
      const showId     = String(booking.showId)
      const seatsCount = Array.isArray(booking.seats) ? booking.seats.length : 0
      const amount     = Number(booking.totalAmount || 0)
      const isOnline   = (booking.source || "ONLINE") === "ONLINE"

      if (!bookingStatsByShowId.has(showId)) {
        bookingStatsByShowId.set(showId, emptyStats())
      }

      const b = bookingStatsByShowId.get(showId)
      b.totalBookings += 1
      b.totalTickets  += seatsCount
      b.totalRevenue  += amount

      if (isOnline) {
        b.onlineBookings += 1; b.onlineTickets += seatsCount; b.onlineRevenue += amount
      } else {
        b.offlineBookings += 1; b.offlineTickets += seatsCount; b.offlineRevenue += amount
      }
    }

    // 6) Group venues by partner — check BOTH createdBy AND partnerId
    //    so venues created before partnerId was a field still appear
    const venuesByPartnerId = new Map()
    for (const venue of venues) {
      // A venue belongs to a partner if either field matches
      const ownerIds = new Set()
      if (venue.createdBy?._id || venue.createdBy) {
        ownerIds.add(String(venue.createdBy._id || venue.createdBy))
      }
      if (venue.partnerId) {
        ownerIds.add(String(venue.partnerId))
      }

      for (const ownerId of ownerIds) {
        if (!venuesByPartnerId.has(ownerId)) venuesByPartnerId.set(ownerId, [])
        // Avoid duplicate venues if both fields point to the same partner
        const existing = venuesByPartnerId.get(ownerId)
        if (!existing.find(v => String(v._id) === String(venue._id))) {
          existing.push(venue)
        }
      }
    }

    // 7) Group shows by venue
    const showsByVenueId = new Map()
    for (const show of shows) {
      const venueId = String(show.venueId)
      if (!showsByVenueId.has(venueId)) showsByVenueId.set(venueId, [])
      showsByVenueId.get(venueId).push(show)
    }

    // 8) Build the nested report
    const report = []

    for (const partner of partners) {
      const partnerId  = String(partner._id)
      const ownedVenues = venuesByPartnerId.get(partnerId) || []

      const theatres = ownedVenues.map((venue) => {
        const venueId    = String(venue._id)
        const venueShows = showsByVenueId.get(venueId) || []
        const theatreStats = emptyStats()

        // Map screens
        const screens = (venue.screens || []).map((screen) => {
          const screenId     = String(screen._id)
          const screenShows  = venueShows.filter(s => String(s.screenId || "") === screenId)
          const screenStats  = emptyStats()

          const formattedShows = screenShows.map((show) => {
            const rawStats = bookingStatsByShowId.get(String(show._id)) || emptyStats()
            addStats(screenStats, rawStats)

            return {
              id: String(show._id),
              movie: show.movieId ? {
                id:       String(show.movieId._id),
                title:    show.movieId.title,
                posterUrl:show.movieId.posterUrl,
                duration: show.movieId.duration,
                genre:    show.movieId.genre,
                language: show.movieId.language,
              } : null,
              showDate:       show.showDate,
              showTime:       show.showTime,
              showEndTime:    show.showEndTime || null,
              price:          show.price,
              totalSeats:     show.totalSeats,
              availableSeats: show.availableSeats,
              isRunningNow:   isRunningNow(show),
              isUpcoming:     isUpcoming(show),
              statsLast7Days: { ...rawStats },
            }
          })

          addStats(theatreStats, screenStats)

          return {
            id:            String(screen._id),
            screenName:    screen.screenName,
            totalSeats:    screen.totalSeats,
            runningShows:  formattedShows.filter(s => s.isRunningNow),
            upcomingShows: formattedShows.filter(s => s.isUpcoming),
            allShows:      formattedShows,
            statsLast7Days: screenStats,
          }
        })

        // Fallback: shows with no screenId
        const unslottedShows = venueShows.filter(show => !show.screenId)
        if (unslottedShows.length > 0) {
          const screenStats = emptyStats()
          const formattedShows = unslottedShows.map((show) => {
            const rawStats = bookingStatsByShowId.get(String(show._id)) || emptyStats()
            addStats(screenStats, rawStats)
            addStats(theatreStats, rawStats)
            return {
              id: String(show._id),
              movie: show.movieId ? {
                id: String(show.movieId._id), title: show.movieId.title,
                posterUrl: show.movieId.posterUrl, duration: show.movieId.duration,
                genre: show.movieId.genre, language: show.movieId.language,
              } : null,
              showDate: show.showDate, showTime: show.showTime,
              showEndTime: show.showEndTime || null,
              price: show.price, totalSeats: show.totalSeats,
              availableSeats: show.availableSeats,
              isRunningNow: isRunningNow(show), isUpcoming: isUpcoming(show),
              statsLast7Days: { ...rawStats },
            }
          })
          screens.push({
            id: "no-screen", screenName: "Unassigned Screen", totalSeats: 0,
            runningShows:  formattedShows.filter(s => s.isRunningNow),
            upcomingShows: formattedShows.filter(s => s.isUpcoming),
            allShows:      formattedShows,
            statsLast7Days: screenStats,
          })
        }

        return {
          id:      venueId,
          name:    venue.name,
          city:    venue.city,
          area:    venue.area,
          address: venue.address,
          amenities: venue.amenities,
          screenName: venue.screenName || "",
          totalSeats: venue.totalSeats || 0,
          createdBy: venue.createdBy?._id || venue.createdBy || null,
          createdByUser: venue.createdBy ? {
            id:    String(venue.createdBy._id || venue.createdBy),
            name:  venue.createdBy.name  || "",
            email: venue.createdBy.email || "",
            role:  venue.createdBy.role  || "",
          } : null,
          totalScreens: screens.length,
          screens,
          statsLast7Days: theatreStats,
        }
      })

      report.push({
        partnerId: String(partner._id),
        partner: {
          id:    String(partner._id),
          name:  partner.name,
          email: partner.email,
          role:  partner.role,
        },
        totalTheatresOwned: theatres.length,
        theatres,
      })
    }

    res.json({
      generatedAt: new Date(),
      /** @deprecated Use bookingStatsPeriod.from */
      last7DaysFrom: period.start,
      bookingStatsPeriod: {
        mode: period.mode,
        from: period.start,
        to:   period.end,
        days: period.days,
      },
      partners: report,
    })
  } catch (error) {
    console.error("getPartnerTheatreHierarchyReport error:", error)
    res.status(500).json({ message: error.message || "Failed to load report" })
  }
} 

export const getPartnerBusinessOverview = async (req, res) => {
  try {
    const period = parseBookingStatsPeriod(req.query)
    if (period.error) {
      return res.status(400).json({ message: period.error })
    }

    const createdAtFilter = buildBookingDateFilter(period)

    const partners = await User.find({
      role: "MANAGER",
      isActive: true,
      approvalStatus: "APPROVED",
    })
      .select("name email createdAt")
      .sort({ createdAt: -1 })

    const agents = await User.find({
      role: "AGENT",
    }).select("name email partnerId approvalStatus isActive")

    const venues = await Venue.find({
      isActive: true,
    }).select("name city area createdBy partnerId screens totalSeats")

    const shows = await Show.find({
      isActive: true,
    }).select("movieId venueId partnerId showDate showTime showEndTime price totalSeats availableSeats")

    const bookingQuery = {
      status: "CONFIRMED",
      paymentStatus: "PAID",
    }
    if (createdAtFilter) bookingQuery.createdAt = createdAtFilter

    const bookings = await Booking.find(bookingQuery).select(
      "showId venueId totalAmount seats source createdAt"
    )

    const venuesByPartner = new Map()
    for (const venue of venues) {
      const ownerIds = new Set()
      if (venue.createdBy) ownerIds.add(String(venue.createdBy))
      if (venue.partnerId) ownerIds.add(String(venue.partnerId))

      for (const partnerId of ownerIds) {
        if (!venuesByPartner.has(partnerId)) venuesByPartner.set(partnerId, [])
        const arr = venuesByPartner.get(partnerId)
        if (!arr.find(v => String(v._id) === String(venue._id))) arr.push(venue)
      }
    }

    const agentsByPartner = new Map()
    for (const agent of agents) {
      const pid = String(agent.partnerId || "")
      if (!pid) continue
      if (!agentsByPartner.has(pid)) agentsByPartner.set(pid, [])
      agentsByPartner.get(pid).push(agent)
    }

    const showsByPartner = new Map()
    for (const show of shows) {
      const pid = String(show.partnerId || "")
      if (!pid) continue
      if (!showsByPartner.has(pid)) showsByPartner.set(pid, [])
      showsByPartner.get(pid).push(show)
    }

    const bookingStatsByShowId = new Map()
    for (const booking of bookings) {
      const sid = String(booking.showId || "")
      if (!sid) continue

      if (!bookingStatsByShowId.has(sid)) {
        bookingStatsByShowId.set(sid, {
          totalBookings: 0,
          totalTickets: 0,
          totalRevenue: 0,
          onlineBookings: 0,
          onlineTickets: 0,
          onlineRevenue: 0,
          offlineBookings: 0,
          offlineTickets: 0,
          offlineRevenue: 0,
        })
      }

      const stats = bookingStatsByShowId.get(sid)
      const seatsCount = Array.isArray(booking.seats) ? booking.seats.length : 0
      const amount = Number(booking.totalAmount || 0)
      const isOnline = (booking.source || "ONLINE") === "ONLINE"

      stats.totalBookings += 1
      stats.totalTickets += seatsCount
      stats.totalRevenue += amount

      if (isOnline) {
        stats.onlineBookings += 1
        stats.onlineTickets += seatsCount
        stats.onlineRevenue += amount
      } else {
        stats.offlineBookings += 1
        stats.offlineTickets += seatsCount
        stats.offlineRevenue += amount
      }
    }

    const partnerRows = partners.map((partner) => {
      const partnerId = String(partner._id)
      const partnerAgents = agentsByPartner.get(partnerId) || []
      const partnerVenues = venuesByPartner.get(partnerId) || []
      const partnerShows = showsByPartner.get(partnerId) || []

      const totals = {
        totalBookings: 0,
        totalTickets: 0,
        totalRevenue: 0,
        onlineBookings: 0,
        onlineTickets: 0,
        onlineRevenue: 0,
        offlineBookings: 0,
        offlineTickets: 0,
        offlineRevenue: 0,
      }

      for (const show of partnerShows) {
        const s = bookingStatsByShowId.get(String(show._id))
        if (!s) continue
        totals.totalBookings += s.totalBookings
        totals.totalTickets += s.totalTickets
        totals.totalRevenue += s.totalRevenue
        totals.onlineBookings += s.onlineBookings
        totals.onlineTickets += s.onlineTickets
        totals.onlineRevenue += s.onlineRevenue
        totals.offlineBookings += s.offlineBookings
        totals.offlineTickets += s.offlineTickets
        totals.offlineRevenue += s.offlineRevenue
      }

      return {
        partner: {
          id: String(partner._id),
          name: partner.name || "",
          email: partner.email || "",
          createdAt: partner.createdAt,
        },
        counts: {
          agents: partnerAgents.length,
          activeAgents: partnerAgents.filter(a => a.isActive).length,
          pendingAgents: partnerAgents.filter(a => a.approvalStatus === "PENDING").length,
          theatres: partnerVenues.length,
          screens: partnerVenues.reduce((sum, v) => sum + (v.screens?.length || 0), 0),
          shows: partnerShows.length,
        },
        bookings: {
          total: totals.totalBookings,
          online: totals.onlineBookings,
          offline: totals.offlineBookings,
          tickets: totals.totalTickets,
          onlineTickets: totals.onlineTickets,
          offlineTickets: totals.offlineTickets,
        },
        revenue: {
          total: totals.totalRevenue,
          online: totals.onlineRevenue,
          offline: totals.offlineRevenue,
        },
      }
    })

    const summary = partnerRows.reduce(
      (acc, row) => {
        acc.totalPartners += 1
        acc.totalAgents += row.counts.agents
        acc.totalActiveAgents += row.counts.activeAgents
        acc.totalPendingAgents += row.counts.pendingAgents
        acc.totalTheatres += row.counts.theatres
        acc.totalScreens += row.counts.screens
        acc.totalShows += row.counts.shows
        acc.totalBookings += row.bookings.total
        acc.onlineBookings += row.bookings.online
        acc.offlineBookings += row.bookings.offline
        acc.totalRevenue += row.revenue.total
        acc.onlineRevenue += row.revenue.online
        acc.offlineRevenue += row.revenue.offline
        return acc
      },
      {
        totalPartners: 0,
        totalAgents: 0,
        totalActiveAgents: 0,
        totalPendingAgents: 0,
        totalTheatres: 0,
        totalScreens: 0,
        totalShows: 0,
        totalBookings: 0,
        onlineBookings: 0,
        offlineBookings: 0,
        totalRevenue: 0,
        onlineRevenue: 0,
        offlineRevenue: 0,
      }
    )

    res.json({
      generatedAt: new Date(),
      bookingStatsPeriod: {
        mode: period.mode,
        from: period.start,
        to: period.end,
        days: period.days,
      },
      summary,
      partners: partnerRows.sort((a, b) => b.revenue.total - a.revenue.total),
    })
  } catch (error) {
    console.error("getPartnerBusinessOverview error:", error)
    res.status(500).json({ message: error.message || "Failed to load partner business overview" })
  }
}