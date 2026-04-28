require('dotenv').config();

async function checkModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        console.log(".env not found");
        return;
    }

    console.log("fetching data from google\n");

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        
        console.log("API is activated");
        console.log("-------------------------------------------------");
        
        data.models.forEach(model => {
            if(model.supportedGenerationMethods.includes("generateContent")) {
                console.log(`👉 ${model.name.replace('models/', '')}`);
            }
        });
        
        console.log("-------------------------------------------------");
        console.log("List of the models");

    } catch (error) {
        console.log("Error", error.message);
    }
}

checkModels();