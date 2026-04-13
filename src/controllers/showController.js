import Show from "../models/Show.js"
import Movie from "../models/Movie.js"
import Venue from "../models/Venue.js"

// ── Helper: check for time conflict on same screen ───────────────────────────
const hasTimeConflict = async ({ screenId, showDate, showTime, showEndTime, excludeShowId }) => {
  if (!screenId || !showDate || !showTime || !showEndTime) return null

  const toMins = (t) => {
    const [h, m] = t.split(":").map(Number)
    return h * 60 + m
  }

  const newStart = toMins(showTime)
  const newEnd = toMins(showEndTime)

  const query = {
    screenId,
    showDate,
    isActive: true,
    ...(excludeShowId ? { _id: { $ne: excludeShowId } } : {}),
  }

  const existing = await Show.find(query).select("showTime showEndTime movieId")

  for (const show of existing) {
    if (!show.showTime || !show.showEndTime) continue
    const exStart = toMins(show.showTime)
    const exEnd = toMins(show.showEndTime)

    if (newStart < exEnd && newEnd > exStart) {
      const movie = await Movie.findById(show.movieId).select("title")
      return {
        conflictingShow: show,
        conflictingMovie: movie?.title || "Another show",
        message: `Time conflict: "${movie?.title || "Another show"}" runs ${show.showTime}–${show.showEndTime} on this screen.`,
      }
    }
  }

  return null
}

// ── Create show ───────────────────────────────────────────────────────────────
export const createPartnerShow = async (req, res) => {
  try {
    const { movieId, venueId, screenId, showDate, showTime, showEndTime, price, totalSeats } = req.body

    if (!movieId || !venueId || !showDate || !showTime || !price) {
      return res.status(400).json({ message: "Required show fields are missing" })
    }

    const movie = await Movie.findById(movieId)
    if (!movie || !movie.isActive) {
      return res.status(404).json({ message: "Movie not found" })
    }

    const ownerId = req.user.partnerId && req.user.role === "AGENT"
      ? req.user.partnerId
      : (req.user._id || req.user.id)

    const venue = await Venue.findOne({
      _id: venueId,
      partnerId: ownerId,
      isActive: true,
    })

    if (!venue) {
      return res.status(404).json({ message: "Venue not found" })
    }

    let resolvedSeats = Number(totalSeats) || 0
    let resolvedScreenName = ""

    if (screenId) {
      const screen = (venue.screens || []).find(s => String(s._id) === String(screenId))
      if (!screen) return res.status(404).json({ message: "Screen not found in this venue" })

      resolvedSeats = screen.totalSeats
      resolvedScreenName = screen.screenName
    }

    if (!resolvedSeats || resolvedSeats < 1) {
      return res.status(400).json({ message: "Could not determine total seats — select a valid screen" })
    }

    let computedEndTime = showEndTime
    if (!computedEndTime && movie.duration && showTime) {
      const [h, m] = showTime.split(":").map(Number)
      const totalMin = h * 60 + m + Number(movie.duration)
      computedEndTime = `${String(Math.floor(totalMin / 60) % 24).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`
    }

    if (screenId && computedEndTime) {
      const conflict = await hasTimeConflict({
        screenId,
        showDate,
        showTime,
        showEndTime: computedEndTime,
      })

      if (conflict) {
        return res.status(409).json({
          message: conflict.message,
          conflict: true,
          conflictingShow: String(conflict.conflictingShow._id),
        })
      }
    }

    const show = await Show.create({
      movieId,
      venueId,
      screenId: screenId || null,
      screenName: resolvedScreenName,
      showDate,
      showTime,
      showEndTime: computedEndTime || null,
      price: Number(price),
      totalSeats: resolvedSeats,
      availableSeats: resolvedSeats,
      createdBy: req.user._id || req.user.id,
      partnerId: venue.partnerId,
      isActive: true,
    })

    res.status(201).json({
      message: "Show created successfully",
      show: {
        id: String(show._id),
        screenName: resolvedScreenName,
        totalSeats: resolvedSeats,
        showEndTime: computedEndTime,
      },
    })
  } catch (error) {
    console.error("createPartnerShow error:", error)
    res.status(500).json({ message: error.message })
  }
}

