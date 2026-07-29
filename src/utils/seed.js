import User from '../models/User.js';

export const seedDatabase = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log('Database already has users. Seeding skipped.');
      return;
    }

    console.log('Seeding initial users...');

    const admin = await User.create({
      fullName: 'Admin User',
      email: 'admin@portal.com',
      phone: '1234567890',
      password: 'Admin@123', // will be hashed automatically by user schema pre-save hook
      role: 'admin',
      status: 'active',
    });

    const staff1 = await User.create({
      fullName: 'Staff Member One',
      email: 'staff1@portal.com',
      phone: '1234567891',
      password: 'Staff@123',
      role: 'staff',
      status: 'active',
      createdBy: admin._id,
    });

    const staff2 = await User.create({
      fullName: 'Staff Member Two',
      email: 'staff2@portal.com',
      phone: '1234567892',
      password: 'Staff@123',
      role: 'staff',
      status: 'active',
      createdBy: admin._id,
    });

    const client1 = await User.create({
      fullName: 'Client Company A',
      email: 'client1@portal.com',
      phone: '1234567893',
      password: 'Client@123',
      role: 'client',
      status: 'active',
      createdBy: admin._id,
    });

    const client2 = await User.create({
      fullName: 'Client Company B',
      email: 'client2@portal.com',
      phone: '1234567894',
      password: 'Client@123',
      role: 'client',
      status: 'active',
      createdBy: admin._id,
    });

    console.log('Seeding completed successfully!');
    console.log('Initial accounts created:');
    console.log('- Admin: admin@portal.com (Password: Admin@123)');
    console.log('- Staff 1: staff1@portal.com (Password: Staff@123)');
    console.log('- Staff 2: staff2@portal.com (Password: Staff@123)');
    console.log('- Client 1: client1@portal.com (Password: Client@123)');
    console.log('- Client 2: client2@portal.com (Password: Client@123)');
  } catch (error) {
    console.error('Error seeding database:', error.message);
  }
};
