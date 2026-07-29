import File from '../models/File.js';
import path from 'path';
import { UPLOAD_PATH } from '../config/env.js';
import fs from 'fs';

// @desc    List files for a project
export const getProjectFiles = async (req, res, next) => {
  try {
    const files = await File.find({ project: req.params.projectId })
      .populate('uploadedBy', 'fullName role')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, files });
  } catch (error) { next(error); }
};

// @desc    List files for a request
export const getRequestFiles = async (req, res, next) => {
  try {
    const files = await File.find({ request: req.params.requestId })
      .populate('uploadedBy', 'fullName role')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, files });
  } catch (error) { next(error); }
};

// @desc    Download a file
export const downloadFile = async (req, res, next) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });

    const filePath = path.join(UPLOAD_PATH, file.fileName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'File no longer exists on disk' });

    res.download(filePath, file.originalName);
  } catch (error) { next(error); }
};

// @desc    Admin get all files
export const getAllFiles = async (req, res, next) => {
  try {
    const files = await File.find()
      .populate('uploadedBy', 'fullName role')
      .populate('project', 'projectName')
      .populate('request', 'requestNo title')
      .sort({ createdAt: -1 })
      .limit(100);
    res.status(200).json({ success: true, files });
  } catch (error) { next(error); }
};
