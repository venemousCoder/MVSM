const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureRole } = require('../config/auth');
const smeController = require('../controllers/smeController');
const upload = require('../utils/upload');

// All routes require authentication and 'sme_owner' role
router.use(ensureAuthenticated);
router.use(ensureRole('sme_owner'));

// Dashboard
router.get('/dashboard', smeController.getDashboard);
router.get('/activities', smeController.getActivities);
router.get('/businesses', smeController.getBusinesses);

// Create Business
router.get('/business/create', smeController.getCreateBusiness);
router.post('/business/create', upload.single('image'), smeController.postCreateBusiness);

// Business Details
router.get('/business/:id', smeController.getBusinessDetails);
router.get('/business/:id/edit', smeController.getEditBusiness);
router.post('/business/:id/edit', upload.single('image'), smeController.postEditBusiness);
router.post('/business/:id/delete', smeController.deleteBusiness);

// --- ORDERS ---
router.get('/orders', smeController.getOrdersIndex);
router.get('/business/:id/orders', smeController.getBusinessOrders);
router.post('/business/:id/orders/bulk', smeController.bulkOrderAction);
router.get('/business/:id/orders/export', smeController.exportOrders);
router.get('/business/:id/orders/:orderId', smeController.getOrderDetails);
router.post('/business/:id/orders/:orderId/status', smeController.updateOrderStatus);
router.post('/business/:id/orders/:orderId/note', smeController.addOrderNote);
router.get('/business/:id/orders/:orderId/invoice', smeController.getOrderInvoice);

// --- SETTINGS ---
router.get('/settings', smeController.getAccountSettings);
router.post('/settings/profile', smeController.updateProfile);
router.post('/settings/password', smeController.updatePassword);
router.post('/settings/notifications', smeController.updateNotifications);
router.get('/business/:id/settings', smeController.getBusinessSettings);
router.post('/business/:id/settings', smeController.updateBusinessSettings);

// --- ANALYTICS ---
router.get('/analytics', smeController.getAnalyticsIndex);
router.get('/business/:id/analytics', smeController.getBusinessAnalytics);
router.get('/business/:id/analytics/data', smeController.getBusinessAnalyticsData);

// --- REVIEWS ---
router.get('/reviews', smeController.getReviewsIndex);
router.get('/business/:id/reviews', smeController.getBusinessReviews);
router.post('/business/:id/reviews/:reviewId/reply', smeController.replyToReview);
router.post('/business/:id/reviews/:reviewId/report', smeController.reportReview);
router.post('/business/:id/reviews/:reviewId/status', smeController.toggleReviewStatus);

// --- OPERATORS ---
router.get('/business/:id/operators', smeController.getOperators);
router.get('/business/:id/operators/add', smeController.getAddOperator);
router.post('/business/:id/operators/add', smeController.postAddOperator);
router.get('/business/:id/operators/:operatorId/edit', smeController.getEditOperator);
router.post('/business/:id/operators/:operatorId/edit', smeController.postEditOperator);
router.post('/business/:id/operators/:operatorId/delete', smeController.deleteOperator);

// --- PRODUCTS (Retail) ---
router.get('/business/:id/products', smeController.getProducts);
router.post('/business/:id/products/bulk', smeController.bulkProductsAction);
router.get('/business/:id/products/add', smeController.getAddProduct);
router.post('/business/:id/products/add', upload.array('images', 5), smeController.postAddProduct);
router.get('/business/:id/products/:productId/edit', smeController.getEditProduct);
router.post('/business/:id/products/:productId/edit', upload.array('images', 5), smeController.postEditProduct);
router.post('/business/:id/products/:productId/delete', smeController.deleteProduct);

// --- SERVICES (Service) ---
router.get('/business/:id/services', smeController.getServices);
router.get('/business/:id/services/add', smeController.getAddService);
router.post('/business/:id/services/add', upload.array('images', 5), smeController.postAddService);
router.get('/business/:id/services/:serviceId/edit', smeController.getEditService);
router.post('/business/:id/services/:serviceId/edit', upload.array('images', 5), smeController.postEditService);
router.post('/business/:id/services/:serviceId/delete', smeController.deleteService);

// --- SERVICE BUILDER ---
router.get('/business/:businessId/services/:serviceId/builder', smeController.getServiceBuilder);
router.post('/business/:businessId/services/:serviceId/builder', smeController.saveServiceScript);

// --- CHAT LOGS ---
router.get('/chats', smeController.getChatsIndex);
router.get('/business/:id/chats', smeController.getChatLogs);
router.get('/business/:id/chats/:chatId', smeController.getChatDetails);

// --- INTERNAL CHAT ---
router.post('/business/:id/operators/:operatorId/chat', smeController.initiateOperatorChat);
router.get('/chats/live/:chatId', smeController.getInternalChatRoom);
router.post('/chats/live/:chatId/close', smeController.closeInternalChat);

module.exports = router;
