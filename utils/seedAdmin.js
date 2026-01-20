const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        const email = 'admin.hec@gmail.com';
        const password = 'admin12345';
        const name = 'Super Admin';

        let admin = await User.findOne({ email });

        if (admin) {
            console.log('Admin user already exists');
        } else {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            admin = new User({
                name,
                email,
                password: hashedPassword,
                role: 'admin',
                isActive: true
            });

            await admin.save();
            console.log('Admin user created successfully');
        }

        mongoose.connection.close();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedAdmin();
