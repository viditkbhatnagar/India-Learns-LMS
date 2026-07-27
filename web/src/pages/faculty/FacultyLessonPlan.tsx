import type { JSX } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { UploadLessonPlanCard } from '../../components/UploadLessonPlanCard.js';

/**
 * Faculty-facing lesson-plan upload. Same card the super admin sees, minus the
 * generator import (that stays super-admin only). The server restricts a
 * faculty member to replacing courses they actually teach, and a course they
 * create here is assigned to them automatically.
 */
export function FacultyLessonPlanPage(): JSX.Element {
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        eyebrow="Curriculum"
        title="Lesson plans"
        subtitle="Upload your finalized lesson-plan Word file to build or update a course."
      />
      <UploadLessonPlanCard />
      <p className="text-xs text-muted">
        You can replace the lessons of any course you teach, or create a new course (it will be
        assigned to you as a draft). Your file's modules and lessons become the course exactly as
        written.
      </p>
    </div>
  );
}
