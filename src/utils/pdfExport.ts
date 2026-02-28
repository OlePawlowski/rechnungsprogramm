import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice, Partner, Customer } from '../types';
import { formatCurrency } from './invoiceCalculations';
import { COMPANY } from '../config/company';

async function loadLogoAsBase64(
  urls: string[]
): Promise<{ data: string; aspectRatio: number } | null> {
  for (const url of urls) {
    try {
      const img = new Image();
      if (url.startsWith('http')) img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      return {
        data: canvas.toDataURL('image/png'),
        aspectRatio: img.naturalHeight / img.naturalWidth,
      };
    } catch {
      continue;
    }
  }
  return null;
}

async function generateInvoicePDFInternal(
  invoice: Invoice,
  partner: Partner | undefined,
  customer: Customer | undefined,
  preview: boolean
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let y = margin;

  const [r, g, b] = COMPANY.primaryColorRgb;

  // === HEADER: Logo + Company ===
  const logoResult = await loadLogoAsBase64([
    window.location.origin + COMPANY.logoLocalPath,
    COMPANY.logoUrl,
  ]);
  if (logoResult) {
    const logoWidth = 50;
    const logoHeight = logoWidth * logoResult.aspectRatio;
    doc.addImage(logoResult.data, 'PNG', margin, y, logoWidth, logoHeight);
  } else {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(r, g, b);
    doc.text('HelpCare', margin, y + 10);
    doc.setTextColor(0, 0, 0);
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(COMPANY.name, pageWidth - margin, y + 5, { align: 'right' });
  doc.text(`${COMPANY.address}`, pageWidth - margin, y + 11, { align: 'right' });
  doc.text(`${COMPANY.postalCode} ${COMPANY.city}`, pageWidth - margin, y + 17, { align: 'right' });
  doc.text(COMPANY.country, pageWidth - margin, y + 23, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 35;

  // === RECHNUNG Titel ===
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;

  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(r, g, b);
  doc.text('RECHNUNG', margin, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(invoice.invoiceNumber, pageWidth - margin, y, { align: 'right' });
  y += 20;

  // === Zwei Spalten: Rechnungsempfänger | Rechnungsdetails ===
  const colWidth = contentWidth / 2;
  const leftCol = margin;
  const rightCol = margin + colWidth + 10;

  const blockStartY = y;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('RECHNUNGSEMPFÄNGER', leftCol, y);
  doc.text('RECHNUNGSDETAILS', rightCol, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  if (partner) {
    doc.text(partner.name, leftCol, y);
    y += 6;
    doc.text(partner.address, leftCol, y);
    y += 6;
    doc.text(`${partner.postalCode} ${partner.city}`, leftCol, y);
    y += 6;
    doc.text(partner.country, leftCol, y);
    y += 4;
  }

  const inv = invoice as { performancePeriodFrom?: string; performancePeriodTo?: string };
  let detailY = blockStartY + 8;
  doc.text(`Rechnungsnummer:  ${invoice.invoiceNumber}`, rightCol, detailY);
  detailY += 6;
  doc.text(`Rechnungsdatum:   ${invoice.invoiceDate}`, rightCol, detailY);
  detailY += 6;
  if (inv.performancePeriodFrom && inv.performancePeriodTo) {
    doc.text(
      `Leistungsraum:     ${inv.performancePeriodFrom} – ${inv.performancePeriodTo}`,
      rightCol,
      detailY
    );
    detailY += 6;
  }
  doc.text(`Fällig am:        ${invoice.dueDate}`, rightCol, detailY);
  detailY += 6;
  if (invoice.referenceNumber) {
    doc.text(`Referenz:         ${invoice.referenceNumber}`, rightCol, detailY);
    detailY += 6;
  }
  const detailsBottom = detailY;

  y = Math.max(y, detailsBottom) + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('PFLEGEBEDÜRFTIGER', leftCol, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(customer?.name || '-', leftCol, y);
  y += 18;

  // === Betreff ===
  if (invoice.subject) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(invoice.subject, margin, y);
    y += 10;
  }

  // === Einleitungstext ===
  if (invoice.headerText) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(invoice.headerText, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 5.5 + 16;
    doc.setTextColor(0, 0, 0);
  }

  // === Positions-Tabelle ===
  const tableData = [
    [
      'Vereinbarter Gesamtbetrag (Partner – Kunde)',
      formatCurrency(invoice.agreedTotalAmount),
    ],
    ['Provisionssatz', `${invoice.commissionRate} %`],
    [
      'Vermittlungsprovision (Rechnungsbetrag)',
      formatCurrency(invoice.commissionAmount),
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Position', 'Betrag']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: [r, g, b],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 10,
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.7 },
      1: { cellWidth: contentWidth * 0.3, halign: 'right', fontStyle: 'bold' },
    },
    tableLineColor: [220, 220, 220],
    tableLineWidth: 0.2,
  });

  const lastTable = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable;
  y = (lastTable?.finalY ?? y) + 20;

  // === Gesamtbetrag hervorgehoben ===
  doc.setFillColor(r, g, b);
  doc.rect(margin, y - 8, contentWidth, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Rechnungsbetrag (Gesamt)', margin + 8, y + 2);
  doc.text(formatCurrency(invoice.commissionAmount), pageWidth - margin - 8, y + 2, {
    align: 'right',
  });
  doc.setTextColor(0, 0, 0);
  y += 25;

  // === Zahlungsinformationen ===
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('ZAHLUNGSINFORMATIONEN', margin, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `Bitte überweisen Sie den Betrag innerhalb von ${invoice.paymentTermsDays} Tagen auf folgendes Konto:`,
    margin,
    y
  );
  y += 7;
  doc.text(`IBAN: ${COMPANY.bank.iban}`, margin, y);
  y += 5;
  doc.text(`BIC: ${COMPANY.bank.bic}`, margin, y);
  y += 5;
  doc.text(`Verwendungszweck: ${invoice.invoiceNumber}`, margin, y);
  y += 18;

  // === Footer ===
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(
    `${COMPANY.name} | ${COMPANY.address} | ${COMPANY.postalCode} ${COMPANY.city} | ${COMPANY.country}`,
    margin,
    y
  );
  y += 5;
  doc.text(
    `USt-IdNr.: ${COMPANY.bank.vatId} | Steuernr.: ${COMPANY.bank.taxId}`,
    margin,
    y
  );
  y += 6;
  doc.setFont('helvetica', 'italic');
  doc.text(
    'Vielen Dank für Ihr Vertrauen. Bei Fragen stehen wir Ihnen gerne zur Verfügung.',
    margin,
    y
  );

  if (preview) {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else {
    doc.save(`Rechnung-${invoice.invoiceNumber}.pdf`);
  }
}

export async function generateInvoicePDF(
  invoice: Invoice,
  partner: Partner | undefined,
  customer: Customer | undefined
): Promise<void> {
  return generateInvoicePDFInternal(invoice, partner, customer, false);
}

export async function previewInvoicePDF(
  invoice: Invoice,
  partner: Partner | undefined,
  customer: Customer | undefined
): Promise<void> {
  return generateInvoicePDFInternal(invoice, partner, customer, true);
}
