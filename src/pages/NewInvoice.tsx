import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { createPortal } from 'react-dom';
import {
  Eye,
  Save,
  Send,
  Download,
  ChevronDown,
  Plus,
  Search,
  Settings,
} from 'lucide-react';
import { useInvoiceStore } from '../store/invoiceStore';
import { formatCurrency } from '../utils/invoiceCalculations';
import { generateInvoicePDF, previewInvoicePDF } from '../utils/pdfExport';

const defaultHeaderText = `Sehr geehrte Damen und Herren,

hiermit berechnen wir unsere Vermittlungsprovision für die 24-Stunden-Pflege.

Bitte entnehmen Sie die Details der nachfolgenden Aufstellung.`;

export function NewInvoice() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const {
    partners,
    customers,
    getInvoice,
    getPartner,
    getCustomer,
    getFilteredInvoices,
    addInvoice,
    updateInvoice,
    updatePartner,
  } = useInvoiceStore();

  const existingInvoice = id ? getInvoice(id) : null;

  const [partnerId, setPartnerId] = useState(existingInvoice?.partnerId || '');
  const [customerId, setCustomerId] = useState(existingInvoice?.customerId || '');
  const [agreedTotalAmount, setAgreedTotalAmount] = useState(
    existingInvoice?.agreedTotalAmount ?? 0
  );
  const [commissionRate, setCommissionRate] = useState(
    existingInvoice?.commissionRate ?? 11
  );
  const [invoiceDate, setInvoiceDate] = useState(
    existingInvoice?.invoiceDate || format(new Date(), 'yyyy-MM-dd')
  );
  const [performancePeriodFrom, setPerformancePeriodFrom] = useState(
    (existingInvoice as { performancePeriodFrom?: string; deliveryDate?: string })?.performancePeriodFrom ||
    (existingInvoice as { deliveryDate?: string })?.deliveryDate ||
    format(new Date(), 'yyyy-MM-dd')
  );
  const [performancePeriodTo, setPerformancePeriodTo] = useState(
    (existingInvoice as { performancePeriodTo?: string; deliveryDate?: string })?.performancePeriodTo ||
    (existingInvoice as { deliveryDate?: string })?.deliveryDate ||
    format(new Date(), 'yyyy-MM-dd')
  );
  const [invoiceNumber, setInvoiceNumber] = useState(
    existingInvoice?.invoiceNumber || ''
  );
  const [referenceNumber, setReferenceNumber] = useState(
    existingInvoice?.referenceNumber || ''
  );
  const [paymentTermsDays, setPaymentTermsDays] = useState(
    existingInvoice?.paymentTermsDays ?? 14
  );
  const [subject, setSubject] = useState(existingInvoice?.subject || '');
  const [headerText, setHeaderText] = useState(
    existingInvoice?.headerText || defaultHeaderText
  );
  const partner = partnerId ? getPartner(partnerId) : null;
  const customer = customerId ? getCustomer(customerId) : null;
  const invoices = getFilteredInvoices();
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const actionsButtonRef = useRef<HTMLDivElement>(null);
  const [actionsMenuPosition, setActionsMenuPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (actionsMenuOpen && actionsButtonRef.current) {
      const rect = actionsButtonRef.current.getBoundingClientRect();
      setActionsMenuPosition({ top: rect.bottom + 4, left: rect.right - 192 });
    }
  }, [actionsMenuOpen]);

  const commissionAmount = Math.round(
    agreedTotalAmount * (commissionRate / 100) * 100
  ) / 100;

  useEffect(() => {
    if (!isEdit && !invoiceNumber) {
      const numbers = invoices
        .filter((i) => i.invoiceNumber.startsWith('RE-'))
        .map((i) => parseInt(i.invoiceNumber.replace('RE-', ''), 10))
        .filter((n) => !isNaN(n));
      const max = numbers.length ? Math.max(...numbers) : 1335;
      setInvoiceNumber(`RE-${max + 1}`);
    }
  }, [isEdit, invoiceNumber, invoices]);

  useEffect(() => {
    if (invoiceNumber && !subject) {
      setSubject(`Rechnung Nr. ${invoiceNumber} – Vermittlungsprovision`);
    }
  }, [invoiceNumber, subject]);

  useEffect(() => {
    const p = partnerId ? getPartner(partnerId) : null;
    if (p) setCommissionRate(p.commissionRate);
  }, [partnerId]);

  const dueDate = addDays(new Date(invoiceDate), paymentTermsDays);

  const handleSave = (status: 'entwurf' | 'offen' = 'entwurf', redirect = true): string => {
    const invoiceData = {
      invoiceNumber,
      status,
      partnerId,
      customerId,
      agreedTotalAmount,
      commissionRate,
      commissionAmount,
      invoiceDate,
      performancePeriodFrom,
      performancePeriodTo,
      dueDate: format(dueDate, 'yyyy-MM-dd'),
      referenceNumber: referenceNumber || undefined,
      subject: subject || `Rechnung Nr. ${invoiceNumber} – Vermittlungsprovision`,
      headerText,
      positions: [],
      paymentTermsDays,
      isLocked: status !== 'entwurf',
      paidAmount: 0,
    };

    if (isEdit && id) {
      updateInvoice(id, invoiceData);
      if (redirect) navigate('/rechnungen');
      return id;
    } else {
      const newInv = addInvoice(invoiceData);
      if (redirect) navigate('/rechnungen');
      return newInv.id;
    }
  };

  const handlePreview = async () => {
    const invoiceForPreview = {
      id: 'preview',
      invoiceNumber,
      status: 'entwurf' as const,
      partnerId,
      customerId,
      agreedTotalAmount,
      commissionRate,
      commissionAmount,
      invoiceDate,
      performancePeriodFrom,
      performancePeriodTo,
      dueDate: format(dueDate, 'yyyy-MM-dd'),
      referenceNumber: referenceNumber || undefined,
      subject: subject || `Rechnung Nr. ${invoiceNumber} – Vermittlungsprovision`,
      headerText,
      positions: [],
      paymentTermsDays,
      isLocked: false,
      paidAmount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await previewInvoicePDF(invoiceForPreview, partner ?? undefined, customer ?? undefined);
  };

  const handleSendAndDownload = async () => {
    const savedId = handleSave('offen', true);
    setTimeout(async () => {
      const inv = getInvoice(savedId);
      if (inv) {
        await generateInvoicePDF(
          inv,
          getPartner(inv.partnerId),
          getCustomer(inv.customerId)
        );
      }
    }, 100);
  };

  const updateHeaderFromSelection = () => {
    if (customer && agreedTotalAmount > 0) {
      setHeaderText(`Sehr geehrte Damen und Herren,

hiermit berechnen wir unsere Vermittlungsprovision für die 24-Stunden-Pflege von ${customer.name}.

Vereinbarter Gesamtbetrag (Partner – Kunde): ${formatCurrency(agreedTotalAmount)}
Provisionssatz: ${commissionRate} %
Rechnungsbetrag: ${formatCurrency(commissionAmount)}`);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Rechnung bearbeiten' : 'Neue Rechnung'}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handlePreview}
            className="flex items-center gap-2 px-3 py-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
          >
            <Eye className="w-4 h-4 shrink-0" />
            Vorschau
          </button>
          <button
            onClick={() => handleSave('entwurf', true)}
            className="flex items-center gap-2 px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm transition-colors"
          >
            <Save className="w-4 h-4 shrink-0" />
            Speichern
          </button>
          <div ref={actionsButtonRef} className="relative flex rounded-lg overflow-hidden shadow-sm">
            <button
              onClick={handleSendAndDownload}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-medium text-sm hover:bg-primary-hover transition-colors whitespace-nowrap"
            >
              <Send className="w-4 h-4 shrink-0" />
              Versenden
            </button>
            <button
              onClick={() => setActionsMenuOpen((o) => !o)}
              className="px-2.5 py-2.5 bg-primary hover:bg-primary-hover text-white border-l border-white/20 transition-colors"
              aria-label="Weitere Optionen"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            {actionsMenuOpen &&
              createPortal(
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setActionsMenuOpen(false)}
                  />
                  <div
                    className="fixed z-50 py-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200"
                    style={{ top: actionsMenuPosition.top, left: actionsMenuPosition.left }}
                  >
                    <button
                      onClick={() => {
                        setActionsMenuOpen(false);
                        handleSendAndDownload();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg text-left"
                    >
                      <Send className="w-4 h-4 shrink-0" />
                      Versenden
                    </button>
                    <button
                      onClick={() => {
                        setActionsMenuOpen(false);
                        handleSendAndDownload();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg text-left"
                    >
                      <Download className="w-4 h-4 shrink-0" />
                      Herunterladen
                    </button>
                  </div>
                </>,
                document.body
              )}
          </div>
          <button className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <span className="sr-only">Mehr Optionen</span>
            <span className="text-lg font-medium leading-none">⋯</span>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Kooperationspartner & Kunde */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Vermittlung 24-Stunden-Pflege
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kooperationspartner (Rechnungsempfänger) *
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={partnerId}
                    onChange={(e) => setPartnerId(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="">Partner auswählen</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.commissionRate}%)
                      </option>
                    ))}
                  </select>
                </div>
                <button className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Plus className="w-4 h-4" />
                </button>
                <button className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
              {partner && (
                <p className="mt-2 text-xs text-gray-500">
                  Standard-Provisionssatz: {partner.commissionRate} %
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kunde (Pflegebedürftiger) *
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="">Kunde auswählen</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {partner && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anschrift *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={partner.address}
                    onChange={(e) =>
                      updatePartner(partnerId, { address: e.target.value })
                    }
                    className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="Straße, Hausnummer"
                  />
                  <button className="text-sm text-primary hover:underline self-center shrink-0">
                    Adresszusatz +
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postleitzahl
                  </label>
                  <input
                    type="text"
                    value={partner.postalCode}
                    onChange={(e) =>
                      updatePartner(partnerId, { postalCode: e.target.value })
                    }
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stadt
                  </label>
                  <input
                    type="text"
                    value={partner.city}
                    onChange={(e) =>
                      updatePartner(partnerId, { city: e.target.value })
                    }
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Land
                </label>
                <input
                  type="text"
                  value={partner.country}
                  onChange={(e) =>
                    updatePartner(partnerId, { country: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="z.B. Deutschland, Polska"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-Mail
                </label>
                <input
                  type="email"
                  value={partner.email || ''}
                  onChange={(e) =>
                    updatePartner(partnerId, { email: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="info@beispiel.de"
                />
              </div>
              <button className="text-sm text-primary hover:underline flex items-center gap-1">
                Kontaktdetails anzeigen
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
        </section>

        {/* Provisionsberechnung */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Provisionsberechnung
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vereinbarter Gesamtbetrag (Partner – Kunde) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={agreedTotalAmount || ''}
                onChange={(e) =>
                  setAgreedTotalAmount(parseFloat(e.target.value) || 0)
                }
                placeholder="z.B. 3890"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-gray-500">
                Der vereinbarte Betrag zwischen Kooperationspartner und Kunde
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provisionssatz (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={commissionRate || ''}
                onChange={(e) =>
                  setCommissionRate(parseFloat(e.target.value) || 0)
                }
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-gray-500">
                Ca. 11 % je nach Kooperationspartner
              </p>
            </div>
          </div>
          <div className="mt-6 p-5 rounded-xl bg-primary-light border border-primary-border shadow-sm">
            <div className="flex justify-between items-baseline gap-4">
              <span className="font-semibold text-gray-800">
                Vermittlungsprovision (Rechnungsbetrag)
              </span>
              <span className="text-2xl font-bold text-primary tabular-nums">
                {formatCurrency(commissionAmount)}
              </span>
            </div>
            {agreedTotalAmount > 0 && (
              <p className="mt-2 text-sm text-gray-600">
                {formatCurrency(agreedTotalAmount)} × {commissionRate} % = {formatCurrency(commissionAmount)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={updateHeaderFromSelection}
            className="mt-3 text-sm text-primary hover:underline"
          >
            Kopftext mit Details aktualisieren
          </button>
        </section>

        {/* Rechnungsinformationen */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Rechnungsinformationen
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rechnungsdatum *
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Leistungsraum von *
              </label>
              <input
                type="date"
                value={performancePeriodFrom}
                onChange={(e) => setPerformancePeriodFrom(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Leistungsraum bis *
              </label>
              <input
                type="date"
                value={performancePeriodTo}
                onChange={(e) => setPerformancePeriodTo(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rechnungsnummer *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                />
                <button className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Referenznummer
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zahlungsziel
              </label>
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <input
                  type="date"
                  value={format(dueDate, 'yyyy-MM-dd')}
                  readOnly
                  className="min-w-0 flex-1 px-3 py-2.5 border border-gray-300 rounded-lg bg-gray-50"
                />
                <span className="text-sm text-gray-500 shrink-0">in</span>
                <input
                  type="number"
                  value={paymentTermsDays}
                  onChange={(e) =>
                    setPaymentTermsDays(parseInt(e.target.value) || 14)
                  }
                  className="w-16 shrink-0 px-2 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-gray-500 shrink-0">Tagen</span>
              </div>
            </div>
          </div>
        </section>

        {/* Kopftext */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Kopftext</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Betreff
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Text
              </label>
              <textarea
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                rows={6}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary resize-y"
              />
            </div>
          </div>
        </section>

        {/* Zusammenfassung */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Zusammenfassung
          </h2>
          <div className="max-w-sm ml-auto space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">Vereinbarter Gesamtbetrag</span>
              <span className="font-medium text-gray-900 tabular-nums">
                {formatCurrency(agreedTotalAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">Provisionssatz</span>
              <span className="font-medium text-gray-900 tabular-nums">
                {commissionRate} %
              </span>
            </div>
            <div className="flex justify-between items-center pt-4 mt-4 border-t-2 border-gray-200 bg-gray-50/50 -mx-4 px-4 py-4 rounded-lg">
              <span className="text-base font-semibold text-gray-900">
                Rechnungsbetrag (Provision)
              </span>
              <span className="text-2xl font-bold text-primary tabular-nums">
                {formatCurrency(commissionAmount)}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
