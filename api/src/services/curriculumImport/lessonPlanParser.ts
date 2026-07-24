// Parse a lesson-plan document's TEXT (pandoc/mammoth plain text) into
// modules + lessons. Handles both generator export shapes:
//   - "MOD101: <module title>" + "Lesson 1: <title>" (Fashion Design docx)
//   - "M1: <module title>"     + "Lesson 1: <title>" (Digital Fashion docx)
// Everything between a lesson heading and the next heading becomes that
// lesson's description; a "Duration: N minutes" line sets plannedMinutes.

export interface ParsedLesson {
  number: number;
  title: string;
  plannedMinutes: number | null;
  description: string;
}
export interface ParsedModule {
  title: string;
  lessons: ParsedLesson[];
}
export interface ParsedLessonPlan {
  modules: ParsedModule[];
}

// Module/lesson headings use a COLON separator ("MOD101: …", "M1: …",
// "Lesson 1: …"). Must NOT be looser than that — a hyphen separator would let
// "M1-LO1:" (module-outcome codes inside a lesson body) masquerade as modules.
const MODULE_RE = /^(?:MOD\w+|M\d+|Module\s+\d+):\s*(.+)$/i;
const LESSON_RE = /^Lesson\s+(\d+):\s*(.+)$/i;
const DURATION_RE = /Duration:\s*(\d+)\s*min/i;

function clean(line: string): string {
  return line
    .replace(/^#+\s*/, '') // markdown heading marks, if fed markdown
    .replace(/\*\*/g, '') // bold markers
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseLessonPlan(text: string): ParsedLessonPlan {
  const rawLines = (text ?? '').split(/\r?\n/);

  // Start after the "Module Lesson Plans" section so the summary tables at the
  // top (which also mention lessons) don't get parsed as content.
  let startIdx = 0;
  for (let i = 0; i < rawLines.length; i += 1) {
    if (/module lesson plans/i.test(rawLines[i] ?? '')) {
      startIdx = i + 1;
      break;
    }
  }

  const modules: ParsedModule[] = [];
  let curModule: ParsedModule | null = null;
  let curLesson: ParsedLesson | null = null;
  let buf: string[] = [];

  const flushLesson = (): void => {
    if (curLesson && curModule) {
      curLesson.description = buf.join('\n').trim().slice(0, 8000);
      curModule.lessons.push(curLesson);
    }
    curLesson = null;
    buf = [];
  };

  for (let i = startIdx; i < rawLines.length; i += 1) {
    const line = clean(rawLines[i] ?? '');
    if (!line) {
      if (curLesson) buf.push('');
      continue;
    }
    const mLes = LESSON_RE.exec(line);
    if (mLes) {
      flushLesson();
      if (!curModule) curModule = { title: 'Module 1', lessons: [] };
      curLesson = {
        number: Number(mLes[1]),
        title: (mLes[2] ?? '').trim().slice(0, 240),
        plannedMinutes: null,
        description: '',
      };
      continue;
    }
    const mMod = MODULE_RE.exec(line);
    if (mMod) {
      flushLesson();
      if (curModule) modules.push(curModule);
      curModule = { title: (mMod[1] ?? '').trim().slice(0, 200), lessons: [] };
      continue;
    }
    if (curLesson) {
      const d = DURATION_RE.exec(line);
      if (d && curLesson.plannedMinutes == null) {
        curLesson.plannedMinutes = Math.min(600, Number(d[1]));
      }
      buf.push(line);
    }
  }
  flushLesson();
  if (curModule) modules.push(curModule);

  return { modules: modules.filter((m) => m.lessons.length > 0) };
}
