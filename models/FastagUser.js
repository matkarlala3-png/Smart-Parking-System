const mongoose = require('mongoose');

const FastagUserSchema = new mongoose.Schema({
    fastagId: {
        type: String,
        default: 'FT12345XYZ'
    },
    balance: {
        type: Number,
        default: 500
    },
    name: {
        type: String,
        default: 'Fastag User'
    },
    vehicleNumber: {
        type: String,
        default: 'MH-12-FT-4321'
    }
});

module.exports = mongoose.model('FastagUser', FastagUserSchema);
