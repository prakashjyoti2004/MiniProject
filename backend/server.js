const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const User = require('./models/User'); 
const Report = require('./models/Report'); 

const app = express(); 
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors());

app.use(express.static(path.join(__dirname, '..', 'frontend')));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Atlas Connected Successfully!"))
  .catch((err) => console.error("❌ DB Connection Error:", err));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'login.html')));
app.get('/upload', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'upload.html')));
app.get('/history', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'history.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'chat.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'about.html')));


app.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: "This Email is already registered!" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({ name, email, password: hashedPassword });
        await user.save();
        res.status(201).json({ message: "Account Created! 🎉" });
    } catch (err) {
        res.status(500).json({ message: "Unable to Register at the moment!" });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "Wrong Email!" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Wrong Password!" });

        const token = jwt.sign({ id: user._id }, "DERMAI_SUPER_SECRET", { expiresIn: '24h' });

        res.json({ 
            message: "Login Success! 🚀", 
            token, 
            user: { name: user.name, email: user.email } 
        });
    } catch (err) {
        res.status(500).json({ message: "Unable to Login at the moment!" });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `System: You are DermAI, an empathetic and highly professional AI Dermatology Assistant. Follow these strict rules to guide your response:

                           1. Language & Tone: Answer ONLY in English. Be warm, polite, and use simple everyday language.
                           2. Strict Formatting: ALWAYS structure your response in exactly this format. YOU MUST LEAVE ONE EMPTY LINE between each section for readability:
                             
                           1 short sentence explaining what the issue might be and why it occured
                          💧 Suggested Ingredients: (Name 1 or 2 specific skincare actives like Salicylic Acid, Niacinamide, Vitamin C, Ceramides, etc. Mention if it should be a serum, cleanser, or cream.)

                          ✅ Actionable Tips:
                             * (Point 1)
                             * (Point 2)
                             * (Point 3)

⚠️ Disclaimer: Note: I am an AI, not a doctor. Please consult a dermatologist for severe issues.

3. Boundary: If the question is NOT about skin, hair, or nails, reply ONLY with: "I am a dermatology AI and can only assist with skin, hair, and nail-related queries."
 ${message}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        res.json({ reply: text });
    } catch (err) {
        console.error("Gemini Error:", err);
        res.status(500).json({ error: "Gemini Engine Fail! Check API Key." });
    }
});
app.post('/api/analyze', async (req, res) => {
    try {
        const { image, skinType, zone } = req.body;

        if (!image) {
            return res.status(400).json({ success: false, error: "No image provided" });
        }

        const base64Data = image.split(',')[1];
        const mimeType = image.split(';')[0].split(':')[1] || "image/jpeg";
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `Act as an expert AI Dermatologist and try to give  accurate result. Analyze the skin of the image.
        The user identified their skin type as: ${skinType} and the facial zone as: ${zone}.
        
        Provide the response STRICTLY as a JSON object. Do not add any markdown formatting (like \`\`\`json), bold text, or conversational text. It MUST be valid JSON:
        {
          "diagnosis": "Name of the single most likely and exact condition in simple word (e.g., Acne, Eczema, Clear Skin,Open Pores)",
          "confidence": <a number between 60 and 99>,
          "description": "Provide a brief 1-2 sentence explanation of this condition and one quick advice in simple words."
        }`;
        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType: mimeType
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const aiResponseText = await result.response.text();
        
        const cleanJsonString = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const finalData = JSON.parse(cleanJsonString);

        res.json({ success: true, data: finalData });

    } catch (err) {
        console.error("Gemini Vision Error:", err);
        res.status(500).json({ success: false, error: "Image analysis failed." });
    }
});

app.post('/api/history/save', async (req, res) => {
    try {
        const { userEmail, image, diagnosis, confidence, description, skinType, zone } = req.body;

        if (!userEmail) {
            return res.status(400).json({ success: false, message: "User not logged in properly." });
        }
        const newReport = new Report({
            userEmail,
            image,
            diagnosis,
            confidence,
            description,
            skinType,
            zone
        });

        await newReport.save();
        res.status(201).json({ success: true, message: "Report saved to cloud successfully!" });

    } catch (err) {
        console.error("Save History Error:", err);
        res.status(500).json({ success: false, message: "Failed to save report." });
    }
});

app.get('/api/history/:email', async (req, res) => {
    try {
        const userEmail = req.params.email;
        

        const userHistory = await Report.find({ userEmail: userEmail }).sort({ date: -1 });
        
        res.json({ success: true, data: userHistory });
    } catch (err) {
        console.error("Fetch History Error:", err);
        res.status(500).json({ success: false, message: "Failed to fetch history." });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 DermAI is Running At: http://localhost:${PORT}`);
});