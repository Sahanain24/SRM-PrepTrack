
// Legacy compatibility - redirecting to new MongoDB-based database
export * from './db';

// Re-export for backward compatibility
export type { 
  UserRole, 
  User, 
  StudyLog, 
  StudySession, 
  QuizResult, 
  CodingSubmission, 
  CommunicationHistory, 
  TeacherFeedback 
} from './db';

export {
  getDb,
  saveDb,
  getCurrentUser,
  setCurrentUser,
  db,
  db as database
} from './db';
