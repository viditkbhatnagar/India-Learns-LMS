---
title: "India Learns — Admin & Staff Guide"
subtitle: "How to run the LMS, step by step"
author: "India Learns / LUC"
---

# Welcome

This guide shows you how to use the India Learns portal, one step at a time, in plain language. You don't need to be technical. Each task is written as **"click this → a form opens → fill it → save."**

**The website:** open **https://india-learns-lms.onrender.com** in Chrome (or any browser).

Words we use:

- **Program** = a diploma or certificate (e.g. *Diploma in Fashion & Retail Management*).
- **Course** = a subject inside a program.
- **Module / Session** = a topic inside a course (where the videos and PDFs live).
- **Batch** = a group of students who study together.

> **Two things to know up front:**
>
> 1. **Naming quirk:** in the left menu, **"Add & View Programs"** is where you create diplomas. The menu item just below it, **"Programs"**, actually opens the list of **courses**. This guide always tells you which one to click.
> 2. **Who does what:** as an **admin** you set up the structure — programs, batches, logins, enrolments, fees, timetable. The actual **teaching content** (uploading videos/PDFs, publishing a course) is done by the **teacher assigned to that course**, signing in with their own login. This is by design (see section 5).

---

# 1. Signing in

1. Open the website. You'll see the **Welcome back** screen.
2. Type your **Email address** and **Password** (these were given to you).
3. Click **Sign in**.

You're now on your **Dashboard**.

> **Forgot your password?** The reliable way is to ask **another admin** to reset it for you — every login has a **Reset password** button (see section 7). *(There is a "Forgot your password?" link on the sign-in screen, but automatic emails may not be switched on, so an admin reset is the sure route.)*

---

# 2. Getting around (the layout)

Once you sign in, every screen has the same frame:

- **Top bar (blue):** the India Learns logo on the left; a 🔔 bell for notifications; your name and role; and a **Log out** button on the right.
- **Left menu (sidebar):** your sections — Dashboard, Users, Programs, Finance, and so on. Click any item to open it.
- **On a phone:** tap the **☰** (three lines) icon at the top-left to open the menu.

An **Admin / Super Admin** sees every section below.

---

# 3. Add a Program (a diploma)

1. In the left menu, click **Add & View Programs**.
2. You'll see **Programs** (the list of existing ones) and, lower down, a **Create program** card.
3. In the **Name** box, type the full name, for example:
   *Diploma in Fashion & Retail Management*.
4. The **Slug** box fills in **automatically** (e.g. `diploma-in-fashion-retail-management`). This is just the web-address version of the name — **you don't need to touch it.**
5. Click **Create program**.

Done! The new program appears in the list with a green **Active** tag.

> **Note:** Earlier, **Create program** showed *"Request failed validation"* when the Slug had a space in it. That's fixed — the slug now fills in for you, and any spaces or capitals are corrected automatically. Just type the **Name** and click **Create program**.

**The three programs to add this way:**

1. Diploma in Fashion & Retail Management
2. Diploma in Digital Fashion & Entrepreneurship
3. Certificate Programme in Fashion Styling, Image Consulting & Personal Branding

---

# 4. Courses inside a program

Click **Programs** in the left menu (the item just under *Add & View Programs*). This opens the **Courses** list — every course, with a status tag (**Sandbox** = draft, not visible to students; **Published** = live to students).

**Important — where courses come from:** courses, modules and sessions are **not** created from this screen (it's view-only — there's no "create course" button). They are set up in one go by a **curriculum import**, which your India Learns contact runs from your syllabus. **If this list is empty ("No courses yet"), ask your India Learns contact to import the curriculum first.**

To look inside a course, click it. It opens in the **course workspace** with tabs across the top:

**Overview · Content · Glossary · Reading list · Gradebook · Students · Announcements · Settings**

> **You'll see a yellow "oversight mode — edits are disabled" banner. That's normal.** Admins view courses read-only. The teaching is done by the assigned teacher (next section). Use these tabs to *check* things — e.g. the **Students** tab shows everyone enrolled.

---

# 5. Get a course ready: assign a teacher

Because admins are read-only inside a course, **the teacher assigned to a course is the one who uploads content and publishes it.** So your job is to assign that teacher.

1. Open the course (section 4) and stay on the **Overview** tab.
2. Find the **Teaching faculty** card and **add** the teacher who will run this course (they must already have a Faculty login — see section 7).
3. That teacher now signs in with **their own** login and:
   - uploads videos / PPTs / PDFs (up to 25 MB each, or pastes a link for big files), and
   - clicks **Publish course** when it's ready for students.

The step-by-step for the teacher is in the **Faculty Guide** (sections 4–5). Hand them that guide.

> **In short:** *Admin creates the login and assigns the teacher → the teacher uploads content and publishes.* If you ever see the upload/publish buttons greyed out, it's because you're an admin (oversight mode) — assign a teacher and let them do it.

---

# 6. Create Batches

