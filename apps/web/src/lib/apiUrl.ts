// Where the browser reaches the API: its own address in production, the dev API's port during development.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

// The sign-in is not an API call but a trip to GitHub and back, so the browser itself goes there. GitHub is asked to
// show its account picker every time, so a person with more than one GitHub account chooses which one to sign in with
// instead of being signed in as whichever one the browser happens to have open.
export const SIGN_IN_URL = `${API_URL}/api/auth/github/login?prompt=select_account`;
