// India Learns — Mobile screens inside iOS bezels (canvas view)
// All 12+ screens redesigned for mobile (402×874 iPhone frame)

const MobileCanvas = () => {
  const screens = [
    { id:'m-login', title:'01 Login', build: MobileLogin },
    { id:'m-dashboard', title:'02 Student Dashboard', build: MobileDashboard },
    { id:'m-course', title:'03 Course', build: MobileCourse },
    { id:'m-timetable', title:'04 Timetable', build: MobileTimetable },
    { id:'m-fees', title:'05 Fees', build: MobileFees },
    { id:'m-tickets', title:'06 Tickets', build: MobileTickets },
    { id:'m-feedback', title:'07 Feedback', build: MobileFeedback },
    { id:'m-certificate', title:'08 Certificate', build: MobileCertificate },
    { id:'m-onboarding', title:'09 Onboarding', build: MobileOnboarding },
    { id:'m-faculty', title:'10 Faculty', build: MobileFaculty },
    { id:'m-admin', title:'11 Admin', build: MobileAdmin },
    { id:'m-admin-students', title:'12 Admin · Students', build: MobileAdminStudents },
    { id:'m-admin-tickets', title:'13 Admin · Tickets', build: MobileAdminTickets },
    { id:'m-finance', title:'14 Finance', build: MobileFinance },
  ];
  return (
    <div style={{padding:'32px 36px 80px', background:'#FBF5E8', minHeight:'calc(100vh - 49px)'}}>
      <div style={{maxWidth:1600, margin:'0 auto 28px'}}>
        <div style={{display:'inline-flex', alignItems:'center', gap:10, background:'#11255C', color:'white', padding:'8px 14px', borderRadius:999, fontSize:11, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:14}}>
          <span style={{width:6, height:6, borderRadius:'50%', background:'#F58220'}}/> Mobile canvas · iOS frames
        </div>
        <h1 style={{fontSize:34, fontWeight:800, color:'#11255C', letterSpacing:'-0.02em', margin:'0 0 6px'}}>Mobile designs — {screens.length} screens</h1>
        <p style={{color:'#6B7490', fontSize:14, margin:0}}>Each screen is designed natively for 402×874. iOS chrome (dynamic island, status bar, home indicator) handled by the frame component.</p>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(440px, 1fr))', gap:40, maxWidth:1600, margin:'0 auto'}}>
        {screens.map(s => {
          const Scr = s.build;
          return (
            <div key={s.id} style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
              <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:16, alignSelf:'stretch', paddingLeft:30}}>
                <div className="mono" style={{fontSize:10, color:'#9098AE', letterSpacing:'0.16em'}}>{s.title.split(' ')[0]}</div>
                <div style={{fontSize:14, fontWeight:700, color:'#11255C', letterSpacing:'-0.01em'}}>{s.title.split(' ').slice(1).join(' ')}</div>
                <div style={{flex:1, height:1, background:'#E6DFCF'}}/>
              </div>
              <IOSDevice width={402} height={874}>
                <Scr/>
              </IOSDevice>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────── shared mobile chrome ───────────
const Mhdr = ({ title, sub, right, bg='#FFFFFF', color='#11255C' }) => (
  <div style={{padding:'56px 20px 16px', background:bg, color, borderBottom: bg==='#FFFFFF'?'1px solid #F2EADA':'none'}}>
    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
      <div>
        {sub && <div style={{fontSize:11, letterSpacing:'0.14em', textTransform:'uppercase', opacity:0.6, fontWeight:700, marginBottom:4}}>{sub}</div>}
        <div style={{fontSize:24, fontWeight:800, letterSpacing:'-0.02em'}}>{title}</div>
      </div>
      {right}
    </div>
  </div>
);

const Mtab = ({ active, children, onClick }) => (
  <div onClick={onClick} style={{
    flex:1, textAlign:'center', padding:'8px 4px 10px',
    display:'flex', flexDirection:'column', alignItems:'center', gap:3,
    color: active ? '#F58220' : '#9098AE', cursor:'pointer',
  }}>
    {children}
  </div>
);

const MTabBar = ({ active='home' }) => (
  <div style={{
    position:'absolute', bottom:0, left:0, right:0,
    background:'rgba(255,255,255,0.94)', backdropFilter:'blur(20px)',
    borderTop:'1px solid #F2EADA',
    paddingBottom:30, display:'flex',
  }}>
    <Mtab active={active==='home'}><Icon name="home" size={20}/><span style={{fontSize:10, fontWeight:600}}>Home</span></Mtab>
    <Mtab active={active==='courses'}><Icon name="book" size={20}/><span style={{fontSize:10, fontWeight:600}}>Learn</span></Mtab>
    <Mtab active={active==='timetable'}><Icon name="cal" size={20}/><span style={{fontSize:10, fontWeight:600}}>Schedule</span></Mtab>
    <Mtab active={active==='fees'}><Icon name="cash" size={20}/><span style={{fontSize:10, fontWeight:600}}>Fees</span></Mtab>
    <Mtab active={active==='me'}><Icon name="user" size={20}/><span style={{fontSize:10, fontWeight:600}}>Me</span></Mtab>
  </div>
);

// ══════════════ 01 Login ══════════════
const MobileLogin = () => (
  <div style={{height:'100%', background:'#11255C', color:'white', display:'flex', flexDirection:'column', position:'relative', overflow:'hidden'}}>
    <div style={{position:'absolute', top:-100, right:-80, width:240, height:240, background:'#F58220', borderRadius:'50%', opacity:0.12}}/>
    <div style={{position:'absolute', bottom:120, left:-60, width:160, height:160, background:'#6E9BCC', borderRadius:30, opacity:0.12, transform:'rotate(18deg)'}}/>
    <div style={{flex:1, padding:'64px 28px 20px', display:'flex', flexDirection:'column'}}>
      <BrandMark size={46} stacked={false}/>
      <div style={{marginTop:42}}>
        <div style={{fontSize:32, fontWeight:800, letterSpacing:'-0.02em', lineHeight:1.1}}>
          Learn what takes you <span style={{color:'#F58220'}}>further</span>.
        </div>
        <p style={{color:'#DDE7F3', fontSize:13, lineHeight:1.55, margin:'14px 0 28px'}}>
          Your classroom, coursework, timetable and fees — all on your phone.
        </p>
      </div>
      <div style={{marginTop:'auto', background:'white', borderRadius:24, padding:'22px 22px 26px', color:'#11255C'}}>
        <div style={{fontSize:11, letterSpacing:'0.14em', textTransform:'uppercase', color:'#D96B0B', fontWeight:700, marginBottom:14}}>
          <span className="dotmark" style={{marginRight:6, color:'#F58220'}}/>Sign in
        </div>
        <div className="field" style={{marginBottom:12}}>
          <label>Email</label>
          <input defaultValue="ananya.sharma@indialearns.com" style={{fontSize:13, padding:'11px 12px'}}/>
        </div>
        <div className="field" style={{marginBottom:16}}>
          <label>Password</label>
          <input type="password" defaultValue="••••••••••" style={{fontSize:13, padding:'11px 12px'}}/>
        </div>
        <button className="btn btn-primary" style={{width:'100%', justifyContent:'center', padding:'13px'}}>Sign in <Icon name="chevR" size={14}/></button>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:14, fontSize:12}}>
          <span style={{color:'#6B7490'}}>Use magic link</span>
          <span style={{color:'#1A3A8F', fontWeight:600}}>Forgot?</span>
        </div>
      </div>
      <div style={{textAlign:'center', fontSize:11, color:'#6E9BCC', marginTop:20, paddingBottom:16}}>© 2026 India Learns · LUC DXB</div>
    </div>
  </div>
);

// ══════════════ 02 Dashboard ══════════════
const MobileDashboard = () => (
  <div style={{height:'100%', background:'#FBF5E8', display:'flex', flexDirection:'column', paddingBottom:80, overflow:'auto'}}>
    <div style={{padding:'56px 20px 18px', background:'#11255C', color:'white', borderBottomLeftRadius:24, borderBottomRightRadius:24}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
        <div>
          <div style={{fontSize:11, color:'#6E9BCC', letterSpacing:'0.12em', textTransform:'uppercase'}}>Monday · 18 Mar</div>
          <div style={{fontSize:22, fontWeight:800, letterSpacing:'-0.02em', marginTop:2}}>Hi, Ananya 👋</div>
        </div>
        <Avatar name="AS" color="orange" size={40}/>
      </div>
      <div style={{background:'rgba(245,130,32,0.15)', border:'1px solid rgba(245,130,32,0.3)', borderRadius:14, padding:'12px 14px', display:'flex', gap:10, alignItems:'center'}}>
        <Icon name="clock" size={18} color="#F58220"/>
        <div style={{flex:1}}>
          <div style={{fontSize:12, color:'#F58220', fontWeight:700, letterSpacing:'0.04em'}}>Next class · in 42 min</div>
          <div style={{fontSize:13, color:'white', fontWeight:600, marginTop:2}}>Ramp Safety Briefing · Room 204</div>
        </div>
        <Icon name="chevR" size={16} color="#F58220"/>
      </div>
    </div>
    <div style={{padding:'18px 20px', display:'flex', flexDirection:'column', gap:14}}>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
        <div style={{background:'white', borderRadius:16, padding:'14px 16px', border:'1px solid #E6DFCF'}}>
          <div style={{fontSize:10, color:'#6B7490', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700}}>Progress</div>
          <div className="mono" style={{fontSize:24, fontWeight:800, color:'#11255C', marginTop:4}}>48%</div>
          <div className="progress" style={{marginTop:8}}><div style={{width:'48%'}}/></div>
        </div>
        <div style={{background:'#F58220', borderRadius:16, padding:'14px 16px', color:'#11255C'}}>
          <div style={{fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700, opacity:0.7}}>Hours done</div>
          <div className="mono" style={{fontSize:24, fontWeight:800, marginTop:4}}>142 / 300</div>
          <div style={{fontSize:11, fontWeight:600, marginTop:6}}>+6 this week</div>
        </div>
      </div>

      <div style={{background:'white', borderRadius:16, padding:16, border:'1px solid #E6DFCF'}}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:10}}>
          <div style={{fontSize:11, color:'#6B7490', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700}}>Today</div>
          <span style={{fontSize:11, color:'#F58220', fontWeight:600}}>See all</span>
        </div>
        {[
          ['09:00','Ramp Safety Briefing','Rm 204'],
          ['11:30','Baggage Handling Lab','Sim Hall'],
          ['14:00','English Communication','Rm 108'],
        ].map(([t,n,r],i)=>(
          <div key={i} style={{display:'flex', gap:12, padding:'10px 0', borderBottom:i<2?'1px solid #F2EADA':'none'}}>
            <div className="mono" style={{fontSize:12, fontWeight:700, color:'#F58220', width:46}}>{t}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13, fontWeight:600, color:'#11255C'}}>{n}</div>
              <div style={{fontSize:11, color:'#6B7490'}}>{r}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{background:'#11255C', borderRadius:16, padding:16, color:'white'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
          <div>
            <div style={{fontSize:11, color:'#6E9BCC', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700}}>Continue learning</div>
            <div style={{fontSize:15, fontWeight:700, marginTop:6, maxWidth:180}}>Ramp Operations · Lesson 4.2</div>
            <div style={{fontSize:11, color:'#6E9BCC', marginTop:3}}>18:42 left</div>
          </div>
          <div style={{width:48, height:48, borderRadius:'50%', background:'#F58220', display:'grid', placeItems:'center', color:'#11255C'}}>
            <Icon name="play" size={20} strokeWidth={1}/>
          </div>
        </div>
      </div>
    </div>
    <MTabBar active="home"/>
  </div>
);

// ══════════════ 03 Course ══════════════
const MobileCourse = () => (
  <div style={{height:'100%', background:'#FBF5E8', overflow:'auto', paddingBottom:80}}>
    <div style={{padding:'50px 0 0', background:'#11255C'}}>
      <div style={{padding:'6px 20px 12px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <Icon name="chevR" size={20} color="#6E9BCC" strokeWidth={2.5}/>
        <div style={{fontSize:12, color:'#DDE7F3'}}>Aviation · DIP-AV-01</div>
        <Icon name="settings" size={18} color="#6E9BCC"/>
      </div>
      <div style={{aspectRatio:'16/9', position:'relative', background:'#0C1B48', display:'grid', placeItems:'center'}}>
        <div style={{position:'absolute', inset:0, background:'repeating-linear-gradient(135deg, rgba(245,130,32,0.12) 0 12px, rgba(110,155,204,0.08) 12px 24px)'}}/>
        <div style={{position:'relative', textAlign:'center', color:'white'}}>
          <div style={{width:56, height:56, borderRadius:'50%', background:'#F58220', display:'grid', placeItems:'center', margin:'0 auto 10px', color:'#11255C'}}>
            <Icon name="play" size={22} strokeWidth={1.2}/>
          </div>
          <div style={{fontSize:12, fontWeight:600}}>Lesson 4.2 · Ramp Safety</div>
          <div className="mono" style={{fontSize:10, color:'#6E9BCC', marginTop:3}}>18:42 / 42:15</div>
        </div>
      </div>
    </div>
    <div style={{padding:'16px 20px'}}>
      <Pill variant="orange" dot>In progress · 48%</Pill>
      <h2 style={{fontSize:22, fontWeight:800, color:'#11255C', letterSpacing:'-0.02em', margin:'8px 0 6px', lineHeight:1.2}}>Airport Ground Handling Operations</h2>
      <p style={{fontSize:12, color:'#6B7490', margin:'0 0 16px', lineHeight:1.5}}>40-hour module · Ramp ops, baggage, safety &amp; aircraft turnaround.</p>

      <div style={{display:'flex', gap:4, marginBottom:14, borderBottom:'1px solid #E6DFCF'}}>
        {['Modules','Notes','Discussion'].map((t,i)=>(
          <div key={t} style={{padding:'8px 12px', fontSize:12, fontWeight:600, color:i===0?'#F58220':'#6B7490', borderBottom:i===0?'2px solid #F58220':'2px solid transparent', marginBottom:-1}}>{t}</div>
        ))}
      </div>

      {[
        {n:'M01', t:'Introduction to Ground Handling', h:'4h', done:true},
        {n:'M02', t:'Ramp & Apron Safety', h:'6h', done:true},
        {n:'M03', t:'Baggage Handling Systems', h:'5h', done:false, active:true},
        {n:'M04', t:'Aircraft Marshalling', h:'4h', done:false, locked:true},
      ].map((m,i)=>(
        <div key={i} style={{display:'flex', gap:12, padding:'14px 0', borderBottom:'1px solid #F2EADA', alignItems:'center'}}>
          <div className="mono" style={{width:36, height:36, borderRadius:10, background:m.active?'#F58220':m.done?'#DDF2E5':'#F2EADA', color:m.active?'#11255C':m.done?'#2E8B57':'#9098AE', display:'grid', placeItems:'center', fontSize:10, fontWeight:700}}>
            {m.done?<Icon name="check" size={14}/>:m.n}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:13, fontWeight:600, color:'#11255C'}}>{m.t}</div>
            <div style={{fontSize:11, color:'#6B7490'}}>{m.h} · {m.done?'Complete':m.active?'In progress':'Locked'}</div>
          </div>
          {m.locked && <Icon name="lock" size={14} color="#9098AE"/>}
          {!m.locked && <Icon name="chevR" size={16} color="#9098AE"/>}
        </div>
      ))}
    </div>
  </div>
);

// ══════════════ 04 Timetable ══════════════
const MobileTimetable = () => (
  <div style={{height:'100%', background:'#FBF5E8', overflow:'auto', paddingBottom:80}}>
    <Mhdr title="Week 12" sub="Timetable · Mar 18—22" right={<Icon name="cal" size={22} color="#6B7490"/>}/>
    <div style={{padding:'0 20px 14px', display:'flex', gap:6, overflowX:'auto'}}>
      {['M 18','T 19','W 20','Th 21','F 22','S 23'].map((d,i)=>(
        <div key={d} style={{flexShrink:0, padding:'10px 14px', borderRadius:12, background:i===0?'#11255C':'white', color:i===0?'white':'#6B7490', fontSize:12, fontWeight:600, border:i===0?'0':'1px solid #E6DFCF', minWidth:58, textAlign:'center'}}>
          <div style={{fontSize:9, opacity:0.7, letterSpacing:'0.08em', textTransform:'uppercase'}}>{d.split(' ')[0]}</div>
          <div style={{fontSize:16, fontWeight:800, marginTop:2, color:i===0?'#F58220':'#11255C'}}>{d.split(' ')[1]}</div>
        </div>
      ))}
    </div>
    <div style={{padding:'0 20px', display:'flex', flexDirection:'column', gap:10}}>
      {[
        {t:'09:00', dur:'90m', n:'Ramp Safety Briefing', f:'Dr. M. Krishnan', r:'Rm 204', live:true},
        {t:'11:30', dur:'120m', n:'Baggage Handling Lab', f:'Capt. R. Singh', r:'Sim Hall'},
        {t:'14:00', dur:'60m', n:'English Communication', f:'Ms. L. Fernandes', r:'Rm 108'},
        {t:'15:30', dur:'90m', n:'Customer Service Role Play', f:'Mr. A. Menon', r:'Rm 211'},
      ].map((c,i)=>(
        <div key={i} style={{display:'flex', gap:12}}>
          <div style={{width:50, textAlign:'right', flexShrink:0, paddingTop:4}}>
            <div className="mono" style={{fontSize:12, fontWeight:800, color:'#11255C'}}>{c.t}</div>
            <div className="mono" style={{fontSize:10, color:'#9098AE'}}>{c.dur}</div>
          </div>
          <div style={{flex:1, background:'white', borderRadius:14, padding:'12px 14px', border:c.live?'1px solid #F58220':'1px solid #E6DFCF', position:'relative'}}>
            {c.live && <div style={{position:'absolute', top:-6, left:14, background:'#F58220', color:'#11255C', padding:'2px 8px', borderRadius:999, fontSize:9, fontWeight:800, letterSpacing:'0.08em'}}>LIVE</div>}
            <div style={{fontSize:13, fontWeight:700, color:'#11255C'}}>{c.n}</div>
            <div style={{fontSize:11, color:'#6B7490', marginTop:3}}>{c.f}</div>
            <div style={{display:'inline-block', marginTop:6, fontSize:11, color:'#1A3A8F', background:'#E8EDF9', padding:'2px 8px', borderRadius:6, fontWeight:600}}>{c.r}</div>
          </div>
        </div>
      ))}
    </div>
    <MTabBar active="timetable"/>
  </div>
);

// ══════════════ 05 Fees ══════════════
const MobileFees = () => (
  <div style={{height:'100%', background:'#FBF5E8', overflow:'auto', paddingBottom:80}}>
    <Mhdr title="Fees" sub="Payment summary"/>
    <div style={{padding:'0 20px'}}>
      <div style={{background:'#11255C', borderRadius:20, padding:'20px 22px', color:'white', position:'relative', overflow:'hidden'}}>
        <div style={{position:'absolute', right:-30, top:-30, width:120, height:120, background:'#F58220', borderRadius:'50%', opacity:0.15}}/>
        <div style={{fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', color:'#6E9BCC', fontWeight:700}}>Outstanding</div>
        <div className="mono" style={{fontSize:32, fontWeight:800, marginTop:6, letterSpacing:'-0.02em'}}>₹24,500</div>
        <div style={{fontSize:12, color:'#DDE7F3', marginTop:4}}>Due on 25 March · Instalment 3 of 6</div>
        <button className="btn btn-primary" style={{marginTop:14, padding:'11px 18px', fontSize:13}}>Pay now <Icon name="chevR" size={13}/></button>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, margin:'14px 0'}}>
        <div style={{background:'white', borderRadius:14, padding:'14px 16px', border:'1px solid #E6DFCF'}}>
          <div style={{fontSize:10, color:'#6B7490', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700}}>Paid</div>
          <div className="mono" style={{fontSize:19, fontWeight:800, color:'#2E8B57', marginTop:4}}>₹49,000</div>
        </div>
        <div style={{background:'white', borderRadius:14, padding:'14px 16px', border:'1px solid #E6DFCF'}}>
          <div style={{fontSize:10, color:'#6B7490', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700}}>Total</div>
          <div className="mono" style={{fontSize:19, fontWeight:800, color:'#11255C', marginTop:4}}>₹98,000</div>
        </div>
      </div>
      <div style={{fontSize:11, color:'#6B7490', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700, margin:'8px 0 8px'}}>Payment history</div>
      {[
        ['RCP-000321','Inst. 2','₹12,250','Paid','2026-02-10'],
        ['RCP-000287','Inst. 1','₹12,250','Paid','2026-01-12'],
        ['RCP-000221','Admission','₹24,500','Paid','2025-12-15'],
      ].map(([id,n,a,s,d],i)=>(
        <div key={i} style={{background:'white', borderRadius:12, padding:'12px 14px', border:'1px solid #E6DFCF', marginBottom:8, display:'flex', alignItems:'center', gap:12}}>
          <div style={{width:36, height:36, borderRadius:10, background:'#DDF2E5', color:'#2E8B57', display:'grid', placeItems:'center'}}>
            <Icon name="check" size={16}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:13, fontWeight:600, color:'#11255C'}}>{n}</div>
            <div className="mono" style={{fontSize:10, color:'#9098AE'}}>{id} · {d}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div className="mono" style={{fontSize:13, fontWeight:700, color:'#11255C'}}>{a}</div>
            <Icon name="download" size={13} color="#F58220"/>
          </div>
        </div>
      ))}
    </div>
    <MTabBar active="fees"/>
  </div>
);

