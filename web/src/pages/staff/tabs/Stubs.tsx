import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader } from '../../../components/ui/Card.js';
import { Button } from '../../../components/ui/Button.js';

/**
 * Phase B-2 stubs — Students / Announcements / Settings render
 * placeholder cards so the shell's six tabs all click through to
 * something coherent. Real implementations land in B-3+.
 */

export function CourseStudentsStub(): JSX.Element {
  return (
    <Card>
      <CardHeader
        title="Students — coming soon"
        subtitle="Roster + per-student grades + attendance summary."
      />
      <p className="text-sm text-muted max-w-[68ch]">
        The Students tab will surface enrolled students for this course with
        their submission completeness, attendance rate, and cumulative
        grade. Click-through to individual profiles. Spec lands once the
        shape is validated against pilot usage.
      </p>
    </Card>
  );
}

export function CourseAnnouncementsStub({ courseId }: { courseId: string }): JSX.Element {
  return (
    <Card>
      <CardHeader
        title="Announcements"
        subtitle="Use the existing course composer for now — full read-receipt history lands later."
      />
      <p className="text-sm text-muted max-w-[68ch]">
        Course announcements are still posted from the legacy composer on
        the faculty course detail page; the dedicated tab + history list
        are deferred to B-3.
      </p>
      <div className="mt-3">
        <Link to={`/faculty/courses/${courseId}/legacy`}>
          <Button variant="secondary">Open legacy composer</Button>
        </Link>
      </div>
    </Card>
  );
}

export function CourseSettingsStub(): JSX.Element {
  return (
    <Card>
      <CardHeader
        title="Settings — coming soon"
        subtitle="Course metadata, grading scheme, attendance policy, collaborator management."
      />
      <p className="text-sm text-muted max-w-[68ch]">
        Course-level metadata edits (rename, summary, certificate template)
        currently happen via the admin Courses screen. The in-shell
        Settings tab consolidates those edits + attendance threshold
        configuration once Logan signs off on the policy defaults
        (curriculum-import/OPEN-QUESTIONS.md).
      </p>
    </Card>
  );
}
