export type InvoiceStatus = 'entwurf' | 'offen' | 'faellig' | 'bezahlt' | 'festgeschrieben';

/** Kooperationspartner – Pflegeagentur, die unsere Rechnung erhält und zahlt */
export interface Partner {
  id: string;
  name: string;
  address: string;
  addressAddition?: string;
  postalCode: string;
  city: string;
  country: string;
  email?: string;
  phone?: string;
  /** Provisionssatz in % (z.B. 11) – Standard für diesen Partner */
  commissionRate: number;
}

/** Kunde – Pflegebedürftiger, für den die Vermittlung erfolgte */
export interface Customer {
  id: string;
  name: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  email?: string;
  phone?: string;
}

export interface InvoicePosition {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  discount: number;
  discountType: 'percent' | 'amount';
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  /** Kooperationspartner (Rechnungsempfänger) */
  partnerId: string;
  /** Kunde (Pflegebedürftiger) */
  customerId: string;
  /** Vereinbarter Gesamtbetrag zwischen Partner und Kunde (€) */
  agreedTotalAmount: number;
  /** Provisionssatz in % (z.B. 11) */
  commissionRate: number;
  /** Unser Rechnungsbetrag = agreedTotalAmount × commissionRate/100 */
  commissionAmount: number;
  invoiceDate: string;
  /** Leistungsraum von (z.B. 01.02.2026) */
  performancePeriodFrom: string;
  /** Leistungsraum bis (z.B. 28.02.2026) */
  performancePeriodTo: string;
  dueDate: string;
  referenceNumber?: string;
  subject: string;
  headerText: string;
  positions: InvoicePosition[];
  paymentTermsDays: number;
  isLocked: boolean;
  paidAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceFilter = 'alle' | 'entwurf' | 'offen' | 'faellig' | 'festgeschrieben';
