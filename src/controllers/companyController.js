import CompanySettings from '../models/CompanySettings.js';
import path from 'path';
import fs from 'fs';
import { UPLOAD_PATH } from '../config/env.js';

// Get current Company Branding
export const getCompanyBranding = async (req, res, next) => {
  try {
    let settings = await CompanySettings.findOne();
    if (!settings) {
      settings = await CompanySettings.create({
        companyName: 'Work Portal',
        companyLogo: '',
        supportEmail: '',
        supportPhone: '',
        website: '',
        companyAddress: '',
        companyDescription: '',
        companyTagline: '',
      });
    }
    res.status(200).json({
      success: true,
      company: settings,
    });
  } catch (error) {
    next(error);
  }
};

// Update Company Branding (Strictly Administrator Only)
export const updateCompanyBranding = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only Administrators can manage company branding.',
      });
    }

    let settings = await CompanySettings.findOne();
    if (!settings) {
      settings = new CompanySettings({
        companyName: 'Work Portal',
        companyLogo: '',
        supportEmail: '',
        supportPhone: '',
        website: '',
        companyAddress: '',
        companyDescription: '',
        companyTagline: '',
      });
    }

    const { companyName, supportEmail, supportPhone, website, companyAddress, companyDescription, companyTagline, removeLogo } = req.body;

    if (companyName !== undefined) settings.companyName = companyName.trim();
    if (supportEmail !== undefined) settings.supportEmail = supportEmail.trim();
    if (supportPhone !== undefined) settings.supportPhone = supportPhone.trim();
    if (website !== undefined) settings.website = website.trim();
    if (companyAddress !== undefined) settings.companyAddress = companyAddress.trim();
    if (companyDescription !== undefined) settings.companyDescription = companyDescription.trim();
    if (companyTagline !== undefined) settings.companyTagline = companyTagline.trim();

    if (removeLogo === 'true' || removeLogo === true) {
      if (settings.companyLogo) {
        const oldPath = path.join(UPLOAD_PATH, settings.companyLogo);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (e) {}
        }
        settings.companyLogo = '';
      }
    } else if (req.file) {
      if (settings.companyLogo) {
        const oldPath = path.join(UPLOAD_PATH, settings.companyLogo);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (e) {}
        }
      }
      settings.companyLogo = req.file.filename;
    }

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Company branding updated successfully!',
      company: settings,
    });
  } catch (error) {
    next(error);
  }
};
