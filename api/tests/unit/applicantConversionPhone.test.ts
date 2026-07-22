import { describe, expect, it } from 'vitest';
import { copyPersonalDetailsFromDraft } from '../../src/services/admissions/applicantConversionService.js';

// The apply flow stores draft step3 phones RAW (SaveDraftBody.payload is
// z.unknown()), so a 10-digit entry reaches conversion un-normalized. At
// conversion the phone is copied onto the User, whose emergencyContact /
// parentGuardian phones are strictly `+`-validated — so it must be normalized
// to E.164 first, or acceptance would fail.

type ContactShape = { name: string; relationship: string; phoneE164: string; email: string | null } | null;

function blankUser() {
  return {
    name: 'X',
    dateOfBirth: null as Date | null,
    personalAddress: null as unknown,
    emergencyContact: null as ContactShape,
    parentGuardian: null as ContactShape,
  };
}

describe('copyPersonalDetailsFromDraft — contact phone normalization', () => {
  it('normalizes a bare 10-digit emergency + a spaced/0-prefixed parent phone to +91 E.164', () => {
    const user = blankUser();
    copyPersonalDetailsFromDraft(
      {
        step3_contact: {
          emergency: { name: 'Rita', relationship: 'Mother', phoneE164: '9812345678' },
          parentGuardian: { name: 'Anil', relationship: 'Father', phoneE164: '098123 45679' },
        },
      },
      user,
    );
    expect(user.emergencyContact?.phoneE164).toBe('+919812345678');
    expect(user.parentGuardian?.phoneE164).toBe('+919812345679');
  });

  it('skips a contact whose phone cannot be normalized rather than throwing (best-effort)', () => {
    const user = blankUser();
    copyPersonalDetailsFromDraft(
      { step3_contact: { emergency: { name: 'Bad', relationship: 'X', phoneE164: 'not-a-phone' } } },
      user,
    );
    expect(user.emergencyContact).toBeNull();
  });

  it('leaves an already-E.164 phone unchanged', () => {
    const user = blankUser();
    copyPersonalDetailsFromDraft(
      { step3_contact: { emergency: { name: 'Ok', relationship: 'X', phoneE164: '+919812345670' } } },
      user,
    );
    expect(user.emergencyContact?.phoneE164).toBe('+919812345670');
  });
});
