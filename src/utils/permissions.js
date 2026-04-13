export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null")
  } catch {
    return null
  }
}

export const isSuperAdmin = () => {
  const user = getUser()
  return user?.role === "SUPER_ADMIN"
}

export const hasPermission = (permission) => {
  const user = getUser()

  if (!user) return false

  // SUPER ADMIN → always allowed
  if (user.role === "SUPER_ADMIN") return true

  return !!user.permissions?.[permission]
}