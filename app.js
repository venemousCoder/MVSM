const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const mongoose = require('mongoose');
const passport = require('passport');
const flash = require('connect-flash');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const path = require('path');
require('dotenv').config();

const Notification = require('./models/Notification');
const Order = require('./models/Order');

const app = express();

// Passport Config
require('./config/passport')(passport);

// DB Config
const db = process.env.MONGO_URI;

// Connect to MongoDB
mongoose
  .connect(db)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

// EJS
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('layout', 'layouts/main'); // Default layout

// Express Body Parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Express Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: db })
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Connect Flash
app.use(flash());

// Global Variables
app.use(async (req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || null;
  
  if (req.user) {
      try {
          const unreadNotifs = await Notification.countDocuments({ user: req.user._id, isRead: false });
          res.locals.unreadNotificationsCount = unreadNotifs;

          // For consumers, show active orders count
          if (req.user.role === 'consumer') {
              const activeOrders = await Order.countDocuments({ 
                  customer: req.user._id, 
                  status: { $in: ['pending', 'processing'] } 
              });
              res.locals.activeOrdersCount = activeOrders;
          } else {
              res.locals.activeOrdersCount = 0;
          }
      } catch (err) {
          console.error("Error fetching global counts", err);
          res.locals.unreadNotificationsCount = 0;
          res.locals.activeOrdersCount = 0;
      }
  } else {
      res.locals.unreadNotificationsCount = 0;
      res.locals.activeOrdersCount = 0;
  }

  // Helper: Get User Badges
  res.locals.getUserBadges = (user) => {
      if (!user) return [];
      const badges = [];
      const now = new Date();
      const createdAt = user.createdAt ? new Date(user.createdAt) : new Date();
      const diffTime = Math.abs(now - createdAt);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (user.role === 'admin') {
          badges.push({ label: 'Admin', color: 'danger' });
      } else if (user.role === 'sme_owner') {
          badges.push({ label: 'Business Owner', color: 'info' });
      } else if (user.role === 'operator') {
          badges.push({ label: 'Operator', color: 'dark' });
      }

      if (diffDays <= 30) {
          badges.push({ label: 'New Member', color: 'success' });
      } else if (diffDays > 365) {
          badges.push({ label: 'Loyal Member', color: 'warning text-dark' });
      }

      if (user.isActive) {
          badges.push({ label: 'Verified', color: 'primary' });
      }

      return badges;
  };

  next();
});

// Routes
app.use('/', require('./routes/index'));

const PORT = process.env.PORT || 5000;

const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const liveChatController = require('./controllers/liveChatController');

app.set('socketio', io);

// Socket.io Connection
io.on('connection', (socket) => {
    console.log('A user connected: ' + socket.id);

    socket.on('join_room', (room) => {
        socket.join(room);
        console.log(`User ${socket.id} joined room ${room}`);
    });

    socket.on('send_message', async (data) => {
        // Broadcast to everyone in the room including sender (or excluding if handled by client)
        // Usually we broadcast to others and update self locally, but for simplicity:
        await liveChatController.saveMessage(data.room, data.userId, data.content, data.role);
        io.to(data.room).emit('receive_message', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

server.listen(PORT, console.log(`Server started on port ${PORT}`));
