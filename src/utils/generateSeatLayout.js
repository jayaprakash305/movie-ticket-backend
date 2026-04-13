  const generateSeatLayout = (totalSeats) => {
    const seats = []
    const count = Number(totalSeats)
    if (!count || count < 1) return seats

    const rowLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

    // ── Curved layout: front rows narrower, rear rows wider ───────────────────
    // Min seats per half = 3, max = 13 (so full row = 6–26)
    // We grow the row width gradually from front to back
    // First figure out how many rows we need and their widths

    const MIN_HALF = 3   // minimum seats per half-row (front)
    const MAX_HALF = 10  // maximum seats per half-row (back) → max 20 per row

    // Build row widths incrementally until we fill totalSeats
    const rowHalves = []  // each entry = seats per half
    let filled = 0
    let rowIdx = 0

    while (filled < count) {
      // Gradually increase half-width: starts at MIN_HALF, grows every 2 rows
      const halfWidth = Math.min(MIN_HALF + Math.floor(rowIdx / 2), MAX_HALF)
      const rowTotal  = halfWidth * 2

      if (filled + rowTotal <= count) {
        // Full row fits
        rowHalves.push({ half: halfWidth, leftCount: halfWidth, rightCount: halfWidth })
        filled += rowTotal
      } else {
        // Last partial row — distribute remaining seats across left + right
        const remaining = count - filled
        const leftCount  = Math.ceil(remaining / 2)
        const rightCount = remaining - leftCount
        rowHalves.push({ half: halfWidth, leftCount, rightCount })
        filled += remaining 
      }

      rowIdx++
      if (rowIdx >= rowLetters.length) break  // safety: max 26 rows
    }

    // ── Generate seat objects ─────────────────────────────────────────────────
    rowHalves.forEach((row, ri) => {
      const rowLabel = rowLetters[ri] || `R${ri + 1}`

      // Left half — L1, L2, ... (seat numbers 1..leftCount)
      for (let i = 0; i < row.leftCount; i++) {
        const seatNum    = i + 1
        const seatNumber = `${rowLabel}${seatNum}`
        seats.push({
          seatId:     seatNumber,
          seatNumber,
          rowLabel,
          side:       "left",
          isActive:   true,
        })
      }

      // Right half — continues numbering after left (L+1 .. L+R)
      for (let i = 0; i < row.rightCount; i++) {
        const seatNum    = row.leftCount + i + 1
        const seatNumber = `${rowLabel}${seatNum}`
        seats.push({
          seatId:     seatNumber,
          seatNumber,
          rowLabel,
          side:       "right",
          isActive:   true,
        })
      }
    })

    return seats
  }

  export default generateSeatLayout