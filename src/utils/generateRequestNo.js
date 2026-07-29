import Request from '../models/Request.js';

export const generateRequestNo = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // Find requests created today
  const startOfDay = new Date(date.setHours(0, 0, 0, 0));
  const endOfDay = new Date(date.setHours(23, 59, 59, 999));

  const countToday = await Request.countDocuments({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });

  const nextNum = String(countToday + 1).padStart(3, '0');
  return `REQ-${dateStr}-${nextNum}`;
};
export default generateRequestNo;
