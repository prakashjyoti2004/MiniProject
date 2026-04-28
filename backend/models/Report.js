const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    userEmail: { type: String, required: true },
    image: { type: String, required: true },  
    diagnosis: { type: String, required: true }, 
    confidence: { type: Number, required: true },
    description: { type: String }, 
    skinType: { type: String },
    zone: { type: String },
    date: { type: Date, default: Date.now } 
});

module.exports = mongoose.model('Report', reportSchema);
