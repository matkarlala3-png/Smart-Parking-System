const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    vehicleNumber: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    slotNumber: {
        type: Number,
        required: true
    },
    duration: {
        type: Number,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    bookingType: {
        type: String,
        default: 'instant'
    },
    bookingTime: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        default: 'Booked',
        enum: ['Booked', 'Released']
    },
    isFastag: {
        type: Boolean,
        default: false
    },
    fastagId: {
        type: String,
        default: ''
    }
});

module.exports = mongoose.model('Booking', BookingSchema);
