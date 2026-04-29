import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { format } from 'date-fns';

// ─── Shared styling constants ─────────────────────────────────────────────────

const BRAND_COLOR  = '#2563EB'; // Blue
const BORDER_COLOR = '#E2E8F0';
const ROW_ALT_BG   = '#F8FAFC';
const TEXT_DARK    = '#1E293B';
const TEXT_MUTED   = '#64748B';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectRow {
  invoiceNumber:     string | null;
  projectName:       string;
  serviceName:       string;
  employeeName?:     string;
  startDate:         Date;
  status:            string;
  paymentMode:       string | null;
  totalProjectPrice?: string | number | null;
  makingCost?:        string | number | null;
  calculatedAmount:  string | number | null;
  createdAt:         Date;
}

interface PaymentRow {
  employeeName:     string;
  invoiceNumber:    string | null;
  projectName:      string;
  calculatedAmount: number;
  totalPaid:        number;
  pendingAmount:    number;
  paymentMode:      string | null;
  status:           string;
  paidAt:           Date | null;
}

// ─── PDF helpers ──────────────────────────────────────────────────────────────

function initDoc(res: Response, filename: string): PDFKit.PDFDocument {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);
  return doc;
}

function drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string): void {
  doc.rect(0, 0, doc.page.width, 70).fill(BRAND_COLOR);
  doc
    .fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(18)
    .text('ServiceFlow ERP', 40, 18);
  doc
    .font('Helvetica')
    .fontSize(10)
    .text(title, 40, 40);
  doc
    .fontSize(8)
    .fillColor('#BFDBFE')
    .text(subtitle, 40, 54);
  doc.fillColor(TEXT_DARK);
  doc.moveDown(3);
}

function drawFooter(doc: PDFKit.PDFDocument): void {
  const pages = (doc.bufferedPageRange?.() ?? { count: 1 }).count;
  for (let i = 0; i < pages; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(7)
      .fillColor(TEXT_MUTED)
      .text(
        `Page ${i + 1} of ${pages}  |  Confidential — ServiceFlow ERP`,
        40,
        doc.page.height - 30,
        { align: 'center', width: doc.page.width - 80 }
      );
  }
}

function drawTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  colWidths: number[]
): void {
  const startX     = 40;
  const headerH    = 20;
  const rowH       = 16;
  let   y          = doc.y;
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  // Header row
  doc.rect(startX, y, tableWidth, headerH).fill(BRAND_COLOR);
  let x = startX;
  headers.forEach((h, i) => {
    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(7)
      .text(h, x + 4, y + 6, { width: colWidths[i] - 8, lineBreak: false });
    x += colWidths[i];
  });
  y += headerH;

  // Data rows
  rows.forEach((row, ri) => {
    if (y + rowH > doc.page.height - 50) {
      doc.addPage();
      y = 90; // after header area
    }

    if (ri % 2 === 0) {
      doc.rect(startX, y, tableWidth, rowH).fill(ROW_ALT_BG);
    }

    // Row border
    doc.moveTo(startX, y + rowH).lineTo(startX + tableWidth, y + rowH).stroke(BORDER_COLOR);

    let cellX = startX;
    row.forEach((cell, ci) => {
      doc
        .fillColor(TEXT_DARK)
        .font('Helvetica')
        .fontSize(7)
        .text(cell ?? '—', cellX + 4, y + 5, { width: colWidths[ci] - 8, lineBreak: false });
      cellX += colWidths[ci];
    });

    y += rowH;
  });

  doc.y = y + 5;
}

function fmt(date: Date | null | undefined): string {
  if (!date) return '—';
  return format(new Date(date), 'dd MMM yyyy');
}

