// India Learns — Student screens

const LoginScreen = () => (
  <div className="login-shell">
    <div className="login-panel">
      <div style={{display:'flex', alignItems:'center', gap:12}}>
        <BrandMark size={54}/>
        <div style={{borderLeft:'1px solid rgba(255,255,255,0.18)', paddingLeft:14, marginLeft:6}}>
          <div style={{fontSize:11, letterSpacing:'0.18em', textTransform:'uppercase', color:'#6E9BCC', fontWeight:700}}>Learning Management</div>
          <div style={{fontSize:11, letterSpacing:'0.18em', textTransform:'uppercase', color:'#6E9BCC', marginTop:3}}>LUC DXB · India Ops</div>
        </div>
      </div>

      {/* Decorative composition */}
      <div style={{position:'relative', marginTop:40, marginBottom:40}}>
        <div style={{fontSize:56, fontWeight:800, letterSpacing:'-0.03em', lineHeight:1.02, maxWidth:520}}>
          Learn what takes you <span style={{color:'#F58220'}}>further</span>.
        </div>
        <p style={{color:'#DDE7F3', fontSize:15, maxWidth:460, marginTop:20, lineHeight:1.6}}>
          Your classroom, coursework, timetable and fees — all in one place. For Diploma programs in Aviation and Retail &amp; Fashion.
        </p>

        <div style={{display:'flex', gap:14, marginTop:36}}>
          <div style={{background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:16, padding:'18px 20px', minWidth:180}}>
            <div style={{fontSize:28, fontWeight:800, color:'#F58220'}} className="mono">300h</div>
            <div style={{fontSize:12, color:'#DDE7F3', marginTop:2}}>Diploma program</div>
          </div>
          <div style={{background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:16, padding:'18px 20px', minWidth:180}}>
            <div style={{fontSize:28, fontWeight:800}} className="mono">30</div>
            <div style={{fontSize:12, color:'#DDE7F3', marginTop:2}}>Max students per class</div>
          </div>
          <div style={{background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:16, padding:'18px 20px', minWidth:180}}>
            <div style={{fontSize:28, fontWeight:800, color:'#F58220'}} className="mono">2</div>
            <div style={{fontSize:12, color:'#DDE7F3', marginTop:2}}>Launch sectors</div>
          </div>
        </div>
      </div>

      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12, color:'#DDE7F3'}}>
        <div>© 2026 India Learns · LUC DXB</div>
        <div style={{display:'flex', gap:18}}>
          <span>Privacy (DPDP 2023)</span>
          <span>Support</span>
        </div>
      </div>

      {/* decorative orange block */}
      <div style={{position:'absolute', right:-80, top:-80, width:260, height:260, background:'#F58220', borderRadius:'50%', opacity:0.10}}/>
      <div style={{position:'absolute', right:60, bottom:-40, width:140, height:140, background:'#6E9BCC', borderRadius:20, opacity:0.14, transform:'rotate(18deg)'}}/>
    </div>

    <div className="login-form">
      <div style={{display:'inline-flex', alignItems:'center', gap:8, background:'#FEE8D2', color:'#D96B0B', padding:'6px 12px', borderRadius:999, fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', alignSelf:'flex-start', marginBottom:16}}>
        <span className="dotmark"/> Accounts are created by admin
      </div>
      <h1 style={{fontSize:38, fontWeight:800, letterSpacing:'-0.02em', margin:'0 0 8px', color:'#11255C'}}>Welcome back.</h1>
      <p style={{color:'#6B7490', margin:'0 0 32px', fontSize:15}}>Sign in to continue to your dashboard.</p>

      <div className="field">
        <label>Email address</label>
        <input defaultValue="ananya.sharma@indialearns.com"/>
      </div>
      <div className="field">
        <label>Password</label>
        <input type="password" defaultValue="••••••••••"/>
      </div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22}}>
        <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#3B4566'}}>
          <input type="checkbox" defaultChecked style={{accentColor:'#F58220'}}/>
          Keep me signed in
        </label>
        <a style={{color:'#1A3A8F', fontSize:13, fontWeight:600, textDecoration:'none', cursor:'pointer'}}>Forgot password?</a>
      </div>
      <button className="btn btn-primary" style={{width:'100%', justifyContent:'center', padding:'14px 22px', fontSize:14}}>
        Sign in <Icon name="chevR" size={14}/>
      </button>

      <div style={{display:'flex', alignItems:'center', gap:12, margin:'28px 0'}}>
        <div style={{flex:1, height:1, background:'#E6DFCF'}}/>
        <span style={{fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', color:'#9098AE'}}>or</span>
        <div style={{flex:1, height:1, background:'#E6DFCF'}}/>
      </div>

      <button className="btn btn-ghost" style={{width:'100%', justifyContent:'center', padding:'12px 22px'}}>
        <Icon name="mail" size={16}/> Sign in with magic link
      </button>

      <div style={{marginTop:32, padding:'14px 16px', background:'#FBF5E8', border:'1px solid #E6DFCF', borderRadius:12, display:'flex', gap:12, alignItems:'flex-start'}}>
        <Icon name="shield" size={18} color="#1A3A8F"/>
        <div style={{fontSize:12, color:'#3B4566', lineHeight:1.5}}>
          Your account is protected with rate-limiting and audit logging. Suspicious activity is flagged to admin.
        </div>
      </div>
    </div>
  </div>
);

// STUDENT DASHBOARD
const StudentDashboard = ({ setScreen }) => (
  <div className="app">
    <SideNav role="student" active="student" setScreen={setScreen}/>
    <div className="main">
      <TopBar placeholder="Search courses, modules, classmates..."/>

      <div className="page-head">
        <div>
          <h1 className="page-title">Good morning, Ananya.</h1>
          <p className="page-sub">You have <b style={{color:'#11255C'}}>2 classes</b> today and <b style={{color:'#F58220'}}>1 assignment</b> due in 3 days.</p>
        </div>
        <div style={{display:'flex', gap:10}}>
          <button className="btn btn-ghost"><Icon name="cal" size={14}/> View Timetable</button>
          <button className="btn btn-navy"><Icon name="book" size={14}/> Continue Learning</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="label">Overall Progress</div>
          <div className="val mono">72%</div>
          <div className="progress" style={{marginTop:10}}><div style={{width:'72%'}}/></div>
          <div className="delta" style={{marginTop:8}}>+4% this week</div>
        </div>
        <div className="stat">
          <div className="label">Attendance</div>
          <div className="val mono">94%</div>
          <div style={{fontSize:12, color:'#6B7490', marginTop:6}}>47 / 50 classes</div>
        </div>
        <div className="stat orange-accent">
          <div className="label">Assignments Due</div>
          <div className="val mono">3</div>
          <div style={{fontSize:12, marginTop:6}}>Next: Mon, 27 Apr</div>
        </div>
        <div className="stat accent">
          <div className="label">Fee Status</div>
          <div className="val mono">₹42,500</div>
          <div className="delta">Paid · on schedule</div>
        </div>
      </div>

      <div className="grid-2">
        <div>
          {/* Continue course */}
          <div className="card" style={{marginBottom:18, background:'#11255C', color:'white', border:0, padding:0, overflow:'hidden', position:'relative'}}>
            <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr'}}>
              <div style={{padding:'26px 28px'}}>
                <div style={{fontSize:11, letterSpacing:'0.14em', textTransform:'uppercase', color:'#6E9BCC'}}>Continue where you left off</div>
                <h2 style={{margin:'8px 0 4px', fontSize:26, fontWeight:800, letterSpacing:'-0.01em'}}>Airport Ground Handling Operations</h2>
                <div style={{fontSize:13, color:'#DDE7F3'}}>Module 4 of 8 · Safety Protocols &amp; Ramp Operations</div>
                <div className="progress navy" style={{marginTop:18, background:'rgba(255,255,255,0.15)'}}><div style={{width:'48%', background:'#F58220'}}/></div>
                <div style={{fontSize:12, color:'#DDE7F3', marginTop:8}}>48% · 3h 20m remaining</div>
                <div style={{display:'flex', gap:10, marginTop:22}}>
                  <button className="btn btn-primary"><Icon name="play" size={12}/> Resume Module 4</button>
                  <button className="btn" style={{background:'rgba(255,255,255,0.1)', color:'white'}}>Course Outline</button>
                </div>
              </div>
              <div style={{position:'relative', background:'#1A3A8F'}}>
                <div style={{position:'absolute', inset:20, borderRadius:14, background:'repeating-linear-gradient(135deg, rgba(245,130,32,0.25) 0 8px, rgba(245,130,32,0.12) 8px 16px)', display:'grid', placeItems:'center'}}>
                  <div style={{textAlign:'center', color:'#FBF5E8'}}>
                    <Icon name="airplane" size={48} color="#F58220" strokeWidth={1.6}/>
                    <div className="mono" style={{fontSize:10, marginTop:10, letterSpacing:'0.1em', color:'#6E9BCC'}}>MODULE COVER · 16:9</div>
                  </div>
                </div>
                <div style={{position:'absolute', top:18, right:18, background:'rgba(0,0,0,0.3)', backdropFilter:'blur(8px)', padding:'4px 10px', borderRadius:999, fontSize:11, fontWeight:600}}>Aviation · DIP-AV-01</div>
              </div>
            </div>
          </div>

          {/* Courses grid */}
          <div className="card" style={{marginBottom:18}}>
            <div className="sec-head"><h3>My Courses</h3><a>View all →</a></div>
            <div className="grid-3">
              {[
                {name:'Airport Ground Handling', prog:48, mods:'4/8', code:'DIP-AV-01', color:'navy'},
                {name:'Aviation Safety & Security', prog:25, mods:'2/8', code:'DIP-AV-02', color:'orange'},
                {name:'Customer Service Excellence', prog:88, mods:'7/8', code:'DIP-AV-03', color:'lblue'},
              ].map(c => (
                <div key={c.code} style={{border:'1px solid #E6DFCF', borderRadius:16, padding:0, overflow:'hidden'}}>
                  <div style={{height:80, background: c.color==='navy'?'#1A3A8F':c.color==='orange'?'#F58220':'#6E9BCC', position:'relative', display:'grid', placeItems:'center'}}>
                    <Icon name={c.color==='orange'?'shield':c.color==='lblue'?'users':'airplane'} size={28} color={c.color==='navy'?'#F58220':'#11255C'}/>
                    <span className="mono" style={{position:'absolute', top:8, left:10, fontSize:9, color:'rgba(255,255,255,0.85)', letterSpacing:'0.1em'}}>{c.code}</span>
                  </div>
                  <div style={{padding:14}}>
                    <div style={{fontWeight:600, fontSize:13, color:'#11255C', lineHeight:1.3, minHeight:34}}>{c.name}</div>
                    <div style={{fontSize:11, color:'#6B7490', margin:'8px 0'}}>{c.mods} modules · {c.prog}%</div>
                    <div className="progress"><div style={{width:c.prog+'%'}}/></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent feedback */}
          <div className="card">
            <div className="sec-head"><h3>Recent Feedback</h3><a onClick={()=>setScreen('feedback')}>See all feedback →</a></div>
            <div className="fb" style={{border:0, padding:0, marginBottom:0}}>
              <div className="fb-head">
                <div className="fb-who">
                  <Avatar name="MK" color="orange" size={36}/>
                  <div>
                    <div style={{fontWeight:600, fontSize:13, color:'#11255C'}}>Dr. Meera Krishnan</div>
                    <div style={{fontSize:11, color:'#6B7490'}}>Module 3 · Customer Handling Assessment</div>
                  </div>
                </div>
                <Pill variant="success" dot>Rubric · 88 / 100</Pill>
              </div>
              <div className="fb-text">
                Ananya, your role-play was measured and empathetic — you handled the irate passenger scenario without escalating. Work on closing statements; try offering a specific next step before ending a conversation.
              </div>
              <div className="rubric">
                <div className="rh">CRITERIA</div><div className="rh" style={{textAlign:'center'}}>WEIGHT</div><div className="rh" style={{textAlign:'right'}}>SCORE</div>
                <div>Listening &amp; empathy</div><div className="mono" style={{textAlign:'center'}}>30%</div><div className="mono" style={{textAlign:'right', color:'#2E8B57'}}>27 / 30</div>
                <div>Problem resolution</div><div className="mono" style={{textAlign:'center'}}>40%</div><div className="mono" style={{textAlign:'right', color:'#2E8B57'}}>35 / 40</div>
                <div>Closing &amp; escalation</div><div className="mono" style={{textAlign:'center'}}>30%</div><div className="mono" style={{textAlign:'right', color:'#C98A1E'}}>26 / 30</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          <div className="card" style={{marginBottom:18}}>
            <div className="sec-head"><h3>Today · Wed 22 Apr</h3><a onClick={()=>setScreen('timetable')}>Week →</a></div>
            {[
              {t:'09:00', d:'90 min', ttl:'Airport Ground Handling', room:'Room 204 · Instructor MK', color:'orange', status:'Next'},
              {t:'11:30', d:'60 min', ttl:'Industry Practicum', room:'Simulation Lab B', color:'navy', status:''},
              {t:'14:00', d:'90 min', ttl:'Customer Service', room:'Room 201', color:'lblue', status:''},
            ].map((c,i) => (
              <div key={i} style={{display:'flex', gap:14, padding:'12px 0', borderBottom: i<2?'1px solid #E6DFCF':0, alignItems:'flex-start'}}>
                <div style={{textAlign:'right', minWidth:52}}>
                  <div className="mono" style={{fontSize:14, fontWeight:700, color:'#11255C'}}>{c.t}</div>
                  <div style={{fontSize:10, color:'#9098AE'}}>{c.d}</div>
                </div>
                <div style={{width:3, alignSelf:'stretch', background: c.color==='orange'?'#F58220':c.color==='navy'?'#1A3A8F':'#6E9BCC', borderRadius:2}}/>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600, fontSize:13, color:'#11255C'}}>{c.ttl}</div>
                  <div style={{fontSize:11, color:'#6B7490', marginTop:2}}>{c.room}</div>
                  {c.status && <Pill variant="orange" dot>{c.status}</Pill>}
                </div>
              </div>
            ))}
          </div>

          <div className="card cream" style={{marginBottom:18}}>
            <div className="sec-head"><h3>Fee Snapshot</h3><a onClick={()=>setScreen('fees')}>Details →</a></div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <div style={{fontSize:11, color:'#6B7490', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:600}}>Next due</div>
                <div className="big-num mono" style={{color:'#11255C', marginTop:6}}>₹8,500</div>
                <div style={{fontSize:12, color:'#6B7490', marginTop:4}}>Tuition · May installment</div>
              </div>
              <div style={{textAlign:'right'}}>
                <Pill variant="success" dot>On track</Pill>
                <div className="mono" style={{fontSize:12, color:'#11255C', marginTop:10, fontWeight:700}}>05 May 2026</div>
                <div style={{fontSize:11, color:'#6B7490'}}>13 days away</div>
              </div>
            </div>
            <div style={{marginTop:14, fontSize:12, color:'#3B4566', lineHeight:1.55}}>
              Finance will record your payment manually. You will receive a PDF receipt and WhatsApp confirmation.
            </div>
          </div>

          <div className="card">
            <div className="sec-head"><h3>Notifications</h3><a>Mark read</a></div>
            <div className="notif">
              <div className="nf-dot" style={{background:'#FEE8D2', color:'#D96B0B'}}><Icon name="feedback" size={16}/></div>
              <div className="nf-body">
                <div className="nf-ttl">New feedback from Dr. Meera</div>
                <div className="nf-sub">Module 3 assessment graded — rubric + comments</div>
              </div>
              <div className="nf-time">2h</div>
            </div>
            <div className="notif">
              <div className="nf-dot" style={{background:'#DDE7F3', color:'#1A3A8F'}}><Icon name="cal" size={16}/></div>
              <div className="nf-body">
                <div className="nf-ttl">Timetable updated</div>
                <div className="nf-sub">Thursday's 11:30 class moved to Room 301</div>
              </div>
              <div className="nf-time">Yesterday</div>
            </div>
            <div className="notif">
              <div className="nf-dot" style={{background:'#DDF2E5', color:'#2E8B57'}}><Icon name="check" size={16}/></div>
              <div className="nf-body">
                <div className="nf-ttl">Ticket #2041 resolved</div>
                <div className="nf-sub">Library access re-enabled by Operations</div>
              </div>
              <div className="nf-time">2d</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, { LoginScreen, StudentDashboard });
