// India Learns — Certificate preview + Onboarding flow

// ───────────────────────────────────────────────────────────────
// Certificate — student view (course complete, download & share)
// ───────────────────────────────────────────────────────────────
const CertificateScreen = ({ setScreen }) => (
  <div className="app">
    <SideNav role="student" active="certificate" setScreen={setScreen}/>
    <div className="main">
      <TopBar placeholder="Search your certificates..."/>
      <div style={{display:'flex', gap:6, alignItems:'center', fontSize:12, color:'#6B7490', marginBottom:10}}>
        <span onClick={()=>setScreen('student')} style={{cursor:'pointer'}}>Dashboard</span>
        <Icon name="chevR" size={12}/>
        <span onClick={()=>setScreen('course')} style={{cursor:'pointer'}}>My Courses</span>
        <Icon name="chevR" size={12}/>
        <span style={{color:'#11255C', fontWeight:600}}>Certificate</span>
      </div>

      <div className="page-head">
        <div>
          <Pill variant="success" dot>Program complete</Pill>
          <h1 className="page-title" style={{marginTop:8}}>Your Diploma is ready.</h1>
          <p className="page-sub">Issued on 12 March 2026 · Valid for lifetime · Verifiable via India Learns ledger.</p>
        </div>
        <div style={{display:'flex', gap:10}}>
          <button className="btn btn-ghost"><Icon name="send" size={14}/> Share</button>
          <button className="btn btn-primary"><Icon name="download" size={14}/> Download PDF</button>
        </div>
      </div>

      <div className="grid-2">
        {/* Certificate preview (left, large) */}
        <div>
          <CertificatePreview
            studentName="Ananya Sharma"
            programTitle="Diploma in Airport Ground Handling"
            hours={300}
            grade="A · Distinction"
            issueDate="12 March 2026"
            certId="IL-AV-2026-000418"
          />
          <div className="card" style={{marginTop:18}}>
            <div className="card-title">Verify this certificate</div>
            <div style={{display:'flex', gap:16, alignItems:'center'}}>
              <div style={{width:84, height:84, background:'#11255C', borderRadius:12, padding:8}}>
                {/* fake QR */}
                <div style={{width:'100%', height:'100%', background:
                  'conic-gradient(from 0deg at 50% 50%, #fff 0deg 45deg, #11255C 45deg 90deg, #fff 90deg 135deg, #11255C 135deg 180deg, #fff 180deg 225deg, #11255C 225deg 270deg, #fff 270deg 315deg, #11255C 315deg 360deg)',
                  backgroundSize:'20px 20px', borderRadius:4}}/>
              </div>
              <div style={{flex:1}}>
                <div className="mono" style={{fontSize:12, color:'#11255C', fontWeight:700, letterSpacing:'0.04em'}}>
                  verify.indialearns.com/IL-AV-2026-000418
                </div>
                <div style={{fontSize:12, color:'#6B7490', marginTop:6, lineHeight:1.5}}>
                  Employers or partners can scan this QR or visit the URL to cross-check authenticity,
                  issue date, hours completed, and grade. Valid for lifetime.
                </div>
              </div>
              <button className="btn btn-ghost btn-sm">Copy link</button>
            </div>
          </div>
        </div>

        {/* Details side panel */}
        <div style={{display:'flex', flexDirection:'column', gap:14}}>
          <div className="card">
            <div className="card-title">Program details</div>
            <Detail label="Program" value="Diploma in Airport Ground Handling"/>
            <Detail label="Sector" value="Aviation"/>
            <Detail label="Batch" value="AV-A · 2025-26"/>
            <Detail label="Total hours" value="300 hours"/>
            <Detail label="Modules" value="12 of 12 complete"/>
            <Detail label="Final grade" value="A · 87%" emphasize/>
            <Detail label="Faculty signatory" value="Dr. Meera Krishnan"/>
            <Detail label="Issued by" value="LUC Training Centre, DXB"/>
          </div>

          <div className="card" style={{background:'#FBF5E8'}}>
            <div className="card-title">Next steps</div>
            <NextAction icon="send" label="Share with employer" desc="Email or WhatsApp verified link"/>
            <NextAction icon="building" label="Job placement portal" desc="3 partner airlines hiring"/>
            <NextAction icon="book" label="Advance to Level 2" desc="International Diploma (IATA-aligned)" last/>
          </div>

          <div className="card" style={{background:'#11255C', color:'white', borderColor:'#11255C'}}>
            <div className="card-title on-dark">Congratulations</div>
            <div style={{fontSize:15, lineHeight:1.55, color:'#DDE7F3'}}>
              You've completed 300 hours of rigorous training. Welcome to the India Learns alumni network —
              4,218 graduates strong.
            </div>
            <div style={{display:'flex', gap:10, marginTop:14}}>
              <div className="mono" style={{fontSize:11, color:'#6E9BCC'}}>COHORT 2026 · BATCH A</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// The certificate artwork (reused inside preview modal too)
const CertificatePreview = ({ studentName, programTitle, hours, grade, issueDate, certId }) => (
  <div style={{
    aspectRatio:'1.414/1',
    background:'linear-gradient(180deg, #FEFBF3 0%, #FBF5E8 100%)',
    border:'1px solid #E6DFCF', borderRadius:20,
    position:'relative', overflow:'hidden',
    boxShadow:'0 30px 60px -20px rgba(17,37,92,0.18), 0 0 0 1px rgba(17,37,92,0.04)',
  }}>
    {/* Decorative corner ornaments */}
    <svg style={{position:'absolute', top:0, left:0, width:'30%'}} viewBox="0 0 200 200">
      <rect x="0" y="0" width="200" height="6" fill="#F58220"/>
      <rect x="0" y="0" width="6" height="200" fill="#1A3A8F"/>
      <circle cx="30" cy="30" r="60" fill="none" stroke="#6E9BCC" strokeWidth="0.5" opacity="0.4"/>
      <circle cx="30" cy="30" r="90" fill="none" stroke="#6E9BCC" strokeWidth="0.5" opacity="0.3"/>
    </svg>
    <svg style={{position:'absolute', bottom:0, right:0, width:'30%', transform:'rotate(180deg)'}} viewBox="0 0 200 200">
      <rect x="0" y="0" width="200" height="6" fill="#F58220"/>
      <rect x="0" y="0" width="6" height="200" fill="#1A3A8F"/>
      <circle cx="30" cy="30" r="60" fill="none" stroke="#6E9BCC" strokeWidth="0.5" opacity="0.4"/>
    </svg>

    <div style={{position:'absolute', inset:0, padding:'8% 10%', display:'flex', flexDirection:'column'}}>
      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <BrandMark size={42} stacked={false}/>
          <div style={{borderLeft:'1px solid #C9BFA4', paddingLeft:12}}>
            <div style={{fontSize:9, letterSpacing:'0.2em', textTransform:'uppercase', color:'#6B7490', fontWeight:700}}>Learning Management</div>
            <div style={{fontSize:9, letterSpacing:'0.2em', textTransform:'uppercase', color:'#6B7490', marginTop:2}}>LUC Training · DXB</div>
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div className="mono" style={{fontSize:9, color:'#9098AE', letterSpacing:'0.1em'}}>CERTIFICATE NO.</div>
          <div className="mono" style={{fontSize:11, color:'#11255C', fontWeight:700, marginTop:2}}>{certId}</div>
        </div>
      </div>

      {/* Body */}
      <div style={{flex:1, display:'flex', flexDirection:'column', justifyContent:'center', textAlign:'center'}}>
        <div style={{fontSize:10, letterSpacing:'0.3em', textTransform:'uppercase', color:'#F58220', fontWeight:700}}>Diploma of Completion</div>
        <div style={{fontSize:13, color:'#6B7490', marginTop:18}}>This certifies that</div>
        <div style={{fontFamily:'Poppins', fontSize:42, fontWeight:800, color:'#11255C', letterSpacing:'-0.02em', margin:'10px 0 12px'}}>
          {studentName}
        </div>
        <div style={{fontSize:13, color:'#6B7490', maxWidth:'70%', margin:'0 auto', lineHeight:1.6}}>
          has successfully completed the {hours}-hour program
        </div>
        <div style={{fontSize:22, fontWeight:700, color:'#1A3A8F', margin:'10px 0', letterSpacing:'-0.01em'}}>
          {programTitle}
        </div>
        <div style={{fontSize:12, color:'#6B7490'}}>
          with a final grade of <span style={{color:'#11255C', fontWeight:700}}>{grade}</span>.
        </div>
      </div>

      {/* Footer signatures */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:20}}>
        <div style={{flex:1, textAlign:'center'}}>
          <div style={{fontFamily:'"Brush Script MT", cursive', fontSize:22, color:'#11255C', fontStyle:'italic', marginBottom:4}}>
            M. Krishnan
          </div>
          <div style={{borderTop:'1px solid #11255C', paddingTop:6, fontSize:10, color:'#6B7490'}}>
            Dr. Meera Krishnan · Course Coordinator
          </div>
        </div>
        <div style={{width:70, height:70, borderRadius:'50%', border:'2px solid #F58220', display:'grid', placeItems:'center', textAlign:'center', flexShrink:0}}>
          <div>
            <div style={{fontSize:7, letterSpacing:'0.15em', color:'#F58220', fontWeight:700}}>OFFICIAL</div>
            <div style={{fontSize:9, fontWeight:800, color:'#11255C'}}>INDIA</div>
            <div style={{fontSize:9, fontWeight:800, color:'#1A3A8F'}}>LEARNS</div>
            <div style={{fontSize:7, letterSpacing:'0.1em', color:'#F58220', fontWeight:700}}>2026</div>
          </div>
        </div>
        <div style={{flex:1, textAlign:'center'}}>
          <div style={{fontFamily:'"Brush Script MT", cursive', fontSize:22, color:'#11255C', fontStyle:'italic', marginBottom:4}}>
            R. Rajan
          </div>
          <div style={{borderTop:'1px solid #11255C', paddingTop:6, fontSize:10, color:'#6B7490'}}>
            Rejin Rajan · Director, LUC DXB
          </div>
        </div>
      </div>

      <div style={{fontSize:10, color:'#9098AE', textAlign:'center', marginTop:14}}>
        Issued on {issueDate} · Verify at verify.indialearns.com
      </div>
    </div>
  </div>
);

