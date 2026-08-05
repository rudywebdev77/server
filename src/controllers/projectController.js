import Project from '../models/Project.js';
import Request from '../models/Request.js';
import File from '../models/File.js';
import User from '../models/User.js';
import { logActivity } from '../utils/logActivity.js';
import { createNotification } from '../utils/createNotification.js';
import StatusHistory from '../models/StatusHistory.js';
import AssignmentHistory from '../models/AssignmentHistory.js';
import RevisionHistory from '../models/RevisionHistory.js';

// @desc    Create project (Admin only)
// @route   POST /api/projects
// @access  Private/Admin
export const createProject = async (req, res, next) => {
  try {
    const {
      projectName, description, clientId, requestId,
      staffIds, startDate, deadline, priority,
      budget, deliverables, instructions, status
    } = req.body;

    const project = await Project.create({
      projectName,
      description,
      client: clientId,
      request: requestId || undefined,
      assignedStaff: staffIds ? JSON.parse(staffIds) : [],
      startDate: startDate || Date.now(),
      deadline,
      priority: priority || 'low',
      budget,
      deliverables,
      instructions,
      status: status || 'not_started',
      createdBy: req.user._id,
    });

    // Handle reference files
    if (req.files && req.files.length > 0) {
      const fileIds = [];
      for (const file of req.files) {
        const fileDoc = await File.create({
          project: project._id,
          uploadedBy: req.user._id,
          fileName: file.filename,
          originalName: file.originalname,
          filePath: `/uploads/${file.filename}`,
          fileType: file.mimetype,
          size: file.size,
        });
        fileIds.push(fileDoc._id);
      }
      project.referenceFiles = fileIds;
      await project.save();
    }

    // If request was provided, mark it as converted
    if (requestId) {
      await Request.findByIdAndUpdate(requestId, { status: 'converted' });
    }

    // Log initial status
    await StatusHistory.create({ project: project._id, oldStatus: '', newStatus: project.status, changedBy: req.user._id });

    // Log activity
    await logActivity({
      project: project._id,
      action: 'project_created',
      newValue: project.status,
      performedBy: req.user._id,
      role: req.user.role,
      description: `Admin created project: ${projectName}`,
    });

    // Notify assigned staff
    const parsedStaffIds = staffIds ? JSON.parse(staffIds) : [];
    for (const staffId of parsedStaffIds) {
      await createNotification({
        user: staffId,
        title: 'New Project Assigned',
        message: `You have been assigned to project: ${projectName}`,
        type: 'project',
        link: `/staff/projects/${project._id}`,
      });
    }

    // Notify client
    await createNotification({
      user: clientId,
      title: 'Project Created',
      message: `A project has been created for your request: ${projectName}`,
      type: 'project',
      link: `/client/projects/${project._id}`,
    });

    res.status(201).json({ success: true, message: 'Project created successfully', project });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all projects (role-filtered)
// @route   GET /api/projects
// @access  Private
export const getProjects = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    const query = {};

    if (req.user.role === 'staff') {
      query.assignedStaff = req.user._id;
    } else if (req.user.role === 'client') {
      query.client = req.user._id;
    }

    if (status) query.status = status;
    if (search && search.trim()) {
      const cleanSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { projectName: { $regex: cleanSearch, $options: 'i' } },
        { description: { $regex: cleanSearch, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [total, projects] = await Promise.all([
      Project.countDocuments(query),
      Project.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('client', 'fullName email')
        .populate('assignedStaff', 'fullName email')
        .populate('request', 'title requestNo')
        .lean(),
    ]);


    res.status(200).json({
      success: true,
      count: projects.length,
      pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) },
      projects,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single project
// @route   GET /api/projects/:id
// @access  Private
export const getProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('client', 'fullName email phone')
      .populate('assignedStaff', 'fullName email profileImage')
      .populate('request', 'title requestNo status')
      .populate('referenceFiles')
      .populate('createdBy', 'fullName');

    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    // Role-based access check
    if (req.user.role === 'client' && project.client._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (req.user.role === 'staff' && !project.assignedStaff.some(s => s._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.status(200).json({ success: true, project });
  } catch (error) {
    next(error);
  }
};

// @desc    Update project
// @route   PUT /api/projects/:id
// @access  Private/Admin
export const updateProject = async (req, res, next) => {
  try {
    const { projectName, description, deadline, priority, budget, deliverables, instructions, status } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const oldDeadline = project.deadline;
    if (projectName) project.projectName = projectName;
    if (description) project.description = description;
    if (deadline) project.deadline = deadline;
    if (priority) project.priority = priority;
    if (budget !== undefined) project.budget = budget;
    if (deliverables !== undefined) project.deliverables = deliverables;
    if (instructions !== undefined) project.instructions = instructions;

    if (deadline && oldDeadline?.toString() !== new Date(deadline).toString()) {
      await logActivity({
        project: project._id, action: 'deadline_changed',
        oldValue: oldDeadline?.toLocaleDateString(), newValue: new Date(deadline).toLocaleDateString(),
        performedBy: req.user._id, role: req.user.role,
        description: `Deadline changed from ${oldDeadline?.toLocaleDateString()} to ${new Date(deadline).toLocaleDateString()}`,
      });
    }

    await project.save();
    res.status(200).json({ success: true, message: 'Project updated successfully', project });
  } catch (error) {
    next(error);
  }
};

// @desc    Change project status
// @route   PATCH /api/projects/:id/status
// @access  Private (Admin, Staff)
export const changeProjectStatus = async (req, res, next) => {
  try {
    const { status, remarks } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    // Staff can only update if assigned
    if (req.user.role === 'staff' && !project.assignedStaff.includes(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not assigned to this project' });
    }

    const oldStatus = project.status;
    project.status = status;
    if (status === 'completed') project.completionDate = new Date();
    await project.save();

    // Record status history
    await StatusHistory.create({ project: project._id, oldStatus, newStatus: status, changedBy: req.user._id });

    // Log revision history if revision required
    if (status === 'revision_required' && remarks) {
      await RevisionHistory.create({ project: project._id, requestedBy: req.user._id, remarks });
    }

    await logActivity({
      project: project._id, action: 'status_changed',
      oldValue: oldStatus, newValue: status,
      performedBy: req.user._id, role: req.user.role,
      description: `${req.user.fullName} changed project status from "${oldStatus.replace('_', ' ')}" to "${status.replace('_', ' ')}"`,
    });

    // Notify relevant users
    const notifyUsers = [];
    if (req.user.role === 'staff') {
      const admins = await User.find({ role: 'admin' });
      notifyUsers.push(...admins.map(a => a._id));
    }
    if (['completed', 'revision_required'].includes(status)) {
      notifyUsers.push(project.client);
    }

    for (const userId of notifyUsers) {
      await createNotification({
        user: userId, title: 'Project Status Updated',
        message: `Project "${project.projectName}" status changed to: ${status.replace('_', ' ')}`,
        type: 'project', link: `/admin/projects/${project._id}`,
      });
    }

    res.status(200).json({ success: true, message: 'Status updated successfully', project });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign staff to project
// @route   PATCH /api/projects/:id/assign
// @access  Private/Admin
export const assignStaff = async (req, res, next) => {
  try {
    const { staffIds } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const oldStaff = [...project.assignedStaff];
    project.assignedStaff = staffIds;
    if (project.status === 'not_started') project.status = 'assigned';
    await project.save();

    // Record assignment history
    await AssignmentHistory.create({ project: project._id, oldStaff, newStaff: staffIds, assignedBy: req.user._id });
    await logActivity({
      project: project._id, action: 'staff_assigned',
      oldValue: oldStaff.join(', '), newValue: staffIds.join(', '),
      performedBy: req.user._id, role: req.user.role,
      description: `Admin reassigned staff on project "${project.projectName}"`,
    });

    // Notify new staff
    for (const staffId of staffIds) {
      if (!oldStaff.map(s => s.toString()).includes(staffId.toString())) {
        await createNotification({
          user: staffId, title: 'Project Assigned',
          message: `You have been assigned to project: ${project.projectName}`,
          type: 'assignment', link: `/staff/projects/${project._id}`,
        });
      }
    }

    res.status(200).json({ success: true, message: 'Staff assigned successfully', project });
  } catch (error) {
    next(error);
  }
};

// @desc    Staff accepts project
// @route   PATCH /api/projects/:id/accept
// @access  Private/Staff
export const acceptProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    if (!project.assignedStaff.includes(req.user._id)) return res.status(403).json({ success: false, message: 'Not assigned to this project' });

    const oldStatus = project.status;
    project.status = 'in_progress';
    await project.save();

    await StatusHistory.create({ project: project._id, oldStatus, newStatus: 'in_progress', changedBy: req.user._id });
    await logActivity({
      project: project._id, action: 'project_accepted',
      oldValue: oldStatus, newValue: 'in_progress',
      performedBy: req.user._id, role: req.user.role,
      description: `Staff ${req.user.fullName} accepted the project and moved it to "In Progress"`,
    });

    res.status(200).json({ success: true, message: 'Project accepted', project });
  } catch (error) {
    next(error);
  }
};

// @desc    Staff submits work for admin review
// @route   PATCH /api/projects/:id/submit-review
// @access  Private/Staff
export const submitForReview = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    // Handle uploaded work files
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await File.create({
          project: project._id,
          uploadedBy: req.user._id,
          fileName: file.filename,
          originalName: file.originalname,
          filePath: `/uploads/${file.filename}`,
          fileType: file.mimetype,
          size: file.size,
        });
      }
    }

    const oldStatus = project.status;
    project.status = 'under_review';
    await project.save();

    await StatusHistory.create({ project: project._id, oldStatus, newStatus: 'under_review', changedBy: req.user._id });
    await logActivity({
      project: project._id, action: 'submitted_for_review',
      oldValue: oldStatus, newValue: 'under_review',
      performedBy: req.user._id, role: req.user.role,
      description: `Staff ${req.user.fullName} submitted work for admin review`,
    });

    // Notify admins
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await createNotification({
        user: admin._id, title: 'Work Submitted for Review',
        message: `Staff submitted work on project: ${project.projectName}`,
        type: 'review', link: `/admin/projects/${project._id}`,
      });
    }

    res.status(200).json({ success: true, message: 'Work submitted for review', project });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin or Client approves work
// @route   PATCH /api/projects/:id/approve
// @access  Private (Admin, Client)
export const approveWork = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const oldStatus = project.status;
    project.status = 'completed';
    project.completionDate = new Date();
    await project.save();

    await StatusHistory.create({ project: project._id, oldStatus, newStatus: 'completed', changedBy: req.user._id });
    await logActivity({
      project: project._id, action: 'work_approved',
      oldValue: oldStatus, newValue: 'completed',
      performedBy: req.user._id, role: req.user.role,
      description: `${req.user.fullName} (${req.user.role}) approved the work and marked project as completed`,
    });

    // Notify staff
    for (const staffId of project.assignedStaff) {
      await createNotification({
        user: staffId, title: 'Project Approved!',
        message: `Your work on "${project.projectName}" has been approved.`,
        type: 'project', link: `/staff/projects/${project._id}`,
      });
    }

    res.status(200).json({ success: true, message: 'Work approved. Project marked as completed.', project });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin or Client requests revision
// @route   PATCH /api/projects/:id/revision
// @access  Private (Admin, Client)
export const requestRevision = async (req, res, next) => {
  try {
    const { remarks } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const oldStatus = project.status;
    project.status = 'revision_required';
    await project.save();

    await RevisionHistory.create({ project: project._id, requestedBy: req.user._id, remarks: remarks || 'Revision requested' });
    await StatusHistory.create({ project: project._id, oldStatus, newStatus: 'revision_required', changedBy: req.user._id });
    await logActivity({
      project: project._id, action: 'revision_requested',
      oldValue: oldStatus, newValue: 'revision_required',
      performedBy: req.user._id, role: req.user.role,
      description: `${req.user.fullName} requested revision: ${remarks || 'No specific remarks'}`,
    });

    // Notify staff
    for (const staffId of project.assignedStaff) {
      await createNotification({
        user: staffId, title: 'Revision Required',
        message: `Revision requested on "${project.projectName}": ${remarks || ''}`,
        type: 'revision', link: `/staff/projects/${project._id}`,
      });
    }

    res.status(200).json({ success: true, message: 'Revision requested', project });
  } catch (error) {
    next(error);
  }
};