1. In the left menu, click **Batches**.
2. In the **Create batch** card, fill in:
   - **Name** (e.g. *Fashion & Retail — July 2026*)
   - **Program** (pick from the dropdown)
   - **Capacity** (default 30 students)
   - **Start date** and **End date**
3. Click **Create**.

The batch appears under **Existing batches**.

> Create the batch **before** you create student logins (section 7), because you'll pick the batch there.

---

# 7. Create logins for students, teachers and staff

This is how you give someone an email + password to sign in. **No email is sent — you copy the password and hand it over yourself.**

1. In the left menu, click **Create login**.
2. Choose the **Role**: *Student*, *Faculty* (teacher), *Admin*, or *Admissions officer*.
3. Fill in **Full name**, **Email (login)**, and **Phone** (a plain 10-digit mobile number is fine, e.g. `9876543210`).
4. **For a student:** also pick the **Program** and **Batch**, and keep the box **"Enrol this student in the selected program"** ticked.
   - The **Program** (section 3) and a **Batch** for it (section 6) must already exist. If the **Batch** dropdown is empty, go create the batch first, then come back.
5. Click **Create login**.

A password is generated and shown. Below it is the **credentials table** — a list of every login with its **email and password**:

- Click **show** to reveal a password (**hide** to hide it again).
- Click **copy** to copy it.
- Click **Reset password** to generate a new one (the old one stops working).

**Copy the email and password and give them to the person.** They sign in at the same website with those details.

> **Did the student actually get enrolled?** Enrolment only works if the program already has courses (from the curriculum import). After clicking **Create login**, read the green success message: it should say **"enrolled in N courses"**. **If it does *not* mention enrolment, the student was created but NOT enrolled** — set up the courses first, then contact support to enrol them. (You can't re-run *Create login* for an email that already exists.)

---

# 8. Enrolments

Click **Enrolments** in the menu to **see** every student–course link (Student, Course, Batch, Status, Valid to). This screen is for viewing only.

**To enrol a student**, use **Create login** (section 7): pick the student's **Program** and **Batch** and tick **Enrol**. That's what gives them course access.

> If the student's login **already exists**, you can't create it again (the email is taken). To enrol an existing student into a further program, contact your India Learns support.

---

# 9. Timetable (weekly classes)

1. In the left menu, click **Timetable**.
2. On the **Timetable builder**, pick the **Batch**.
3. In the **Add a class** card:
   - Choose the **Course** and the **Teacher** from the dropdowns.
   - Pick the **Day**, set the **Start time** and **End time** (normal clock times), and type the **Room**.
4. Click **Add class**. It appears under **Weekly schedule** — each row shows the day, time, course, teacher and room, with a **Delete** button.

> No codes or IDs to type — just pick from the lists. If the **Course** dropdown is empty, the program has no courses yet (import the curriculum first). If the **Teacher** dropdown is empty, create a Faculty login first (section 7).

---

# 10. Fees and payments

> **Before you record a payment:** a student can only have an *Outstanding* balance if a **fee plan (fee structure)** has been set up for their batch. If the Outstanding amount shows nothing, the student has no fee plan yet — fee structures are configured during onboarding, so ask your India Learns contact if you're not sure.

1. In the left menu, click **Finance** to see collections.
2. Click **Record payment**. On **Record a payment**:
   - **Step 1** — pick the **Student**.
   - **Step 2** — check the **Outstanding** balance shown.
   - **Step 3** — enter the **Amount (₹)**, choose a **Method** (cash / UPI / bank transfer / cheque), add a **Reference** (UTR / cheque no.) and **Notes** if needed.
3. Click **Record payment & issue receipt**.

---

# 11. Showcase — present brochures to a visitor

Use this to open the company profile and program brochures full-screen when you're sitting with a prospective student.

1. In the left menu, click **Showcase**.
2. You'll see cards: **India Learns — Company Profile** and the **program brochures**.
3. Click **Present** on any card to open it full-screen and show it.

> **To add a new brochure or change an existing one:** the brochure files are large, so they can't be uploaded from this screen. Send the PDF files to your India Learns contact (Vidit) and they'll be added for you.

---

# 12. Other useful sections

- **Users** — view and manage everyone (edit, suspend). *Create login* (section 7) is the fast way to add someone.
- **Faculty** — see teachers and the courses they're assigned to.
- **Visitor Leads** — capture a walk-in prospect's details (name, phone — 10 digits is fine — qualification, etc.) for follow-up.
- **Tickets** — student support requests.
- **Fee structures** — set up the fee plans that section 10 collects against (usually configured during onboarding).
- **Reports** — attendance, assignments and fees across batches.
- **Staff attendance** — mark staff/faculty attendance.
- **Audit log** — a record of who changed what.

---

# Quick tips

- **A 10-digit phone number always works now** — you don't need to type `+91`.
- **You never need to type a "slug"** — it fills in from the name.
- **Can't upload or publish inside a course?** That's expected for admins — assign a teacher (section 5); they do it.
- If a screen shows a red message, read it — it now tells you exactly which field to fix.
- Use **Log out** (top-right) when you're done on a shared computer.

*Need help? Contact your India Learns support (Vidit).*
