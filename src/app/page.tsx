import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  BookOpen, Code, Mic, BarChart3, GraduationCap, Trophy,
  Brain, Sparkles, Users, ClipboardCheck, Briefcase,
  ArrowRight, CheckCircle2, Star, Zap, Shield, Video,
} from 'lucide-react';

const features = [
  {
    icon: ClipboardCheck,
    title: 'Self-Assessment',
    description: 'Complete a one-time academic and skill profile so teachers can understand you better and personalise support.',
    gradient: 'from-sky-500 to-blue-600',
    tag: null,
  },
  {
    icon: Sparkles,
    title: 'AI Placement Tests',
    description: 'Teachers schedule AI-generated exams from your course syllabus. Timed, proctored, with instant score breakdowns.',
    gradient: 'from-violet-500 to-purple-600',
    tag: 'AI',
  },
  {
    icon: Brain,
    title: 'Aptitude Arena',
    description: 'Placement-level aptitude practice — Quantitative, Logical, Verbal, and Data Interpretation with step-by-step solutions.',
    gradient: 'from-orange-500 to-rose-500',
    tag: 'AI',
  },
  {
    icon: Trophy,
    title: 'Exam Arena',
    description: 'Practice exams on any subject in your curriculum. AI generates fresh questions every time from your syllabus.',
    gradient: 'from-amber-500 to-orange-500',
    tag: 'AI',
  },
  {
    icon: Code,
    title: 'Coding Lab',
    description: 'Solve real-world programming challenges and grow your problem-solving skills with guided feedback.',
    gradient: 'from-emerald-500 to-teal-600',
    tag: null,
  },
  {
    icon: Mic,
    title: 'Speech Practice',
    description: 'Record yourself speaking and receive instant AI feedback on grammar, clarity, and fluency.',
    gradient: 'from-indigo-500 to-indigo-600',
    tag: 'AI',
  },
  {
    icon: Video,
    title: 'Mentor Sessions',
    description: 'Book one-on-one video sessions with your teachers for personalised guidance and doubt-clearing.',
    gradient: 'from-pink-500 to-rose-500',
    tag: null,
  },
  {
    icon: Briefcase,
    title: 'Placement Updates',
    description: 'Stay up-to-date on placement drives, deadlines, and opportunities posted by your placement team.',
    gradient: 'from-slate-600 to-slate-800',
    tag: null,
  },
  {
    icon: BarChart3,
    title: 'Teacher Dashboard',
    description: "Educators get a full view of student performance, self-assessment data, and targeted insights to guide every student.",
    gradient: 'from-purple-500 to-purple-700',
    tag: null,
  },
];

const steps = [
  {
    step: '01',
    title: 'Complete your profile',
    desc: 'Fill in a one-time self-assessment form so teachers know your skill level, goals, and learning needs.',
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
  },
  {
    step: '02',
    title: 'Practice every day',
    desc: 'Use the Exam Arena, Aptitude Arena, Coding Lab, and Speech Coach to build skills at your own pace.',
    color: 'text-violet-600',
    bg: 'bg-violet-50 border-violet-200',
  },
  {
    step: '03',
    title: 'Attend scheduled tests',
    desc: 'Teachers publish AI-generated placement tests. Attempt them on time and review your detailed results.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
  },
  {
    step: '04',
    title: 'Get placed',
    desc: 'Track placement drives, attend mentor sessions, and walk into interviews confident and prepared.',
    color: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-200',
  },
];

const stats = [
  { value: '9+', label: 'Learning Modules' },
  { value: 'AI', label: 'Powered by Gemini' },
  { value: '4', label: 'User Roles' },
  { value: '100%', label: 'Syllabus-aligned' },
];

