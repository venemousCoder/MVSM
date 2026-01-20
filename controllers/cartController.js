const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Service = require('../models/Service');

// @desc    Get Cart Page
// @route   GET /cart
exports.getCart = async (req, res) => {
    try {
        let cart = await Cart.findOne({ user: req.user._id })
            .populate('items.product')
            .populate('items.service');

        if (!cart) {
            cart = { items: [], totalPrice: 0 };
        }

        res.render('cart/index', {
            title: 'My Cart',
            user: req.user,
            cart: cart
        });
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Add Item to Cart
// @route   POST /cart/add
exports.addToCart = async (req, res) => {
    try {
        const { itemId, itemType, quantity, operatorId } = req.body;
        const qty = parseInt(quantity) || 1;

        let item;
        if (itemType === 'product') {
            item = await Product.findById(itemId);
        } else if (itemType === 'service') {
            item = await Service.findById(itemId);
        }

        if (!item) {
            req.flash('error_msg', 'Item not found');
            return res.redirect('/');
        }

        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            cart = new Cart({
                user: req.user._id,
                items: []
            });
        }

        // Check if item already exists in cart (including operator check for services)
        const itemIndex = cart.items.findIndex(p => {
            if (itemType === 'product') return p.product && p.product.toString() === itemId;
            if (itemType === 'service') {
                const sameService = p.service && p.service.toString() === itemId;
                const sameOperator = (p.operator && p.operator.toString() === operatorId) || (!p.operator && !operatorId);
                return sameService && sameOperator;
            }
            return false;
        });

        if (itemIndex > -1) {
            // Update quantity
            cart.items[itemIndex].quantity += qty;
        } else {
            // Add new item
            const cartItem = {
                itemType: itemType,
                quantity: qty,
                price: item.price,
                name: item.name
            };
            
            if (itemType === 'product') {
                cartItem.product = itemId;
            } else {
                cartItem.service = itemId;
                if (operatorId) {
                    cartItem.operator = operatorId;
                }
            }
            
            cart.items.push(cartItem);
        }

        await cart.save();

        req.flash('success_msg', 'Item added to cart');
        // Redirect back to referring page or cart
        const referer = req.get('Referer');
        if (referer && referer.includes('/cart')) {
            res.redirect('/cart');
        } else {
             res.redirect(referer || '/');
        }

    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Update Cart Item Quantity
// @route   POST /cart/update
exports.updateCartItem = async (req, res) => {
    try {
        const { itemId, quantity } = req.body; // itemId here is the _id of the item inside the cart array, OR the product/service ID. 
        // Better to use the Cart Item _id if possible, but our view might send Product ID.
        // Let's assume we pass the Product/Service ID for simplicity or the array index.
        // Actually, Mongoose subdocuments have _id. Let's use the item's _id within the cart.
        
        // Wait, simplicity: Pass the product/service ID and type? Or just find the item in the array.
        // Let's use the cart item's _id passed from the view.
        
        const { cartItemId, qty } = req.body;
        const newQty = parseInt(qty);

        if (newQty < 1) {
             // If qty is 0 or less, maybe remove? Or just minimum 1. Let's enforce min 1.
             // Users should use delete button to remove.
             req.flash('error_msg', 'Quantity must be at least 1');
             return res.redirect('/cart');
        }

        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) return res.redirect('/cart');

        const item = cart.items.id(cartItemId);
        if (item) {
            item.quantity = newQty;
            await cart.save();
            req.flash('success_msg', 'Cart updated');
        }

        res.redirect('/cart');

    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Remove Item from Cart
// @route   POST /cart/remove
exports.removeFromCart = async (req, res) => {
    try {
        const { cartItemId } = req.body;

        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) return res.redirect('/cart');

        // Filter out the item
        cart.items = cart.items.filter(item => item._id.toString() !== cartItemId);

        await cart.save();
        req.flash('success_msg', 'Item removed');
        res.redirect('/cart');

    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};
