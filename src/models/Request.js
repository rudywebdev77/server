import mongoose from 'mongoose';

const RequestSchema = new mongoose.Schema(
  {
    requestNo: {
      type: String,
      required: true,
      unique: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Please add a request title'],
      trim: true,
    },
    service: {
      type: String,
      required: [true, 'Please add a service or project type'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please add a detailed description'],
    },
    deadline: {
      type: Date,
      required: [true, 'Please add a required deadline'],
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
    instructions: {
      type: String,
      trim: true,
    },
    contactInfo: {
      name: String,
      email: String,
      phone: String,
    },
    files: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File',
      },
    ],
    status: {
      type: String,
      enum: ['new', 'under_review', 'approved', 'rejected', 'converted', 'closed'],
      default: 'new',
    },
    rejectReason: {
      type: String,
      default: '',
    },
    internalNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Request', RequestSchema);
