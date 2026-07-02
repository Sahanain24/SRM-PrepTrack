'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen, Code, Mic, LayoutDashboard,
  LogOut, GraduationCap, CheckSquare, Users, History,
  Trophy, ClipboardList, Brain, AlertCircle, BarChart2,
  Download, UserCog, Sparkles, School, Video,
  ClipboardCheck, ChevronDown, Briefcase, Code2, ShieldCheck, Menu, X }
  from 'lucide-react';
import { cn } from '@/lib/utils';
import { User, setCurrentUser } from '@/lib/mock-db';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { useState } from 'react';

// ── Nav content shared between desktop sidebar and mobile drawer ──────────────
function NavContent({
  user,
  pathname,
  onNavigate,
  onLogout,
}: {
  user: User;
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  const selfAssessmentHrefs = [
    '/dashboard/study', '/dashboard/coding', '/dashboard/communication', '/dashboard/quiz', '/dashboard/aptitude',
  ];
  const [selfAssessmentOpen, setSelfAssessmentOpen] = useState(
    selfAssessmentHrefs.includes(pathname)
  );

  const selfAssessmentLinks = [
    { name: 'Study Hub',       icon: BookOpen,        href: '/dashboard/study' },
    { name: 'Coding Lab',      icon: Code,            href: '/dashboard/coding' },
    { name: 'Speech Practice', icon: Mic,             href: '/dashboard/communication' },
    { name: 'Smart Quizzes',   icon: CheckSquare,     href: '/dashboard/quiz' },
    { name: 'Aptitude Arena',  icon: Brain,           href: '/dashboard/aptitude' },
  ];

  const studentLinks = [
    { name: 'Overview',        icon: LayoutDashboard, href: '/dashboard' },
    { name: 'Classroom',       icon: School,          href: '/dashboard/classroom/student', isNew: true },
    { name: 'Mentor Support',  icon: Video,           href: '/dashboard/mentor/student',    isNew: true },
    { name: 'Exam Arena',      icon: Trophy,          href: '/dashboard/exam',     isNew: true },
    { name: 'Coding Tests',    icon: Code2,           href: '/dashboard/coding-test', isNew: true },
    { name: 'My Results',      icon: ClipboardList,   href: '/dashboard/results', isNew: true },
    { name: 'Study History',   icon: History,         href: '/dashboard/history' },
  ];

  const teacherLinks = [
    { name: 'Teacher Insights',       icon: Users,         href: '/dashboard/teacher' },
    { name: 'Student Management',     icon: UserCog,       href: '/dashboard/admin/students',        isNew: true },
    { name: 'Self Assessment Forms',  icon: ClipboardList, href: '/dashboard/teacher/assessments' },
    { name: 'Classroom',              icon: School,        href: '/dashboard/classroom/teacher',     isNew: true },
    { name: 'Mentor Sessions',        icon: Video,         href: '/dashboard/mentor/teacher',        isNew: true },
    { name: 'Schedule AI Test',       icon: Sparkles,      href: '/dashboard/teacher/schedule-exam',  isNew: true },
{ name: 'Schedule Coding Test',   icon: Code2,         href: '/dashboard/teacher/coding-test',   isNew: true },
    { name: 'Placement Updates',      icon: Briefcase,     href: '/dashboard/placements',            isNew: true },
  ];

  const managementLinks = [
    { name: 'Strategic Dashboard', icon: BarChart2,     href: '/dashboard/dean' },
    { name: 'Reports',             icon: Download,      href: '/dashboard/dean/reports' },
    { name: 'Placement Updates',   icon: Briefcase,     href: '/dashboard/dean/placements',      isNew: true },
    { name: 'AI Test Results',     icon: Sparkles,      href: '/dashboard/ai-test-results',      isNew: true },
    { name: 'Coding Test Results', icon: Code2,         href: '/dashboard/coding-test/results',  isNew: true },
    { name: 'Student Management',  icon: UserCog,       href: '/dashboard/admin/students' },
  ];

  const hodLinks = [
    { name: 'Strategic Dashboard', icon: BarChart2,     href: '/dashboard/dean' },
    { name: 'Reports',             icon: Download,      href: '/dashboard/dean/reports' },
    { name: 'Placement Updates',   icon: Briefcase,     href: '/dashboard/dean/placements',      isNew: true },
    { name: 'Report Placement',    icon: Briefcase,     href: '/dashboard/placements',           isNew: true },
    { name: 'AI Test Results',     icon: Sparkles,      href: '/dashboard/ai-test-results',      isNew: true },
    { name: 'Coding Test Results', icon: Code2,         href: '/dashboard/coding-test/results',  isNew: true },
    { name: 'Student Management',  icon: UserCog,       href: '/dashboard/admin/students' },
  ];

  const adminLinks = [
    { name: 'Admin Panel',         icon: ShieldCheck, href: '/dashboard/admin' },
    { name: 'Strategic Dashboard', icon: BarChart2,   href: '/dashboard/dean' },
    { name: 'Student Management',  icon: UserCog,     href: '/dashboard/admin/students' },
    { name: 'Staff & Roles',       icon: Users,       href: '/dashboard/admin/staff',      isNew: true },
    { name: 'Audit Logs',          icon: History,     href: '/dashboard/admin/audit-logs', isNew: true },
    { name: 'Reports',             icon: Download,    href: '/dashboard/dean/reports' },
  ];

  const links =
    user.role === 'admin'      ? adminLinks :
    user.role === 'teacher'    ? teacherLinks :
    user.role === 'hod'        ? hodLinks :
    ['dean','deputy_dean','pro_vc'].includes(user.role) ? managementLinks :
    studentLinks;

  const linkClass = (active: boolean) => cn(
    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium',
    active
      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  );

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-slate-100 flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-3 group" onClick={onNavigate}>
          <div className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white group-hover:shadow-lg transition-all">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <span className="font-headline font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent block">
              SRM PrepTrack
            </span>
            <span className="text-[10px] text-slate-400 leading-tight block">Track your Prep. Crack your Placement.</span>
          </div>
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {user.role === 'student' && (
          <div>
            <button
              onClick={() => setSelfAssessmentOpen(o => !o)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium',
                selfAssessmentHrefs.includes(pathname)
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}>
              <ClipboardCheck className="h-5 w-5 flex-shrink-0" />
              <span className="flex-1 text-left">Self Assessment</span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', selfAssessmentOpen && 'rotate-180')} />
            </button>
            {selfAssessmentOpen && (
              <div className="mt-1.5 ml-4 pl-3 border-l-2 border-slate-100 space-y-1.5">
                {selfAssessmentLinks.map(item => (
                  <Link key={item.href} href={item.href} onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm',
                      pathname === item.href
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    )}>
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1">{item.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
        {links.map(item => (
          <Link key={item.href} href={item.href} onClick={onNavigate}
            className={linkClass(pathname === item.href)}>
            <item.icon className="h-5 w-5 flex-shrink-0" />
            <span className="flex-1">{item.name}</span>
            {(item as any).isNew && pathname !== item.href && (
              <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">NEW</span>
            )}
          </Link>
        ))}
      </nav>

      {/* User + logout */}
      <div className="p-4 border-t border-slate-200 space-y-3 flex-shrink-0">
        <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
          <p className="text-xs text-slate-500 capitalize">{user.role}</p>
        </div>
        <Button
          variant="ghost"
          onClick={onLogout}
          className="w-full justify-start text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
        >
          <LogOut className="h-5 w-5 mr-3" /> Logout
        </Button>
      </div>
    </div>
  );
}

// ── Main Sidebar export ───────────────────────────────────────────────────────
export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const confirmLogout = () => {
    setCurrentUser(null);
    router.push('/');
  };

  return (
    <>
      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <div className="hidden md:flex w-64 bg-gradient-to-b from-white to-slate-50 border-r border-slate-200 flex-col h-screen sticky top-0 shadow-sm flex-shrink-0">
        <NavContent
          user={user}
          pathname={pathname}
          onLogout={() => setLogoutOpen(true)}
        />
      </div>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-headline font-bold text-base bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              SRM PrepTrack
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="rounded-xl text-slate-600"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* ── Mobile drawer ── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-72 flex flex-col">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <NavContent
            user={user}
            pathname={pathname}
            onNavigate={() => setMobileOpen(false)}
            onLogout={() => { setMobileOpen(false); setLogoutOpen(true); }}
          />
        </SheetContent>
      </Sheet>

      {/* ── Logout Confirmation Dialog ── */}
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="sm:max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Confirm Logout
            </DialogTitle>
            <DialogDescription className="text-slate-600 pt-1">
              Are you sure you want to logout? You will be taken back to the login page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-2 mt-2">
            <Button variant="outline" onClick={() => setLogoutOpen(false)} className="flex-1 rounded-xl">
              Cancel
            </Button>
            <Button onClick={confirmLogout} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl">
              <LogOut className="h-4 w-4 mr-2" /> Yes, Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
