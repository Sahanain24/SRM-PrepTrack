import mongoose from 'mongoose';

const ExamSchema = new mongoose.Schema({
  teacherId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:       { type: String, required: true },
  subject:     { type: String },
  description: { type: String },

  examDate:     { type: String },  // 'YYYY-MM-DD'
  startTime:    { type: String },  // 'HH:MM'
  endTime:      { type: String },
  deadlineDate: { type: String },  // 'YYYY-MM-DD' — last day students can attempt
  deadlineTime: { type: String },  // 'HH:MM'
  durationMins: { type: Number, required: true },

  totalQuestions: { type: Number },
  totalMarks:     { type: Number, required: true },
  passingMarks:   { type: Number, required: true },
  shuffleQuestions: { type: Boolean, default: false },
  shuffleOptions:   { type: Boolean, default: false },
  showResultImmediately: { type: Boolean, default: true },
  answerKeyPublished:    { type: Boolean, default: false },

  targetPrograms:    [{ type: String }],
  targetDepartments: [{ type: String }],
  targetYears:       [{ type: Number }],
  targetBatches:     [{ type: String }],

  questions: [{ type: mongoose.Schema.Types.Mixed }], // inline question objects

  // Per-student re-attempt permissions granted by the teacher
  reAttemptPermissions: [{
    userId:    { type: String, required: true },
    userName:  { type: String },
    grantedAt: { type: Date, default: Date.now },
    used:      { type: Boolean, default: false },
  }],

  status: {
    type: String,
    enum: ['draft','published','completed','archived'],
    default: 'draft',
  },
}, { timestamps: true });

export const Exam = mongoose.models.Exam || mongoose.model('Exam', ExamSchema);