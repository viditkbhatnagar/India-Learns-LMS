import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type {
  AssignmentSubmissionsReportDto,
  AttendanceReportDto,
  BatchSummaryReportDto,
  StaffAttendanceReportDto,
} from 'india-learns-shared-types';

// M10 — Excel + PDF renderers for the three Reports (LMS_Faculty_Features
// §4). Each function returns a Buffer ready to stream from an Express
// handler with the right Content-Type + Content-Disposition.
//
// PDF is a simpler, single-page-per-report layout suitable for sharing
// over WhatsApp / printing; XLSX is the analyst-grade format.

function paiseToRupees(p: number): number {
  return Math.round(p) / 100;
}

function styleHeaderRow(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F2F4F' }, // brand-navy
  };
  row.height = 22;
  row.alignment = { vertical: 'middle' };
}

function addTitleBlock(
  ws: ExcelJS.Worksheet,
  title: string,
  meta: Array<[string, string]>,
): void {
  ws.addRow([title]).font = { size: 16, bold: true, color: { argb: 'FF0F2F4F' } };
  for (const [k, v] of meta) {
    const r = ws.addRow([k, v]);
    r.getCell(1).font = { bold: true, color: { argb: 'FF6B6B6B' } };
  }
  ws.addRow([]);
}

// --------- Attendance --------------------------------------------------

