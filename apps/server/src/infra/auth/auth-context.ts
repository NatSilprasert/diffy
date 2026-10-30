// Who is making a request, as the guard worked it out from the session cookie. Any controller can ask for it with
// @CurrentAuth(), so it lives with the other things every module may use, not inside the auth module.
export type AuthContext = {
  sessionId: string;
  userId: string;
  // The account the person is looking at, or null when they cannot use diffy for any account yet.
  accountId: string | null;
};
