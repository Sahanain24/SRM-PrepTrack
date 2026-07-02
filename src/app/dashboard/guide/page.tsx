'use client';

export default function StudentGuidePage() {
  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          nav, aside, [class*="sidebar"], [class*="Sidebar"] { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; max-width: 100% !important; }
          body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @page { size: A4; margin: 12mm 14mm; }
      `}</style>

      <div className="no-print fixed top-4 right-4 z-50">
        <button
          onClick={() => window.print()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-lg"
        >
          🖨 Print / Save as PDF
        </button>
      </div>

      <div className="max-w-[740px] mx-auto px-8 py-8 font-sans text-slate-800 text-[13px] leading-snug">

        {/* Header */}
        <div className="flex items-center justify-between mb-5 pb-4 border-b-2 border-indigo-600">
          <div>
            <h1 className="text-2xl font-black text-indigo-700">SRM PrepTrack</h1>
            <p className="text-sm text-slate-500 font-medium">Student Quick-Start Guide</p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>SRM Institute of Science and Technology</p>
            <p>For new students — keep this handy</p>
          </div>
        </div>

        {/* 2-column grid */}
        <div className="grid grid-cols-2 gap-4">

          {/* Step 1 */}
          <Box num="1" title="Register Your Account (New User)" color="indigo">
            <Step n="1" text="Open the PrepTrack URL in your browser." />
            <Step n="2" text='Click "Student Login", then switch to the "Register" tab.' />
            <Step n="3" text={<>Enter your <strong>Full Name</strong>, <strong>Roll Number</strong> (15 chars, e.g. RA2211003010001), <strong>Program</strong>, and <strong>Email</strong> (@srmist.edu.in).</>} />
            <Step n="4" text='Click "Create Account". Your default password is set to your Roll Number.' />
            <Step n="5" text="You are taken to the login page. Log in with your Roll Number and password." />
            <Step n="6" text="On first login, set a new personal password when prompted." />
            <Tip>Already registered? Skip to Step 2 — just log in directly.</Tip>
          </Box>

          {/* Step 2 */}
          <Box num="2" title="Complete Self-Assessment" color="violet">
            <Step n="1" text="After first login you are redirected to the Self-Assessment form automatically." />
            <Step n="2" text="Section A — Fill in your CGPA, program, year, and career goal." />
            <Step n="3" text="Section B — Rate yourself on 9 skills (1–5 scale). Be honest." />
            <Step n="4" text="Section C — Select the training areas you want to improve." />
            <Step n="5" text="Click Submit. This can only be done once." />
            <Tip>This is not graded — it helps your teacher plan your development.</Tip>
          </Box>

          {/* Step 3 */}
          <Box num="3" title="Attempt an AI Placement Test" color="rose">
            <Step n="1" text='Click "Exam Arena" in the left sidebar.' />
            <Step n="2" text="Find your test and click Start Exam." />
            <Step n="3" text="Read instructions, then click Begin." />
            <Step n="4" text="Answer each MCQ — use the question palette on the right to track answered / skipped questions." />
            <Step n="5" text="Click Submit Exam → Confirm before time runs out." />
            <Step n="6" text="Your score and explanations appear immediately." />
            <Warn>Do NOT switch browser tabs — this is monitored and reported to your teacher. Copy/paste and right-click are blocked.</Warn>
          </Box>

          {/* Step 4 */}
          <Box num="4" title="Attempt a Coding Test" color="emerald">
            <Step n="1" text='Click "Coding Test" in the sidebar.' />
            <Step n="2" text="Select your test and click Attempt." />
            <Step n="3" text="Read the problem statement, input/output format, and examples carefully." />
            <Step n="4" text="Choose your language (Python / Java / C / C++)." />
            <Step n="5" text="Write your solution in the code editor. Read from stdin, print to stdout." />
            <Step n="6" text='Click Run to test with visible examples, then Submit when ready.' />
            <Step n="7" text="After all problems, click Submit Test to finalise." />
            <Tip>Handle edge cases — hidden test cases are used for final scoring.</Tip>
          </Box>

        </div>

        {/* Rules strip */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <RuleBox title="⚠️ During Any Test" color="red" items={[
            'Stay on the exam tab at all times',
            'No copy-paste from outside',
            'Submit before the timer ends',
            'Use a stable internet connection',
          ]} />
          <RuleBox title="📊 Track Your Progress" color="blue" items={[
            'Dashboard — overview of all scores',
            'AI Test Results — first vs latest attempt',
            'Study History — all past attempts',
            'Aptitude Arena — topic-wise practice',
          ]} />
          <RuleBox title="🆘 Need Help?" color="slate" items={[
            'Wrong password → teacher / admin',
            'Test not visible → check with teacher',
            'Wrong details → contact admin',
            'Technical error → system admin',
          ]} />
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-slate-200 flex justify-between text-[10px] text-slate-400">
          <span>SRM PrepTrack · Student Quick-Start Guide · Internal Use Only</span>
          <span>Printed on {new Date().toLocaleDateString('en-GB')}</span>
        </div>

      </div>
    </>
  );
}

function Box({ num, title, color, children }: { num: string; title: string; color: string; children: React.ReactNode }) {
  const header: Record<string, string> = {
    indigo: 'bg-indigo-600',
    violet: 'bg-violet-600',
    rose:   'bg-rose-600',
    emerald:'bg-emerald-600',
  };
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className={`${header[color]} text-white px-4 py-2 flex items-center gap-2`}>
        <span className="w-5 h-5 rounded-full bg-white/25 text-white text-xs font-black flex items-center justify-center flex-shrink-0">{num}</span>
        <span className="font-bold text-sm">{title}</span>
      </div>
      <div className="px-4 py-3 space-y-1.5 bg-white">{children}</div>
    </div>
  );
}

function Step({ n, text }: { n: string; text: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-start">
      <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{n}</span>
      <p className="text-[12px] text-slate-700 leading-snug">{text}</p>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1.5 flex gap-1.5 bg-blue-50 rounded-lg px-2.5 py-1.5 text-[11px] text-blue-700">
      <span>💡</span><span>{children}</span>
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1.5 flex gap-1.5 bg-red-50 rounded-lg px-2.5 py-1.5 text-[11px] text-red-700">
      <span>🚫</span><span>{children}</span>
    </div>
  );
}

function RuleBox({ title, color, items }: { title: string; color: string; items: string[] }) {
  const bg: Record<string, string> = {
    red:   'bg-red-50 border-red-200',
    blue:  'bg-blue-50 border-blue-200',
    slate: 'bg-slate-50 border-slate-200',
  };
  return (
    <div className={`border rounded-xl p-3 ${bg[color]}`}>
      <p className="font-bold text-[12px] text-slate-700 mb-1.5">{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-[11px] text-slate-600 flex gap-1.5">
            <span className="flex-shrink-0">·</span><span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
