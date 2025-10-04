require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  passwordHash: { type: String, required: false },
  name: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['traveler', 'organizer', 'admin', 'agent'], 
    default: 'traveler', 
    index: true 
  },
  emailVerified: { type: Boolean, default: false, index: true },
  phoneVerified: { type: Boolean, default: false, index: true },
  totalRatings: { type: Number, default: 0, min: 0 },
  totalTripsOrganized: { type: Number, default: 0, min: 0 },
  totalTripsJoined: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function createAdmin() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trek-tribe';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Admin user details
    const adminData = {
      email: 'admin@trekktribe.com',
      name: 'Trek Tribe Admin',
      role: 'admin',
      emailVerified: true,
      isActive: true
    };

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminData.email });
    if (existingAdmin) {
      console.log('❌ Admin user already exists with email:', adminData.email);
      console.log('Current admin role:', existingAdmin.role);
      
      // Update role to admin if needed
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log('✅ Updated existing user to admin role');
      }
    } else {
      // Create password hash
      const password = 'admin123';
      const passwordHash = await bcrypt.hash(password, 12);
      adminData.passwordHash = passwordHash;

      // Create admin user
      const adminUser = new User(adminData);
      await adminUser.save();
      
      console.log('✅ Admin user created successfully!');
      console.log('📧 Email:', adminData.email);
      console.log('🔑 Password:', password);
      console.log('🎭 Role:', adminData.role);
    }

    // Also create an agent user for testing
    const agentData = {
      email: 'agent@trekktribe.com',
      name: 'Trek Tribe Agent',
      role: 'agent',
      emailVerified: true,
      isActive: true
    };

    const existingAgent = await User.findOne({ email: agentData.email });
    if (!existingAgent) {
      const agentPassword = 'agent123';
      const agentPasswordHash = await bcrypt.hash(agentPassword, 12);
      agentData.passwordHash = agentPasswordHash;

      const agentUser = new User(agentData);
      await agentUser.save();
      
      console.log('✅ Agent user created successfully!');
      console.log('📧 Email:', agentData.email);
      console.log('🔑 Password:', agentPassword);
      console.log('🎭 Role:', agentData.role);
    } else {
      console.log('❌ Agent user already exists with email:', agentData.email);
    }

    console.log('\n🚀 Setup Complete! You can now login with:');
    console.log('Admin: admin@trekktribe.com / admin123');
    console.log('Agent: agent@trekktribe.com / agent123');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createAdmin();