// ══════════════ 06 Tickets ══════════════
const MobileTickets = () => (
  <div style={{height:'100%', background:'#FBF5E8', overflow:'auto', paddingBottom:80}}>
    <Mhdr title="Support" sub="Your tickets" right={<div style={{width:36, height:36, borderRadius:'50%', background:'#F58220', display:'grid', placeItems:'center', color:'#11255C'}}><Icon name="plus" size={18}/></div>}/>
    <div style={{padding:'0 20px 14px', display:'flex', gap:6}}>
      {['All 6','Open 2','Resolved 4'].map((t,i)=>(
        <div key={t} style={{padding:'7px 14px', borderRadius:999, fontSize:12, fontWeight:600, background:i===0?'#11255C':'white', color:i===0?'white':'#6B7490', border:i===0?'0':'1px solid #E6DFCF'}}>{t}</div>
      ))}
    </div>
    <div style={{padding:'0 20px', display:'flex', flexDirection:'column', gap:10}}>
      {[
        {id:'TKT-0418', t:'Login OTP not received on phone', s:'In progress', sc:'#F58220', sb:'#FEE8D2', time:'2h ago', cat:'IT'},
        {id:'TKT-0392', t:'Request class recording for Lesson 4.2', s:'Awaiting reply', sc:'#1A3A8F', sb:'#E8EDF9', time:'Yesterday', cat:'Academic'},
        {id:'TKT-0371', t:'Fee receipt correction needed', s:'Resolved', sc:'#2E8B57', sb:'#DDF2E5', time:'3 days ago', cat:'Finance'},
        {id:'TKT-0344', t:'Update emergency contact details', s:'Resolved', sc:'#2E8B57', sb:'#DDF2E5', time:'Last week', cat:'Admin'},
      ].map((tk,i)=>(
        <div key={i} style={{background:'white', borderRadius:14, padding:'14px', border:'1px solid #E6DFCF'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
            <span className="mono" style={{fontSize:10, color:'#9098AE'}}>{tk.id} · {tk.cat}</span>
            <span style={{padding:'3px 8px', borderRadius:999, background:tk.sb, color:tk.sc, fontSize:10, fontWeight:700}}>{tk.s}</span>
          </div>
          <div style={{fontSize:13, fontWeight:600, color:'#11255C', marginBottom:6, lineHeight:1.4}}>{tk.t}</div>
          <div style={{fontSize:11, color:'#6B7490'}}>{tk.time}</div>
        </div>
      ))}
    </div>
    <MTabBar active="me"/>
  </div>
);

// ══════════════ 07 Feedback ══════════════
const MobileFeedback = () => (
  <div style={{height:'100%', background:'#FBF5E8', overflow:'auto', paddingBottom:80}}>
    <Mhdr title="Feedback" sub="From your faculty · 3 new"/>
    <div style={{padding:'0 20px', display:'flex', flexDirection:'column', gap:12}}>
      <div style={{background:'#FEE8D2', borderRadius:16, padding:16, border:'1px solid #F5C38A', position:'relative'}}>
        <div style={{display:'flex', gap:10, alignItems:'center', marginBottom:10}}>
          <Avatar name="MK" color="orange" size={32}/>
          <div style={{flex:1}}>
            <div style={{fontSize:12, fontWeight:700, color:'#11255C'}}>Dr. Meera Krishnan</div>
            <div style={{fontSize:10, color:'#6B7490'}}>Module 2 · Ramp Safety Quiz</div>
          </div>
          <span style={{background:'#F58220', color:'#11255C', fontSize:10, fontWeight:800, padding:'3px 8px', borderRadius:999, letterSpacing:'0.04em'}}>NEW</span>
        </div>
        <div style={{fontSize:13, color:'#11255C', lineHeight:1.5, fontWeight:500}}>
          "Strong on safety protocols. Revise radio-call phraseology — page 14 of the handbook."
        </div>
        <div style={{display:'flex', gap:8, marginTop:12}}>
          <Pill variant="success" dot>Score: 8/10</Pill>
          <Pill variant="ghost">2 March</Pill>
        </div>
      </div>

      {[
        {f:'Capt. R. Singh', c:'RS', m:'Baggage Lab · Practical', t:'Good execution under time pressure. Next: focus on weight distribution.', s:'7/10', d:'28 Feb', col:'navy'},
        {f:'Ms. L. Fernandes', c:'LF', m:'English · Oral Exam', t:'Clear articulation. Work on active-voice sentence construction.', s:'9/10', d:'22 Feb', col:'lblue'},
      ].map((f,i)=>(
        <div key={i} style={{background:'white', borderRadius:16, padding:16, border:'1px solid #E6DFCF'}}>
          <div style={{display:'flex', gap:10, alignItems:'center', marginBottom:10}}>
            <Avatar name={f.c} color={f.col} size={32}/>
            <div style={{flex:1}}>
              <div style={{fontSize:12, fontWeight:700, color:'#11255C'}}>{f.f}</div>
              <div style={{fontSize:10, color:'#6B7490'}}>{f.m}</div>
            </div>
          </div>
          <div style={{fontSize:13, color:'#3B4566', lineHeight:1.5}}>"{f.t}"</div>
          <div style={{display:'flex', gap:8, marginTop:10}}>
            <Pill variant="navy">Score: {f.s}</Pill>
            <Pill variant="ghost">{f.d}</Pill>
          </div>
        </div>
      ))}
    </div>
    <MTabBar active="me"/>
  </div>
);

// ══════════════ 08 Certificate ══════════════
const MobileCertificate = () => (
  <div style={{height:'100%', background:'#FBF5E8', overflow:'auto', paddingBottom:80}}>
    <div style={{padding:'56px 20px 20px', background:'#11255C', color:'white', borderBottomLeftRadius:28, borderBottomRightRadius:28, textAlign:'center'}}>
      <div style={{width:64, height:64, borderRadius:'50%', background:'#F58220', display:'grid', placeItems:'center', margin:'0 auto 14px', color:'#11255C', boxShadow:'0 12px 30px rgba(245,130,32,0.35)'}}>
        <Icon name="award" size={30} strokeWidth={1.5}/>
      </div>
      <Pill variant="orange" dot>Program complete</Pill>
      <h2 style={{fontSize:22, fontWeight:800, letterSpacing:'-0.02em', margin:'10px 0 4px'}}>Your Diploma is ready.</h2>
      <div style={{fontSize:12, color:'#DDE7F3'}}>Issued 12 March 2026 · Grade A · Distinction</div>
    </div>
    <div style={{padding:'20px'}}>
      {/* mini certificate */}
      <div style={{aspectRatio:'1.414/1', background:'#FEFBF3', border:'1px solid #E6DFCF', borderRadius:14, padding:'16px', position:'relative', overflow:'hidden', boxShadow:'0 10px 30px -10px rgba(17,37,92,0.15)', marginBottom:14}}>
        <div style={{position:'absolute', top:0, left:0, width:4, height:'100%', background:'#1A3A8F'}}/>
        <div style={{position:'absolute', top:0, right:0, width:4, height:'100%', background:'#F58220'}}/>
        <div style={{textAlign:'center', marginTop:18}}>
          <div style={{fontSize:8, letterSpacing:'0.3em', color:'#F58220', fontWeight:700, textTransform:'uppercase'}}>Diploma of Completion</div>
          <div style={{fontSize:9, color:'#6B7490', marginTop:14}}>This certifies that</div>
          <div style={{fontSize:20, fontWeight:800, color:'#11255C', margin:'4px 0 6px', letterSpacing:'-0.02em'}}>Ananya Sharma</div>
          <div style={{fontSize:9, color:'#6B7490'}}>has completed the 300-hour program</div>
          <div style={{fontSize:13, fontWeight:700, color:'#1A3A8F', marginTop:4}}>Airport Ground Handling</div>
          <div className="mono" style={{fontSize:8, color:'#9098AE', marginTop:16}}>IL-AV-2026-000418</div>
        </div>
      </div>

      <div style={{display:'flex', gap:8, marginBottom:14}}>
        <button className="btn btn-primary" style={{flex:1, justifyContent:'center', padding:'11px'}}><Icon name="download" size={14}/> Download</button>
        <button className="btn btn-ghost" style={{flex:1, justifyContent:'center', padding:'11px'}}><Icon name="send" size={14}/> Share</button>
      </div>

      <div style={{background:'white', border:'1px solid #E6DFCF', borderRadius:14, padding:14, marginBottom:12}}>
        <div style={{fontSize:10, color:'#6B7490', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700, marginBottom:8}}>Verify online</div>
        <div style={{display:'flex', gap:12, alignItems:'center'}}>
          <div style={{width:50, height:50, background:'#11255C', borderRadius:8, padding:4, flexShrink:0}}>
            <div style={{width:'100%', height:'100%', background:'conic-gradient(from 0deg at 50% 50%, #fff 0deg 45deg, #11255C 45deg 90deg, #fff 90deg 135deg, #11255C 135deg 180deg, #fff 180deg 225deg, #11255C 225deg 270deg, #fff 270deg 315deg, #11255C 315deg 360deg)', backgroundSize:'12px 12px', borderRadius:2}}/>
          </div>
          <div style={{flex:1, minWidth:0}}>
            <div className="mono" style={{fontSize:10, color:'#11255C', fontWeight:700, wordBreak:'break-all'}}>verify.indialearns.com/IL-AV-2026-000418</div>
          </div>
        </div>
      </div>

      <div style={{background:'white', border:'1px solid #E6DFCF', borderRadius:14, padding:14}}>
        <div style={{fontSize:10, color:'#6B7490', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700, marginBottom:10}}>Next steps</div>
        <NextActionM icon="building" label="Job placement portal" desc="3 airlines hiring"/>
        <NextActionM icon="book" label="Level 2 · International Diploma" desc="IATA-aligned" last/>
      </div>
    </div>
  </div>
);

const NextActionM = ({ icon, label, desc, last=false }) => (
  <div style={{display:'flex', gap:10, padding:'10px 0', borderBottom:last?'none':'1px solid #F2EADA'}}>
    <div style={{width:32, height:32, borderRadius:10, background:'#F58220', display:'grid', placeItems:'center', color:'#11255C', flexShrink:0}}>
      <Icon name={icon} size={14}/>
    </div>
    <div style={{flex:1}}>
      <div style={{fontSize:12, fontWeight:600, color:'#11255C'}}>{label}</div>
      <div style={{fontSize:10, color:'#6B7490'}}>{desc}</div>
    </div>
    <Icon name="chevR" size={14} color="#9098AE"/>
  </div>
);

// ══════════════ 09 Onboarding (mobile) ══════════════
const MobileOnboarding = () => (
  <div style={{height:'100%', background:'#11255C', display:'flex', flexDirection:'column', color:'white', padding:'60px 24px 40px', position:'relative', overflow:'hidden'}}>
    <div style={{position:'absolute', top:-80, right:-60, width:200, height:200, background:'#F58220', borderRadius:'50%', opacity:0.12}}/>
    <BrandMark size={44} stacked={false}/>
    <div style={{margin:'30px 0 24px', display:'flex', gap:4}}>
      {[0,1,2].map(i=>(
        <div key={i} style={{flex:1, height:3, borderRadius:99, background:i<=1?'#F58220':'rgba(255,255,255,0.15)'}}/>
      ))}
    </div>
    <div style={{width:140, height:140, borderRadius:36, background:'#F58220', display:'grid', placeItems:'center', margin:'20px auto', color:'#11255C', boxShadow:'0 20px 40px -10px rgba(245,130,32,0.4)'}}>
      <Icon name="book" size={64} strokeWidth={1.5}/>
    </div>
    <div style={{textAlign:'center', margin:'10px 0 auto'}}>
      <div className="mono" style={{fontSize:10, color:'#6E9BCC', letterSpacing:'0.16em', marginBottom:8}}>TOUR · 02 OF 03</div>
      <h2 style={{fontSize:28, fontWeight:800, letterSpacing:'-0.02em', margin:'0 0 12px', lineHeight:1.15}}>Learn at your pace.</h2>
      <p style={{color:'#DDE7F3', fontSize:13, lineHeight:1.6, margin:0, maxWidth:280, margin:'0 auto'}}>
        Videos, PDFs &amp; quizzes organised by module. Resume exactly where you stopped, on any device.
      </p>
    </div>
    <div style={{display:'flex', gap:8, justifyContent:'center', margin:'28px 0 20px'}}>
      {[0,1,2].map(i=>(
        <span key={i} style={{width:i===1?24:8, height:8, borderRadius:99, background:i===1?'#F58220':'rgba(255,255,255,0.2)', transition:'all .2s'}}/>
      ))}
    </div>
    <div style={{display:'flex', gap:10}}>
      <button className="btn btn-ghost" style={{flex:1, justifyContent:'center', padding:'13px', background:'transparent', color:'#DDE7F3', borderColor:'rgba(255,255,255,0.2)'}}>Skip</button>
      <button className="btn btn-primary" style={{flex:2, justifyContent:'center', padding:'13px'}}>Next <Icon name="chevR" size={14}/></button>
    </div>
  </div>
);

// ══════════════ 10 Faculty ══════════════
const MobileFaculty = () => (
  <div style={{height:'100%', background:'#FBF5E8', overflow:'auto', paddingBottom:30}}>
    <div style={{padding:'56px 20px 18px', background:'#11255C', color:'white'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <div>
          <div style={{fontSize:10, letterSpacing:'0.14em', textTransform:'uppercase', color:'#6E9BCC', fontWeight:700}}>Faculty · DIP-AV-01</div>
          <div style={{fontSize:22, fontWeight:800, letterSpacing:'-0.02em', marginTop:4}}>Good morning, Dr. Meera</div>
        </div>
        <Avatar name="MK" color="orange" size={40}/>
      </div>
    </div>
    <div style={{padding:'16px 20px'}}>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14}}>
        <div style={{background:'white', borderRadius:14, padding:'14px', border:'1px solid #E6DFCF'}}>
          <div style={{fontSize:10, color:'#6B7490', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700}}>To grade</div>
          <div className="mono" style={{fontSize:24, fontWeight:800, color:'#F58220', marginTop:4}}>8</div>
          <div style={{fontSize:10, color:'#6B7490', marginTop:2}}>Due today</div>
        </div>
        <div style={{background:'white', borderRadius:14, padding:'14px', border:'1px solid #E6DFCF'}}>
          <div style={{fontSize:10, color:'#6B7490', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700}}>Students</div>
          <div className="mono" style={{fontSize:24, fontWeight:800, color:'#11255C', marginTop:4}}>28</div>
          <div style={{fontSize:10, color:'#2E8B57', marginTop:2}}>26 active</div>
        </div>
      </div>
      <div style={{fontSize:11, color:'#6B7490', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700, margin:'4px 0 8px'}}>Grading queue</div>
      {[
        ['Ananya Sharma','AS','Quiz · Module 2','Submitted 2h ago','orange'],
        ['Rohan Mehta','RM','Practical · Ramp Safety','Submitted 5h ago','lblue'],
        ['Kavya Iyer','KI','Quiz · Module 2','Submitted 8h ago','navy'],
      ].map(([n,i,m,t,c],k)=>(
        <div key={k} style={{background:'white', borderRadius:14, padding:'12px 14px', border:'1px solid #E6DFCF', marginBottom:8, display:'flex', gap:12, alignItems:'center'}}>
          <Avatar name={i} color={c} size={36}/>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:13, fontWeight:600, color:'#11255C'}}>{n}</div>
            <div style={{fontSize:11, color:'#6B7490'}}>{m} · {t}</div>
          </div>
          <button className="btn btn-primary btn-sm">Grade</button>
        </div>
      ))}
      <div style={{fontSize:11, color:'#6B7490', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700, margin:'16px 0 8px'}}>Upcoming classes</div>
      {[['09:00','Ramp Safety Briefing','Rm 204'],['14:00','Quiz Review · Module 2','Rm 204']].map(([t,n,r],i)=>(
        <div key={i} style={{display:'flex', gap:12, padding:'10px 0', borderBottom:i<1?'1px solid #F2EADA':'none'}}>
          <div className="mono" style={{fontSize:12, fontWeight:700, color:'#F58220', width:46}}>{t}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13, fontWeight:600, color:'#11255C'}}>{n}</div>
            <div style={{fontSize:11, color:'#6B7490'}}>{r}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ══════════════ 11 Admin ══════════════
const MobileAdmin = () => (
  <div style={{height:'100%', background:'#FBF5E8', overflow:'auto', paddingBottom:30}}>
    <Mhdr bg="#11255C" color="white" title="Admin · LUC DXB" sub="Operations dashboard" right={<Avatar name="RR" color="orange" size={36}/>}/>
    <div style={{padding:'16px 20px'}}>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14}}>
        {[
          ['Students','126','+8 this wk','#11255C','white'],
          ['Faculty','14','—','#F58220','#11255C'],
          ['Open tickets','14','3 urgent','white','#11255C'],
          ['Attendance','92%','+2%','white','#11255C'],
        ].map(([l,v,d,bg,fg],i)=>(
          <div key={i} style={{background:bg, color:fg, borderRadius:14, padding:'14px 16px', border:'1px solid '+(bg==='white'?'#E6DFCF':bg)}}>
            <div style={{fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700, opacity:fg==='white'?0.7:0.6}}>{l}</div>
            <div className="mono" style={{fontSize:22, fontWeight:800, marginTop:4}}>{v}</div>
            <div style={{fontSize:10, marginTop:2, opacity:0.7}}>{d}</div>
          </div>
        ))}
      </div>
      <div style={{background:'white', borderRadius:14, padding:16, border:'1px solid #E6DFCF', marginBottom:12}}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:10}}>
          <div style={{fontSize:11, color:'#6B7490', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700}}>Needs attention</div>
          <Pill variant="danger" dot>3</Pill>
        </div>
        {[
          ['alert','Batch AV-A attendance < 75%','5 students flagged'],
          ['cash','4 fee reminders overdue','Send SMS batch'],
          ['user','Dr. Krishnan · leave request','Approve by EOD'],
        ].map(([ic,t,d],i)=>(
          <div key={i} style={{display:'flex', gap:12, padding:'10px 0', borderBottom:i<2?'1px solid #F2EADA':'none', alignItems:'flex-start'}}>
            <div style={{width:30, height:30, borderRadius:8, background:'#FEE8D2', color:'#D96B0B', display:'grid', placeItems:'center', flexShrink:0}}><Icon name={ic} size={14}/></div>
            <div style={{flex:1}}>
              <div style={{fontSize:12, fontWeight:600, color:'#11255C', lineHeight:1.35}}>{t}</div>
              <div style={{fontSize:10, color:'#6B7490', marginTop:2}}>{d}</div>
            </div>
            <Icon name="chevR" size={14} color="#9098AE"/>
          </div>
        ))}
      </div>
      <div style={{background:'#11255C', borderRadius:14, padding:16, color:'white'}}>
        <div style={{fontSize:11, letterSpacing:'0.1em', textTransform:'uppercase', color:'#6E9BCC', fontWeight:700}}>Today's batches</div>
        <div style={{fontSize:13, marginTop:10, lineHeight:1.8}}>
          <div>AV-A · 09:00 · 28 present / 30</div>
          <div>AV-B · 11:00 · 25 present / 28</div>
          <div>RF-A · 14:00 · 24 present / 25</div>
        </div>
      </div>
    </div>
  </div>
);

