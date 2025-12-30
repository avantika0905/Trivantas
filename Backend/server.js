const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
require('dotenv').config();

const User = require('./models/User');
const Bill = require('./models/Bill');

const app = express();
const PORT = process.env.PORT || 5000;

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'trivantas-secret-key-2024';

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ============ CORS CONFIGURATION ============
// Enable CORS for all routes - MUST be before routes
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        // or any origin for development
        callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    credentials: false,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log('MongoDB Connection Error:', err));

// Auth Middleware
const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};

// ==================== AUTH ROUTES ====================

// Register Route
app.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ msg: 'Please enter all fields' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            name,
            email,
            password: hashedPassword
        });

        const savedUser = await newUser.save();

        const token = jwt.sign(
            { id: savedUser._id, name: savedUser.name, email: savedUser.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: savedUser._id,
                name: savedUser.name,
                email: savedUser.email
            }
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login Route
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ msg: 'Please enter all fields' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'User does not exist' });
        }

        let isMatch = await bcrypt.compare(password, user.password);

        // Fallback for legacy plain text passwords
        if (!isMatch && password === user.password) {
            isMatch = true;
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
            await user.save();
        }

        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user._id, name: user.name, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            },
            msg: 'Login successful'
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Verify Token Route
app.get('/verify', authMiddleware, (req, res) => {
    res.json({ user: req.user });
});

// ==================== BILL ROUTES ====================

// Save Bill Route
app.post('/api/bills', authMiddleware, async (req, res) => {
    try {
        const { billType, invoiceNo, invoiceDate, buyerName, totalAmount, content } = req.body;

        // Check for duplicate invoice number for this user
        const existingBill = await Bill.findOne({
            user: req.user.id,
            invoiceNo: invoiceNo
        });

        if (existingBill) {
            return res.status(400).json({ msg: 'Invoice number already exists. Please change the number.' });
        }

        const newBill = new Bill({
            user: req.user.id,
            billType: billType || 'tax-invoice',
            invoiceNo,
            invoiceDate,
            buyerName,
            totalAmount,
            content
        });

        const savedBill = await newBill.save();
        res.json(savedBill);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Bill Route
app.put('/api/bills/:id', authMiddleware, async (req, res) => {
    try {
        const { invoiceNo, invoiceDate, buyerName, totalAmount, content } = req.body;

        const bill = await Bill.findById(req.params.id);
        if (!bill) {
            return res.status(404).json({ msg: 'Bill not found' });
        }

        if (bill.user.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        // Check for duplicate invoice number if it's being changed
        if (invoiceNo && invoiceNo !== bill.invoiceNo) {
            const existingBill = await Bill.findOne({
                user: req.user.id,
                invoiceNo: invoiceNo
            });

            if (existingBill) {
                return res.status(400).json({ msg: 'Invoice number already exists. Please change the number.' });
            }
        }

        bill.invoiceNo = invoiceNo || bill.invoiceNo;
        bill.invoiceDate = invoiceDate || bill.invoiceDate;
        bill.buyerName = buyerName || bill.buyerName;
        bill.totalAmount = totalAmount || bill.totalAmount;
        bill.content = content || bill.content;
        bill.updatedAt = Date.now();

        const updatedBill = await bill.save();
        res.json(updatedBill);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload PDF to Cloudinary
app.post('/api/bills/:id/upload-pdf', authMiddleware, async (req, res) => {
    try {
        const { pdfBase64 } = req.body;

        const bill = await Bill.findById(req.params.id);
        if (!bill) {
            return res.status(404).json({ msg: 'Bill not found' });
        }

        if (bill.user.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        if (bill.pdfPublicId) {
            await cloudinary.uploader.destroy(bill.pdfPublicId, { resource_type: 'raw' });
        }

        const result = await cloudinary.uploader.upload(pdfBase64, {
            resource_type: 'raw',
            folder: 'trivantas-invoices',
            public_id: `${bill.invoiceNo}-${Date.now()}`,
            format: 'pdf'
        });

        bill.pdfUrl = result.secure_url;
        bill.pdfPublicId = result.public_id;
        await bill.save();

        res.json({
            msg: 'PDF uploaded successfully',
            pdfUrl: result.secure_url,
            bill
        });
    } catch (err) {
        console.error('PDF Upload Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get Bills Route (protected)
app.get('/api/bills', authMiddleware, async (req, res) => {
    try {
        const bills = await Bill.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(bills);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Bills by User ID (legacy support)
app.get('/api/bills/:userId', async (req, res) => {
    try {
        const bills = await Bill.find({ user: req.params.userId }).sort({ createdAt: -1 });
        res.json(bills);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Single Bill Route
app.get('/api/bill/:id', async (req, res) => {
    try {
        const bill = await Bill.findById(req.params.id);
        if (!bill) {
            return res.status(404).json({ msg: 'Bill not found' });
        }
        res.json(bill);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Bill Route
app.delete('/api/bills/:id', authMiddleware, async (req, res) => {
    try {
        const bill = await Bill.findById(req.params.id);
        if (!bill) {
            return res.status(404).json({ msg: 'Bill not found' });
        }

        if (bill.user.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        if (bill.pdfPublicId) {
            await cloudinary.uploader.destroy(bill.pdfPublicId, { resource_type: 'raw' });
        }

        await Bill.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Bill deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Dashboard Stats
app.get('/api/stats', authMiddleware, async (req, res) => {
    try {
        const totalBills = await Bill.countDocuments({ user: req.user.id });
        const billsByType = await Bill.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(req.user.id) } },
            { $group: { _id: '$billType', count: { $sum: 1 } } }
        ]);
        const recentBills = await Bill.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('invoiceNo buyerName totalAmount billType createdAt');

        res.json({
            totalBills,
            billsByType,
            recentBills
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
