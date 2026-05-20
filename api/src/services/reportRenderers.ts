import ExcelJS from 'exceljs';
import type {
  AssignmentSubmissionsReportDto,
  AttendanceReportDto,
  BatchSummaryReportDto,
} from 'india-learns-shared-types';

// M10 — Excel renderers for the three Reports (LMS_Faculty_Features §4).
// Each function returns a Buffer ready to stream from an Express handler
// with the right Content-Type and Content-Disposition headers.
//
// PDF rendering (pdfkit) is intentionally deferred to a follow-up PR; the
// requirements doc says "PDF or Excel" and Excel is the one ops teams use
// the most.

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