function fmtAmt(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '—';
  return `₹${Math.round(Number(val)).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ─── Generate Projects PDF ────────────────────────────────────────────────────

export const generateProjectsPdf = (
  res: Response,
  rows: ProjectRow[],
  isAdmin: boolean,
  exportedBy: string,
  filterLabel: string
): void => {
  const doc  = initDoc(res, `projects_${Date.now()}.pdf`);
  const date = format(new Date(), 'dd MMM yyyy, HH:mm');

  drawHeader(
    doc,
    'Project Report',
    `Generated on ${date}  |  Exported by ${exportedBy}  |  Filter: ${filterLabel}`
  );

  if (rows.length === 0) {
    doc.fontSize(11).fillColor(TEXT_MUTED).text('No records found for the selected filters.', { align: 'center' });
  } else if (isAdmin) {
    const headers   = ['Invoice No', 'Project', 'Service', 'Employee', 'Start Date', 'Status', 'Pay Mode', 'Total Price', 'Making Cost', 'Calc. Amount', 'Created'];
    const colWidths = [80, 100, 80, 80, 65, 60, 55, 75, 75, 75, 65];
    const tableRows = rows.map((r) => [
      r.invoiceNumber ?? '—',
      r.projectName,
      r.serviceName,
      r.employeeName ?? '—',
      fmt(r.startDate),
      r.status,
      r.paymentMode ?? '—',
      fmtAmt(r.totalProjectPrice),
      fmtAmt(r.makingCost),
      fmtAmt(r.calculatedAmount),
      fmt(r.createdAt),
    ]);
    drawTable(doc, headers, tableRows, colWidths);
  } else {
    const headers   = ['Invoice No', 'Project', 'Service', 'Start Date', 'Status', 'Pay Mode', 'Calc. Amount', 'Created'];
    const colWidths = [90, 130, 100, 75, 70, 70, 90, 75];
    const tableRows = rows.map((r) => [
      r.invoiceNumber ?? '—',
      r.projectName,
      r.serviceName,
      fmt(r.startDate),
      r.status,
      r.paymentMode ?? '—',
      fmtAmt(r.calculatedAmount),
      fmt(r.createdAt),
    ]);
    drawTable(doc, headers, tableRows, colWidths);
  }

  drawFooter(doc);
  doc.end();
};

// ─── Generate Payments PDF ────────────────────────────────────────────────────

export const generatePaymentsPdf = (
  res: Response,
  rows: PaymentRow[],
  exportedBy: string,
  filterLabel: string
): void => {
  const doc  = initDoc(res, `payments_${Date.now()}.pdf`);
  const date = format(new Date(), 'dd MMM yyyy, HH:mm');

  drawHeader(
    doc,
    'Payment Report',
    `Generated on ${date}  |  Exported by ${exportedBy}  |  Filter: ${filterLabel}`
  );

  const headers   = ['Employee', 'Invoice No', 'Project', 'Amount', 'Pay Mode', 'Status', 'Paid Date'];
  const colWidths = [110, 90, 130, 90, 75, 70, 85];

  if (rows.length === 0) {
    doc.fontSize(11).fillColor(TEXT_MUTED).text('No records found for the selected filters.', { align: 'center' });
  } else {
    const tableRows = rows.map((r) => [
      r.employeeName,
      r.invoiceNumber ?? '—',
      r.projectName,
      fmtAmt(r.totalPaid),
      r.paymentMode ?? '—',
      r.status,
      fmt(r.paidAt),
    ]);
    drawTable(doc, headers, tableRows, colWidths);

    // Summary row
    const totalPaid    = rows.reduce((s, r) => s + r.totalPaid,        0);
    const totalPending = rows.reduce((s, r) => s + r.pendingAmount,    0);
    const totalCalc    = rows.reduce((s, r) => s + r.calculatedAmount, 0);

    doc.moveDown(1);
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(TEXT_DARK)
      .text(`Total Calculated: ${fmtAmt(totalCalc)}   |   Total Paid: ${fmtAmt(totalPaid)}   |   Total Pending: ${fmtAmt(totalPending)}`, { align: 'right' });
  }

  drawFooter(doc);
  doc.end();
};
