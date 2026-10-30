// Where the browser reaches the API: its own address in production, the dev API's port during development.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

// The sign-in is not an API call but a trip to GitHub and back, so the browser itself goes there.
export const SIGN_IN_URL = `${API_URL}/api/auth/github/login`;
