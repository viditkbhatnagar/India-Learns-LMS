// India Learns — Admin, Faculty, Finance

const AdminDashboard = ({ setScreen }) => (
  <div className="app">
    <SideNav role="admin" active="admin" setScreen={setScreen}/>
    <div className="main">
      <TopBar placeholder="Search students, courses, tickets..."/>
      <div className="page-head">
        <div>
          <h1 className="page-title">Operations Overview</h1>
          <p className="page-sub">Tue 22 Apr 2026 · All systems nominal. 3 SLAs approaching deadline.</p>
        </div>
        <div style={{display:'flex', gap:10}}>
          <button className="btn btn-ghost"><Icon name="download" size={14}/> Export</button>
          <button className="btn btn-primary"><Icon name="plus" size={14}/> New Student</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="label">Active Students</div><div className="val mono">126</div><div className="delta">+14 this week</div></div>
        <div className="stat"><div className="label">Active Faculty</div><div className="val mono">18</div><div style={{fontSize:12, color:'#6B7490'}}>2 on leave</div></div>
        <div className="stat orange-accent"><div className="label">Open Tickets</div><div className="val mono">14</div><div style={{fontSize:12, marginTop:6}}>3 near SLA breach</div></div>
        <div className="stat accent"><div className="label">Fees Collected · April</div><div className="val mono">₹18.4L</div><div className="delta">92% of target</div></div>
      </div>

      <div className="grid-2" style={{marginBottom:18}}>
        <div className="card">
          <div className="sec-head">
            <h3>Enrolment &amp; Revenue · last 6 months</h3>
            <div style={{display:'flex', gap:12, fontSize:11, color:'#6B7490'}}>
              <span style={{display:'flex', alignItems:'center', gap:6}}><span style={{width:10, height:10, background:'#1A3A8F', borderRadius:2}}/> Students</span>
              <span style={{display:'flex', alignItems:'center', gap:6}}><span style={{width:10, height:10, background:'#F58220', borderRadius:2}}/> Revenue ₹L</span>
            </div>
          </div>
          <div className="bars">
            {[
              ['Nov',24,6],['Dec',42,11],['Jan',68,14],['Feb',92,16],['Mar',118,18],['Apr',126,18.4]
            ].map(([m,s,r],i)=>{
              const sh = (s/140)*100, rh = (r/22)*100;
              return (
                <div key={m} className="bar-col">
                  <div style={{display:'flex', gap:3, alignItems:'flex-end', width:'100%', height:'100%'}}>
                    <div className="b" style={{height:sh+'%'}}/>
                    <div className="b orange" style={{height:rh+'%'}}/>
                  </div>
                  <div className="lbl">{m}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="sec-head"><h3>Ticket SLA Health</h3><Pill variant="danger" dot>3 near breach</Pill></div>
          <div style={{display:'flex', justifyContent:'center', padding:'10px 0'}}>
            <div className="donut" style={{background:'conic-gradient(#2E8B57 0 78%, #C98A1E 78% 92%, #C23B3B 92% 100%)'}}>
              <span className="dval mono">78%</span>
            </div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginTop:6, fontSize:12, textAlign:'center'}}>
            <div><div style={{color:'#2E8B57', fontWeight:700}} className="mono">11</div><div style={{color:'#6B7490'}}>On-track</div></div>
            <div><div style={{color:'#C98A1E', fontWeight:700}} className="mono">2</div><div style={{color:'#6B7490'}}>Near breach</div></div>
            <div><div style={{color:'#C23B3B', fontWeight:700}} className="mono">1</div><div style={{color:'#6B7490'}}>Breached</div></div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="sec-head"><h3>Tickets Needing Attention</h3><a onClick={()=>setScreen('admin-tickets')}>Go to board →</a></div>
          <table className="tbl">
            <thead><tr><th>ID</th><th>Category</th><th>Assigned</th><th>SLA</th><th>Priority</th></tr></thead>
            <tbody>
              {[
                ['#2054','Academic','Dr. Meera K.','4d 14h','Normal','navy'],
                ['#2051','Finance','Priya N.','2d 08h','Normal','navy'],
                ['#2048','Complaints','Senior Mgmt','9d 02h','Urgent','danger'],
                ['#2044','Technical','IT Desk','3h · Near breach','High','warn'],
                ['#2039','Academic','Capt. R. Verma','4h · Near breach','High','warn'],
              ].map(r=>(
                <tr key={r[0]}>
                  <td className="mono" style={{color:'#1A3A8F', fontWeight:600}}>{r[0]}</td>
                  <td>{r[1]}</td>
                  <td>{r[2]}</td>
                  <td className="mono" style={{color: r[3].includes('Near')?'#C98A1E':'#3B4566'}}>{r[3]}</td>
                  <td><Pill variant={r[5]} dot>{r[4]}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="card" style={{marginBottom:18}}>
            <div className="card-title">Programs</div>
            {[
              {n:'Aviation Diploma', code:'DIP-AV', b:'4 batches', s:'84 students', c:'#F58220'},
              {n:'Retail & Fashion', code:'DIP-RF', b:'2 batches', s:'42 students', c:'#6E9BCC'},
            ].map((p,i)=>(
              <div key={i} style={{display:'flex', gap:12, alignItems:'center', padding:'10px 0', borderBottom: i===0?'1px solid #E6DFCF':0}}>
                <div style={{width:40, height:40, borderRadius:10, background:p.c, display:'grid', placeItems:'center', color:'#11255C'}}>
                  <Icon name={i===0?'airplane':'hanger'} size={18}/>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700, color:'#11255C'}}>{p.n}</div>
                  <div style={{fontSize:11, color:'#6B7490'}} className="mono">{p.code} · {p.b} · {p.s}</div>
                </div>
                <Icon name="chevR" size={14} color="#9098AE"/>
              </div>
            ))}
          </div>

          <div className="card" style={{marginBottom:18}}>
            <div className="card-title">System Health</div>
            {[
              ['WhatsApp gateway','Operational','success','Delivery 99.2%'],
              ['Certifier.io','Operational','success','Last sync 2m ago'],
              ['Cloud storage','Operational','success','68% used'],
              ['Email (SES)','Degraded','warn','Retrying 14 messages'],
              ['DPDP audit log','Operational','success','Append-only'],
            ].map((s,i)=>(
              <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:i<4?'1px solid #E6DFCF':0}}>
                <div>
                  <div style={{fontSize:13, color:'#11255C', fontWeight:500}}>{s[0]}</div>
                  <div style={{fontSize:11, color:'#9098AE'}}>{s[3]}</div>
                </div>
                <Pill variant={s[2]} dot>{s[1]}</Pill>
              </div>
            ))}
          </div>

          <div className="card" style={{background:'#11255C', color:'white', border:0}}>
            <div className="card-title on-dark">Quick Actions</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
              {[['plus','New student'],['upload','Bulk enrol'],['cal','Timetable'],['bell','Broadcast']].map(([i,t])=>(
                <button key={t} className="btn" style={{background:'rgba(255,255,255,0.08)', color:'white', justifyContent:'flex-start', padding:'12px 14px'}}>
                  <Icon name={i} size={14} color="#F58220"/> {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const AdminStudents = ({ setScreen }) => (
  <div className="app">
    <SideNav role="admin" active="admin-students" setScreen={setScreen}/>
    <div className="main">
      <TopBar placeholder="Search by name, ID, email..."/>
      <div className="page-head">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-sub">126 active · 14 pending enrolment · 3 suspended</p>
        </div>
        <div style={{display:'flex', gap:10}}>
          <button className="btn btn-ghost"><Icon name="upload" size={14}/> Bulk import CSV</button>
          <button className="btn btn-primary"><Icon name="plus" size={14}/> Add Student</button>
        </div>
      </div>

      <div style={{display:'flex', gap:10, marginBottom:18, alignItems:'center', flexWrap:'wrap'}}>
        <div style={{display:'flex', gap:4, background:'white', border:'1px solid #E6DFCF', borderRadius:999, padding:4}}>
          <button className="btn btn-sm" style={{background:'#11255C', color:'white'}}>All · 126</button>
          <button className="btn btn-sm btn-ghost" style={{border:0}}>Active · 120</button>
          <button className="btn btn-sm btn-ghost" style={{border:0}}>Suspended · 3</button>
          <button className="btn btn-sm btn-ghost" style={{border:0}}>Pending · 3</button>
        </div>
        <Pill variant="ghost"><Icon name="filter" size={10}/> Program: All</Pill>
        <Pill variant="ghost">Batch: All</Pill>
        <Pill variant="ghost">Fee status: All</Pill>
        <div style={{marginLeft:'auto', fontSize:12, color:'#6B7490'}}>Showing 1–12 of 126</div>
      </div>

      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{width:28, paddingLeft:20}}><input type="checkbox"/></th>
              <th>Student</th>
              <th>ID</th>
              <th>Program · Batch</th>
              <th>Progress</th>
              <th>Fee Status</th>
              <th>Access</th>
              <th>Last login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Ananya Sharma','AS','lblue','ILH-STU-0042','Aviation · Batch A',72,'On track','success','Active','2h ago'],
              ['Arjun Patel','AP','orange','ILH-STU-0038','Aviation · Batch A',68,'On track','success','Active','Yesterday'],
              ['Diya Menon','DM','navy','ILH-STU-0051','Retail & Fashion · B1',55,'Due 05 May','warn','Active','3h ago'],
              ['Karthik Iyer','KI','lblue','ILH-STU-0029','Aviation · Batch A',82,'On track','success','Active','1h ago'],
              ['Priyanka Rao','PR','orange','ILH-STU-0022','Aviation · Batch B',44,'Overdue 18d','danger','Suspended','4 days ago'],
              ['Rohan Kumar','RK','navy','ILH-STU-0060','Retail & Fashion · B1',61,'Warning 1','warn','Active','Yesterday'],
              ['Sana Fernandes','SF','lblue','ILH-STU-0047','Aviation · Batch B',77,'On track','success','Active','2h ago'],
              ['Tanvi Joshi','TJ','orange','ILH-STU-0033','Retail & Fashion · B2',90,'Paid in full','success','Active','8h ago'],
              ['Vikram Shetty','VS','navy','ILH-STU-0054','Aviation · Batch B',38,'Upcoming 05 May','ghost','Active','5 days ago'],
              ['Zara Khan','ZK','lblue','ILH-STU-0039','Aviation · Batch A',73,'On track','success','Active','3h ago'],
            ].map((r,i)=>(
              <tr key={i}>
                <td style={{paddingLeft:20}}><input type="checkbox"/></td>
                <td>
                  <div style={{display:'flex', alignItems:'center', gap:10}}>
                    <Avatar name={r[1]} color={r[2]} size={34}/>
                    <div>
                      <div style={{fontWeight:600, color:'#11255C'}}>{r[0]}</div>
                      <div style={{fontSize:11, color:'#9098AE'}}>{r[0].toLowerCase().replace(' ','.')}@indialearns.com</div>
                    </div>
                  </div>
                </td>
                <td className="mono" style={{fontSize:12, color:'#6B7490'}}>{r[3]}</td>
                <td style={{fontSize:12}}>{r[4]}</td>
                <td style={{minWidth:140}}>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <div className="progress" style={{flex:1}}><div style={{width:r[5]+'%'}}/></div>
                    <span className="mono" style={{fontSize:12, color:'#11255C', fontWeight:700}}>{r[5]}%</span>
                  </div>
                </td>
                <td><Pill variant={r[7]} dot>{r[6]}</Pill></td>
                <td>{r[8]==='Suspended' ? <Pill variant="danger" dot>Suspended</Pill> : <Pill variant="success" dot>Active</Pill>}</td>
                <td className="mono" style={{color:'#6B7490', fontSize:12}}>{r[9]}</td>
                <td><Icon name="chevR" size={14} color="#9098AE"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const AdminTickets = ({ setScreen }) => {
  const cols = [
    {k:'Open', n:3, tk:[
      {id:'#2068',t:'Wi-Fi dropping in Room 204',c:'Technical',cc:'navy',a:'IT Desk',p:'Normal',pv:'navy'},
      {id:'#2065',t:'Request to change batch allocation',c:'Admin',cc:'lblue',a:'Ops Team',p:'Normal',pv:'navy'},
      {id:'#2063',t:'Certificate typo on trial preview',c:'Admin',cc:'lblue',a:'Ops Team',p:'High',pv:'warn'},
    ]},
    {k:'Assigned', n:4, tk:[
      {id:'#2054',t:'Rubric clarification — Module 4',c:'Academic',cc:'navy',a:'Dr. Meera K.',p:'Normal',pv:'navy'},
      {id:'#2051',t:'Missing receipt · February',c:'Finance',cc:'orange',a:'Priya N.',p:'Normal',pv:'navy'},
      {id:'#2049',t:'Practicum reschedule request',c:'Academic',cc:'navy',a:'Capt. R. Verma',p:'Normal',pv:'navy'},
      {id:'#2046',t:'Name correction on record',c:'Admin',cc:'lblue',a:'Ops Team',p:'Low',pv:'ghost'},
    ]},
    {k:'In Progress', n:4, tk:[
      {id:'#2048',t:'Formal complaint: assessment grading',c:'Complaints',cc:'danger',a:'Senior Mgmt',p:'Urgent',pv:'danger'},
      {id:'#2044',t:'Login 2FA lockout',c:'Technical',cc:'navy',a:'IT Desk',p:'High · 3h to SLA',pv:'warn'},
      {id:'#2039',t:'Confusion on Module 2 quiz score',c:'Academic',cc:'navy',a:'Capt. R. Verma',p:'High · 4h to SLA',pv:'warn'},
      {id:'#2037',t:'Refund clarification · trip fee',c:'Finance',cc:'orange',a:'Priya N.',p:'Normal',pv:'navy'},
    ]},
    {k:'Resolved', n:3, tk:[
      {id:'#2041',t:'Library access error',c:'Technical',cc:'navy',a:'IT Desk',p:'Normal',pv:'success'},
      {id:'#2031',t:'Timetable app sync issue',c:'Technical',cc:'navy',a:'IT Desk',p:'Normal',pv:'success'},
      {id:'#2028',t:'Fee statement request',c:'Finance',cc:'orange',a:'Priya N.',p:'Normal',pv:'success'},
    ]},
    {k:'Closed', n:2, tk:[
      {id:'#2030',t:'Change of address',c:'Admin',cc:'lblue',a:'Ops Team',p:'Low',pv:'ghost'},
      {id:'#1998',t:'Practicum reschedule',c:'Academic',cc:'navy',a:'Dr. Meera K.',p:'Normal',pv:'ghost'},
    ]},
  ];

  return (
    <div className="app">
      <SideNav role="admin" active="admin-tickets" setScreen={setScreen}/>
      <div className="main">
        <TopBar/>
        <div className="page-head">
          <div>
            <h1 className="page-title">Tickets Board</h1>
            <p className="page-sub">Drag to move through states. SLA timers run in background; managers notified 2h before breach.</p>
          </div>
          <div style={{display:'flex', gap:10}}>
            <button className="btn btn-ghost"><Icon name="filter" size={14}/> All categories</button>
            <button className="btn btn-navy"><Icon name="plus" size={14}/> Raise on behalf</button>
          </div>
        </div>

        <div className="kanban">
          {cols.map(col=>(
            <div key={col.k} className="col">
              <h4><span>{col.k}</span><span className="mono" style={{color:'#6B7490'}}>{col.n}</span></h4>
              {col.tk.map(t=>(
                <div key={t.id} className="tkt">
                  <div style={{display:'flex', justifyContent:'space-between'}}>
                    <span className="tkt-id">{t.id}</span>
                    <span className="dotmark" style={{background: t.cc==='orange'?'#F58220':t.cc==='lblue'?'#6E9BCC':t.cc==='danger'?'#C23B3B':'#1A3A8F', width:8, height:8}}/>
                  </div>
                  <div className="tkt-ttl">{t.t}</div>
                  <div className="tkt-meta">
                    <span>{t.a}</span>
                    <Pill variant={t.pv} dot={t.pv!=='ghost'}>{t.p}</Pill>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="grid-3" style={{marginTop:22}}>
          <div className="card tight">
            <div className="card-title">Breakdown by category</div>
            {[['Academic',6,'#1A3A8F'],['Finance',3,'#F58220'],['Technical',4,'#24489E'],['Admin',3,'#6E9BCC'],['Complaints',1,'#C23B3B']].map(([k,n,c])=>(
              <div key={k} style={{display:'flex', alignItems:'center', gap:10, padding:'6px 0'}}>
                <span style={{width:8, height:8, borderRadius:'50%', background:c}}/>
                <span style={{flex:1, fontSize:13, color:'#11255C'}}>{k}</span>
                <span className="mono" style={{color:'#6B7490', fontWeight:600}}>{n}</span>
              </div>
            ))}
          </div>
          <div className="card tight">
            <div className="card-title">SLA Targets</div>
            <div style={{fontSize:13, color:'#3B4566', lineHeight:1.8}}>
              <div style={{display:'flex', justifyContent:'space-between'}}><span>Acknowledgement</span><span className="mono" style={{color:'#11255C', fontWeight:700}}>24h</span></div>
              <div style={{display:'flex', justifyContent:'space-between'}}><span>Resolution · standard</span><span className="mono" style={{color:'#11255C', fontWeight:700}}>5 days</span></div>
              <div style={{display:'flex', justifyContent:'space-between'}}><span>Formal complaint</span><span className="mono" style={{color:'#11255C', fontWeight:700}}>15 days</span></div>
              <div style={{display:'flex', justifyContent:'space-between'}}><span>Reopen window</span><span className="mono" style={{color:'#11255C', fontWeight:700}}>7 days</span></div>
            </div>
          </div>
          <div className="card tight" style={{background:'#FEE8D2', border:'1px solid #F9D0A1'}}>
            <div className="card-title" style={{color:'#D96B0B'}}>Escalation rule</div>
            <div style={{fontSize:13, color:'#11255C', lineHeight:1.55}}>
              A <b>Complaint</b> ticket can only be opened if the student has a <b>resolved or closed</b> ticket. Keeps escalation deliberate and traceable.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FacultyDashboard = ({ setScreen }) => (
  <div className="app">
    <SideNav role="faculty" active="faculty" setScreen={setScreen}/>
    <div className="main">
      <TopBar placeholder="Search students, assignments..."/>
      <div className="page-head">
        <div>
          <h1 className="page-title">Teaching today, Dr. Meera.</h1>
          <p className="page-sub">2 classes · 8 submissions awaiting grading · 3 rubric reviews due.</p>
        </div>
        <div style={{display:'flex', gap:10}}>
          <button className="btn btn-ghost"><Icon name="cal" size={14}/> My Schedule</button>
          <button className="btn btn-primary"><Icon name="feedback" size={14}/> Give Feedback</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="label">Students</div><div className="val mono">58</div><div style={{fontSize:12, color:'#6B7490'}}>across 2 batches</div></div>
        <div className="stat orange-accent"><div className="label">To Grade</div><div className="val mono">8</div><div style={{fontSize:12, marginTop:6}}>Mod 3 assessments</div></div>
        <div className="stat"><div className="label">Batch Average</div><div className="val mono">78</div><div className="delta">+3 vs last cohort</div></div>
        <div className="stat accent"><div className="label">Feedback Given · Mo</div><div className="val mono">34</div><div style={{fontSize:12, color:'#6E9BCC'}}>2.1 per student</div></div>
      </div>

      <div className="grid-2">
        <div>
          <div className="card" style={{marginBottom:18}}>
            <div className="sec-head"><h3>Grading Queue</h3><a>Open all →</a></div>
            <table className="tbl">
              <thead><tr><th>Student</th><th>Assignment</th><th>Submitted</th><th>Rubric</th><th></th></tr></thead>
              <tbody>
                {[
                  ['Rohan Kumar','RK','navy','Module 3 · Customer Handling','2h ago',true],
                  ['Sana Fernandes','SF','lblue','Module 3 · Customer Handling','4h ago',true],
                  ['Tanvi Joshi','TJ','orange','Module 3 · Customer Handling','Yesterday',true],
                  ['Arjun Patel','AP','orange','Assignment 04 · Ramp Case Study','Yesterday',false],
                  ['Vikram Shetty','VS','navy','Assignment 04 · Ramp Case Study','2 days ago',false],
                ].map((r,i)=>(
                  <tr key={i}>
                    <td><div style={{display:'flex', alignItems:'center', gap:10}}><Avatar name={r[1]} color={r[2]} size={30}/><span style={{fontWeight:600, color:'#11255C'}}>{r[0]}</span></div></td>
                    <td style={{fontSize:12}}>{r[3]}</td>
                    <td className="mono" style={{fontSize:12, color:'#6B7490'}}>{r[4]}</td>
                    <td>{r[5] ? <Pill variant="orange" dot>Rubric</Pill> : <Pill variant="ghost">Free text</Pill>}</td>
                    <td><button className="btn btn-ghost btn-sm">Grade →</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="sec-head"><h3>Feedback Composer</h3><Pill variant="navy">Module 3 · Customer Handling</Pill></div>
            <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:14}}>
              <Avatar name="RK" color="navy" size={40}/>
              <div>
                <div style={{fontWeight:600, color:'#11255C'}}>Rohan Kumar · ILH-STU-0060</div>
                <div style={{fontSize:11, color:'#6B7490'}}>Retail & Fashion · Batch B1</div>
              </div>
            </div>

            <div className="rubric" style={{borderTop:0, paddingTop:0, marginTop:0, gridTemplateColumns:'1fr 80px 120px'}}>
              <div className="rh">CRITERIA</div><div className="rh" style={{textAlign:'center'}}>WEIGHT</div><div className="rh" style={{textAlign:'right'}}>SCORE</div>
              {[['Listening & empathy',30,24],['Problem resolution',40,32],['Closing & escalation',30,22]].map((c,i)=>(
                <React.Fragment key={i}>
                  <div style={{alignSelf:'center', color:'#11255C', fontSize:13}}>{c[0]}</div>
                  <div className="mono" style={{textAlign:'center', alignSelf:'center'}}>{c[1]}%</div>
                  <div>
                    <input type="range" min={0} max={c[1]} defaultValue={c[2]} style={{width:'100%', accentColor:'#F58220'}}/>
                    <div className="mono" style={{fontSize:12, textAlign:'right', color:'#11255C', fontWeight:700}}>{c[2]} / {c[1]}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>

            <div className="field" style={{marginTop:14}}>
              <label>Written comments</label>
              <textarea rows={3} defaultValue="Solid foundation, Rohan. The empathy moments were authentic. Work on transitioning from listening to resolution — your pauses were slightly too long. Specific technique to try: 'mirror-then-ask'."/>
            </div>
            <div style={{display:'flex', gap:8, flexWrap:'wrap', fontSize:11, marginBottom:12}}>
              {['Clear structure','Needs more evidence','Good progression','Review technique','Exemplary'].map(t=><span key={t} style={{padding:'4px 10px', background:'#FBF5E8', border:'1px solid #E6DFCF', borderRadius:999, color:'#3B4566', cursor:'pointer'}}>+ {t}</span>)}
            </div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <Pill variant="ghost">Notify student via in-app + email</Pill>
              <div style={{display:'flex', gap:8}}>
                <button className="btn btn-ghost btn-sm">Save draft</button>
                <button className="btn btn-primary btn-sm"><Icon name="send" size={12}/> Publish feedback</button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{marginBottom:18}}>
            <div className="card-title">Today's classes</div>
            {[
              ['09:00','Airport Ground Handling','Room 204 · 30 students','orange'],
              ['14:00','Customer Service','Room 201 · 28 students','lblue'],
            ].map((c,i)=>(
              <div key={i} style={{display:'flex', gap:12, padding:'12px 0', borderBottom:i===0?'1px solid #E6DFCF':0}}>
                <div className="mono" style={{fontSize:14, fontWeight:700, color:'#11255C', minWidth:48}}>{c[0]}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600, color:'#11255C'}}>{c[1]}</div>
                  <div style={{fontSize:11, color:'#6B7490'}}>{c[2]}</div>
                </div>
                <Pill variant={c[3]}>{i===0?'Next':'Later'}</Pill>
              </div>
            ))}
          </div>

          <div className="card" style={{marginBottom:18}}>
            <div className="card-title">Batch A · Performance</div>
            <div className="bars" style={{height:120}}>
              {[['M1',78],['M2',82],['M3',79],['M4',null]].map(([l,v],i)=>(
                <div key={l} className="bar-col">
                  <div className="b orange" style={{height:(v?v:10)+'%', opacity:v?1:0.25}}/>
                  <div className="lbl">{l}</div>
                </div>
              ))}
            </div>
            <div style={{fontSize:12, color:'#6B7490', marginTop:8}}>Module 4 assessments begin Fri 24 Apr.</div>
          </div>

          <div className="card cream">
            <div className="card-title">Feedback templates</div>
            <div style={{fontSize:13}}>
              {['Exemplary submission','Needs technical review','Strong structure, weak evidence','Re-attempt recommended'].map(t=>(
                <div key={t} style={{display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #E6DFCF', cursor:'pointer'}}>
                  <span style={{color:'#11255C'}}>{t}</span>
                  <Icon name="chevR" size={14} color="#9098AE"/>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const FinanceDashboard = ({ setScreen }) => (
  <div className="app">
    <SideNav role="finance" active="finance" setScreen={setScreen}/>
    <div className="main">
      <TopBar placeholder="Search students, invoices, receipts..."/>
      <div className="page-head">
        <div>
          <h1 className="page-title">Finance — April 2026</h1>
          <p className="page-sub">Manual collection phase. 18 receipts issued this week. 3 students approaching suspension.</p>
        </div>
        <div style={{display:'flex', gap:10}}>
          <button className="btn btn-ghost"><Icon name="download" size={14}/> Reconciliation report</button>
          <button className="btn btn-primary"><Icon name="plus" size={14}/> Record Payment</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat accent"><div className="label">Collected · April</div><div className="val mono">₹18.4L</div><div className="delta">92% of ₹20L target</div></div>
        <div className="stat orange-accent"><div className="label">Outstanding</div><div className="val mono">₹4.8L</div><div style={{fontSize:12, marginTop:6}}>across 38 students</div></div>
        <div className="stat"><div className="label">Overdue &gt; 14 days</div><div className="val mono">3</div><div style={{fontSize:12, color:'#C23B3B', fontWeight:600}}>Warning 1 sent</div></div>
        <div className="stat"><div className="label">Upcoming · next 7d</div><div className="val mono">22</div><div style={{fontSize:12, color:'#6B7490'}}>Reminders scheduled</div></div>
      </div>

      <div className="grid-2" style={{marginBottom:18}}>
        <div className="card">
          <div className="sec-head"><h3>Collection vs Target</h3><span className="mono" style={{fontSize:12, color:'#6B7490'}}>Monthly</span></div>
          <div className="bars" style={{height:180}}>
            {[['Nov',6,8],['Dec',11,12],['Jan',14,15],['Feb',16,17],['Mar',18,18],['Apr',18.4,20]].map(([m,c,t],i)=>(
              <div key={m} className="bar-col">
                <div style={{display:'flex', gap:3, alignItems:'flex-end', width:'100%', height:'100%'}}>
                  <div className="b orange" style={{height:(c/22)*100+'%'}}/>
                  <div className="b" style={{height:(t/22)*100+'%', opacity:0.4}}/>
                </div>
                <div className="lbl">{m}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex', gap:14, marginTop:10, fontSize:11, color:'#6B7490'}}>
            <span style={{display:'flex', alignItems:'center', gap:6}}><span style={{width:10, height:10, background:'#F58220', borderRadius:2}}/> Collected</span>
            <span style={{display:'flex', alignItems:'center', gap:6}}><span style={{width:10, height:10, background:'#1A3A8F', opacity:0.4, borderRadius:2}}/> Target</span>
          </div>
        </div>

        <div className="card">
          <div className="sec-head"><h3>Record a Payment</h3><Pill variant="orange" dot>Manual entry</Pill></div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
            <div className="field"><label>Student</label><input defaultValue="Ananya Sharma · ILH-STU-0042"/></div>
            <div className="field"><label>Fee component</label><select defaultValue="tut3"><option value="tut3">Tuition · Installment 3</option></select></div>
            <div className="field"><label>Amount (INR)</label><input defaultValue="8,500" className="mono"/></div>
            <div className="field"><label>Method</label><select><option>Bank transfer</option><option>Cheque</option><option>Cash</option><option>UPI</option></select></div>
            <div className="field"><label>Reference / UTR</label><input className="mono" defaultValue="HDFC8273627" /></div>
            <div className="field"><label>Payment date</label><input defaultValue="22 April 2026"/></div>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6}}>
            <Pill variant="ghost"><Icon name="shield" size={10}/> Audit log will record this action</Pill>
            <button className="btn btn-primary"><Icon name="check" size={14}/> Record &amp; issue receipt</button>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="sec-head"><h3>Suspension Watchlist</h3><Pill variant="danger" dot>3 at risk</Pill></div>
          <table className="tbl">
            <thead><tr><th>Student</th><th>Overdue</th><th>Amount</th><th>Stage</th><th></th></tr></thead>
            <tbody>
              {[
                ['Priyanka Rao','PR','orange','ILH-STU-0022','18d','₹8,500','Suspended','danger','Override'],
                ['Rohan Kumar','RK','navy','ILH-STU-0060','16d','₹8,500','Warning 1 → 2 in 5d','warn','Send W2'],
                ['Kunal Desai','KD','lblue','ILH-STU-0081','15d','₹8,500','Warning 1 sent','warn','View'],
                ['Nisha Shah','NS','orange','ILH-STU-0066','8d','₹8,500','Approaching W1','ghost','Remind'],
              ].map((r,i)=>(
                <tr key={i}>
                  <td><div style={{display:'flex', alignItems:'center', gap:10}}><Avatar name={r[1]} color={r[2]} size={30}/><div><div style={{fontWeight:600, color:'#11255C'}}>{r[0]}</div><div className="mono" style={{fontSize:11, color:'#9098AE'}}>{r[3]}</div></div></div></td>
                  <td className="mono" style={{color:'#C23B3B', fontWeight:600}}>{r[4]}</td>
                  <td className="mono">{r[5]}</td>
                  <td><Pill variant={r[7]} dot={r[7]!=='ghost'}>{r[6]}</Pill></td>
                  <td><button className="btn btn-ghost btn-sm">{r[8]}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div className="card" style={{marginBottom:18}}>
            <div className="card-title">Recent Receipts</div>
            {[
              ['ILH-R-0148','Ananya Sharma','Miscellaneous','₹2,500'],
              ['ILH-R-0147','Karthik Iyer','Tuition · Inst 3','₹8,500'],
              ['ILH-R-0146','Tanvi Joshi','Certification','₹3,000'],
              ['ILH-R-0145','Sana Fernandes','Tuition · Inst 3','₹8,500'],
            ].map((r,i)=>(
              <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom: i<3?'1px solid #E6DFCF':0}}>
                <div>
                  <div className="mono" style={{fontSize:12, color:'#1A3A8F', fontWeight:700}}>{r[0]}</div>
                  <div style={{fontSize:12, color:'#11255C'}}>{r[1]}</div>
                  <div style={{fontSize:11, color:'#9098AE'}}>{r[2]}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div className="mono" style={{fontWeight:700, color:'#11255C'}}>{r[3]}</div>
                  <a style={{fontSize:11, color:'#1A3A8F', cursor:'pointer'}}>Download PDF</a>
                </div>
              </div>
            ))}
          </div>

          <div className="card cream">
            <div className="card-title">Reminder queue · next 7 days</div>
            {[
              ['22 Apr · Today','14d-before reminder','6 students'],
              ['25 Apr','7d-before reminder','12 students'],
              ['28 Apr','On-due reminder','4 students'],
              ['29 Apr','3d-overdue nudge','2 students'],
            ].map((r,i)=>(
              <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:i<3?'1px solid #E6DFCF':0, fontSize:13}}>
                <div>
                  <div style={{fontWeight:600, color:'#11255C'}}>{r[1]}</div>
                  <div className="mono" style={{fontSize:11, color:'#9098AE'}}>{r[0]}</div>
                </div>
                <Pill variant="ghost">{r[2]}</Pill>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, { AdminDashboard, AdminStudents, AdminTickets, FacultyDashboard, FinanceDashboard });