const Detail = ({ label, value, emphasize=false }) => (
  <div style={{display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid #F2EADA'}}>
    <span style={{fontSize:12, color:'#6B7490'}}>{label}</span>
    <span style={{fontSize:13, fontWeight:emphasize?800:600, color:emphasize?'#F58220':'#11255C'}}>{value}</span>
  </div>
);

const NextAction = ({ icon, label, desc, last=false }) => (
  <div style={{display:'flex', gap:12, padding:'10px 0', borderBottom: last?'none':'1px solid #E6DFCF', cursor:'pointer'}}>
    <div style={{width:32, height:32, borderRadius:10, background:'#F58220', display:'grid', placeItems:'center', color:'#11255C', flexShrink:0}}>
      <Icon name={icon} size={15}/>
    </div>
    <div style={{flex:1, minWidth:0}}>
      <div style={{fontSize:13, fontWeight:600, color:'#11255C'}}>{label}</div>
      <div style={{fontSize:11, color:'#6B7490', marginTop:2}}>{desc}</div>
    </div>
    <Icon name="chevR" size={14} color="#9098AE"/>
  </div>
);

// ───────────────────────────────────────────────────────────────
// Onboarding flow — 5 steps (shown as sequential screens)
// Step 1: Email received  ·  2: Landing  ·  3: Set password
// Step 4: Welcome tour (3 slides)  ·  5: Dashboard arrival
// ───────────────────────────────────────────────────────────────
const OnboardingScreen = ({ setScreen }) => {
  const [step, setStep] = React.useState(() => {
    try { return Number(localStorage.getItem('il-onb')) || 0; } catch { return 0; }
  });
  const [tour, setTour] = React.useState(0);
  const go = (n) => { setStep(n); try { localStorage.setItem('il-onb', String(n)); } catch {} };
  const steps = ['Email invite', 'Landing page', 'Set password', 'Welcome tour', 'Dashboard'];

  return (
    <div style={{minHeight:'calc(100vh - 49px)', background:'#11255C', display:'flex', flexDirection:'column'}}>
      {/* Flow progress bar */}
      <div style={{background:'#0C1B48', padding:'18px 32px', display:'flex', alignItems:'center', gap:20, borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <BrandGlyph size={32}/>
          <span style={{color:'white', fontWeight:700, fontSize:14}}>Onboarding flow</span>
          <span style={{color:'#6E9BCC', fontSize:12}}>· Magic-link invite</span>
        </div>
        <div style={{flex:1, display:'flex', gap:6, maxWidth:600, marginLeft:'auto'}}>
          {steps.map((s, i) => (
            <div key={i} onClick={()=>go(i)} style={{
              flex:1, cursor:'pointer',
              padding:'8px 12px', borderRadius:10,
              background: i===step ? '#F58220' : i<step ? 'rgba(245,130,32,0.18)' : 'rgba(255,255,255,0.05)',
              color: i===step ? '#11255C' : i<step ? '#F58220' : '#6E9BCC',
              fontSize:11, fontWeight:700, letterSpacing:'0.04em', textAlign:'center',
              border: i===step ? '0' : '1px solid rgba(255,255,255,0.08)',
            }}>
              <span className="mono" style={{marginRight:6, opacity:0.8}}>{String(i+1).padStart(2,'0')}</span>{s}
            </div>
          ))}
        </div>
      </div>

      <div style={{flex:1, padding:'40px 32px', display:'grid', placeItems:'center'}}>
        {step === 0 && <OnbEmailInvite onNext={()=>go(1)}/>}
        {step === 1 && <OnbLanding onNext={()=>go(2)}/>}
        {step === 2 && <OnbSetPassword onNext={()=>go(3)}/>}
        {step === 3 && <OnbTour slide={tour} setSlide={setTour} onDone={()=>go(4)}/>}
        {step === 4 && <OnbArrival onEnter={()=>{ try { localStorage.removeItem('il-onb'); } catch {} setScreen('student'); }}/>}
      </div>

      <div style={{padding:'14px 32px', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12, color:'#6E9BCC', borderTop:'1px solid rgba(255,255,255,0.08)'}}>
        <span>Step {step+1} of 5 · click any pill above to jump</span>
        <div style={{display:'flex', gap:10}}>
          {step > 0 && <button className="btn btn-ghost btn-sm" style={{background:'transparent', color:'#DDE7F3', borderColor:'rgba(255,255,255,0.2)'}} onClick={()=>go(step-1)}>← Back</button>}
          {step < 4 && <button className="btn btn-primary btn-sm" onClick={()=>go(step+1)}>Next →</button>}
        </div>
      </div>
    </div>
  );
};

// Step 1: Email invite (mocked Gmail-ish interface)
const OnbEmailInvite = ({ onNext }) => (
  <div style={{width:'100%', maxWidth:680, background:'white', borderRadius:20, boxShadow:'0 40px 80px rgba(0,0,0,0.3)', overflow:'hidden'}}>
    <div style={{padding:'14px 20px', borderBottom:'1px solid #E6DFCF', display:'flex', alignItems:'center', gap:12, background:'#FBF5E8'}}>
      <div style={{display:'flex', gap:6}}>
        <span style={{width:12, height:12, borderRadius:'50%', background:'#FF5F57'}}/>
        <span style={{width:12, height:12, borderRadius:'50%', background:'#FEBC2E'}}/>
        <span style={{width:12, height:12, borderRadius:'50%', background:'#28C840'}}/>
      </div>
      <div className="mono" style={{fontSize:11, color:'#9098AE', marginLeft:8}}>mail.google.com/inbox</div>
      <span style={{marginLeft:'auto', fontSize:11, color:'#6B7490'}}>From: onboarding@indialearns.com</span>
    </div>
    <div style={{padding:'32px 40px'}}>
      <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:28}}>
        <BrandMark size={42} stacked={false}/>
        <div style={{borderLeft:'1px solid #E6DFCF', paddingLeft:14}}>
          <div style={{fontSize:10, letterSpacing:'0.18em', textTransform:'uppercase', color:'#6B7490', fontWeight:700}}>Welcome email</div>
          <div style={{fontSize:10, letterSpacing:'0.18em', textTransform:'uppercase', color:'#6B7490', marginTop:2}}>Delivered · 12:04 PM</div>
        </div>
      </div>
      <h2 style={{fontSize:26, fontWeight:800, color:'#11255C', letterSpacing:'-0.02em', margin:'0 0 12px'}}>Your seat is reserved, Ananya.</h2>
      <p style={{color:'#3B4566', lineHeight:1.6, margin:'0 0 20px', fontSize:14}}>
        You've been enrolled in the <b>Diploma in Airport Ground Handling</b> program at LUC Training Centre,
        Dubai. Your classes begin on <b>Monday, 18 March 2026</b>. Use the link below to activate your account.
      </p>
      <div style={{background:'#FBF5E8', border:'1px solid #E6DFCF', borderRadius:14, padding:'18px 20px', marginBottom:20}}>
        <div style={{fontSize:11, color:'#6B7490', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:700, marginBottom:6}}>Your enrolment code</div>
        <div className="mono" style={{fontSize:20, fontWeight:800, color:'#11255C', letterSpacing:'0.06em'}}>IL-AV-2026-000418</div>
      </div>
      <button className="btn btn-primary" style={{padding:'14px 26px', fontSize:14}} onClick={onNext}>
        Activate your account <Icon name="chevR" size={14}/>
      </button>
      <div style={{marginTop:18, fontSize:11, color:'#9098AE'}}>
        Link expires in 7 days · If the button doesn't work, paste <span className="mono">https://app.indialearns.com/a/IL-AV-2026-000418</span> into your browser.
      </div>
    </div>
  </div>
);

// Step 2: Landing page
const OnbLanding = ({ onNext }) => (
  <div style={{width:'100%', maxWidth:920, background:'white', borderRadius:20, boxShadow:'0 40px 80px rgba(0,0,0,0.3)', overflow:'hidden', display:'grid', gridTemplateColumns:'1fr 1fr'}}>
    <div style={{background:'#1A3A8F', color:'white', padding:'48px 44px', position:'relative', overflow:'hidden'}}>
      <BrandMark size={42} stacked={false}/>
      <h2 style={{fontSize:30, fontWeight:800, letterSpacing:'-0.02em', margin:'36px 0 14px', lineHeight:1.15}}>
        Welcome to <span style={{color:'#F58220'}}>India Learns</span>.
      </h2>
      <p style={{color:'#DDE7F3', fontSize:14, lineHeight:1.6, margin:'0 0 28px'}}>
        Before we begin — three quick things you should know about your learning journey with us.
      </p>
      <div style={{display:'flex', flexDirection:'column', gap:14}}>
        <LandingPoint n="01" t="Classes, content, tests — in one place" d="Everything lives in your dashboard. No separate apps."/>
        <LandingPoint n="02" t="Your data is yours" d="DPDP 2023 compliant · India-hosted · Encrypted at rest."/>
        <LandingPoint n="03" t="A Diploma that gets you hired" d="Verifiable online, recognised by LUC's partner employers."/>
      </div>
      <div style={{position:'absolute', right:-60, top:-60, width:200, height:200, background:'#F58220', borderRadius:'50%', opacity:0.08}}/>
    </div>
    <div style={{padding:'48px 44px', display:'flex', flexDirection:'column', justifyContent:'center'}}>
      <div style={{fontSize:11, letterSpacing:'0.14em', textTransform:'uppercase', color:'#F58220', fontWeight:700, marginBottom:8}}>Step 01 of 03</div>
      <h2 style={{fontSize:24, fontWeight:800, color:'#11255C', letterSpacing:'-0.02em', margin:'0 0 10px'}}>Let's set up your account.</h2>
      <p style={{color:'#6B7490', margin:'0 0 24px', fontSize:13, lineHeight:1.6}}>
        Your admin has pre-enrolled you. You only need to choose a password and we'll get you started in
        under 3 minutes.
      </p>
      <div style={{display:'flex', flexDirection:'column', gap:10, marginBottom:28}}>
        <ChecklistItem label="Email verified" done/>
        <ChecklistItem label="Enrolment details"/>
        <ChecklistItem label="Password & security"/>
        <ChecklistItem label="Profile photo (optional)"/>
      </div>
      <button className="btn btn-primary" style={{padding:'13px 22px', fontSize:14, alignSelf:'flex-start'}} onClick={onNext}>
        Let's go <Icon name="chevR" size={14}/>
      </button>
      <div style={{marginTop:14, fontSize:11, color:'#9098AE'}}>
        Having trouble? Write to <span style={{color:'#1A3A8F', fontWeight:600}}>support@indialearns.com</span>
      </div>
    </div>
  </div>
);

const LandingPoint = ({ n, t, d }) => (
  <div style={{display:'flex', gap:14, alignItems:'flex-start'}}>
    <div className="mono" style={{width:34, height:34, borderRadius:10, background:'rgba(245,130,32,0.2)', color:'#F58220', display:'grid', placeItems:'center', fontSize:12, fontWeight:700, flexShrink:0}}>{n}</div>
    <div>
      <div style={{fontSize:13, fontWeight:700, color:'white'}}>{t}</div>
      <div style={{fontSize:12, color:'#DDE7F3', marginTop:2}}>{d}</div>
    </div>
  </div>
);

const ChecklistItem = ({ label, done=false }) => (
  <div style={{display:'flex', gap:10, alignItems:'center', fontSize:13, color: done ? '#2E8B57' : '#6B7490'}}>
    <div style={{width:20, height:20, borderRadius:'50%', background: done ? '#DDF2E5' : '#F2EADA', color: done ? '#2E8B57' : '#9098AE', display:'grid', placeItems:'center', flexShrink:0}}>
      {done ? <Icon name="check" size={12}/> : <span className="mono" style={{fontSize:10}}>·</span>}
    </div>
    <span style={{textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.7 : 1}}>{label}</span>
  </div>
);

// Step 3: Set password
const OnbSetPassword = ({ onNext }) => (
  <div style={{width:'100%', maxWidth:520, background:'white', borderRadius:20, padding:'44px 48px', boxShadow:'0 40px 80px rgba(0,0,0,0.3)'}}>
    <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
      <BrandGlyph size={32}/>
      <span style={{fontSize:11, letterSpacing:'0.14em', textTransform:'uppercase', color:'#6B7490', fontWeight:700}}>Account setup · 02 of 03</span>
    </div>
    <h2 style={{fontSize:26, fontWeight:800, color:'#11255C', letterSpacing:'-0.02em', margin:'0 0 8px'}}>Choose a strong password.</h2>
    <p style={{color:'#6B7490', margin:'0 0 26px', fontSize:13}}>You'll use this to sign in from now on. Keep it safe.</p>
    <div className="field">
      <label>Email address</label>
      <input defaultValue="ananya.sharma@indialearns.com" disabled style={{background:'#FBF5E8', color:'#6B7490'}}/>
    </div>
    <div className="field">
      <label>New password</label>
      <input type="password" defaultValue="•••••••••••"/>
    </div>
    <div className="field">
      <label>Confirm password</label>
      <input type="password" defaultValue="•••••••••••"/>
    </div>
    <div style={{background:'#FBF5E8', borderRadius:12, padding:'14px 16px', margin:'8px 0 22px'}}>
      <div style={{fontSize:11, color:'#6B7490', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8}}>Strength</div>
      <div style={{display:'flex', gap:4, marginBottom:10}}>
        {['#2E8B57','#2E8B57','#2E8B57','#E6DFCF'].map((c,i)=>(
          <div key={i} style={{flex:1, height:6, borderRadius:3, background:c}}/>
        ))}
      </div>
      <div style={{fontSize:11, color:'#3B4566'}}>
        <div><Icon name="check" size={10} color="#2E8B57"/> At least 10 characters</div>
        <div><Icon name="check" size={10} color="#2E8B57"/> Mix of letters & numbers</div>
        <div><Icon name="check" size={10} color="#2E8B57"/> Includes a special character</div>
      </div>
    </div>
    <button className="btn btn-primary" style={{width:'100%', justifyContent:'center', padding:'13px 22px', fontSize:14}} onClick={onNext}>
      Create account & continue <Icon name="chevR" size={14}/>
    </button>
  </div>
);

// Step 4: Welcome tour (3 slides inside)
const OnbTour = ({ slide, setSlide, onDone }) => {
  const slides = [
    { t:'Your dashboard', d:'Everything — today\'s classes, pending work, unread notes — opens from a single screen. No hunting around.', icon:'home', accent:'#F58220' },
    { t:'Learn at your pace', d:'Video lessons, PDFs and quizzes are organised by module. Resume right where you stopped, on web or phone.', icon:'book', accent:'#6E9BCC' },
    { t:'Talk to your faculty', d:'Questions on a lecture? Open a ticket. Want to give feedback? We read every response — so use it.', icon:'feedback', accent:'#F58220' },
  ];
  const s = slides[slide];
  return (
    <div style={{width:'100%', maxWidth:780, background:'white', borderRadius:20, boxShadow:'0 40px 80px rgba(0,0,0,0.3)', overflow:'hidden'}}>
      <div style={{aspectRatio:'2.2/1', background:'#FBF5E8', position:'relative', overflow:'hidden', display:'grid', placeItems:'center'}}>
        {/* illustration area */}
        <div style={{position:'absolute', inset:0, background:'repeating-linear-gradient(135deg, #F2EADA 0 20px, #FBF5E8 20px 40px)'}}/>
        <div style={{position:'relative', textAlign:'center'}}>
          <div style={{width:120, height:120, borderRadius:30, background:s.accent, display:'grid', placeItems:'center', margin:'0 auto 18px', color:'#11255C', boxShadow:'0 20px 40px -10px rgba(17,37,92,0.3)'}}>
            <Icon name={s.icon} size={54} strokeWidth={1.6}/>
          </div>
          <div className="mono" style={{fontSize:10, color:'#9098AE', letterSpacing:'0.2em'}}>TOUR · {String(slide+1).padStart(2,'0')} OF 03</div>
        </div>
      </div>
      <div style={{padding:'32px 40px', textAlign:'center'}}>
        <h2 style={{fontSize:26, fontWeight:800, color:'#11255C', letterSpacing:'-0.02em', margin:'0 0 10px'}}>{s.t}</h2>
        <p style={{color:'#6B7490', fontSize:14, lineHeight:1.6, margin:'0 auto 24px', maxWidth:480}}>{s.d}</p>
        {/* dots */}
        <div style={{display:'flex', gap:8, justifyContent:'center', marginBottom:24}}>
          {slides.map((_,i)=>(
            <span key={i} onClick={()=>setSlide(i)} style={{width:i===slide?26:8, height:8, borderRadius:999, background:i===slide?'#F58220':'#E6DFCF', cursor:'pointer', transition:'width .2s'}}/>
          ))}
        </div>
        <div style={{display:'flex', gap:10, justifyContent:'center'}}>
          <button className="btn btn-ghost" onClick={onDone}>Skip tour</button>
          {slide < slides.length-1 ? (
            <button className="btn btn-primary" onClick={()=>setSlide(slide+1)}>Next <Icon name="chevR" size={14}/></button>
          ) : (
            <button className="btn btn-primary" onClick={onDone}>Enter dashboard <Icon name="chevR" size={14}/></button>
          )}
        </div>
      </div>
    </div>
  );
};

// Step 5: Arrival
const OnbArrival = ({ onEnter }) => (
  <div style={{width:'100%', maxWidth:520, textAlign:'center', color:'white'}}>
    <div style={{width:96, height:96, borderRadius:'50%', background:'#F58220', display:'grid', placeItems:'center', margin:'0 auto 28px', color:'#11255C', boxShadow:'0 20px 50px rgba(245,130,32,0.4)'}}>
      <Icon name="check" size={46} strokeWidth={3}/>
    </div>
    <h2 style={{fontSize:38, fontWeight:800, letterSpacing:'-0.02em', margin:'0 0 14px', lineHeight:1.1}}>
      You're all set, <span style={{color:'#F58220'}}>Ananya</span>.
    </h2>
    <p style={{color:'#DDE7F3', fontSize:15, lineHeight:1.6, margin:'0 0 32px'}}>
      Your first class — <b>Airport Ground Handling · Module 1</b> — starts on Monday at 9:00 AM.
      We'll remind you by WhatsApp and email, 30 minutes before.
    </p>
    <button className="btn btn-primary" style={{padding:'14px 28px', fontSize:14}} onClick={onEnter}>
      Go to my dashboard <Icon name="chevR" size={14}/>
    </button>
    <div style={{marginTop:20, fontSize:12, color:'#6E9BCC'}}>
      Or — <span style={{color:'#F58220', fontWeight:600, cursor:'pointer'}}>install the mobile app</span> to get started on your phone
    </div>
  </div>
);

Object.assign(window, { CertificateScreen, CertificatePreview, OnboardingScreen });
