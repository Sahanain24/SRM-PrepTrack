import mongoose from 'mongoose';

const CodingTestSchema = new mongoose.Schema({
  teacherId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teacherName: { type: String },
  title:       { type: String, required: true },
  description: { type: String },

  examDate:     { type: String },  // 'YYYY-MM-DD'
  startTime:    { type: String },  // 'HH:MM'
  deadlineDate: { type: String },  // 'YYYY-MM-DD'
  deadlineTime: { type: String },  // 'HH:MM'
  durationMins: { type: Number, required: true },

  // Per-student reattempt grants (after deadline)
  reAttemptPermissions: [{
    userId:    { type: String, required: true },
    userName:  { type: String },
    grantedAt: { type: Date, default: Date.now },
    used:      { type: Boolean, default: false },
  }],

  targetPrograms: [{ type: String }],
  targetYears:    [{ type: Number }],
  targetSections: [{ type: String }],

  problems: [{
    problemId:   { type: String, required: true }, // slug, unique within test
    title:       { type: String, required: true },
    description: { type: String, required: true },
    difficulty:  { type: String, enum: ['easy','medium','hard'], default: 'medium' },
    language:    { type: String, default: 'javascript' }, // default/required language
    examples: [{
      input:       { type: String },
      output:      { type: String },
      explanation: { type: String },
    }],
    starterCode: { type: String, default: '' },
    testCases: [{
      input:          { type: String, default: '' },
      expectedOutput: { type: String, required: true },
      hidden:         { type: Boolean, default: false },
    }],
    marks: { type: Number, default: 10 },
  }],

  status: {
    type: String,
    enum: ['draft','published','archived'],
    default: 'published',
  },
}, { timestamps: true });

export const CodingTest = mongoose.models.CodingTest || mongoose.model('CodingTest', CodingTestSchema);
