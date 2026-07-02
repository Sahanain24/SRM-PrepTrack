import mongoose from 'mongoose';

const PasswordResetSchema = new mongoose.Schema({
  email:     { type: String, required: true, lowercase: true },
  token:     { type: String, required: true, unique: true },
  expiresAt: { type: Date,   required: true },
}, { timestamps: true });

// Auto-delete expired documents
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordReset = mongoose.models.PasswordReset
  || mongoose.model('PasswordReset', PasswordResetSchema);
