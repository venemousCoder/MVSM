const LocalStrategy = require('passport-local').Strategy;
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Load User model
const User = require('../models/User');

module.exports = function(passport) {
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
      // Match user
      User.findOne({
        email: email
      }).then(user => {
        if (!user) {
          return done(null, false, { message: 'That email is not registered' });
        }

        if (!user.isActive) {
          return done(null, false, { message: 'Account deactivated. Please contact admin.' });
        }

        // Check if account is locked
        if (user.lockUntil && user.lockUntil > Date.now()) {
          return done(null, false, { message: 'Account is temporarily locked. Please try again later.' });
        }

        // Match password
        bcrypt.compare(password, user.password, (err, isMatch) => {
          if (err) throw err;
          if (isMatch) {
            // Successful login - reset attempts and lock
            if (user.loginAttempts > 0 || user.lockUntil) {
              user.loginAttempts = 0;
              user.lockUntil = undefined;
              user.save().then(savedUser => {
                return done(null, savedUser);
              });
            } else {
              return done(null, user);
            }
          } else {
            // Failed login - increment attempts
            user.loginAttempts = (user.loginAttempts || 0) + 1;

            if (user.loginAttempts >= 5) {
              // Lock account for 1 hour
              user.lockUntil = Date.now() + 3600000;
              user.save().then(() => {
                return done(null, false, { message: 'Account locked due to too many failed login attempts.' });
              });
            } else {
              user.save().then(() => {
                return done(null, false, { message: 'Password incorrect' });
              });
            }
          }
        });
      });
    })
  );

  passport.serializeUser(function(user, done) {
    done(null, user.id);
  });

  passport.deserializeUser(function(id, done) {
    User.findById(id)
        .then(user => done(null, user))
        .catch(err => done(err, null));
  });
};
