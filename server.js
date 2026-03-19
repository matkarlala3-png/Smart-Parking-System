const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const path = require('path');

dotenv.config();
const connectDB = require('./config/db');

const Booking = require('./models/Booking');
const Admin = require('./models/Admin');
const FastagUser = require('./models/FastagUser');
const Feedback = require('./models/Feedback');

connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const seedData = async () => {
    try {
        const adminCount = await Admin.countDocuments();
        if (adminCount === 0) {
            const admin = new Admin({ username: 'admin', password: 'adminpassword' });
            await admin.save();
        }

        const fastagCount = await FastagUser.countDocuments();
        if (fastagCount === 0) {
            await new FastagUser({
                fastagId: 'FT12345XYZ',
                balance: 500,
                name: 'Mukesh Kumar (FASTag)',
                vehicleNumber: 'MH-12-FT-4321'
            }).save();
        }

        const demoNames = ['Mukesh Kumar', 'Anita Singh', 'Arjun Sharma', 'Rahul Verma', 'Sneha Patil', 'Amol Shinde', 'Vikas Gupta', 'Pooja Reddy', 'Rohan Das', 'Kiran Shah'];
        for (let i = 0; i < 10; i++) {
            const slotNum = [1, 5, 12, 18, 22, 30, 35, 42, 48, 2][i];
            const exists = await Booking.findOne({ slotNumber: slotNum, status: 'Booked' });
            if (!exists) {
                await new Booking({
                    name: demoNames[i],
                    vehicleNumber: `MH-0${i + 1}-XY-${1000 + i}`,
                    phone: `987654321${i}`,
                    slotNumber: slotNum,
                    duration: 2,
                    amount: 400,
                    bookingType: i % 2 === 0 ? 'instant' : 'pre',
                    status: 'Booked'
                }).save();
            }
        }
    } catch (err) {
        console.error('Seed error:', err);
    }
};
seedData();

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
});

app.get('/api/bookings', async (req, res) => {
    try {
        const bookings = await Booking.find({ status: 'Booked' });
        res.json({ success: true, bookings });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

app.post('/api/bookings', async (req, res) => {
    const { name, vehicleNumber, phone, slotNumber, duration, amount, bookingType } = req.body;
    try {
        const existing = await Booking.findOne({ slotNumber, status: 'Booked' });
        if (existing) return res.status(400).json({ success: false, message: 'Slot occupied' });

        const newBooking = new Booking({ name, vehicleNumber, phone, slotNumber, duration, amount, bookingType });
        await newBooking.save();

        io.emit('slot_updated', { type: 'booked', booking: newBooking });
        res.status(201).json({ success: true, booking: newBooking });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

const protectAdmin = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ success: false, message: 'No auth' });
    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        req.admin = decoded.admin;
        next();
    } catch (err) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

app.put('/api/bookings/:id/release', protectAdmin, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: 'Not found' });
        booking.status = 'Released';
        await booking.save();
        io.emit('slot_updated', { type: 'released', slotNumber: booking.slotNumber });
        res.json({ success: true, message: 'Released' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

app.delete('/api/bookings/:id', protectAdmin, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: 'Not found' });
        booking.status = 'Released';
        await booking.save();
        io.emit('slot_updated', { type: 'released', slotNumber: booking.slotNumber });
        res.json({ success: true, message: 'Released (soft delete)' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await Admin.findOne({ username });
        if (!admin || !(await admin.matchPassword(password))) {
            return res.status(400).json({ success: false, message: 'Invalid Credentials' });
        }
        const token = jwt.sign({ admin: { id: admin.id } }, process.env.JWT_SECRET, { expiresIn: '10h' });
        res.json({ success: true, token });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/fastag/user', async (req, res) => {
    try {
        const user = await FastagUser.findOne({ fastagId: 'FT12345XYZ' });
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

app.post('/api/fastag/simulate-entry', async (req, res) => {
    try {
        const user = await FastagUser.findOne({ fastagId: 'FT12345XYZ' });
        let autoRefilled = false;
        if (user.balance < 50) {
            user.balance += 1000;
            autoRefilled = true;
        }

        const active = await Booking.findOne({ fastagId: 'FT12345XYZ', status: 'Booked' });
        if (active) return res.status(400).json({ success: false, message: 'Already inside' });

        const booked = await Booking.find({ status: 'Booked' }).select('slotNumber');
        const bookedSet = new Set(booked.map(s => s.slotNumber));
        let target = -1;
        for (let i = 1; i <= 50; i++) if (!bookedSet.has(i)) { target = i; break; }
        if (target === -1) return res.status(400).json({ success: false, message: 'Full' });

        user.balance -= 50;
        await user.save();

        const b = new Booking({
            name: user.name, vehicleNumber: user.vehicleNumber, phone: 'N/A (FASTag)',
            slotNumber: target, duration: 1, amount: 50,
            bookingType: 'FASTag', isFastag: true, fastagId: user.fastagId
        });
        await b.save();

        io.emit('slot_updated', { type: 'booked', booking: b });
        res.json({ 
            success: true, 
            message: autoRefilled ? 'Auto-Refill (₹1000) - Entry Success' : 'FASTag Entry Success',
            booking: b, balance: user.balance 
        });
    } catch (err) { res.status(500).json({ success: false, message: 'Server Error' }); }
});

app.post('/api/fastag/simulate-exit', async (req, res) => {
    try {
        const active = await Booking.findOne({ fastagId: 'FT12345XYZ', status: 'Booked' });
        if (!active) return res.status(404).json({ success: false, message: 'Not inside' });
        const user = await FastagUser.findOne({ fastagId: 'FT12345XYZ' });
        user.balance -= 50;
        await user.save();
        active.status = 'Released';
        await active.save();
        io.emit('slot_updated', { type: 'released', slotNumber: active.slotNumber });
        res.json({ success: true, message: 'Exit Success', balance: user.balance });
    } catch (err) { res.status(500).json({ success: false, message: 'Server Error' }); }
});

app.post('/api/feedback', async (req, res) => {
    try {
        const { name, phone, feedback } = req.body;
        await new Feedback({ name, phone, feedback }).save();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/api/feedback', async (req, res) => {
    try {
        const feedbacks = await Feedback.find().sort({ createdAt: -1 });
        res.json({ success: true, feedbacks });
    } catch (e) { res.status(500).json({ success: false }); }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server on port ${PORT}`));