// ══════════════ 12 Admin · Students ══════════════
const MobileAdminStudents = () => (
  <div style={{height:'100%', background:'#FBF5E8', overflow:'auto', paddingBottom:30}}>
    <Mhdr title="Students · 126" sub="Admin · all batches" right={<Icon name="filter" size={20} color="#6B7490"/>}/>
    <div style={{padding:'0 20px 12px'}}>
      <div style={{background:'white', border:'1px solid #E6DFCF', borderRadius:12, padding:'9px 12px', display:'flex', alignItems:'center', gap:8}}>
        <Icon name="search" size={14} color="#6B7490"/>
        <input placeholder="Search by name or ID..." style={{border:0, outline:0, flex:1, fontSize:13, background:'transparent'}}/>
      </div>
      <div style={{display:'flex', gap:6, marginTop:10, overflowX:'auto'}}>
        {['All 126','Aviation 82','Retail 44','Flagged 5'].map((t,i)=>(
          <div key={t} style={{flexShrink:0, padding:'6px 12px', borderRadius:999, background:i===0?'#11255C':'white', color:i===0?'white':'#6B7490', fontSize:11, fontWeight:600, border:i===0?'0':'1px solid #E6DFCF'}}>{t}</div>
        ))}
      </div>
    </div>
    <div style={{padding:'0 20px', display:'flex', flexDirection:'column', gap:8}}>
      {[
        {n:'Ananya Sharma',i:'AS',id:'STU-000418',b:'AV-A',f:'Paid',a:'94%',c:'orange',fc:'success'},
        {n:'Rohan Mehta',i:'RM',id:'STU-000412',b:'AV-A',f:'Partial',a:'88%',c:'lblue',fc:'warn'},
        {n:'Kavya Iyer',i:'KI',id:'STU-000397',b:'AV-B',f:'Paid',a:'91%',c:'navy',fc:'success'},
        {n:'Arjun Patel',i:'AP',id:'STU-000386',b:'RF-A',f:'Overdue',a:'72%',c:'orange',fc:'danger'},
        {n:'Sneha Rao',i:'SR',id:'STU-000371',b:'RF-A',f:'Paid',a:'96%',c:'lblue',fc:'success'},
        {n:'Deepika Bose',i:'DB',id:'STU-000364',b:'AV-B',f:'Paid',a:'89%',c:'navy',fc:'success'},
      ].map((s,i)=>(
        <div key={i} style={{background:'white', borderRadius:14, padding:'12px 14px', border:'1px solid #E6DFCF', display:'flex', gap:12, alignItems:'center'}}>
          <Avatar name={s.i} color={s.c} size={40}/>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:13, fontWeight:600, color:'#11255C'}}>{s.n}</div>
            <div style={{fontSize:10, color:'#6B7490', marginTop:1}}><span className="mono">{s.id}</span> · {s.b}</div>
            <div style={{display:'flex', gap:6, marginTop:6}}>
              <Pill variant={s.fc}>{s.f}</Pill>
              <Pill variant="ghost">Att {s.a}</Pill>
            </div>
          </div>
          <Icon name="chevR" size={16} color="#9098AE"/>
        </div>
      ))}
    </div>
  </div>
);

