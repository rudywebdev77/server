import mongoose from 'mongoose';

const ProjectSchema = new mongoose.Schema(
  {
    projectName: {
      type: String,
      required: [true, 'Please add a project name'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please add a project description'],
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
    },
    assignedStaff: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    startDate: {
      type: Date,
      default: Date.now,
    },
    deadline: {
      type: Date,
      required: [true, 'Please add a project deadline'],
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
    },
    budget: {
      type: String,
      trim: true,
    },
    deliverables: {
      type: String,
      trim: true,
    },
    instructions: {
      type: String,
      trim: true,
    },
    referenceFiles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File',
      },
    ],
    status: {
      type: String,
      enum: [
        'not_started',
        'assigned',
        'in_progress',
        'waiting_for_client',
        'under_review',
        'revision_required',
        'completed',
        'cancelled',
      ],
      default: 'not_started',
    },
    completionDate: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Performance Indexes
ProjectSchema.index({ client: 1, status: 1 });
ProjectSchema.index({ assignedStaff: 1, status: 1 });
ProjectSchema.index({ status: 1, deadline: 1 });
ProjectSchema.index({ createdAt: -1 });

export default mongoose.model('Project', ProjectSchema);
