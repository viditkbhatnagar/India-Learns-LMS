import type {
  VisitorQualification,
  VisitorLeadSource,
  VisitorOtpStatus,
  VisitorLeadStatus,
} from '../enums.js';
import type { PersonalAddressDto } from './user.js';

// M10s — Visitor Lead DTO. Pre-application stage; admin / admissions
// staff captures prospects (walk-ins, agent referrals, calls, social
// inbound). The "OTP Verification Status" is a manual flag — we don't
// send actual OTPs in V1 (per Logan 2026-05-20). When the lead is
// ready to apply, admin clicks Convert → creates an ApplicationDraft
// prefilled from the lead.

export interface VisitorLeadDto {
  id: string;
  firstName: string;
  lastName: string;
  highestQualification: VisitorQualification | null;
  dateOfBirth: string | null; // YYYY-MM-DD
  currentAddress: PersonalAddressDto | null;
  phoneE164: string;
  email: string | null;
  parentGuardianContact: string | null; // free text (phone or name+phone)
  leadSource: VisitorLeadSource;
  socialMediaId: string | null; // Instagram handle / LinkedIn URL / Facebook link
  otpVerificationStatus: VisitorOtpStatus;
  status: VisitorLeadStatus;
  notes: string | null;
  assignedToUserId: string | null;
  convertedApplicationId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateVisitorLeadInput {
  firstName: string;
  lastName: string;
  highestQualification?: VisitorQualification | null;
  dateOfBirth?: string | null;
  currentAddress?: PersonalAddressDto | null;
  phoneE164: string;
  email?: string | null;
  parentGuardianContact?: string | null;
  leadSource: VisitorLeadSource;
  socialMediaId?: string | null;
  otpVerificationStatus?: VisitorOtpStatus;
  status?: VisitorLeadStatus;
  notes?: string | null;
  assignedToUserId?: string | null;
}

export type UpdateVisitorLeadInput = Partial<CreateVisitorLeadInput>;

export interface VisitorLeadListResponse {
  items: VisitorLeadDto[];
  total: number;
  page: number;
  limit: number;
}
