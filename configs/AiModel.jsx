const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

export const defaultGenerationConfig = {
    temperature: 0.7, 
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
};

// 1. CHAT MODEL - Using the new high-quota 2.5-flash-lite model
export const chatModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    systemInstruction: "You are an expert React developer assistant. Help the user build their website by answering questions, suggesting ideas, and confirming their requests. Do NOT output raw JSON code schemas. Keep responses conversational and formatted in Markdown."
});

// 2. CODE MODEL - Using the new high-quota 2.5-flash-lite model
export const codeModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    systemInstruction: `You are an expert React developer. Build a complete, functional React application using Vite and Tailwind CSS based on the user's exact request.
    
    CRITICAL RULES:
    1. NEVER declare the same component or variable twice in the same file.
    2. Write completely valid, bug-free React code.
    3. Do NOT output placeholder text like "Hello World". You MUST write the actual, FULL application code requested by the user.
    4. Provide the main entry point in "/App.js".
    5. If your code requires routing, wrap the main component in <BrowserRouter> inside App.js.
    6. Return the response strictly as a JSON object with this exact structure:
    {
      "projectTitle": "Dynamic Title",
      "explanation": "Explanation of the code",
      "files": {
        "/App.js": { "code": "import React from 'react';\\n// FULL COMPLEX CODE HERE..." },
        "/components/CustomComponent.js": { "code": "// FULL COMPLEX CODE HERE..." }
      },
      "generatedFiles": ["/App.js", "/components/CustomComponent.js"]
    }`
});

// 3. LEGACY EXPORTS (Keeps Next.js from crashing if any old files try to import them)
export const chatSession = chatModel.startChat({
    generationConfig: { ...defaultGenerationConfig, responseMimeType: "text/plain" },
    history: [],
});

export const enhancePromptSession = chatModel.startChat({
    generationConfig: { ...defaultGenerationConfig, responseMimeType: "text/plain" },
    history: [],
});