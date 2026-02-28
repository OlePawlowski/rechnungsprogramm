import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Invoice, Partner, Customer, InvoiceFilter } from '../types';
import { format } from 'date-fns';

const STORAGE_KEY = 'rechnungs-24h-pflege-v2';

const generateId = () => Math.random().toString(36).slice(2, 11);

const defaultPartners: Partner[] = [
  {
    id: 'p1',
    name: 'Pflegepartner Sp. z o.o.',
    address: 'Al. Jana Pawla II 27',
    postalCode: '00-867',
    city: 'Warszawa',
    country: 'Polska',
    email: 'info@pflegepartner-direkt.de',
    commissionRate: 11,
  },
];

const defaultCustomers: Customer[] = [
  {
    id: 'c1',
    name: 'Maria Schmidt',
  },
];

const createSampleInvoices = (): Invoice[] => {
  const base = format(new Date(), 'yyyy-MM-dd');
  return [
    {
      id: 'inv1',
      invoiceNumber: 'RE-1341',
      status: 'entwurf',
      partnerId: 'p1',
      customerId: 'c1',
      agreedTotalAmount: 3890,
      commissionRate: 11,
      commissionAmount: 427.9,
      invoiceDate: '2026-02-24',
      performancePeriodFrom: '2026-02-01',
      performancePeriodTo: '2026-02-28',
      dueDate: '',
      subject: 'Rechnung Nr. RE-1341 – Vermittlungsprovision',
      headerText: `Sehr geehrte Damen und Herren,

hiermit berechnen wir unsere Vermittlungsprovision für die 24-Stunden-Pflege von Frau Maria Schmidt.

Vereinbarter Gesamtbetrag (Partner – Kunde): 3.890,00 €
Provisionssatz: 11 %
Rechnungsbetrag: 427,90 €`,
      positions: [],
      paymentTermsDays: 14,
      isLocked: false,
      paidAmount: 0,
      createdAt: base,
      updatedAt: base,
    },
  ];
};

const getNextInvoiceNumber = (invoices: Invoice[]): string => {
  const numbers = invoices
    .filter((i) => i.invoiceNumber.startsWith('RE-'))
    .map((i) => parseInt(i.invoiceNumber.replace('RE-', ''), 10))
    .filter((n) => !isNaN(n));
  const max = numbers.length ? Math.max(...numbers) : 1335;
  return `RE-${max + 1}`;
};

interface InvoiceStore {
  invoices: Invoice[];
  partners: Partner[];
  customers: Customer[];
  filter: InvoiceFilter;
  setFilter: (filter: InvoiceFilter) => void;
  getFilteredInvoices: () => Invoice[];
  getPartner: (id: string) => Partner | undefined;
  getCustomer: (id: string) => Customer | undefined;
  addPartner: (partner: Omit<Partner, 'id'>) => Partner;
  addCustomer: (customer: Omit<Customer, 'id'>) => Customer;
  updatePartner: (id: string, partner: Partial<Partner>) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => Invoice;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  getInvoice: (id: string) => Invoice | undefined;
}

export const useInvoiceStore = create<InvoiceStore>()(
  persist(
    (set, get) => ({
      invoices: createSampleInvoices(),
      partners: defaultPartners,
      customers: defaultCustomers,
      filter: 'alle',

      setFilter: (filter) => set({ filter }),

      getFilteredInvoices: () => {
        const { invoices, filter } = get();
        if (filter === 'alle') return invoices;
        return invoices.filter((i) => i.status === filter);
      },

      getPartner: (id) => get().partners.find((p) => p.id === id),
      getCustomer: (id) => get().customers.find((c) => c.id === id),

      addPartner: (partner) => {
        const newPartner: Partner = {
          ...partner,
          id: generateId(),
        };
        set((state) => ({
          partners: [...state.partners, newPartner],
        }));
        return newPartner;
      },

      addCustomer: (customer) => {
        const newCustomer: Customer = {
          ...customer,
          id: generateId(),
        };
        set((state) => ({
          customers: [...state.customers, newCustomer],
        }));
        return newCustomer;
      },

      updatePartner: (id, partner) => {
        set((state) => ({
          partners: state.partners.map((p) =>
            p.id === id ? { ...p, ...partner } : p
          ),
        }));
      },

      updateCustomer: (id, customer) => {
        set((state) => ({
          customers: state.customers.map((c) =>
            c.id === id ? { ...c, ...customer } : c
          ),
        }));
      },

      addInvoice: (invoice) => {
        const now = format(new Date(), 'yyyy-MM-dd');
        const invoices = get().invoices;
        const invoiceNumber =
          invoice.invoiceNumber || getNextInvoiceNumber(invoices);
        const newInvoice: Invoice = {
          ...invoice,
          id: generateId(),
          invoiceNumber,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          invoices: [...state.invoices, newInvoice],
        }));
        return newInvoice;
      },

      updateInvoice: (id, invoice) => {
        const now = format(new Date(), 'yyyy-MM-dd');
        set((state) => ({
          invoices: state.invoices.map((i) =>
            i.id === id ? { ...i, ...invoice, updatedAt: now } : i
          ),
        }));
      },

      deleteInvoice: (id) => {
        set((state) => ({
          invoices: state.invoices.filter((i) => i.id !== id),
        }));
      },

      getInvoice: (id) => get().invoices.find((i) => i.id === id),
    }),
    {
      name: STORAGE_KEY,
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        if (version < 2) {
          const state = persistedState as { invoices?: Array<Record<string, unknown>> };
          if (state?.invoices) {
            state.invoices = state.invoices.map((inv) => {
              const deliveryDate = inv.deliveryDate as string | undefined;
              if (deliveryDate && !inv.performancePeriodFrom) {
                const { deliveryDate: _, ...rest } = inv;
                return { ...rest, performancePeriodFrom: deliveryDate, performancePeriodTo: deliveryDate };
              }
              return inv;
            });
          }
        }
        return persistedState as typeof persistedState;
      },
    }
  )
);