export async function renderAttendanceReportXlsx(
  report: AttendanceReportDto,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'India Learns';
  wb.created = new Date(report.generatedAt);
  const ws = wb.addWorksheet('Attendance');

  addTitleBlock(ws, 'Attendance report', [
    ['Batch', report.batchCode],
    ['Programme', report.programName],
    ['Date range', `${report.filters.from} → ${report.filters.to}`],
    ['Sessions in range', String(report.sessionCount)],
    ['Generated', new Date(report.generatedAt).toLocaleString('en-IN')],
  ]);

  const header = ws.addRow([
    'Student code',
    'Student name',
    'Present',
    'Absent',
    'Late',
    'Excused',
    'Marked',
    'Attendance %',
  ]);
  styleHeaderRow(header);

  for (const r of report.rows) {
    ws.addRow([
      r.studentCode ?? '',
      r.studentName,
      r.presentCount,
      r.absentCount,
      r.lateCount,
      r.excusedCount,
      r.totalMarked,
      r.attendanceRate,
    ]);
  }
  // Column widths.
  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 32;
  for (let i = 3; i <= 8; i += 1) ws.getColumn(i).width = 12;
  ws.getColumn(8).numFmt = '0.0"%"';

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// --------- Batch summary -----------------------------------------------

export async function renderBatchSummaryReportXlsx(
  report: BatchSummaryReportDto,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'India Learns';
  wb.created = new Date(report.generatedAt);
  const ws = wb.addWorksheet('Batch summary');

  addTitleBlock(ws, 'Batch summary', [
    ['Batch', report.batchCode],
    ['Programme', report.programName],
    ['Generated', new Date(report.generatedAt).toLocaleString('en-IN')],
  ]);

  // Section: enrolment
  const sec1 = ws.addRow(['Enrolment']);
  sec1.font = { bold: true, color: { argb: 'FFE85D2C' } }; // brand-orange
  ws.addRow(['Enrolled students', report.enrolledStudentCount]);
  ws.addRow(['Active students', report.activeStudentCount]);
  ws.addRow([]);

  // Section: attendance
  const sec2 = ws.addRow(['Attendance']);
  sec2.font = { bold: true, color: { argb: 'FFE85D2C' } };
  ws.addRow(['Total sessions held', report.totalSessions]);
  const attRow = ws.addRow(['Average attendance %', report.averageAttendanceRate]);
  attRow.getCell(2).numFmt = '0.0"%"';
  ws.addRow([]);

  // Section: assignments
  const sec3 = ws.addRow(['Assignments']);
  sec3.font = { bold: true, color: { argb: 'FFE85D2C' } };
  ws.addRow(['Total assignments', report.totalAssignments]);
  ws.addRow(['Submissions published', report.publishedSubmissionCount]);
  ws.addRow(['Submissions graded (draft)', report.draftSubmissionCount]);
  ws.addRow(['Submissions awaiting grading', report.needsGradingCount]);
  ws.addRow([]);

  // Section: fees
  const sec4 = ws.addRow(['Fees (INR)']);
  sec4.font = { bold: true, color: { argb: 'FFE85D2C' } };
  const r1 = ws.addRow(['Total billed', paiseToRupees(report.totalBilledPaise)]);
  const r2 = ws.addRow(['Total collected', paiseToRupees(report.totalCollectedPaise)]);
  const r3 = ws.addRow(['Total outstanding', paiseToRupees(report.totalOutstandingPaise)]);
  for (const r of [r1, r2, r3]) {
    r.getCell(2).numFmt = '"₹"#,##0.00';
  }

  ws.getColumn(1).width = 36;
  ws.getColumn(2).width = 18;

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// --------- Assignment submissions matrix -------------------------------

export async function renderAssignmentSubmissionsReportXlsx(
  report: AssignmentSubmissionsReportDto,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'India Learns';
  wb.created = new Date(report.generatedAt);
  const ws = wb.addWorksheet('Submissions');

  addTitleBlock(ws, 'Assignment submissions', [
    ['Batch', report.batchCode],
    ['Programme', report.programName],
    ['Due-by range', `${report.filters.from} → ${report.filters.to}`],
    ['Assignments in range', String(report.assignments.length)],
    ['Students enrolled', String(report.students.length)],
    ['Generated', new Date(report.generatedAt).toLocaleString('en-IN')],
  ]);

  // Pivot to a matrix: rows are students, columns are assignments. Cells
  // are short status codes ("✓" published / "G" needs grading / "D" draft /
  // "S" submitted / "—" not started). The long form lives on a second sheet
  // so analysts can pivot.
  const header = [
    'Student code',
    'Student name',
    ...report.assignments.map((a) => `${a.title} (${a.courseName})`),
  ];
  styleHeaderRow(ws.addRow(header));

  const cellByKey = new Map(
    report.cells.map((c) => [`${c.assignmentId}::${c.studentId}`, c]),
  );

  for (const st of report.students) {
    const row: (string | number)[] = [st.code ?? '', st.name];
    for (const a of report.assignments) {
      const c = cellByKey.get(`${a.id}::${st.id}`);
      const code =
        c?.status === 'published'
          ? '✓'
          : c?.status === 'graded_draft'
            ? 'D'
            : c?.status === 'needs_grading'
              ? 'G'
              : c?.status === 'submitted'
                ? 'S'
                : '—';
      const late = c?.lateFlag ? ' (late)' : '';
      const score =
        c?.status === 'published' && typeof c.score === 'number' ? ` ${c.score}` : '';
      row.push(`${code}${score}${late}`);
    }
    ws.addRow(row);
  }

  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 28;
  for (let i = 3; i <= header.length; i += 1) ws.getColumn(i).width = 18;

  // Second sheet — flat cell list for downstream pivot tables.
  const ws2 = wb.addWorksheet('Submissions (flat)');
  styleHeaderRow(
    ws2.addRow([
      'Assignment',
      'Course',
      'Due at',
      'Student code',
      'Student name',
      'Status',
      'Score',
      'Submitted at',
      'Late',
    ]),
  );
  const aMap = new Map(report.assignments.map((a) => [a.id, a]));
  const sMap = new Map(report.students.map((s) => [s.id, s]));
  for (const c of report.cells) {
    const a = aMap.get(c.assignmentId);
    const s = sMap.get(c.studentId);
    if (!a || !s) continue;
    ws2.addRow([
      a.title,
      a.courseName,
      new Date(a.dueAt).toLocaleString('en-IN'),
      s.code ?? '',
      s.name,
      c.status,
      c.score ?? '',
      c.submittedAt ? new Date(c.submittedAt).toLocaleString('en-IN') : '',
      c.lateFlag ? 'yes' : '',
    ]);
  }
  ws2.getColumn(1).width = 28;
  ws2.getColumn(2).width = 22;
  ws2.getColumn(3).width = 22;
  ws2.getColumn(4).width = 14;
  ws2.getColumn(5).width = 28;
  ws2.getColumn(6).width = 16;
  ws2.getColumn(7).width = 10;
  ws2.getColumn(8).width = 22;
  ws2.getColumn(9).width = 8;

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// --------- PDF renderers ----------------------------------------------
//
// pdfkit is already a dep (it powers receipts in receiptService.ts). The
// three reports each render as a single-A4 page with a brand-coloured
// header, a metadata block, and a table or summary grid. Long tables
// flow to additional pages automatically — pdfkit handles pagination
// when y exceeds the page's bottom margin.

function streamToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function pdfHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  meta: Array<[string, string]>,
): void {
  doc
    .fillColor('#0F2F4F') // brand-navy
    .fontSize(20)
    .text('India Learns', { align: 'left' });
  doc
    .fillColor('#0F2F4F')
    .fontSize(14)
    .text(title);
  doc.moveDown(0.5);
  doc.fontSize(9).fillColor('#6B6B6B');
  for (const [k, v] of meta) {
    doc.text(`${k}: `, { continued: true }).fillColor('#0F2F4F').text(v).fillColor('#6B6B6B');
  }
  doc.moveDown(0.5);
  // Separator
  doc
    .strokeColor('#E85D2C') // brand-orange
    .lineWidth(1.5)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.75);
  doc.fillColor('#1A1A1A');
}

export async function renderAttendanceReportPdf(
  report: AttendanceReportDto,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  pdfHeader(doc, 'Attendance report', [
    ['Batch', report.batchCode],
    ['Programme', report.programName],
    ['Date range', `${report.filters.from} → ${report.filters.to}`],
    ['Sessions in range', String(report.sessionCount)],
    ['Generated', new Date(report.generatedAt).toLocaleString('en-IN')],
  ]);

  // Table header
  const cols = [
    { label: 'Code', x: 40, w: 75 },
    { label: 'Student', x: 115, w: 195 },
    { label: 'P', x: 310, w: 30, align: 'right' as const },
    { label: 'A', x: 340, w: 30, align: 'right' as const },
    { label: 'L', x: 370, w: 30, align: 'right' as const },
    { label: 'E', x: 400, w: 30, align: 'right' as const },
    { label: 'Marked', x: 430, w: 55, align: 'right' as const },
    { label: 'Rate', x: 485, w: 70, align: 'right' as const },
  ];
  doc.fontSize(9).fillColor('#0F2F4F').font('Helvetica-Bold');
  const headerY = doc.y;
  for (const c of cols) {
    doc.text(c.label, c.x, headerY, { width: c.w, align: c.align ?? 'left' });
  }
  doc.font('Helvetica').fillColor('#1A1A1A');
  doc.moveDown(0.4);

  for (const r of report.rows) {
    if (doc.y > doc.page.height - 80) {
      doc.addPage();
    }
    const { y } = doc;
    doc.fontSize(8).text(r.studentCode ?? '—', cols[0]!.x, y, { width: cols[0]!.w });
    doc.text(r.studentName, cols[1]!.x, y, { width: cols[1]!.w });
    doc.text(String(r.presentCount), cols[2]!.x, y, { width: cols[2]!.w, align: 'right' });
    doc.text(String(r.absentCount), cols[3]!.x, y, { width: cols[3]!.w, align: 'right' });
    doc.text(String(r.lateCount), cols[4]!.x, y, { width: cols[4]!.w, align: 'right' });
    doc.text(String(r.excusedCount), cols[5]!.x, y, { width: cols[5]!.w, align: 'right' });
    doc.text(String(r.totalMarked), cols[6]!.x, y, { width: cols[6]!.w, align: 'right' });
    doc.text(
      r.totalMarked > 0 ? `${r.attendanceRate.toFixed(1)}%` : '—',
      cols[7]!.x,
      y,
      { width: cols[7]!.w, align: 'right' },
    );
    doc.moveDown(0.35);
  }

  return streamToBuffer(doc);
}

export async function renderBatchSummaryReportPdf(
  report: BatchSummaryReportDto,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  pdfHeader(doc, 'Batch summary', [
    ['Batch', report.batchCode],
    ['Programme', report.programName],
    ['Generated', new Date(report.generatedAt).toLocaleString('en-IN')],
  ]);

  const sections: Array<[string, Array<[string, string]>]> = [
    [
      'Enrolment',
      [
        ['Enrolled students', String(report.enrolledStudentCount)],
        ['Active students', String(report.activeStudentCount)],
      ],
    ],
    [
      'Attendance',
      [
        ['Total sessions held', String(report.totalSessions)],
        ['Average attendance', `${report.averageAttendanceRate.toFixed(1)}%`],
      ],
    ],
    [
      'Assignments',
      [
        ['Total assignments', String(report.totalAssignments)],
        ['Submissions published', String(report.publishedSubmissionCount)],
        ['Submissions graded (draft)', String(report.draftSubmissionCount)],
        ['Submissions awaiting grading', String(report.needsGradingCount)],
      ],
    ],
    [
      'Fees (INR)',
      [
        ['Total billed', `₹${(report.totalBilledPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
        ['Total collected', `₹${(report.totalCollectedPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
        ['Total outstanding', `₹${(report.totalOutstandingPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
      ],
    ],
  ];

  for (const [title, rows] of sections) {
    doc.fontSize(11).fillColor('#E85D2C').font('Helvetica-Bold').text(title);
    doc.moveDown(0.2);
    doc.font('Helvetica').fillColor('#1A1A1A').fontSize(10);
    for (const [k, v] of rows) {
      const { y } = doc;
      doc.fillColor('#6B6B6B').text(k, 40, y, { width: 280 });
      doc.fillColor('#0F2F4F').text(v, 320, y, { width: 220, align: 'right' });
      doc.moveDown(0.25);
    }
    doc.moveDown(0.5);
  }

  return streamToBuffer(doc);
}

export async function renderAssignmentSubmissionsReportPdf(
  report: AssignmentSubmissionsReportDto,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
  pdfHeader(doc, 'Assignment submissions', [
    ['Batch', report.batchCode],
    ['Programme', report.programName],
    ['Due-by range', `${report.filters.from} → ${report.filters.to}`],
    ['Assignments in range', String(report.assignments.length)],
    ['Students enrolled', String(report.students.length)],
    ['Generated', new Date(report.generatedAt).toLocaleString('en-IN')],
  ]);

  if (report.assignments.length === 0 || report.students.length === 0) {
    doc.fontSize(10).fillColor('#6B6B6B').text('Nothing to show for these filters.');
    return streamToBuffer(doc);
  }

  // Use the flat cell list — much simpler than reproducing the matrix
  // in PDF land when the column count can be large.
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#0F2F4F');
  const cols = [
    { label: 'Student', x: 40, w: 160 },
    { label: 'Code', x: 200, w: 80 },
    { label: 'Assignment', x: 280, w: 220 },
    { label: 'Course', x: 500, w: 140 },
    { label: 'Status', x: 640, w: 90 },
    { label: 'Score', x: 730, w: 60, align: 'right' as const },
  ];
  const headerY = doc.y;
  for (const c of cols) {
    doc.text(c.label, c.x, headerY, { width: c.w, align: c.align ?? 'left' });
  }
  doc.font('Helvetica').fillColor('#1A1A1A');
  doc.moveDown(0.4);

  const aMap = new Map(report.assignments.map((a) => [a.id, a]));
  const sMap = new Map(report.students.map((s) => [s.id, s]));
  for (const c of report.cells) {
    const a = aMap.get(c.assignmentId);
    const s = sMap.get(c.studentId);
    if (!a || !s) continue;
    if (doc.y > doc.page.height - 60) doc.addPage();
    const { y } = doc;
    doc.fontSize(8);
    doc.text(s.name, cols[0]!.x, y, { width: cols[0]!.w });
    doc.text(s.code ?? '—', cols[1]!.x, y, { width: cols[1]!.w });
    doc.text(a.title, cols[2]!.x, y, { width: cols[2]!.w });
    doc.text(a.courseName, cols[3]!.x, y, { width: cols[3]!.w });
    doc.text(c.status.replace('_', ' '), cols[4]!.x, y, { width: cols[4]!.w });
    doc.text(
      typeof c.score === 'number' ? `${c.score} / ${a.maxScore}` : '—',
      cols[5]!.x,
      y,
      { width: cols[5]!.w, align: 'right' },
    );
    doc.moveDown(0.3);
  }

  return streamToBuffer(doc);
}

// --------- Staff attendance --------------------------------------------

export async function renderStaffAttendanceReportXlsx(
  report: StaffAttendanceReportDto,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'India Learns';
  wb.created = new Date(report.generatedAt);
  const ws = wb.addWorksheet('Staff attendance');

  addTitleBlock(ws, 'Staff attendance report', [
    ['Date range', `${report.filters.from} → ${report.filters.to}`],
    ['Role filter', report.filters.role ?? 'All staff roles'],
    ['Working days in range', String(report.workingDayCount)],
    ['Generated', new Date(report.generatedAt).toLocaleString('en-IN')],
  ]);

  const header = ws.addRow([
    'Staff code',
    'Staff name',
    'Role',
    'Present',
    'Absent',
    'Late',
    'Leave',
    'Half day',
    'Marked',
    'Attendance %',
  ]);
  styleHeaderRow(header);

  for (const r of report.rows) {
    ws.addRow([
      r.userCode ?? '',
      r.userName,
      r.role,
      r.presentCount,
      r.absentCount,
      r.lateCount,
      r.leaveCount,
      r.halfDayCount,
      r.totalMarked,
      r.attendanceRate,
    ]);
  }
  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 32;
  ws.getColumn(3).width = 18;
  for (let i = 4; i <= 10; i += 1) ws.getColumn(i).width = 12;
  ws.getColumn(10).numFmt = '0.0"%"';

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function renderStaffAttendanceReportPdf(
  report: StaffAttendanceReportDto,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 36 });

  doc.fontSize(16).fillColor('#0F2F4F').text('Staff attendance report', { underline: false });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#444');
  doc.text(`Date range: ${report.filters.from} → ${report.filters.to}`);
  doc.text(`Role filter: ${report.filters.role ?? 'All staff roles'}`);
  doc.text(`Working days in range: ${report.workingDayCount}`);
  doc.text(`Generated: ${new Date(report.generatedAt).toLocaleString('en-IN')}`);
  doc.moveDown(0.6);

  // Header row.
  doc.fontSize(9).fillColor('#0F2F4F').font('Helvetica-Bold');
  doc.text('Staff', 36, doc.y, { continued: true, width: 180 });
  doc.text('Role', { continued: true, width: 80 });
  doc.text('P', { continued: true, width: 30, align: 'right' });
  doc.text('A', { continued: true, width: 30, align: 'right' });
  doc.text('L', { continued: true, width: 30, align: 'right' });
  doc.text('Lv', { continued: true, width: 30, align: 'right' });
  doc.text('Half', { continued: true, width: 36, align: 'right' });
  doc.text('Rate', { width: 50, align: 'right' });
  doc.moveDown(0.25);
  doc.font('Helvetica').fillColor('#222');

  for (const r of report.rows) {
    doc.text(r.userName, 36, doc.y, { continued: true, width: 180 });
    doc.text(r.role, { continued: true, width: 80 });
    doc.text(String(r.presentCount), { continued: true, width: 30, align: 'right' });
    doc.text(String(r.absentCount), { continued: true, width: 30, align: 'right' });
    doc.text(String(r.lateCount), { continued: true, width: 30, align: 'right' });
    doc.text(String(r.leaveCount), { continued: true, width: 30, align: 'right' });
    doc.text(String(r.halfDayCount), { continued: true, width: 36, align: 'right' });
    doc.text(
      r.totalMarked > 0 ? `${r.attendanceRate.toFixed(1)}%` : '—',
      { width: 50, align: 'right' },
    );
    doc.moveDown(0.3);
  }

  return streamToBuffer(doc);
}
