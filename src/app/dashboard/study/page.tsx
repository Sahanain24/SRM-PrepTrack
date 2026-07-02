
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, BookOpen, History, Trash2, FileText, CheckCircle2 } from 'lucide-react';
import { getDb, saveDb, getCurrentUser, StudyLog } from '@/lib/mock-db';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function StudyHub() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  const [newLog, setNewLog] = useState({
    title: '',
    subject: '',
    content: ''
  });

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const user = getCurrentUser();
        if (user) {
          const { db } = await import('@/lib/mock-db');
          const userId = user._id || user.id;
          if (userId) {
            const userLogs = await db.getStudyLogs(userId);
            setLogs(userLogs.reverse());
          }
        }
      } catch (error) {
        console.error('Failed to fetch study logs:', error);
      }
    };

    fetchLogs();
  }, []);

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return;

    if (!newLog.title || !newLog.content) {
      toast({ title: "Error", description: "Please fill in title and content.", variant: "destructive" });
      return;
    }

    try {
      const { db } = await import('@/lib/mock-db');
      const userId = user._id || user.id;
      if (!userId) {
        toast({ title: "Error", description: "User ID not found.", variant: "destructive" });
        return;
      }

      const log = await db.createStudyLog({
        userId,
        title: newLog.title,
        subject: newLog.subject,
        content: newLog.content,
        date: new Date().toISOString(),
      });

      setLogs([log, ...logs]);
      setNewLog({ title: '', subject: '', content: '' });
      setIsAdding(false);
      toast({ title: "Success", description: "Study log created successfully!" });
    } catch (error) {
      console.error('Failed to create study log:', error);
      toast({ title: "Error", description: "Failed to save study log.", variant: "destructive" });
    }
  };

  const deleteLog = async (id: string) => {
    try {
      const response = await fetch(`/api/study-logs/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setLogs(logs.filter(l => (l._id !== id && l.id !== id)));
        toast({ title: "Success", description: "Study log deleted." });
      } else {
        throw new Error('Failed to delete study log');
      }
    } catch (error) {
      console.error('Failed to delete study log:', error);
      toast({ title: "Error", description: "Failed to delete study log.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Study Hub</h1>
          <p className="text-muted-foreground">Manage your study logs and materials.</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? 'Cancel' : <><Plus className="mr-2 h-4 w-4" /> New Study Log</>}
        </Button>
      </div>

      {isAdding && (
        <Card className="border-none shadow-xl animate-in slide-in-from-top-4">
          <CardHeader>
            <CardTitle className="font-headline">Create New Log</CardTitle>
            <CardDescription>Enter your notes or subject material to generate quizzes later.</CardDescription>
          </CardHeader>
          <form onSubmit={handleAddLog}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Log Title</Label>
                  <Input 
                    placeholder="e.g. React Hooks Overview" 
                    value={newLog.title}
                    onChange={(e) => setNewLog({...newLog, title: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input 
                    placeholder="e.g. Computer Science" 
                    value={newLog.subject}
                    onChange={(e) => setNewLog({...newLog, subject: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Study Material / Notes</Label>
                <Textarea 
                  placeholder="Paste your notes or summary here..." 
                  className="min-h-[200px]"
                  value={newLog.content}
                  onChange={(e) => setNewLog({...newLog, content: e.target.value})}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full">Save Study Log</Button>
            </CardFooter>
          </form>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {logs.length === 0 ? (
          <Card className="md:col-span-2 border-dashed border-2 p-12 flex flex-col items-center justify-center text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-bold">No Study Logs Yet</h3>
            <p className="text-muted-foreground max-w-sm">Create a log with your study materials to enable personalized AI quizzes.</p>
          </Card>
        ) : (
          logs.map((log) => (
            <Card key={log._id || log.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="font-headline text-xl">{log.title}</CardTitle>
                    <CardDescription>{log.subject} • {format(new Date(log.date), 'dd/MM/yyyy')}</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteLog(log._id || log.id || '')}>
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                  {log.content}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <a href={`/dashboard/quiz?source=${log._id || log.id || ''}`}>
                      <FileText className="mr-2 h-4 w-4" />
                      Take Quiz
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