const roles = [
  {
    icon: GraduationCap,
    role: 'Students',
    color: 'from-blue-500 to-indigo-600',
    perks: ['Self-paced practice modules', 'Scheduled AI placement tests', 'Mentor booking', 'Placement updates'],
  },
  {
    icon: Users,
    role: 'Teachers',
    color: 'from-violet-500 to-purple-600',
    perks: ['Schedule AI-generated exams', 'View student self-assessments', 'Host mentor sessions', 'Conduct coding tests'],
  },
  {
    icon: Shield,
    role: 'Admins',
    color: 'from-slate-600 to-slate-800',
    perks: ['Manage students & staff', 'Role-based access control', 'Audit logs', 'Bulk student import'],
  },
  {
    icon: BarChart3,
    role: 'Dean / Management',
    color: 'from-emerald-500 to-teal-600',
    perks: ['Strategic analytics dashboard', 'AI test result reports', 'Placement tracking', 'Institution-wide insights'],
  },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-white">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/90 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center">
          <Link className="flex items-center gap-2.5 group" href="/">
            <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-200 group-hover:shadow-lg transition-all">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-xl font-headline font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
              SRM PrepTrack
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-6">
            <Link className="hidden sm:block text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors" href="#features">Features</Link>
            <Link className="hidden sm:block text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors" href="#how-it-works">How it works</Link>
            <Link className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors" href="/auth">Login</Link>
            <Button asChild size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md rounded-xl">
              <Link href="/auth">Get Started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 py-20 md:py-32 lg:py-40">
          {/* decorative blobs */}
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] rounded-full bg-violet-500/10 blur-3xl" />

          <div className="relative max-w-5xl mx-auto px-4 md:px-6 text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-300 rounded-full text-sm font-medium border border-blue-500/30">
              <Zap className="h-3.5 w-3.5" />
              AI-Powered Placement Preparation Platform
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-headline font-bold text-white leading-tight">
              Your all-in-one
              <span className="block bg-gradient-to-r from-blue-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
                placement toolkit
              </span>
            </h1>

            <p className="max-w-xl mx-auto text-xl md:text-2xl font-semibold text-indigo-300 tracking-wide">
              Track your Prep. Crack your Placement.
            </p>
            <p className="max-w-2xl mx-auto text-base md:text-lg text-slate-400 leading-relaxed mt-2">
              SRM PrepTrack combines AI-powered exams, aptitude practice, coding challenges,
              and teacher analytics — built for SRM Institute students and faculty.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="h-13 px-8 text-base bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-xl shadow-blue-900/50 rounded-xl font-semibold">
                <Link href="/auth" className="flex items-center gap-2">
                  Get Started Free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-13 px-8 text-base border-white/20 text-white hover:bg-white/10 rounded-xl font-semibold bg-transparent">
                <Link href="#features">Explore Features</Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-8 max-w-2xl mx-auto">
              {stats.map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-3xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">{s.value}</p>
                  <p className="text-xs text-slate-400 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="py-20 md:py-28 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="text-center mb-14">
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">What's inside</p>
              <h2 className="text-3xl md:text-4xl font-headline font-bold text-slate-900 mb-4">
                Everything you need to get placed
              </h2>
              <p className="text-slate-500 text-lg max-w-2xl mx-auto">
                Nine integrated modules designed around the complete student-to-professional journey.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(f => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="group relative bg-white rounded-2xl border border-slate-200 p-7 hover:border-blue-200 hover:shadow-xl transition-all duration-300">
                    {f.tag && (
                      <span className="absolute top-5 right-5 text-[10px] font-bold bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full border border-violet-200">
                        {f.tag}
                      </span>
                    )}
                    <div className={`inline-flex p-3.5 rounded-2xl bg-gradient-to-r ${f.gradient} text-white mb-5 shadow-md group-hover:scale-105 transition-transform duration-300`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-headline font-bold text-slate-900 mb-2">{f.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{f.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" className="py-20 md:py-28 bg-white">
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <div className="text-center mb-14">
              <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-3">The journey</p>
              <h2 className="text-3xl md:text-4xl font-headline font-bold text-slate-900 mb-4">
                From enrolment to placement
              </h2>
              <p className="text-slate-500 text-lg max-w-xl mx-auto">
                Four simple steps that take you from day one to your dream job.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {steps.map(s => (
                <div key={s.step} className={`rounded-2xl border p-7 ${s.bg} transition-all duration-300 hover:shadow-md`}>
                  <span className={`text-4xl font-black ${s.color} opacity-30 leading-none`}>{s.step}</span>
                  <h3 className="text-lg font-headline font-bold text-slate-900 mt-3 mb-2">{s.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Who it's for ── */}
        <section className="py-20 md:py-28 bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="text-center mb-14">
              <p className="text-sm font-semibold text-emerald-600 uppercase tracking-widest mb-3">Built for everyone</p>
              <h2 className="text-3xl md:text-4xl font-headline font-bold text-slate-900 mb-4">
                One platform, four roles
              </h2>
              <p className="text-slate-500 text-lg max-w-xl mx-auto">
                From students to the Dean — every stakeholder has a dedicated experience.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {roles.map(r => {
                const Icon = r.icon;
                return (
                  <div key={r.role} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl hover:border-blue-100 transition-all duration-300">
                    <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${r.color} text-white mb-4 shadow-md`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-headline font-bold text-slate-900 mb-4">{r.role}</h3>
                    <ul className="space-y-2">
                      {r.perks.map(p => (
                        <li key={p} className="flex items-start gap-2 text-sm text-slate-600">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-20 md:py-28 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent" />
          <div className="relative max-w-2xl mx-auto px-4 md:px-6 text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-headline font-bold text-white">
              Ready to ace your placements?
            </h2>
            <p className="text-slate-300 text-lg leading-relaxed">
              Join SRM PrepTrack today. Practice smarter, get feedback faster, and walk into every interview prepared.
            </p>
            <Button asChild size="lg" className="h-14 px-10 text-base bg-white text-indigo-700 hover:bg-blue-50 shadow-2xl rounded-xl font-bold transition-all duration-300">
              <Link href="/auth" className="flex items-center gap-2">
                Create your account <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <p className="text-slate-500 text-sm">No payment required · SRM students only</p>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-slate-950 text-slate-400 py-10 px-4 md:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div>
              <span className="font-headline font-bold text-white text-sm block">SRM PrepTrack</span>
              <span className="text-[10px] text-slate-500">Track your Prep. Crack your Placement.</span>
            </div>
          </div>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} SRM Institute of Science and Technology. All rights reserved.</p>
          <nav className="flex gap-6">
            <Link className="text-xs hover:text-white transition-colors" href="#">Terms</Link>
            <Link className="text-xs hover:text-white transition-colors" href="#">Privacy</Link>
            <Link className="text-xs hover:text-white transition-colors" href="/auth">Login</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
