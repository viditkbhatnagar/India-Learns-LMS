# M10q — MongoDB GridFS file storage — smoke walkthrough

**Decision:** [D-094](/memory/decisions.md).

## What changed

Direct file uploads now flow through `POST /v1/files/upload` and land in a MongoDB GridFS bucket (`il_files`) on the app's Atlas cluster. Default `STORAGE_PROVIDER` is now `mongo` — Cloudinary credentials are no longer required for production.

Affected UI surfaces:
- **Profile → Resume** — students upload a PDF or paste a URL.
- **Admin → Users → Resume** — admins do the same on behalf of a student.
- **Admin → Users → Documents** — admins upload a PDF / image OR paste a Drive / Dropbox link.
- **Chat → composer** — paperclip icon picks a file; attachments render inline in message bubbles.

## Test plan

1. **Resume upload (student).**
   - Sign in as a student.
   - Profile → "Click to choose a PDF" → pick any PDF ≤ 5 MB.
   - Expect: "Resume saved." banner. The URL field auto-populates with `https://<api-origin>/v1/files/<24-char-id>`.
   - Click "Open current resume →" — the PDF opens inline in a new tab (no download prompt).
2. **Resume upload (admin).**
   - Sign in as admin → Users → pick a student → Resume card.
   - Same flow as above; the URL the student sees on Profile updates after refresh.
3. **Student document upload (admin).**
   - Admin → Users → pick a student → Documents.
   - Pick "SSLC" → click upload area → pick a PDF.
   - Expect: "File uploaded — review the type / label, then save." Click "Add document".
   - Document appears in the list with "Open" link.
4. **Chat attachment.**
   - Open Chat → pick a conversation.
   - Click paperclip → pick a file.
   - Expect: pill appears above the composer with filename + ×.
   - Type a message (optional) → Send.
   - Expect: message renders with the filename as a clickable link under the body.
   - Other party sees the same in real time.
5. **Reject oversize / missing folder.**
   - DevTools → Network: `POST /v1/files/upload` without `?folder=` → 422.
   - Upload > 5 MB file → 413 (multer LIMIT_FILE_SIZE).
6. **Unauth blocks GET.**
   - Open a `/v1/files/<id>` URL in an incognito window → 401.
7. **Storage adapter test suite.**
   - `npm test -w api -- tests/integration/files.test.ts` → 7 / 7 green.

## Roll-back

If GridFS misbehaves: set `STORAGE_PROVIDER=cloudinary` + Cloudinary credentials on Render. Existing GridFS URLs keep serving (the GET route still works); new uploads land in Cloudinary. No code change required.
