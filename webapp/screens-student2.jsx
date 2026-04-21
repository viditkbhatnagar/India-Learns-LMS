// India Learns — Course, Timetable, Fees, Tickets, Feedback for students

const CourseScreen = ({ setScreen }) => (
  <div className="app">
    <SideNav role="student" active="course" setScreen={setScreen}/>
    <div className="main">
      <TopBar placeholder="Search modules, notes, resources..."/>
      <div style={{display:'flex', gap:6, alignItems:'center', fontSize:12, color:'#6B7490', marginBottom:10}}>
        <span onClick={()=>setScreen('student')} style={{cursor:'pointer'}}>Dashboard</span>
        <Icon name="chevR" size={12}/>
        <span>My Courses</span>
        <Icon name="chevR" size={12}/>
        <span style={{color:'#11255C', fontWeight:600}}>Airport Ground Handling</span>
      </div>

      <div className="page-head">
        <div>
          <Pill variant="navy">Aviation · DIP-AV-01</Pill>
          <h1 className="page-title" style={{marginTop:8}}>Airport Ground Handling Operations</h1>
          <p className="page-sub">A 40-hour module covering ramp operations, baggage handling, safety &amp; aircraft turnaround procedures.</p>
        </div>
        <div style={{textAlign:'right'}}>
          <Pill variant="orange" dot>In progress · 48%</Pill>
          <div className="mono" style={{marginTop:8, fontSize:13, color:'#11255C', fontWeight:700}}>3h 20m left</div>
        </div>
      </div>

      <div className="grid-2">
        <div>
          {/* Player */}
          <div className="card" style={{padding:0, overflow:'hidden', marginBottom:18}}>
            <div style={{aspectRatio:'16/9', background:'#11255C', position:'relative', display:'grid', placeItems:'center'}}>
              <div style={{position:'absolute', inset:0, background:'repeating-linear-gradient(135deg, rgba(245,130,32,0.12) 0 12px, rgba(110,155,204,0.08) 12px 24px)'}}/>
              <div style={{position:'relative', textAlign:'center', color:'white'}}>
                <div style={{width:76, height:76, borderRadius:'50%', background:'#F58220', display:'grid', placeItems:'center', margin:'0 auto 14px', cursor:'pointer'}}>
                  <Icon name="play" size={28} color="#11255C" strokeWidth={1.2}/>
                </div>
                <div style={{fontSize:14, fontWeight:600}}>Lesson 4.2 · Ramp Safety Briefing</div>
                <div className="mono" style={{fontSize:11, color:'#6E9BCC', marginTop:4}}>18:42 / 42:15</div>
              </div>
              <div style={{position:'absolute', bottom:0, left:0, right:0, padding:16}}>
                <div style={{height:4, background:'rgba(255,255,255,0.2)', borderRadius:2, overflow:'hidden'}}>
                  <div style={{width:'44%', height:'100%', background:'#F58220'}}/>
                </div>
              </div>
            </div>
            <div style={{padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid #E6DFCF'}}>
              <div>
                <div style={{fontSize:14, fontWeight:600, color:'#11255C'}}>Lesson 4.2 — Ramp Safety Briefing</div>
                <div style={{fontSize:12, color:'#6B7490'}}>Delivered by Dr. Meera Krishnan · Uploaded 18 Apr</div>
              </div>
              <div style={{display:'flex', gap:8}}>
                <button className="btn btn-ghost btn-sm"><Icon name="doc" size={12}/> Transcript</button>
                <button className="btn btn-ghost btn-sm"><Icon name="download" size={12}/> Resources</button>
              </div>
            </div>
          </div>

          {/* Module list */}
          <div className="card">
            <div className="sec-head"><h3>Course Outline</h3><span className="mono" style={{fontSize:12, color:'#6B7490'}}>8 modules · 40h</span></div>
            {[
              {n:1, ttl:'Airport Ecosystem & Stakeholders', dur:'3h · 4 lessons, 1 quiz', state:'done'},
              {n:2, ttl:'Passenger Handling Fundamentals', dur:'5h · 6 lessons, 1 quiz', state:'done'},
              {n:3, ttl:'Baggage Processing Systems', dur:'4h · 5 lessons, 1 quiz', state:'done'},
              {n:4, ttl:'Ramp Operations & Safety', dur:'6h · 7 lessons, 1 quiz', state:'active'},
              {n:5, ttl:'Aircraft Turnaround Procedures', dur:'5h · 6 lessons, 1 quiz', state:'todo'},
              {n:6, ttl:'Cargo Handling', dur:'5h · 5 lessons, 1 quiz', state:'todo'},
              {n:7, ttl:'Emergency Response & IRA', dur:'6h · 7 lessons, 1 quiz', state:'todo'},
              {n:8, ttl:'Final Practicum & Exam', dur:'6h · Practicum + Final Exam', state:'todo'},
            ].map(m => (
              <div key={m.n} className="module">
                <div className={`m-num ${m.state==='done'?'done':m.state==='active'?'active':''}`}>
                  {m.state==='done' ? <Icon name="check" size={16}/> : String(m.n).padStart(2,'0')}
                </div>
                <div className="m-body">
                  <div className="m-ttl">{m.ttl}</div>
                  <div className="m-meta">{m.dur}</div>
                </div>
                {m.state==='done' && <Pill variant="success">Completed</Pill>}
                {m.state==='active' && <Pill variant="orange" dot>Active</Pill>}
                {m.state==='todo' && <Pill variant="ghost">Upcoming</Pill>}
                <Icon name="chevR" size={16} color="#9098AE"/>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="card" style={{marginBottom:18}}>
            <div className="card-title">Module 4 · Resources</div>
            {[
              {t:'Ramp Safety Handbook', m:'PDF · 2.4 MB', i:'pdf'},
              {t:'Ground Equipment Diagram', m:'PDF · 880 KB', i:'pdf'},
              {t:'Safety Briefing Video', m:'MP4 · 42:15', i:'video'},
              {t:'Weekly Checkpoint Quiz', m:'20 Qs · 25 min', i:'quiz'},
            ].map((r,i)=>(
              <div key={i} style={{display:'flex', gap:12, alignItems:'center', padding:'10px 0', borderBottom: i<3?'1px solid #E6DFCF':0}}>
                <div style={{width:34, height:34, borderRadius:10, background:'#FBF5E8', display:'grid', placeItems:'center', color:'#1A3A8F'}}>
                  <Icon name={r.i} size={16}/>
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:13, fontWeight:600, color:'#11255C'}}>{r.t}</div>
                  <div style={{fontSize:11, color:'#9098AE'}}>{r.m}</div>
                </div>
                <Icon name="download" size={14} color="#1A3A8F"/>
              </div>
            ))}
          </div>

          <div className="card" style={{marginBottom:18}}>
            <div className="card-title">Assignments</div>
            <div style={{border:'1px solid #FEE8D2', background:'#FEF4E8', borderRadius:12, padding:14}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                <Pill variant="orange" dot>Due in 3 days</Pill>
                <span className="mono" style={{fontSize:11, color:'#6B7490'}}>ASG-04</span>
              </div>
              <div style={{fontSize:13, fontWeight:600, color:'#11255C', lineHeight:1.35}}>Ramp Safety Incident Case Study</div>
              <div style={{fontSize:11, color:'#6B7490', marginTop:4}}>500-word analysis · Rubric graded</div>
              <button className="btn btn-primary btn-sm" style={{marginTop:10}}><Icon name="upload" size={12}/> Submit</button>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Instructor</div>
            <div style={{display:'flex', gap:12, alignItems:'center'}}>
              <Avatar name="MK" color="orange" size={48}/>
              <div>
                <div style={{fontWeight:600, color:'#11255C'}}>Dr. Meera Krishnan</div>
                <div style={{fontSize:12, color:'#6B7490'}}>Course Coordinator · 12 yrs IGA</div>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{width:'100%', justifyContent:'center', marginTop:12}} onClick={()=>setScreen('tickets')}>
              <Icon name="ticket" size={12}/> Raise academic ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const TimetableScreen = ({ setScreen }) => {
  const slots = [
    ['08:30',null,null,null,null,null],
    ['09:00',{t:'Airport Ground Handling',r:'Room 204 · MK',c:'navy',sp:2},null,{t:'Aviation Safety',r:'Room 204 · RV',c:'orange',sp:2},null,{t:'Customer Service',r:'Room 201 · SJ',c:'lblue',sp:2}],
    ['10:00',null,null,null,{t:'Industry Practicum',r:'Sim Lab B',c:'lblue',sp:2},null],
    ['11:30',{t:'Industry Practicum',r:'Sim Lab B',c:'lblue',sp:1},{t:'Language & Comm',r:'Room 110 · AG',c:'orange',sp:2},null,null,{t:'Tutorial',r:'Room 201',c:'navy',sp:1}],
    ['13:00',null,null,null,null,null],
    ['14:00',{t:'Customer Service',r:'Room 201 · SJ',c:'lblue',sp:2},{t:'Self-study Lab',r:'Library',c:'navy',sp:1},{t:'Assessment',r:'Exam Hall',c:'orange',sp:2},null,null],
    ['15:30',null,null,null,null,null],
  ];
  return (
    <div className="app">
      <SideNav role="student" active="timetable" setScreen={setScreen}/>
      <div className="main">
        <TopBar/>
        <div className="page-head">
          <div>
            <h1 className="page-title">Weekly Timetable</h1>
            <p className="page-sub">Batch A · Aviation Diploma · Week of 20–26 Apr 2026</p>
          </div>
          <div style={{display:'flex', gap:10}}>
            <div style={{display:'flex', alignItems:'center', gap:4, border:'1px solid #E6DFCF', borderRadius:999, padding:4}}>
              <button className="btn btn-sm" style={{background:'#11255C', color:'white'}}>Week</button>
              <button className="btn btn-sm btn-ghost" style={{border:0}}>Month</button>
              <button className="btn btn-sm btn-ghost" style={{border:0}}>List</button>
            </div>
            <button className="btn btn-ghost"><Icon name="download" size={14}/> Export .ics</button>
          </div>
        </div>

        <div style={{display:'flex', gap:16, marginBottom:18, fontSize:12, color:'#6B7490'}}>
          <span style={{display:'flex', alignItems:'center', gap:6}}><span style={{width:12, height:12, background:'#1A3A8F', borderRadius:3}}/> Core theory</span>
          <span style={{display:'flex', alignItems:'center', gap:6}}><span style={{width:12, height:12, background:'#F58220', borderRadius:3}}/> Assessment</span>
          <span style={{display:'flex', alignItems:'center', gap:6}}><span style={{width:12, height:12, background:'#6E9BCC', borderRadius:3}}/> Practicum / soft skills</span>
          <span style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:6, color:'#D96B0B'}}>
            <Icon name="alert" size={14}/> Thu 24 · Room change — 11:30 moved to Room 301
          </span>
        </div>

        <div className="timetable">
          <div className="thead"> </div>
          <div className="thead">Mon 20</div>
          <div className="thead">Tue 21</div>
          <div className="thead" style={{background:'#FEE8D2', color:'#D96B0B'}}>Wed 22</div>
          <div className="thead">Thu 23</div>
          <div className="thead">Fri 24</div>
          {slots.map((row,ri) => {
            const time = row[0];
            return (
              <React.Fragment key={ri}>
                <div className="time">{time}</div>
                {row.slice(1).map((cell,ci) => {
                  if (!cell) return <div key={ci}></div>;
                  return (
                    <div key={ci}>
                      <div className={`class-block ${cell.c==='orange'?'orange':cell.c==='lblue'?'lblue':''}`}>
                        <div>
                          <div className="c-ttl">{cell.t}</div>
                          <div className="c-meta">{cell.r}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>

        <div className="grid-3" style={{marginTop:22}}>
          <div className="card tight">
            <div className="card-title">This Week</div>
            <div className="big-num mono" style={{color:'#11255C'}}>14</div>
            <div style={{fontSize:12, color:'#6B7490'}}>classes scheduled · 22h total</div>
          </div>
          <div className="card tight">
            <div className="card-title">Attendance</div>
            <div className="big-num mono" style={{color:'#11255C'}}>94%</div>
            <div style={{fontSize:12, color:'#2E8B57', fontWeight:600}}>3 above batch average</div>
          </div>
          <div className="card tight" style={{background:'#11255C', color:'white', border:0}}>
            <div className="card-title on-dark">Upcoming assessment</div>
            <div style={{fontSize:16, fontWeight:700, marginTop:6}}>Module 4 · Ramp Safety Quiz</div>
            <div className="mono" style={{fontSize:13, color:'#6E9BCC', marginTop:6}}>Fri 24 Apr · 14:00</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FeesScreen = ({ setScreen }) => (
  <div className="app">
    <SideNav role="student" active="fees" setScreen={setScreen}/>
    <div className="main">
      <TopBar/>
      <div className="page-head">
        <div>
          <h1 className="page-title">Fees</h1>
          <p className="page-sub">Online payments are not enabled yet — Finance records payments manually and issues a PDF receipt.</p>
        </div>
        <div style={{display:'flex', gap:10}}>
          <button className="btn btn-ghost"><Icon name="download" size={14}/> Payment plan PDF</button>
          <button className="btn btn-navy" onClick={()=>setScreen('tickets')}><Icon name="ticket" size={14}/> Raise Finance Ticket</button>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <div className="card" style={{marginBottom:18, background:'#11255C', color:'white', border:0}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
              <div>
                <div style={{fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', color:'#6E9BCC'}}>Outstanding balance</div>
                <div className="mono" style={{fontSize:56, fontWeight:800, letterSpacing:'-0.03em', margin:'8px 0 4px', lineHeight:1}}>₹34,500</div>
                <div style={{fontSize:13, color:'#DDE7F3'}}>Next installment of ₹8,500 due on 05 May 2026</div>
              </div>
              <Pill variant="success" dot>On track · No suspension risk</Pill>
            </div>
            <div style={{height:1, background:'rgba(255,255,255,0.15)', margin:'22px 0'}}/>
            <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:20}}>
              <div><div style={{fontSize:11, color:'#6E9BCC', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600}}>Total fees</div><div className="mono" style={{fontSize:20, fontWeight:700, marginTop:4}}>₹77,000</div></div>
              <div><div style={{fontSize:11, color:'#6E9BCC', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600}}>Paid</div><div className="mono" style={{fontSize:20, fontWeight:700, marginTop:4, color:'#8CE8B2'}}>₹42,500</div></div>
              <div><div style={{fontSize:11, color:'#6E9BCC', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600}}>Balance</div><div className="mono" style={{fontSize:20, fontWeight:700, marginTop:4, color:'#F58220'}}>₹34,500</div></div>
              <div><div style={{fontSize:11, color:'#6E9BCC', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600}}>Next due</div><div className="mono" style={{fontSize:20, fontWeight:700, marginTop:4}}>05 May</div></div>
            </div>
          </div>

          <div className="card" style={{marginBottom:18}}>
            <div className="sec-head"><h3>Fee Breakdown</h3><Pill variant="ghost">6 components</Pill></div>
            <table className="tbl">
              <thead><tr><th>Component</th><th>Amount</th><th>Status</th><th>Due / Paid</th><th></th></tr></thead>
              <tbody>
                {[
                  ['Registration Fee','₹10,000','Paid','Paid 02 Feb','success'],
                  ['Tuition · Installment 1','₹8,500','Paid','Paid 05 Mar','success'],
                  ['Tuition · Installment 2','₹8,500','Paid','Paid 04 Apr','success'],
                  ['Tuition · Installment 3','₹8,500','Upcoming','Due 05 May','warn'],
                  ['Examination Fee','₹4,000','Pending','Due 20 Jun','ghost'],
                  ['Certification Fee','₹3,000','Pending','Due on completion','ghost'],
                  ['Miscellaneous (Trips)','₹2,500','Paid','Paid 15 Apr','success'],
                  ['Consumables','₹4,000','Pending','Due 15 May','ghost'],
                ].map(([a,b,c,d,v],i)=>(
                  <tr key={i}>
                    <td style={{fontWeight:600, color:'#11255C'}}>{a}</td>
                    <td className="mono">{b}</td>
                    <td><Pill variant={v} dot={v==='warn'||v==='success'}>{c}</Pill></td>
                    <td className="mono" style={{color:'#6B7490'}}>{d}</td>
                    <td><Icon name="chevR" size={14} color="#9098AE"/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="sec-head"><h3>Payment History</h3><a>Download all</a></div>
            <table className="tbl">
              <thead><tr><th>Receipt</th><th>Date</th><th>Paid for</th><th>Method</th><th>Amount</th><th></th></tr></thead>
              <tbody>
                {[
                  ['ILH-R-0148','15 Apr 2026','Miscellaneous · Trip','Bank transfer','₹2,500'],
                  ['ILH-R-0121','04 Apr 2026','Tuition Installment 2','Cheque · HDFC','₹8,500'],
                  ['ILH-R-0089','05 Mar 2026','Tuition Installment 1','Bank transfer','₹8,500'],
                  ['ILH-R-0031','02 Feb 2026','Registration','Cash','₹10,000'],
                ].map((r,i)=>(
                  <tr key={i}>
                    <td className="mono" style={{color:'#1A3A8F', fontWeight:600}}>{r[0]}</td>
                    <td className="mono">{r[1]}</td>
                    <td>{r[2]}</td>
                    <td><Pill variant="ghost">{r[3]}</Pill></td>
                    <td className="mono" style={{fontWeight:700, color:'#11255C'}}>{r[4]}</td>
                    <td><button className="btn btn-ghost btn-sm"><Icon name="download" size={12}/> PDF</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="card" style={{marginBottom:18}}>
            <div className="card-title">Payment progress</div>
            <div style={{display:'flex', justifyContent:'center', padding:'10px 0'}}>
              <div className="donut" style={{background:'conic-gradient(#F58220 0 55%, #F2EADA 55% 100%)'}}>
                <span className="dval mono">55%</span>
              </div>
            </div>
            <div style={{textAlign:'center', fontSize:12, color:'#6B7490'}}>₹42,500 of ₹77,000 paid</div>
          </div>

          <div className="card cream" style={{marginBottom:18}}>
            <div className="card-title">Reminder Schedule</div>
            <div style={{fontSize:12, color:'#3B4566', lineHeight:1.7}}>
              {['14 days before due · email + WhatsApp','7 days before due · friendly reminder','On due date · payment due today','3 days overdue · gentle nudge','14 days overdue · Warning 1','21 days overdue · Warning 2','28 days overdue · Access suspended'].map((t,i)=>(
                <div key={i} style={{display:'flex', gap:10, padding:'4px 0', alignItems:'center'}}>
                  <span style={{width:6, height:6, borderRadius:'50%', background: i>=4?'#C23B3B':i===6?'#C23B3B':'#1A3A8F'}}/>
                  <span style={{color:i>=4?'#C23B3B':'#3B4566'}}>{t}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="invoice">
            <div className="invoice-head">
              <div>
                <BrandMark size={32}/>
                <div style={{fontWeight:700, marginTop:8, color:'#11255C'}}>India Learns</div>
                <div style={{fontSize:11, color:'#6B7490'}}>LUC DXB · Registered Office</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div className="mono" style={{fontSize:10, letterSpacing:'0.1em', color:'#6B7490', textTransform:'uppercase'}}>Receipt</div>
                <div className="mono" style={{fontSize:13, fontWeight:700, color:'#11255C'}}>ILH-R-0148</div>
                <div className="mono" style={{fontSize:11, color:'#6B7490', marginTop:4}}>15 APR 2026</div>
              </div>
            </div>
            <div style={{fontSize:11, color:'#9098AE', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:600}}>Received from</div>
            <div style={{fontWeight:700, color:'#11255C', marginTop:2}}>Ananya Sharma · ILH-STU-0042</div>
            <div style={{fontSize:12, color:'#6B7490'}}>Aviation Diploma · Batch A</div>

            <table style={{width:'100%', marginTop:14, fontSize:12, borderCollapse:'collapse'}}>
              <tr><td style={{padding:'6px 0', color:'#6B7490'}}>Miscellaneous — Industry Trip</td><td className="mono" style={{textAlign:'right'}}>₹2,500.00</td></tr>
              <tr style={{borderTop:'1px solid #E6DFCF'}}><td style={{padding:'10px 0 4px', fontWeight:700, color:'#11255C'}}>Total received</td><td className="mono" style={{textAlign:'right', fontWeight:700, color:'#11255C'}}>₹2,500.00</td></tr>
            </table>
            <div style={{marginTop:12, fontSize:10, color:'#9098AE', display:'flex', justifyContent:'space-between'}}>
              <span>Issued by Finance</span>
              <span className="mono">SHA · 4e2a9c</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const TicketsScreen = ({ setScreen }) => (
  <div className="app">
    <SideNav role="student" active="tickets" setScreen={setScreen}/>
    <div className="main">
      <TopBar/>
      <div className="page-head">
        <div>
          <h1 className="page-title">Support Tickets</h1>
          <p className="page-sub">Raise issues across 5 categories. Acknowledgement within 24h, resolution within 5 days.</p>
        </div>
        <button className="btn btn-primary"><Icon name="plus" size={14}/> New Ticket</button>
      </div>

      <div className="grid-3" style={{marginBottom:22}}>
        {[
          {k:'Academic Support', d:'Course content, assessments, instructor queries', c:'navy', open:1},
          {k:'Administration', d:'Enrolment, documents, general queries', c:'lblue', open:0},
          {k:'Finance', d:'Fees, payments, refunds', c:'orange', open:1},
          {k:'Technical Support', d:'Platform access, login issues, system errors', c:'navy', open:0},
          {k:'Complaints & Appeals', d:'Escalation only · requires prior closed ticket', c:'danger', open:0, locked:true},
        ].map(cat => (
          <div key={cat.k} className="card tight" style={{cursor:'pointer', position:'relative'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
              <span className="dotmark" style={{background: cat.c==='orange'?'#F58220':cat.c==='lblue'?'#6E9BCC':cat.c==='danger'?'#C23B3B':'#1A3A8F', width:10, height:10}}/>
              {cat.locked && <Pill variant="ghost"><Icon name="lock" size={10}/> Escalation</Pill>}
              {cat.open>0 && !cat.locked && <Pill variant="orange">{cat.open} open</Pill>}
            </div>
            <div style={{fontWeight:700, color:'#11255C', marginTop:10, fontSize:14}}>{cat.k}</div>
            <div style={{fontSize:12, color:'#6B7490', marginTop:4, lineHeight:1.5}}>{cat.d}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="sec-head"><h3>My Tickets</h3>
            <div style={{display:'flex', gap:6}}>
              <button className="btn btn-sm" style={{background:'#11255C', color:'white'}}>All</button>
              <button className="btn btn-sm btn-ghost">Active</button>
              <button className="btn btn-sm btn-ghost">Closed</button>
            </div>
          </div>
          <table className="tbl">
            <thead><tr><th>ID</th><th>Subject</th><th>Category</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>
              {[
                ['#2054','Clarification on Module 4 assessment rubric','Academic','In Progress','warn','2h ago'],
                ['#2051','Receipt missing for Feb registration','Finance','Assigned','lblue','Yesterday'],
                ['#2041','Library portal access error','Technical','Resolved','success','2 days ago'],
                ['#2030','Change of address on record','Administration','Closed','ghost','5 days ago'],
                ['#1998','Request to reschedule practicum','Academic','Closed','ghost','12 days ago'],
              ].map(r=>(
                <tr key={r[0]}>
                  <td className="mono" style={{color:'#1A3A8F', fontWeight:600}}>{r[0]}</td>
                  <td style={{color:'#11255C'}}>{r[1]}</td>
                  <td><Pill variant="ghost">{r[2]}</Pill></td>
                  <td><Pill variant={r[4]} dot>{r[3]}</Pill></td>
                  <td className="mono" style={{color:'#6B7490', fontSize:12}}>{r[5]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div className="card" style={{marginBottom:18}}>
            <div className="card-title">Ticket #2054 · Conversation</div>
            <div style={{padding:'12px 0', borderBottom:'1px solid #E6DFCF', display:'flex', gap:10}}>
              <Avatar name="AS" color="lblue" size={32}/>
              <div style={{flex:1}}>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:12}}>
                  <span style={{fontWeight:600, color:'#11255C'}}>You</span>
                  <span className="mono" style={{color:'#9098AE'}}>Wed 09:14</span>
                </div>
                <div style={{fontSize:13, color:'#3B4566', marginTop:4, lineHeight:1.55}}>
                  Hi, for the Ramp Safety assessment rubric — the "closing &amp; escalation" criteria has 3 descriptors but only 2 score bands. Could you clarify which applies?
                </div>
              </div>
            </div>
            <div style={{padding:'12px 0', display:'flex', gap:10}}>
              <Avatar name="MK" color="orange" size={32}/>
              <div style={{flex:1}}>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:12}}>
                  <span style={{fontWeight:600, color:'#11255C'}}>Dr. Meera Krishnan <span style={{color:'#9098AE', fontWeight:400}}>· Course Coordinator</span></span>
                  <span className="mono" style={{color:'#9098AE'}}>Wed 10:42</span>
                </div>
                <div style={{fontSize:13, color:'#3B4566', marginTop:4, lineHeight:1.55}}>
                  Good catch. The third descriptor maps to the "partial" band — I'll update the rubric sheet today. Will confirm by EOD.
                </div>
              </div>
            </div>
            <div style={{marginTop:14, background:'#FBF5E8', border:'1px solid #E6DFCF', borderRadius:12, padding:12}}>
              <textarea rows={3} placeholder="Type a reply..." style={{width:'100%', border:0, outline:0, resize:'vertical', background:'transparent', font:'inherit', fontSize:13}}/>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8}}>
                <span style={{fontSize:11, color:'#9098AE'}}>Replies allowed on active tickets only</span>
                <button className="btn btn-primary btn-sm"><Icon name="send" size={12}/> Send</button>
              </div>
            </div>
          </div>

          <div className="card cream">
            <div className="card-title">SLA Timeline · #2054</div>
            <div style={{fontSize:12, color:'#3B4566', lineHeight:1.7}}>
              <div style={{display:'flex', gap:10, alignItems:'center'}}><Icon name="check" size={14} color="#2E8B57"/> <span>Submitted · Wed 09:14</span></div>
              <div style={{display:'flex', gap:10, alignItems:'center'}}><Icon name="check" size={14} color="#2E8B57"/> <span>Acknowledged within 24h target</span></div>
              <div style={{display:'flex', gap:10, alignItems:'center'}}><Icon name="clock" size={14} color="#C98A1E"/> <span>Resolution target · 5 days remaining: <b className="mono">4d 14h</b></span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const FeedbackScreen = ({ setScreen }) => (
  <div className="app">
    <SideNav role="student" active="feedback" setScreen={setScreen}/>
    <div className="main">
      <TopBar/>
      <div className="page-head">
        <div>
          <h1 className="page-title">Your Feedback</h1>
          <p className="page-sub">All rubric scores, written comments, and summary feedback from your faculty in one place.</p>
        </div>
        <div style={{display:'flex', gap:10}}>
          <button className="btn btn-ghost"><Icon name="filter" size={14}/> All courses</button>
          <button className="btn btn-ghost"><Icon name="download" size={14}/> Export</button>
        </div>
      </div>

      <div className="stats" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        <div className="stat"><div className="label">Average Rubric Score</div><div className="val mono">84</div><div style={{fontSize:12, color:'#2E8B57'}}>+6 vs last module</div></div>
        <div className="stat"><div className="label">Feedback Received</div><div className="val mono">12</div><div style={{fontSize:12, color:'#6B7490'}}>3 new this week</div></div>
        <div className="stat accent"><div className="label">Top Strength</div><div className="val" style={{fontSize:22, marginTop:8}}>Listening &amp; Empathy</div><div style={{fontSize:12, color:'#6E9BCC'}}>+9 above batch average</div></div>
      </div>

      <div className="grid-2">
        <div>
          {[
            {who:'Dr. Meera Krishnan', sub:'Module 3 · Customer Handling Assessment', score:'88 / 100', color:'success',
              text:'Your role-play was measured and empathetic — you handled the irate passenger scenario without escalating. Work on closing statements; try offering a specific next step before ending a conversation.',
              rubric:[['Listening & empathy','30%','27 / 30','success'],['Problem resolution','40%','35 / 40','success'],['Closing & escalation','30%','26 / 30','warn']]},
            {who:'Capt. Rahul Verma', sub:'Module 2 · Baggage Systems Quiz', score:'78 / 100', color:'warn',
              text:'Solid grasp of conveyor mechanics. Review the 4 questions on RFID tracking — notes are in the resources tab. You can retake the quiz after Fri.',
              rubric:null},
            {who:'Dr. Meera Krishnan', sub:'Assignment 01 · Airport Stakeholders Report', score:'92 / 100', color:'success',
              text:'Excellent structure and sourcing. Your stakeholder map was the clearest in the batch — consider submitting to the Industry Journal showcase.',
              rubric:null},
          ].map((f,i)=>(
            <div key={i} className="fb">
              <div className="fb-head">
                <div className="fb-who">
                  <Avatar name={f.who.split(' ').slice(-1)[0].slice(0,2)} color={i===0?'orange':i===1?'navy':'orange'} size={38}/>
                  <div>
                    <div style={{fontWeight:600, color:'#11255C'}}>{f.who}</div>
                    <div style={{fontSize:11, color:'#6B7490'}}>{f.sub}</div>
                  </div>
                </div>
                <Pill variant={f.color} dot>{f.score}</Pill>
              </div>
              <div className="fb-text">{f.text}</div>
              {f.rubric && (
                <div className="rubric">
                  <div className="rh">CRITERIA</div><div className="rh" style={{textAlign:'center'}}>WEIGHT</div><div className="rh" style={{textAlign:'right'}}>SCORE</div>
                  {f.rubric.map((r,j)=><React.Fragment key={j}><div>{r[0]}</div><div className="mono" style={{textAlign:'center'}}>{r[1]}</div><div className="mono" style={{textAlign:'right', color:r[3]==='success'?'#2E8B57':'#C98A1E'}}>{r[2]}</div></React.Fragment>)}
                </div>
              )}
            </div>
          ))}
        </div>
        <div>
          <div className="card" style={{marginBottom:18}}>
            <div className="card-title">Strengths · Growth areas</div>
            {[
              {t:'Listening & empathy', v:93, c:'#2E8B57'},
              {t:'Problem resolution', v:84, c:'#2E8B57'},
              {t:'Written communication', v:76, c:'#1A3A8F'},
              {t:'Closing & escalation', v:68, c:'#C98A1E'},
              {t:'Technical recall', v:62, c:'#C98A1E'},
            ].map((s,i)=>(
              <div key={i} style={{marginBottom:12}}>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4}}>
                  <span style={{color:'#11255C', fontWeight:600}}>{s.t}</span>
                  <span className="mono" style={{color:s.c, fontWeight:700}}>{s.v}</span>
                </div>
                <div className="progress"><div style={{width:s.v+'%', background:s.c}}/></div>
              </div>
            ))}
          </div>

          <div className="card cream">
            <div className="card-title">Summary from Coordinator</div>
            <div style={{fontSize:13, color:'#3B4566', lineHeight:1.6}}>
              Ananya is tracking <b style={{color:'#11255C'}}>comfortably above batch median</b> at the mid-point. Prioritise closing techniques and technical recall drills in the next fortnight. Continue strong written work.
            </div>
            <div style={{marginTop:12, fontSize:11, color:'#6B7490'}}>— Dr. Meera Krishnan · 18 Apr</div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, { CourseScreen, TimetableScreen, FeesScreen, TicketsScreen, FeedbackScreen });
