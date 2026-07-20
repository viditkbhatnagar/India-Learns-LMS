import { randomInt } from 'node:crypto';

// Unambiguous alphabet (no O/0/I/l/1) — generated passwords are read off a
// screen / handed out on paper, so avoid look-alike characters. Same set the
// entrance-exam seed uses.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/**
 * Generate a random password using a CSPRNG. The regenerate-until-valid loop
 * guarantees the result satisfies the User password policy (validatePolicy:
 * ≥10 chars, at least one letter and one digit). Default length 12 leaves
 * margin over the 10-char minimum.
 */
export function generatePassword(len = 12): string {
  for (;;) {
    let out = '';
    for (let i = 0; i < len; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
    if (/[a-z]/.test(out) && /\d/.test(out)) return out;
  }
}
