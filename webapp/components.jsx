// India Learns — Shared UI primitives and icons
// All icons are simple inline SVGs drawn from primitives (no emoji)

const Icon = ({ name, size = 16, color = 'currentColor', strokeWidth = 2 }) => {
  const s = size;
  const sw = strokeWidth;
  const paths = {
    home: <><path d="M3 12 12 3l9 9"/><path d="M5 10v10h14V10"/></>,
    book: <><path d="M4 4h10a4 4 0 0 1 4 4v12"/><path d="M4 4v14a2 2 0 0 0 2 2h12"/><path d="M4 4a2 2 0 0 0 2 2h8"/></>,
    cal: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 3v4M16 3v4"/></>,
    cash: <><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></>,
    ticket: <><path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M13 5v14" strokeDasharray="2 2"/></>,
    feedback: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    users: <><circle cx="9" cy="8" r="4"/><path d="M1 21a8 8 0 0 1 16 0"/><path d="M16 3.5a4 4 0 0 1 0 7.9"/><path d="M23 21a8 8 0 0 0-7-7.9"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    chevR: <><path d="m9 6 6 6-6 6"/></>,
    chevD: <><path d="m6 9 6 6 6-6"/></>,
    chart: <><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></>,
    play: <polygon points="6 4 20 12 6 20 6 4" strokeLinejoin="round"/>,
    doc: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>,
    check: <path d="m5 12 5 5L20 7"/>,
    lock: <><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    alert: <><path d="M12 2 2 20h20z"/><path d="M12 9v5"/><circle cx="12" cy="17.5" r="0.5" fill="currentColor"/></>,
    shield: <><path d="M12 2 4 5v7c0 5 3.5 8 8 10 4.5-2 8-5 8-10V5z"/></>,
    award: <><circle cx="12" cy="9" r="6"/><path d="M9 14l-2 8 5-3 5 3-2-8"/></>,
    logout: <><path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h12"/></>,
    filter: <path d="M3 5h18l-7 9v6l-4-2v-4z"/>,
    download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4z"/></>,
    trash: <><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6"/></>,
    video: <><rect x="3" y="6" width="14" height="12" rx="2"/><polygon points="17 10 22 7 22 17 17 14"/></>,
    pdf: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><text x="7" y="17" fontSize="5" fontFamily="monospace" fill="currentColor" stroke="none" fontWeight="700">PDF</text></>,
    quiz: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .8-1 1.7V14"/><circle cx="12" cy="17.5" r="0.5" fill="currentColor"/></>,
    upload: <><path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/></>,
    send: <><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></>,
    building: <><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01"/></>,
    airplane: <><path d="M17 22v-5l4-3v-3l-8 2V5a2 2 0 1 0-4 0v8L1 11v3l4 3v5l3-2 3 2"/></>,
    hanger: <><path d="M12 8a2 2 0 1 1 2-2"/><path d="m12 9 10 7-10 3L2 16z"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    flag: <><path d="M4 21V4h14l-3 4 3 4H4"/></>,
    star: <polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3"/>,
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      {paths[name]}
    </svg>
  );
};

// Brand mark — "India" in orange + "Learns" in navy with dash pattern
const BrandMark = ({size=40, stacked=true, onCream=true}) => {
  const h = size;
  const lineH = h*0.42;
  return (
    <div style={{display:'inline-flex', flexDirection: stacked?'column':'row', alignItems: stacked?'flex-start':'baseline', gap: stacked?h*0.02:h*0.18, fontFamily:'Poppins', lineHeight:1, letterSpacing:'-0.02em'}}>
      <span style={{color:'#F58220', fontWeight:800, fontSize:lineH}}>India</span>
      <span style={{color:'#1A3A8F', fontWeight:800, fontSize:lineH}}>Learns</span>
      <div style={{display:'flex', gap:h*0.06, marginTop:h*0.06}}>
        <span style={{width:h*0.18, height:h*0.07, background:'#1A3A8F', borderRadius:1}}/>
        <span style={{width:h*0.18, height:h*0.07, background:'#1A3A8F', borderRadius:1}}/>
        <span style={{width:h*0.18, height:h*0.07, background:'#F58220', borderRadius:1}}/>
        <span style={{width:h*0.18, height:h*0.07, background:'#1A3A8F', borderRadius:1}}/>
      </div>
    </div>
  );
};

