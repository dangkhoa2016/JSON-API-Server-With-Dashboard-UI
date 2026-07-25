const STORAGE_KEY = "auth_token"

export function setAuthToken(t: string | null) {
  if (t) {
    localStorage.setItem(STORAGE_KEY, t)
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}
