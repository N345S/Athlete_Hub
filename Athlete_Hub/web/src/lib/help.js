// "How to use this page" content shown from the Help button in the top bar.
// Keyed by portal, then by page (the same keys as each portal's VIEWS). Keep steps short and action-first.

const NOTIFICATIONS = {
  title: 'Notifications',
  intro: 'Updates about approvals, reviews, and schedule changes that involve you.',
  steps: [
    'Unread notifications are tinted and have a red dot.',
    'Select a notification to open what it is about (for example, the portfolio item or the training session). It is marked as read.',
    'Use “Unread” to see only what is new, or “Mark all as read” to clear everything.',
  ],
  tips: ['Select the bell in the top bar to see your latest notifications; “See all notifications” opens this page.'],
}

export const HELP = {
  athlete: {
    dashboard: {
      title: 'Your dashboard',
      intro: 'A summary of your schedule, achievements, documents, and coach evaluations.',
      steps: [
        'When final grades are released, an “Evaluate your coach” card appears at the top. Select “Evaluate” to fill in the form.',
        'Check the “Getting started” list and finish any step that is not ticked.',
        'Select a summary card (for example “Next training”) to open that page.',
        'Review “Coming up” for your next approved training and events.',
      ],
      tips: ['Your grades come from the ICTD university database. You do not need to upload them yourself.'],
    },
    schedule: {
      title: 'Schedule',
      intro: 'Approved training sessions, sports events, and competitions.',
      steps: [
        'Use ‹ and › to change month, or “Today” to jump back.',
        'Select a day to list its events below the calendar.',
        'Select an event to see its time, location, and details.',
        'Switch to “List” to see every upcoming event in order.',
      ],
      tips: ['Use the coloured filter buttons to show or hide training, sports events, and competitions.'],
    },
    performance: {
      title: 'My performance',
      intro: 'Your results from each training session, recorded by your coach.',
      steps: [
        'Check the summary cards for how many sessions are recorded and how many workouts improved last time.',
        'Use the chart’s time-range buttons to see all time, the last 30 days, or the last 7 days.',
        'Under “Session by session”, each result shows ▲ (better) or ▼ (worse) compared with your previous result for that workout. “PB” marks a personal best.',
        'Select a workout above the session list to follow only that workout.',
      ],
      tips: ['For timed runs such as sprints, a lower time counts as an improvement.', 'Results appear after your coach records them following an approved session.'],
    },
    documents: {
      title: 'Documents',
      intro: 'Keep your clearance and consent forms on file for your coach and the Sports Director.',
      steps: [
        'Choose the document type.',
        'Drag files into the box, or click it to browse. You can add several files.',
        'Select “Upload”. The document is filed right away — no approval is needed — and your coach and the Sports Director can open it.',
      ],
      tips: ['Accepted: PDF, PNG, JPG, DOC, DOCX up to 10 MB each.', 'Files marked in red cannot be uploaded — remove them first.'],
    },
    portfolio: {
      title: 'Athletic portfolio',
      intro: 'Submit achievements with proof so your coach can verify them.',
      steps: [
        'Enter the achievement title, date, and category.',
        'Attach at least one evidence file, such as a certificate or photo.',
        'Select “Submit for verification”.',
        'If your coach rejects it, the reason is shown under the item. Delete it and submit a corrected one.',
      ],
      tips: ['Verified achievements cannot be deleted.'],
    },
    evaluations: {
      title: 'Coach evaluation',
      intro: 'Rate how your team coach did this semester.',
      steps: [
        'When a semester’s final grades are released, you get a notification and an “Evaluate your coach” card appears on your dashboard.',
        'Select “Evaluate”, choose 1 (strongly disagree) to 5 (strongly agree) for every statement, and add an optional comment.',
        'Select “Submit evaluation”. You can submit each form once.',
      ],
      tips: ['Your answers are not anonymous: the Sports Director sees your name with your answers and comment.'],
    },
    profile: {
      title: 'Profile',
      intro: 'Your account and personal details.',
      steps: ['Update your program, year level, birth date, or phone.', 'Select “Save changes”.'],
      tips: ['Your name, email, and student ID are managed by the school. Contact the Sports Director to change them.'],
    },
    notifications: NOTIFICATIONS,
  },

  coach: {
    dashboard: {
      title: 'Coach dashboard',
      intro: 'How your teams are doing and what needs your action.',
      steps: [
        '“Athletes needing attention” lists inactive or low-attendance athletes. Select “View” to open one.',
        '“Portfolio verification” lists achievements waiting for you. Select “Review”.',
        'Use “Request training session” to schedule practice.',
      ],
      tips: ['Attendance below 60% is flagged automatically.'],
    },
    athletes: {
      title: 'My athletes',
      intro: 'Every student-athlete on the teams you coach.',
      steps: [
        'Search by name, student ID, team, or sport.',
        'Select “View profile” to verify portfolio items and see documents.',
      ],
      tips: ['After each semester’s final grades are released, your athletes evaluate you. The Sports Director sees the results.'],
    },
    schedule: {
      title: 'Schedule',
      intro: 'Your training sessions plus the Director’s sports events and competitions.',
      steps: [
        'Select “Request training session”, choose a team, then tap each date on the calendar (or use “Repeat weekly” for a regular schedule) and submit.',
        'New sessions show “Awaiting approval” until the Sports Director approves them.',
        'To withdraw a pending request, open it in the calendar and select “Cancel request”.',
      ],
      tips: ['Athletes only see a session after it is approved.'],
    },
    attendance: {
      title: 'Attendance',
      intro: 'Record who attended each approved training session.',
      steps: [
        'Choose a training session from the list.',
        'Select Present, Late, Excused, or Absent for each athlete. Each choice saves immediately.',
        'Use “Mark everyone else present” to fill in the rest in one step, then adjust exceptions.',
      ],
      tips: ['Suspended or inactive athletes cannot be marked.', 'Parents are notified when attendance is recorded.'],
    },
    performance: {
      title: 'Performance',
      intro: 'Record measurements and track progress over time.',
      steps: [
        'Select an athlete.',
        'Select “Record performance”, enter the workout, value, and unit, and choose the training session.',
        'Use the time-range buttons to change the chart.',
        'Under “Session by session”, ▲ means better and ▼ means worse than the athlete’s previous result; “PB” marks a personal best.',
      ],
      tips: ['Performance can only be recorded for approved sessions that have already ended.'],
    },
    notifications: NOTIFICATIONS,
  },

  director: {
    dashboard: {
      title: 'Director dashboard',
      intro: 'Program-wide overview and the training sessions waiting for your approval.',
      steps: [
        'Approve or reject coach training requests in “Training approvals”. A rejection needs a reason.',
        'Use the “Coach overview” table to compare rosters and attendance.',
        '“ICTD grades” shows the latest semester synced from the ICTD database. Grades and Accounts are under “More” in the menu and need your page password.',
        'Select “Add sports event” to publish an event or competition to every athlete.',
      ],
    },
    coaches: {
      title: 'Coaches',
      intro: 'Coach accounts, their teams, and their athletes.',
      steps: [
        'Select “View coach” to see their roster.',
        'Select “Assign athletes”. Athletes with no team are shown first — tap each one you want to add.',
        'To reassign someone, switch to “On another team”, select them, and choose “Move” (they leave their old team) or “Add as an extra team”.',
        'Use “Unassign” in the roster to remove an athlete from the team.',
      ],
      tips: ['You can select several athletes and assign them in one step.', 'A coach without an active team cannot be assigned athletes.', '“Student evaluations” on a coach’s page shows what each of their athletes said after each semester.'],
    },
    athletes: {
      title: 'All athletes',
      intro: 'Every registered student-athlete.',
      steps: [
        'Search for an athlete.',
        'Select “View profile” to see their portfolio and documents. Select “View grades” and enter your page password to see their grades.',
      ],
      tips: ['Grades come from the ICTD database automatically once each semester’s final grades are released.'],
    },
    grades: {
      title: 'Grades',
      intro: 'Final grades from the ICTD university database. They sync automatically when ICTD releases them, and only you can see them.',
      steps: [
        'Open “More” in the menu and select “Grades”, then enter your page password. The first time, you make this password.',
        'Choose a semester, then select “View grades” next to a student-athlete to open their grades in a pop-up.',
        'Each subject shows “Code : Subject” with the grade, and “Section: code - (units)” with Passed, Failed, or INC.',
        'Use “Failed or INC” to list only student-athletes with a failed or incomplete subject.',
      ],
      tips: ['There is nothing to pull: Athlete-Hub checks the ICTD database every hour and adds newly released grades by itself.', 'When a semester’s grades arrive, every student gets a form to evaluate their team coach.', 'The page locks again when you leave it or after 15 minutes. You can change the page password from the password window.'],
    },
    schedule: {
      title: 'Schedule',
      intro: 'Publish events and approve coaches’ training sessions.',
      steps: [
        'Review pending training sessions at the top of the page.',
        'Select “Add sports event” then tap each date on the calendar, or use “Repeat weekly” for a recurring event.',
        'Open an event in the calendar to delete it.',
      ],
    },
    performance: {
      title: 'Performance',
      intro: 'View any athlete’s performance records and trends.',
      steps: [
        'Select an athlete.',
        'Use the time-range buttons to change the chart.',
        'Under “Session by session”, ▲ means better and ▼ means worse than the athlete’s previous result; “PB” marks a personal best.',
      ],
      tips: ['Athletes see this same page for their own results.'],
    },
    accounts: {
      title: 'User accounts',
      intro: 'Create accounts, reset passwords, and control who can sign in.',
      steps: [
        'Open “More” in the menu and select “Accounts”, then enter your page password. The first time, you make this password.',
        'Select “Create account”, choose the role, and fill in the required fields (marked *).',
        'For a parent, enter the child’s University ID instead of the parent’s own.',
        'Use “Edit” to change details or reset a password.',
        'Use “More” to suspend, deactivate, reactivate, link children, or delete.',
      ],
      tips: ['Suspended and inactive users are signed out immediately.', 'Accounts with existing records cannot be deleted — deactivate them instead.', 'You cannot change your own role or status, and at least one Sports Director must stay active.', 'The page locks again when you leave it or after 15 minutes. You can change the page password from the password window.'],
    },
    notifications: NOTIFICATIONS,
  },

  // The Registrar and Admin portals are hidden (see lib/features.js); their help stays for when they return.
  registrar: {
    dashboard: {
      title: 'Registrar dashboard',
      intro: 'Grade Evaluation requests from the Director of Sports and your eligibility decisions.',
      steps: ['“Ready for decision” lists requests that already have a PDF. Select “Review”.', 'Requests still needing a PDF are under “Eligibility requests”.'],
    },
    requests: {
      title: 'Eligibility requests',
      intro: 'Director of Sports requests waiting for the official Grade Evaluation or your decision.',
      steps: [
        'Select “Upload PDF” and attach the Registrar-issued Grade Evaluation.',
        'Choose Eligible or Ineligible. Ineligible needs at least one reason.',
        'Add an optional remark and select “Submit decision”.',
      ],
      tips: ['The coach, the Sports Director, and the athlete are notified of your decision.'],
    },
    evaluations: {
      title: 'Decisions',
      intro: 'Every eligibility decision you have recorded.',
      steps: ['Search by name or student ID.', 'Select “View” to open the decision and its PDF.'],
    },
    students: {
      title: 'Students',
      intro: 'All student-athletes and their latest evaluation.',
      steps: ['Search by name, student ID, or program.', 'Select a status to open that evaluation.'],
    },
    notifications: NOTIFICATIONS,
  },

  admin: {
    dashboard: {
      title: 'Account overview',
      intro: 'Who has access to Athlete-Hub.',
      steps: ['Select a summary card or a role to open the matching accounts.'],
    },
    accounts: {
      title: 'User accounts',
      intro: 'Create accounts, reset passwords, and control who can sign in.',
      steps: [
        'Select “Create account”, choose the role, and fill in the required fields (marked *).',
        'For a parent, enter the child’s University ID instead of the parent’s own.',
        'Use “Edit” to change details or reset a password.',
        'Use “More” to suspend, deactivate, reactivate, link children, or delete.',
      ],
      tips: ['Suspended and inactive users are signed out immediately.', 'Accounts with existing records cannot be deleted — deactivate them instead.'],
    },
  },

  parent: {
    dashboard: {
      title: 'Parent dashboard',
      intro: 'Your children’s approved training and attendance.',
      steps: ['Each child has a card with their next session and recent attendance.', 'Select “Next training” to open the full calendar.'],
      tips: ['Attendance counts Present and Late as attended.', 'If no child is shown, ask the athletics office to link your account.'],
    },
    training: {
      title: 'Training sessions',
      intro: 'Approved training for your children, with attendance recorded by the coach.',
      steps: [
        'With more than one child, choose whose training to show.',
        'Select a day or session in the calendar for details and attendance.',
        'Scroll to “Attendance history” for past sessions.',
      ],
    },
    notifications: NOTIFICATIONS,
  },
}
