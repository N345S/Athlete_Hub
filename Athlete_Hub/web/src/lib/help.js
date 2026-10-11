// "How to use this page" content shown from the Help button in the top bar.
// Keyed by portal, then by page (the same keys as each portal's VIEWS). Keep steps short and action-first.

const NOTIFICATIONS = {
  title: 'Notifications',
  intro: 'Updates about approvals, reviews, and schedule changes that involve you.',
  steps: [
    'Unread notifications have a red dot and red title.',
    'Select a notification to mark it as read.',
    'Use “Unread” to see only what is new, or “Mark all as read” to clear everything.',
  ],
  tips: ['The bell in the top bar shows how many notifications are unread.'],
}

export const HELP = {
  athlete: {
    dashboard: {
      title: 'Your dashboard',
      intro: 'A summary of your eligibility, schedule, achievements, and documents.',
      steps: [
        'Check the “Getting started” list and finish any step that is not ticked.',
        'Select a summary card (for example “Next training”) to open that page.',
        'Review “Coming up” for your next approved training and events.',
      ],
      tips: ['Academic eligibility is decided by the Registrar after your coach requests a Grade Evaluation. You do not need to upload grades yourself.'],
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
    documents: {
      title: 'Documents',
      intro: 'Upload clearance and consent forms for staff to review.',
      steps: [
        'Choose the document type.',
        'Drag files into the box, or click it to browse. You can add several files.',
        'Select “Upload”. Each document shows “Pending” until staff review it.',
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
    profile: {
      title: 'Profile',
      intro: 'Your account and personal details.',
      steps: ['Update your program, year level, birth date, or phone.', 'Select “Save changes”.'],
      tips: ['Your name, email, and student ID are managed by the school. Contact an administrator to change them.'],
    },
    notifications: NOTIFICATIONS,
  },

  coach: {
    dashboard: {
      title: 'Coach dashboard',
      intro: 'How your teams are doing and what needs your action.',
      steps: [
        '“Athletes needing attention” lists ineligible, inactive, or low-attendance athletes. Select “View” to open one.',
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
        'Select “View profile” to request a Grade Evaluation, verify portfolio items, and see documents.',
      ],
      tips: ['Request a Grade Evaluation once per term; the Registrar records the eligibility decision.'],
    },
    schedule: {
      title: 'Schedule',
      intro: 'Your training sessions plus the Director’s sports events and competitions.',
      steps: [
        'Select “Request training session”, choose a team, add one or more dates, and submit.',
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
        'Use the “Coach overview” table to compare rosters, attendance, and eligibility.',
        'Select “Add sports event” to publish an event or competition to every athlete.',
      ],
    },
    coaches: {
      title: 'Coaches',
      intro: 'Coach accounts, their teams, and their athletes.',
      steps: ['Select “View coach” to see their roster.', 'Use “Assign athlete” to add an athlete to the coach’s active team, or “Unassign” to remove one.'],
      tips: ['A coach without a team cannot be assigned athletes.'],
    },
    athletes: {
      title: 'All athletes',
      intro: 'Every registered student-athlete (view only).',
      steps: ['Search for an athlete.', 'Select “View profile” to see eligibility, portfolio, and documents.'],
      tips: ['Coaches record athlete data; directors monitor it.'],
    },
    schedule: {
      title: 'Schedule',
      intro: 'Publish events and approve coaches’ training sessions.',
      steps: [
        'Review pending training sessions at the top of the page.',
        'Select “Add sports event” and choose one or more dates.',
        'Open an event in the calendar to delete it.',
      ],
    },
    performance: {
      title: 'Performance',
      intro: 'View any athlete’s performance records and trends.',
      steps: ['Select an athlete.', 'Use the time-range buttons to change the chart.'],
    },
    notifications: NOTIFICATIONS,
  },

  registrar: {
    dashboard: {
      title: 'Registrar dashboard',
      intro: 'Grade Evaluation requests from coaches and your eligibility decisions.',
      steps: ['“Ready for decision” lists requests that already have a PDF. Select “Review”.', 'Requests still needing a PDF are under “Eligibility requests”.'],
    },
    requests: {
      title: 'Eligibility requests',
      intro: 'Coach requests waiting for the official Grade Evaluation or your decision.',
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