// ══════════════ 13 Admin · Tickets ══════════════
const MobileAdminTickets = () => (
  <div style={{height:'100%', background:'#FBF5E8', overflow:'auto', paddingBottom:30}}>
    <Mhdr title="Tickets · 14" sub="Support board"/>
    <div style={{padding:'0 20px 10px', display:'flex', gap:6, overflowX:'auto'}}>
      {[['New','4','#F58220'],['In progress','6','#1A3A8F'],['Awaiting','2','#6E9BCC'],['Resolved','12','#2E8B57']].map(([t,n,c],i)=>(
        <div key={t} style={{flexShrink:0, background:'white', border:'1px solid #E6DFCF', borderRadius:12, padding:'8px 12px', display:'flex', gap:8, alignItems:'center'}}>
          <span style={{width:8, height:8, borderRadius:'50%', background:c}}/>
          <span style={{fontSize:11, color:'#6B7490', fontWeight:600}}>{t}</span>
          <span className="mono" style={{fontSize:12, fontWeight:800, color:'#11255C'}}>{n}</span>
        </div>
      ))}
    </div>
    <div style={{padding:'0 20px', display:'flex', flexDirection:'column', gap:10}}>
      {[
        {id:'TKT-0418',t:'Login OTP not received',s:'New',sc:'#F58220',sb:'#FEE8D2',who:'A. Sharma',cat:'IT',age:'2h'},
        {id:'TKT-0417',t:'Request class recording Lesson 4.2',s:'In progress',sc:'#1A3A8F',sb:'#E8EDF9',who:'R. Mehta',cat:'Academic',age:'4h'},
        {id:'TKT-0415',t:'Fee receipt correction needed',s:'Awaiting',sc:'#6E9BCC',sb:'#DDE7F3',who:'K. Iyer',cat:'Finance',age:'1d'},
        {id:'TKT-0412',t:'WiFi intermittent in Rm 204',s:'In progress',sc:'#1A3A8F',sb:'#E8EDF9',who:'Faculty',cat:'Facilities',age:'1d'},
        {id:'TKT-0411',t:'Update emergency contact',s:'Resolved',sc:'#2E8B57',sb:'#DDF2E5',who:'A. Patel',cat:'Admin',age:'2d'},
      ].map((tk,i)=>(
        <div key={i} style={{background:'white', borderRadius:14, padding:'14px', border:'1px solid #E6DFCF'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
            <span className="mono" style={{fontSize:10, color:'#9098AE'}}>{tk.id} · {tk.cat}</span>
            <span style={{padding:'3px 8px', borderRadius:999, background:tk.sb, color:tk.sc, fontSize:10, fontWeight:700}}>{tk.s}</span>
          </div>
          <div style={{fontSize:13, fontWeight:600, color:'#11255C', marginBottom:6, lineHeight:1.4}}>{tk.t}</div>
          <div style={{display:'flex', justifyContent:'space-between', fontSize:11, color:'#6B7490'}}>
            <span>{tk.who}</span>
            <span className="mono">{tk.age} ago</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ══════════════ 14 Finance ══════════════
const MobileFinance = () => (
  <div style={{height:'100%', background:'#FBF5E8', overflow:'auto', paddingBottom:30}}>
    <Mhdr bg="#11255C" color="white" title="Finance" sub="March 2026" right={<Avatar name="PN" color="orange" size={36}/>}/>
    <div style={{padding:'16px 20px'}}>
      <div style={{background:'#F58220', color:'#11255C', borderRadius:16, padding:'18px 20px', marginBottom:12, position:'relative', overflow:'hidden'}}>
        <div style={{fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase', fontWeight:700, opacity:0.7}}>Collected · March</div>
        <div className="mono" style={{fontSize:28, fontWeight:800, marginTop:4, letterSpacing:'-0.02em'}}>₹18.4L</div>
        <div style={{fontSize:11, fontWeight:600, marginTop:3}}>+12% vs. Feb</div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14}}>
        <div style={{background:'white', borderRadius:14, padding:'14px', border:'1px solid #E6DFCF'}}>
          <div style={{fontSize:10, color:'#6B7490', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700}}>Overdue</div>
          <div className="mono" style={{fontSize:20, fontWeight:800, color:'#C23B3B', marginTop:4}}>₹2.3L</div>
          <div style={{fontSize:10, color:'#6B7490', marginTop:2}}>11 students</div>
        </div>
        <div style={{background:'white', borderRadius:14, padding:'14px', border:'1px solid #E6DFCF'}}>
          <div style={{fontSize:10, color:'#6B7490', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700}}>Due this wk</div>
          <div className="mono" style={{fontSize:20, fontWeight:800, color:'#F58220', marginTop:4}}>₹5.8L</div>
          <div style={{fontSize:10, color:'#6B7490', marginTop:2}}>24 students</div>
        </div>
      </div>

      <button className="btn btn-primary" style={{width:'100%', justifyContent:'center', padding:'12px', marginBottom:14}}>
        <Icon name="plus" size={14}/> Record a payment
      </button>

      <div style={{fontSize:11, color:'#6B7490', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700, margin:'4px 0 8px'}}>Suspension watchlist</div>
      {[
        {n:'Arjun Patel',i:'AP',id:'STU-000386',due:'₹24,500',days:'18 days overdue'},
        {n:'Vikram Nair',i:'VN',id:'STU-000348',due:'₹12,250',days:'11 days overdue'},
        {n:'Nisha Pillai',i:'NP',id:'STU-000319',due:'₹12,250',days:'8 days overdue'},
      ].map((s,i)=>(
        <div key={i} style={{background:'white', borderRadius:12, padding:'12px 14px', border:'1px solid #E6DFCF', marginBottom:8, display:'flex', gap:12, alignItems:'center'}}>
          <Avatar name={s.i} color="orange" size={36}/>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:13, fontWeight:600, color:'#11255C'}}>{s.n}</div>
            <div style={{fontSize:10, color:'#C23B3B', marginTop:1, fontWeight:600}}>{s.days}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div className="mono" style={{fontSize:13, fontWeight:700, color:'#11255C'}}>{s.due}</div>
            <span style={{fontSize:10, color:'#F58220', fontWeight:600}}>Remind →</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

Object.assign(window, { MobileCanvas });
