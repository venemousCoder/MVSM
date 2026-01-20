const User = require('../models/User');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Login Page
exports.loginPage = (req, res) => {
    res.render('auth/login', { title: 'Login' });
};

// Register Page (Consumer)
exports.registerPage = (req, res) => {
    res.render('auth/signup', { title: 'Sign Up' });
};

// Register Page (Business)
exports.registerBusinessPage = (req, res) => {
    res.render('auth/signup-business', { title: 'Register Business' });
};

// Register Handle
exports.registerHandle = (req, res) => {
    const { name, email, password, confirm_password, phone } = req.body;
    let errors = [];

    if (!name || !email || !password || !confirm_password) {
        errors.push({ msg: 'Please enter all required fields' });
    }

    if (password !== confirm_password) {
        errors.push({ msg: 'Passwords do not match' });
    }

    if (password.length < 6) {
        errors.push({ msg: 'Password must be at least 6 characters' });
    }

    if (errors.length > 0) {
        res.render('auth/signup', {
            errors,
            name,
            email,
            password,
            confirm_password,
            phone,
            title: 'Sign Up'
        });
    } else {
        User.findOne({ email: email }).then(user => {
            if (user) {
                errors.push({ msg: 'Email already exists' });
                res.render('auth/signup', {
                    errors,
                    name,
                    email,
                    password,
                    confirm_password,
                    phone,
                    title: 'Sign Up'
                });
            } else {
                const newUser = new User({
                    name,
                    email,
                    password,
                    phone,
                    role: 'consumer'
                });

                bcrypt.genSalt(10, (err, salt) => {
                    bcrypt.hash(newUser.password, salt, (err, hash) => {
                        if (err) throw err;
                        newUser.password = hash;
                        newUser
                            .save()
                            .then(user => {
                                req.flash(
                                    'success_msg',
                                    'You are now registered and can log in'
                                );
                                res.redirect('/users/login');
                            })
                            .catch(err => console.log(err));
                    });
                });
            }
        });
    }
};

// Register Business Handle
exports.registerBusinessHandle = (req, res) => {
    const { name, email, password, confirm_password, phone } = req.body;
    let errors = [];

    if (!name || !email || !password || !confirm_password) {
        errors.push({ msg: 'Please enter all required fields' });
    }

    if (password !== confirm_password) {
        errors.push({ msg: 'Passwords do not match' });
    }

    if (password.length < 6) {
        errors.push({ msg: 'Password must be at least 6 characters' });
    }

    if (errors.length > 0) {
        res.render('auth/signup-business', {
            errors,
            name,
            email,
            password,
            confirm_password,
            phone,
            title: 'Register Business'
        });
    } else {
        User.findOne({ email: email }).then(user => {
            if (user) {
                errors.push({ msg: 'Email already exists' });
                res.render('auth/signup-business', {
                    errors,
                    name,
                    email,
                    password,
                    confirm_password,
                    phone,
                    title: 'Register Business'
                });
            } else {
                const newUser = new User({
                    name,
                    email,
                    password,
                    phone,
                    role: 'sme_owner'
                });

                bcrypt.genSalt(10, (err, salt) => {
                    bcrypt.hash(newUser.password, salt, (err, hash) => {
                        if (err) throw err;
                        newUser.password = hash;
                        newUser
                            .save()
                            .then(user => {
                                req.flash(
                                    'success_msg',
                                    'Business account registered! Please log in.'
                                );
                                res.redirect('/users/login');
                            })
                            .catch(err => console.log(err));
                    });
                });
            }
        });
    }
};

// Login Handle
exports.loginHandle = (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            req.flash('error_msg', info.message || 'Login failed');
            return res.redirect('/users/login');
        }
        req.logIn(user, (err) => {
            if (err) return next(err);
            
            if (user.role === 'sme_owner') {
                return res.redirect('/sme/dashboard');
            } else if (user.role === 'consumer') {
                return res.redirect('/');
            } else if (user.role === 'operator') {
                return res.redirect('/operator/dashboard');
            } else {
                return res.redirect('/admin/dashboard');
            }
        });
    })(req, res, next);
};

// Forgot Password Page
exports.forgotPasswordPage = (req, res) => {
    res.render('auth/forgot', { title: 'Forgot Password' });
};