// Compact monogram mark for sidebars/tight spots (orange 'i' + navy 'L')
const BrandGlyph = ({size=36}) => (
  <div style={{width:size, height:size, borderRadius:size*0.26, background:'#FBF5E8', border:'1px solid #EADFC5', display:'grid', placeItems:'center', fontFamily:'Poppins', fontWeight:800, fontSize:size*0.5, lineHeight:1, letterSpacing:'-0.04em'}}>
      <span><span style={{color:'#F58220'}}>i</span><span style={{color:'#1A3A8F'}}>L</span></span>
  </div>
);

// Pill
const Pill = ({ variant='ghost', children, dot=false }) => (
  <span className={`pill pill-${variant}`}>
    {dot && <span className="dotmark"/>}
    {children}
  </span>
);

// Avatar
const Avatar = ({ name='JD', color='lblue', size=36 }) => {
  const bg = color==='orange' ? '#F58220' : color==='navy' ? '#24489E' : color==='cream' ? '#F2EADA' : '#6E9BCC';
  const fg = color==='navy' ? '#ffffff' : '#11255C';
  return <div style={{width:size, height:size, borderRadius:'50%', background:bg, color:fg, display:'grid', placeItems:'center', fontWeight:700, fontSize:size*0.36, flexShrink:0}}>{name}</div>;
};

