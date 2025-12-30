const mongoose = require('mongoose');

const BillSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    billType: {
        type: String,
        enum: ['quotation', 'tax-invoice', 'proforma-invoice', 'purchase-order'],
        required: true
    },
    invoiceNo: { type: String, required: true },
    invoiceDate: { type: String, required: true },
    buyerName: { type: String, required: true },
    totalAmount: { type: String, required: true },
    content: { type: Object, required: true }, // Store full scraped data
    pdfUrl: { type: String, default: null }, // Cloudinary PDF URL
    pdfPublicId: { type: String, default: null }, // Cloudinary public_id for deletion
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update updatedAt on save
BillSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Bill', BillSchema);
