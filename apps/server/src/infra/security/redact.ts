// Providers sometimes echo a key back inside an error message. Strip known secrets before a
// message is stored or sent to the browser. Very short values are skipped: replacing them would
// mangle ordinary text.
const MIN_SECRET_LENGTH = 6;

export function redactSecrets(message: string, secrets: readonly string[]): string {
  return secrets
    .filter((secret) => secret.length >= MIN_SECRET_LENGTH)
    .reduce((text, secret) => text.split(secret).join('***'), message);
}
