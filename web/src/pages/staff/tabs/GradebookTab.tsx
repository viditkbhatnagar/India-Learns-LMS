import type { JSX } from 'react';
import { CourseGradebookView } from '../CourseGradebookView.js';

/**
 * The Gradebook tab is a thin wrapper around the existing B-1 gradebook
 * grid. The legacy /faculty/courses/:id/gradebook + /admin/.../gradebook
 * routes redirect into this shell, so the grid behaviour is unchanged.
 */
export function CourseGradebookTab({ courseId }: { courseId: string }): JSX.Element {
  return <CourseGradebookView courseId={courseId} />;
}