// Top role switcher (the tabs above the app chrome)
const RoleBar = ({ screen, setScreen }) => {
  const groups = [
    { label: 'Public', items: [['onboarding','Onboarding'],['login','Login']] },
    { label: 'Student', items: [['student','Dashboard'], ['course','Course'], ['timetable','Timetable'], ['fees','Fees'], ['tickets','Tickets'], ['feedback','Feedback'], ['certificate','Certificate']] },
    { label: 'Faculty', items: [['faculty','Faculty Dashboard']] },
    { label: 'Admin', items: [['admin','Admin Dashboard'], ['admin-students','Students'], ['admin-tickets','Tickets Board']] },
    { label: 'Finance', items: [['finance','Finance']] },
    { label: 'Mobile', items: [['mobile','All Mobile Screens']] },
  ];
  return (
    <div className="rolebar">
      <div className="brand">
        <BrandGlyph size={30}/>
        <span>India Learns · Design System</span>
      </div>
      <div style={{marginLeft:'auto'}}/>
      <div className="scrn">
        {groups.map((g, gi) => (
          <React.Fragment key={g.label}>
            {gi > 0 && <div className="sep"/>}
            <span className="label">{g.label}</span>
            {g.items.map(([k, n]) => (
              <button key={k} className={screen === k ? 'active' : ''} onClick={() => setScreen(k)}>{n}</button>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// Sidebar (role-specific)
const SideNav = ({ role = 'student', active, setScreen }) => {
  const menus = {
    student: {
      user: { name: 'Ananya Sharma', role: 'Aviation · Batch A', initials: 'AS', color: 'lblue' },
      sections: [
        { title: 'Learn', items: [
          { key: 'student', label: 'Dashboard', icon: 'home' },
          { key: 'course', label: 'My Courses', icon: 'book' },
          { key: 'timetable', label: 'Timetable', icon: 'cal' },
          { key: 'feedback', label: 'Feedback', icon: 'feedback', badge: '3' },
        ]},
        { title: 'Admin', items: [
          { key: 'fees', label: 'Fees', icon: 'cash' },
          { key: 'tickets', label: 'Support Tickets', icon: 'ticket' },
        ]},
      ],
    },
    admin: {
      user: { name: 'Rejin Rajan', role: 'Admin · LUC DXB', initials: 'RR', color: 'orange' },
      sections: [
        { title: 'Overview', items: [
          { key: 'admin', label: 'Dashboard', icon: 'chart' },
        ]},
        { title: 'Manage', items: [
          { key: 'admin-students', label: 'Students', icon: 'users', badge: '126' },
          { key: 'admin-faculty', label: 'Faculty', icon: 'user' },
          { key: 'admin-courses', label: 'Courses', icon: 'book' },
          { key: 'admin-timetable', label: 'Timetable', icon: 'cal' },
        ]},
        { title: 'Operations', items: [
          { key: 'admin-tickets', label: 'Tickets Board', icon: 'ticket', badge: '14' },
          { key: 'admin-notifications', label: 'Notifications', icon: 'bell' },
          { key: 'admin-audit', label: 'Audit Log', icon: 'shield' },
          { key: 'admin-settings', label: 'Settings', icon: 'settings' },
        ]},
      ],
    },
    faculty: {
      user: { name: 'Dr. Meera Krishnan', role: 'Course Coordinator', initials: 'MK', color: 'orange' },
      sections: [
        { title: 'Teach', items: [
          { key: 'faculty', label: 'Dashboard', icon: 'home' },
          { key: 'faculty-courses', label: 'My Courses', icon: 'book' },
          { key: 'faculty-grading', label: 'Grading', icon: 'check', badge: '8' },
          { key: 'faculty-feedback', label: 'Give Feedback', icon: 'feedback' },
        ]},
        { title: 'Engage', items: [
          { key: 'faculty-tickets', label: 'Tickets', icon: 'ticket', badge: '2' },
          { key: 'faculty-timetable', label: 'Timetable', icon: 'cal' },
        ]},
      ],
    },
    finance: {
      user: { name: 'Priya Nair', role: 'Finance', initials: 'PN', color: 'orange' },
      sections: [
        { title: 'Finance', items: [
          { key: 'finance', label: 'Dashboard', icon: 'chart' },
          { key: 'finance-payments', label: 'Record Payment', icon: 'cash' },
          { key: 'finance-invoices', label: 'Invoices', icon: 'doc' },
          { key: 'finance-reminders', label: 'Reminders', icon: 'bell' },
          { key: 'finance-reports', label: 'Reports', icon: 'chart' },
        ]},
        { title: 'Support', items: [
          { key: 'finance-tickets', label: 'Finance Tickets', icon: 'ticket', badge: '4' },
        ]},
      ],
    },
  };
  const m = menus[role] || menus.student;
  return (
    <aside className="side">
      <div className="logo">
        <BrandGlyph size={34}/>
        <div>
          <div className="logo-name"><span style={{color:'#F58220'}}>India</span> <span style={{color:'#ffffff'}}>Learns</span></div>
          <div className="logo-sub">{role}</div>
        </div>
      </div>
      {m.sections.map(sec => (
        <React.Fragment key={sec.title}>
          <div className="nav-section">{sec.title}</div>
          <div className="nav">
            {sec.items.map(it => (
              <a key={it.key} className={active === it.key ? 'active' : ''} onClick={() => setScreen && setScreen(it.key)}>
                <span className="nav-ic"><Icon name={it.icon} size={16}/></span>
                <span>{it.label}</span>
                {it.badge && <span className="badge">{it.badge}</span>}
              </a>
            ))}
          </div>
        </React.Fragment>
      ))}
      <div className="user">
        <Avatar name={m.user.initials} color={m.user.color}/>
        <div style={{flex:1, minWidth:0}}>
          <div className="user-name">{m.user.name}</div>
          <div className="user-role">{m.user.role}</div>
        </div>
        <span style={{color:'rgba(255,255,255,0.6)', cursor:'pointer'}}><Icon name="logout" size={16}/></span>
      </div>
    </aside>
  );
};

// Topbar with search + actions
const TopBar = ({ placeholder = 'Search...' }) => (
  <div className="topbar">
    <div className="search">
      <Icon name="search" size={16} color="#6B7490"/>
      <input placeholder={placeholder}/>
      <span className="mono" style={{fontSize:10, color:'#9098AE', border:'1px solid #E6DFCF', padding:'2px 6px', borderRadius:6}}>⌘K</span>
    </div>
    <div className="actions">
      <div className="iconbtn"><Icon name="bell" size={18}/><span className="dot"/></div>
      <div className="iconbtn"><Icon name="mail" size={18}/></div>
      <div className="iconbtn"><Icon name="settings" size={18}/></div>
    </div>
  </div>
);

Object.assign(window, { Icon, BrandMark, BrandGlyph, Pill, Avatar, RoleBar, SideNav, TopBar });
