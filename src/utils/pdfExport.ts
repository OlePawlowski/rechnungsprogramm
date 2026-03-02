import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { parseISO } from 'date-fns';
import type { Invoice, Partner, Customer } from '../types';
import { formatCurrency } from './invoiceCalculations';
import { COMPANY } from '../config/company';

function formatDateDe(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

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
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - 2 * margin;
  let y = margin;

  const [r, g, b] = COMPANY.primaryColorRgb;

  // === HEADER: Logo + Company (kompakt) ===
  const logoResult = await loadLogoAsBase64([
    window.location.origin + COMPANY.logoLocalPath,
    COMPANY.logoUrl,
  ]);
  if (logoResult) {
    const logoWidth = 36;
    const logoHeight = logoWidth * logoResult.aspectRatio;
    doc.addImage(logoResult.data, 'PNG', margin, y, logoWidth, logoHeight);
  } else {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(r, g, b);
    doc.text('HelpCare', margin, y + 8);
    doc.setTextColor(0, 0, 0);
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(COMPANY.name, pageWidth - margin, y + 4, { align: 'right' });
  doc.text(`${COMPANY.address}, ${COMPANY.postalCode} ${COMPANY.city}`, pageWidth - margin, y + 9, { align: 'right' });
  doc.text(COMPANY.country, pageWidth - margin, y + 14, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 24;

  // === RECHNUNG Titel ===
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(r, g, b);
  doc.text(`Rechnung Nr. ${invoice.invoiceNumber}`, margin, y);
  doc.setTextColor(0, 0, 0);
  y += 12;

  // === Zwei Spalten: Rechnungsempfänger | Rechnungsdetails ===
  const colWidth = contentWidth / 2;
  const leftCol = margin;
  const rightCol = margin + colWidth + 10;

  const blockStartY = y;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('RECHNUNGSEMPFÄNGER', leftCol, y);
  doc.text('RECHNUNGSDETAILS', rightCol, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  if (partner) {
    doc.text(partner.name, leftCol, y);
    y += 5;
    doc.text(partner.address, leftCol, y);
    y += 5;
    doc.text(`${partner.postalCode} ${partner.city}`, leftCol, y);
    y += 5;
    doc.text(partner.country, leftCol, y);
    y += 3;
  }

  const rightColEnd = pageWidth - margin;
  let detailY = blockStartY + 5;
  doc.text('Rechnungsnummer:', rightCol, detailY);
  doc.text(invoice.invoiceNumber, rightColEnd, detailY, { align: 'right' });
  detailY += 5;
  doc.text('Rechnungsdatum:', rightCol, detailY);
  doc.text(invoice.invoiceDate, rightColEnd, detailY, { align: 'right' });
  detailY += 5;
  const inv = invoice as { performancePeriodFrom?: string; performancePeriodTo?: string };
  if (inv.performancePeriodFrom && inv.performancePeriodTo) {
    doc.text('Leistungszeitraum:', rightCol, detailY);
    doc.text(
      `${formatDateDe(inv.performancePeriodFrom)} - ${formatDateDe(inv.performancePeriodTo)}`,
      rightColEnd,
      detailY,
      { align: 'right' }
    );
    detailY += 5;
  }
  if (invoice.referenceNumber) {
    doc.text('Referenz:', rightCol, detailY);
    doc.text(invoice.referenceNumber, rightColEnd, detailY, { align: 'right' });
    detailY += 5;
  }
  const detailsBottom = detailY;

  y = Math.max(y, detailsBottom) + 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('PFLEGEBEDÜRFTIGER', leftCol, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(customer?.name || '-', leftCol, y);
  y += 10;

  // === Betreff ===
  if (invoice.subject) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(invoice.subject, margin, y);
    y += 6;
  }

  // === Einleitungstext ===
  if (invoice.headerText) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(invoice.headerText, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 2;
    doc.setTextColor(0, 0, 0);
  }

  // === Positions-Tabelle inkl. Netto/USt/Gesamt (einheitliches Design) ===
  const vatPercent = invoice.reverseCharge ? 0 : 0;
  const vatAmount = invoice.reverseCharge ? 0 : 0;
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
    ['Gesamtbetrag netto', formatCurrency(invoice.commissionAmount)],
    [`Umsatzsteuer (${vatPercent}%)`, formatCurrency(vatAmount)],
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
      fontSize: 9,
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index === 1) {
        data.cell.styles.halign = 'right';
      }
    },
    bodyStyles: {
      fontSize: 9,
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
    styles: { cellPadding: 2 },
  });

  const lastTable = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable;
  y = (lastTable?.finalY ?? y) + 10;

  // === Rechnungsbetrag (Gesamt) – hervorgehobene Bar ===
  doc.setFillColor(r, g, b);
  doc.rect(margin, y - 3, contentWidth, 11, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Rechnungsbetrag (Gesamt)', margin + 6, y + 5);
  doc.text(formatCurrency(invoice.commissionAmount), pageWidth - margin - 6, y + 5, {
    align: 'right',
  });
  doc.setTextColor(0, 0, 0);
  y += 14;

  // === Reverse Charge Hinweis ===
  if (invoice.reverseCharge) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(
      'Reverse charge, Steuerschuldnerschaft des Leistungsempfängers § 13b UStG.',
      margin,
      y
    );
    doc.setTextColor(0, 0, 0);
    y += 8;
  }

  // === Zahlungsinformationen ===
  const footerTop = pageHeight - 32;
  if (y + 40 < footerTop) {
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text('ZAHLUNGSINFORMATIONEN', margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      `Bitte überweisen Sie den Betrag innerhalb von ${invoice.paymentTermsDays} Tagen auf folgendes Konto:`,
      margin,
      y
    );
    y += 5;
    doc.text(`IBAN: ${COMPANY.bank.iban}`, margin, y);
    y += 4;
    doc.text(`BIC: ${COMPANY.bank.bic}`, margin, y);
    y += 4;
    doc.text(`Verwendungszweck: ${invoice.invoiceNumber}`, margin, y);
    y += 8;
  }

  // === Footer – 4 Spalten wie Referenz, weiter unten ===
  const footerContentTop = footerTop + 8;

  doc.setFillColor(248, 248, 250);
  doc.rect(0, footerTop, pageWidth, pageHeight - footerTop, 'F');

  doc.setDrawColor(200, 200, 205);
  doc.setLineWidth(0.4);
  doc.line(margin, footerTop, pageWidth - margin, footerTop);

  const footerColWidth = contentWidth / 3;
  const col1 = margin;
  const col2 = margin + footerColWidth;
  const col3 = margin + footerColWidth * 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  doc.text(COMPANY.name, col1, footerContentTop - 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  let row = footerContentTop + 4;
  doc.text(COMPANY.address, col1, row);
  row += 4;
  doc.text(`${COMPANY.postalCode} ${COMPANY.city}`, col1, row);
  row += 4;
  doc.text(COMPANY.country, col1, row);

  row = footerContentTop + 4;
  if (COMPANY.phone) {
    doc.text(`Tel. ${COMPANY.phone}`, col2, row);
    row += 4;
  }
  if (COMPANY.email) {
    doc.text(`E-Mail ${COMPANY.email}`, col2, row);
    row += 4;
  }

  row = footerContentTop + 4;
  doc.text(`USt.-ID ${COMPANY.bank.vatId}`, col3, row);
  row += 4;
  doc.text(`Steuer-Nr. ${COMPANY.bank.taxId}`, col3, row);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text(
    'Vielen Dank für Ihr Vertrauen. Bei Fragen stehen wir Ihnen gerne zur Verfügung.',
    margin,
    footerTop + (pageHeight - footerTop) - 5
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
