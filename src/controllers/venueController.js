import Venue from "../models/Venue.js"
import generateSeatLayout from "../utils/generateSeatLayout.js"
import Notification from "../models/Notification.js"

const formatVenue = (venue) => ({
  id:         venue._id,
  name:       venue.name,
  city:       venue.city,
  area:       venue.area,
  address:    venue.address,
  amenities:  venue.amenities,
  screenName: venue.screenName || venue.screens?.[0]?.screenName || "",
  totalSeats: venue.totalSeats || venue.screens?.reduce((s, sc) => s + sc.totalSeats, 0) || 0,
  partnerId:  venue.partnerId,
  createdBy:  venue.createdBy,
  screens: (venue.screens || []).map(sc => ({
    id:         sc._id,
    screenName: sc.screenName,
    totalSeats: sc.totalSeats,
  })),
})

export const getPartnerVenues = async (req, res) => {
  try {
    const venues = await Venue.find({
      partnerId: req.user.id,
      isActive: true
    }).sort({ createdAt: -1 })

    res.json(venues.map(formatVenue))
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const createPartnerVenue = async (req, res) => {
  try {
    const { name, city, area, address, amenities, screenName, totalSeats, screens } = req.body

    if (!name || !city || !address) {
      return res.status(400).json({ message: "Name, city and address are required" })
    }

    let screensData = []

    if (Array.isArray(screens) && screens.length > 0) {
      for (const sc of screens) {
        if (!sc.screenName || !sc.totalSeats) continue
        const num = Number(sc.totalSeats)
        screensData.push({
          screenName: sc.screenName,
          totalSeats: num,
          seatLayout: generateSeatLayout(num),
        })
      }
    }

    if (screensData.length === 0) {
      if (!screenName || !totalSeats) {
        return res.status(400).json({ message: "At least one screen with name and seats is required" })
      }

      const num = Number(totalSeats)
      screensData.push({
        screenName,
        totalSeats: num,
        seatLayout: generateSeatLayout(num),
      })
    }

    const totalSeatsAll = screensData.reduce((s, sc) => s + sc.totalSeats, 0)

    const venue = await Venue.create({
      name,
      city,
      area: area || "",
      address,
      amenities: amenities || "",
      screenName: screensData[0].screenName,
      totalSeats: totalSeatsAll,
      seatLayout: screensData[0].seatLayout,
      screens: screensData,
      createdBy: req.user.id,
      partnerId: req.user.id,
      isActive: true,
    })

    res.status(201).json({
      message: "Venue created successfully",
      venue: formatVenue(venue),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const updatePartnerVenue = async (req, res) => {
  try {
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      partnerId: req.user.id,
      isActive: true
    })

    if (!venue) return res.status(404).json({ message: "Venue not found" })

    venue.name      = req.body.name      ?? venue.name
    venue.city      = req.body.city      ?? venue.city
    venue.area      = req.body.area      ?? venue.area
    venue.address   = req.body.address   ?? venue.address
    venue.amenities = req.body.amenities ?? venue.amenities

    if (Array.isArray(req.body.screens) && req.body.screens.length > 0) {
      const updatedScreens = []

      for (const sc of req.body.screens) {
        if (!sc.screenName || !sc.totalSeats) continue
        const num = Number(sc.totalSeats)

        const existingScreen = sc.id
          ? venue.screens.find(s => String(s._id) === String(sc.id))
          : null

        if (existingScreen && existingScreen.totalSeats === num) {
          existingScreen.screenName = sc.screenName
          updatedScreens.push(existingScreen)
        } else {
          updatedScreens.push({
            ...(existingScreen ? { _id: existingScreen._id } : {}),
            screenName: sc.screenName,
            totalSeats: num,
            seatLayout: generateSeatLayout(num),
          })
        }
      }

      venue.screens = updatedScreens

      if (updatedScreens.length > 0) {
        venue.screenName = updatedScreens[0].screenName
        venue.totalSeats = updatedScreens.reduce((s, sc) => s + sc.totalSeats, 0)
        venue.seatLayout = updatedScreens[0].seatLayout
      }
    }

    await venue.save()
    res.json({ message: "Venue updated successfully", venue: formatVenue(venue) })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const deletePartnerVenue = async (req, res) => {
  try {
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      partnerId: req.user.id,
      isActive: true
    })

    if (!venue) return res.status(404).json({ message: "Venue not found" })

    venue.isActive = false
    await venue.save()

    res.json({ message: "Venue deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const addVenueScreen = async (req, res) => {
  try {
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      partnerId: req.user.id,
      isActive: true
    })

    if (!venue) return res.status(404).json({ message: "Venue not found" })

    const { screenName, totalSeats } = req.body
    if (!screenName || !totalSeats) {
      return res.status(400).json({ message: "screenName and totalSeats are required" })
    }

    const exists = venue.screens.some(
      s => s.screenName.toLowerCase() === screenName.toLowerCase()
    )
    if (exists) return res.status(400).json({ message: `Screen "${screenName}" already exists` })

    const totalSeatsNum = Number(totalSeats)
    const seatLayout = generateSeatLayout(totalSeatsNum)

    venue.screens.push({ screenName, totalSeats: totalSeatsNum, seatLayout })
    venue.totalSeats = venue.screens.reduce((s, sc) => s + sc.totalSeats, 0)

    await venue.save()

    const newScreen = venue.screens[venue.screens.length - 1]

    res.status(201).json({
      message: "Screen added successfully",
      screen: {
        id: newScreen._id,
        screenName: newScreen.screenName,
        totalSeats: newScreen.totalSeats,
      },
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const deleteVenueScreen = async (req, res) => {
  try {
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      partnerId: req.user.id,
      isActive: true
    })

    if (!venue) return res.status(404).json({ message: "Venue not found" })

    if (venue.screens.length <= 1) {
      return res.status(400).json({ message: "Cannot delete the last screen. Delete the theatre instead." })
    }

    const screenIndex = venue.screens.findIndex(
      s => String(s._id) === req.params.screenId
    )

    if (screenIndex === -1) return res.status(404).json({ message: "Screen not found" })

    venue.screens.splice(screenIndex, 1)
    venue.totalSeats = venue.screens.reduce((s, sc) => s + sc.totalSeats, 0)

    await venue.save()

    res.json({ message: "Screen deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getScreenSeatLayout = async (req, res) => {
  try {
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      isActive: true
    })

    if (!venue) return res.status(404).json({ message: "Venue not found" })

    const screen = venue.screens.find(
      s => String(s._id) === req.params.screenId
    )

    if (!screen) return res.status(404).json({ message: "Screen not found" })

    res.json({
      screenId:   screen._id,
      screenName: screen.screenName,
      totalSeats: screen.totalSeats,
      seatLayout: screen.seatLayout,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const updateScreenSeatLayout = async (req, res) => {
  try {
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      partnerId: req.user.id,
      isActive: true
    })

    if (!venue) return res.status(404).json({ message: "Venue not found" })

    const screen = venue.screens.find(
      s => String(s._id) === req.params.screenId
    )

    if (!screen) return res.status(404).json({ message: "Screen not found" })

    const { seatLayout } = req.body

    if (!Array.isArray(seatLayout)) {
      return res.status(400).json({ message: "seatLayout must be an array" })
    }

    screen.seatLayout = seatLayout
    screen.totalSeats = seatLayout.filter(s => s.isActive !== false).length

    await venue.save()

    res.json({
      message: "Seat layout updated successfully",
      totalSeats: screen.totalSeats,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}