// Forgot Password Handle
exports.forgotPasswordHandle = async (req, res) => {
    const { email } = req.body;
    
    try {
        const user = await User.findOne({ email });
        if (!user) {
            req.flash('error_msg', 'No account with that email found');
            return res.redirect('/users/forgot-password');
        }

        // Generate Token
        const token = crypto.randomBytes(20).toString('hex');

        // Set token and expiration (1 hour)
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        await user.save();

        // Create Transporter
        // For Dev: Use Ethereal or just Log. Here we try Ethereal for "realism" or fallback to console
        const testAccount = await nodemailer.createTestAccount();

        const transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false, 
            auth: {
                user: testAccount.user, 
                pass: testAccount.pass, 
            },
        });

        const resetUrl = `http://${req.headers.host}/users/reset/${token}`;

        const mailOptions = {
            from: '"MVSM Support" <support@mvsm.com>',
            to: user.email,
            subject: 'Password Reset Request',
            text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n` +
                `Please click on the following link, or paste this into your browser to complete the process:\n\n` +
                `${resetUrl}\n\n` +
                `If you did not request this, please ignore this email and your password will remain unchanged.\n`
        };

        // Send Email
        try {
            const info = await transporter.sendMail(mailOptions);
            console.log('Message sent: %s', info.messageId);
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
            console.log('RESET LINK (DEV):', resetUrl); // Always log for CLI user convenience

            req.flash('success_msg', 'An email has been sent to ' + user.email + ' with further instructions.');
            res.redirect('/users/login');
        } catch (err) {
            console.error("Error sending email:", err);
            req.flash('error_msg', 'Error sending email. Please try again later.');
            res.redirect('/users/forgot-password');
        }

    } catch (err) {
        console.error(err);
        res.redirect('/users/forgot-password');
    }
};

// Reset Password Page
exports.resetPasswordPage = async (req, res) => {
    try {
        const user = await User.findOne({ 
            resetPasswordToken: req.params.token, 
            resetPasswordExpires: { $gt: Date.now() } 
        });

        if (!user) {
            req.flash('error_msg', 'Password reset token is invalid or has expired.');
            return res.redirect('/users/forgot-password');
        }

        res.render('auth/reset', {
            title: 'Reset Password',
            token: req.params.token
        });
    } catch (err) {
        console.error(err);
        res.redirect('/users/forgot-password');
    }
};

// Reset Password Handle
exports.resetPasswordHandle = async (req, res) => {
    try {
        const user = await User.findOne({ 
            resetPasswordToken: req.params.token, 
            resetPasswordExpires: { $gt: Date.now() } 
        });

        if (!user) {
            req.flash('error_msg', 'Password reset token is invalid or has expired.');
            return res.redirect('/users/forgot-password');
        }

        if(req.body.password !== req.body.confirm) {
            req.flash('error_msg', 'Passwords do not match.');
            return res.redirect(`/users/reset/${req.params.token}`);
        }

        // Set new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(req.body.password, salt);
        
        // Clear token fields
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        // Optional: Send confirmation email
        // ...

        req.flash('success_msg', 'Success! Your password has been changed.');
        res.redirect('/users/login');

    } catch (err) {
        console.error(err);
        res.redirect('/users/login');
    }
};

// Logout Handle
exports.logoutHandle = (req, res, next) => {
    req.logout(function(err) {
        if (err) { return next(err); }
        req.flash('success_msg', 'You are logged out');
        res.redirect('/users/login');
    });
};

// @desc    Get User Profile
// @route   GET /users/profile
exports.getProfile = (req, res) => {
    res.render('users/profile', {
        title: 'My Profile',
        user: req.user
    });
};

// @desc    Update User Profile
// @route   POST /users/profile
exports.updateProfile = async (req, res) => {
    try {
        const { name, email, phone, password, confirm_password } = req.body;
        let errors = [];

        // Basic validation
        if (!name || !email) {
            errors.push({ msg: 'Name and Email are required' });
        }

        if (password || confirm_password) {
            if (password !== confirm_password) {
                errors.push({ msg: 'Passwords do not match' });
            }
            if (password.length < 6) {
                errors.push({ msg: 'Password must be at least 6 characters' });
            }
        }

        if (errors.length > 0) {
            return res.render('users/profile', {
                title: 'My Profile',
                user: req.user,
                errors
            });
        }

        // Check email uniqueness if changed
        if (email !== req.user.email) {
            const existingUser = await User.findOne({ email: email });
            if (existingUser) {
                return res.render('users/profile', {
                    title: 'My Profile',
                    user: req.user,
                    errors: [{ msg: 'Email already exists' }]
                });
            }
        }

        // Update User
        const user = await User.findById(req.user._id);
        user.name = name;
        user.email = email;
        user.phone = phone;

        if (password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }

        await user.save();
        req.flash('success_msg', 'Profile updated successfully');
        res.redirect('/users/profile');

    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Update Notifications
// @route   POST /users/notifications
exports.updateNotifications = async (req, res) => {
    try {
        const { email, sms } = req.body;
        
        await User.findByIdAndUpdate(req.user._id, {
            notifications: {
                email: !!email,
                sms: !!sms,
                push: true // Default keep true or add logic
            }
        });

        req.flash('success_msg', 'Notification preferences updated');
        res.redirect('/users/profile');
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};