// ── Update show ───────────────────────────────────────────────────────────────
export const updatePartnerShow = async (req, res) => {
  try {
    const { showId } = req.params
    const { movieId, venueId, screenId, showDate, showTime, showEndTime, price, totalSeats } = req.body

    const ownerId = req.user.partnerId && req.user.role === "AGENT"
      ? req.user.partnerId
      : (req.user._id || req.user.id)

    const show = await Show.findOne({
      _id: showId,
      isActive: true,
      partnerId: ownerId,
    })

    if (!show) return res.status(404).json({ message: "Show not found" })

    let targetVenue = null
    if (venueId) {
      targetVenue = await Venue.findOne({
        _id: venueId,
        partnerId: ownerId,
        isActive: true,
      })

      if (!targetVenue) {
        return res.status(404).json({ message: "Venue not found" })
      }
    } else {
      targetVenue = await Venue.findOne({
        _id: show.venueId,
        partnerId: ownerId,
        isActive: true,
      })
    }

    let computedEndTime = showEndTime
    if (!computedEndTime && showTime) {
      const movie = await Movie.findById(movieId || show.movieId).select("duration")
      if (movie?.duration) {
        const [h, m] = showTime.split(":").map(Number)
        const totalMin = h * 60 + m + Number(movie.duration)
        computedEndTime = `${String(Math.floor(totalMin / 60) % 24).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`
      }
    }

    const effectiveScreenId = screenId || show.screenId
    if (effectiveScreenId && computedEndTime) {
      const conflict = await hasTimeConflict({
        screenId: effectiveScreenId,
        showDate: showDate || show.showDate,
        showTime: showTime || show.showTime,
        showEndTime: computedEndTime,
        excludeShowId: show._id,
      })

      if (conflict) {
        return res.status(409).json({
          message: conflict.message,
          conflict: true,
        })
      }
    }

    let resolvedSeats = totalSeats ? Number(totalSeats) : show.totalSeats
    let resolvedScreenName = show.screenName

    if (effectiveScreenId && targetVenue) {
      const screen = (targetVenue.screens || []).find(
        s => String(s._id) === String(effectiveScreenId)
      )

      if (!screen) {
        return res.status(404).json({ message: "Screen not found in this venue" })
      }

      resolvedSeats = screen.totalSeats
      resolvedScreenName = screen.screenName
    }

    if (movieId) show.movieId = movieId
    if (venueId) {
      show.venueId = venueId
      show.partnerId = targetVenue.partnerId
    }
    if (screenId) show.screenId = screenId
    if (showDate) show.showDate = showDate
    if (showTime) show.showTime = showTime
    if (computedEndTime) show.showEndTime = computedEndTime
    if (price !== undefined) show.price = Number(price)

    show.totalSeats = resolvedSeats
    show.screenName = resolvedScreenName

    await show.save()

    res.json({
      message: "Show updated successfully",
      showEndTime: computedEndTime || show.showEndTime,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ── Get partner shows (only active) ──────────────────────────────────────────
export const getPartnerShows = async (req, res) => {
  try {
    let ownerId = req.user._id || req.user.id

    if (req.user.role === "AGENT") {
      if (!req.user.partnerId) {
        return res.status(403).json({ message: "Agent is not linked to a partner" })
      }
      ownerId = req.user.partnerId
    }

    const today = new Date().toISOString().slice(0, 10)

    let query = {
      partnerId: ownerId,
      isActive: true,
      showDate: { $gte: today },
    }

    if (
      req.user.role === "AGENT" &&
      Array.isArray(req.user.venueIds) &&
      req.user.venueIds.length > 0
    ) {
      query.venueId = { $in: req.user.venueIds }
    }

    const shows = await Show.find(query)
      .populate("movieId", "title posterUrl duration genre language")
      .populate("venueId", "name city area")
      .sort({ showDate: 1, showTime: 1 })

    res.json(
      shows.map((s) => ({
        id: String(s._id),
        movieId: String(s.movieId?._id || s.movieId || ""),
        movie: s.movieId
          ? {
              id: String(s.movieId._id),
              title: s.movieId.title,
              posterUrl: s.movieId.posterUrl,
              duration: s.movieId.duration,
              genre: s.movieId.genre,
              language: s.movieId.language,
            }
          : null,
        venueId: String(s.venueId?._id || s.venueId || ""),
        venue: s.venueId
          ? {
              id: String(s.venueId._id),
              name: s.venueId.name,
              city: s.venueId.city,
            }
          : null,
        screenId: s.screenId ? String(s.screenId) : null,
        screenName: s.screenName || "",
        showDate: s.showDate,
        showTime: s.showTime,
        showEndTime: s.showEndTime || null,
        price: s.price,
        totalSeats: s.totalSeats,
        availableSeats: s.availableSeats,
        isActive: s.isActive,
      }))
    )
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ── Delete show (soft delete) ─────────────────────────────────────────────────
export const deletePartnerShow = async (req, res) => {
  try {
    const { showId } = req.params

    const ownerId = req.user.partnerId && req.user.role === "AGENT"
      ? req.user.partnerId
      : (req.user._id || req.user.id)

    const show = await Show.findOne({
      _id: showId,
      isActive: true,
      partnerId: ownerId,
    })

    if (!show) return res.status(404).json({ message: "Show not found" })

    show.isActive = false
    await show.save()

    res.json({ message: "Show deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ── Get shows by movie (for user side) ───────────────────────────────────────
export const getShowsByMovie = async (req, res) => {
  try {
    const { movieId, date, city } = req.query

    if (!movieId) {
      return res.status(400).json({ message: "movieId is required" })
    }

    const today = new Date().toISOString().slice(0, 10)

    const query = {
      movieId,
      isActive: true,
      showDate: date || { $gte: today },
    }

    if (city) {
      const venues = await Venue.find({
        city: new RegExp(city, "i"),
        isActive: true
      }).select("_id")

      const venueIds = venues.map((v) => v._id)
      query.venueId = { $in: venueIds }
    }

    const shows = await Show.find(query)
      .populate("venueId", "name city area address")
      .populate("movieId", "title duration posterUrl")
      .sort({ showDate: 1, showTime: 1 })

    res.json(
      shows.map((s) => ({
        id: String(s._id),
        movieId: String(s.movieId?._id || s.movieId),
        movie: s.movieId ? {
          id: String(s.movieId._id),
          title: s.movieId.title,
          duration: s.movieId.duration,
          posterUrl: s.movieId.posterUrl,
        } : null,
        venueId: String(s.venueId?._id || s.venueId),
        venue: s.venueId ? {
          id: String(s.venueId._id),
          name: s.venueId.name,
          city: s.venueId.city,
          area: s.venueId.area,
          address: s.venueId.address,
        } : null,
        screenId: s.screenId ? String(s.screenId) : null,
        screenName: s.screenName || "",
        showDate: s.showDate,
        showTime: s.showTime,
        showEndTime: s.showEndTime || null,
        price: s.price,
        totalSeats: s.totalSeats,
        availableSeats: s.availableSeats,
      }))
    )
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}