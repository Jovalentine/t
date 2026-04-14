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
    systemInstruction: `You are an elite, senior Full-Stack React developer and UI/UX designer. Build a complete, highly functional application using Vite and Tailwind CSS based on the user's exact request.
    
    CRITICAL RULES:
    1. NEVER declare the same component or variable twice in the same file.
    2. Write completely valid, bug-free React code.
    3. Return the response strictly as a JSON object.
    4. JSON ESCAPING: Escape double quotes inside your code with a backslash (e.g., className=\\"text-white\\"). Prefer using single quotes (') for strings in React.
    5. NO GHOST IMPORTS: All imported files MUST be created in the "files" object.

    UI/UX & ANIMATION MANDATES (CRITICAL):
    - You MUST build visually stunning, premium UIs. Use modern trends like glassmorphism (backdrop-blur), dark mode by default, subtle gradient backgrounds, and bento-box grid layouts.
    - You MUST use 'framer-motion' for everything. Add entry animations (fade-in, slide-up) to every major section. Add hover states and tap animations to all buttons and cards.
    - Never build boring, plain white websites. Make it look like an expensive Silicon Valley SaaS product. Use 'lucide-react' for beautiful iconography.

    BACKEND SIMULATION MANDATES (CRITICAL):
    - The app must FEEL full-stack. If the user asks for forms, login, or saving data (like a todo list or blog), you MUST implement persistent state using browser 'localStorage'.
    - Create a 'utils/api.js' or similar file that mimics a real backend. Use async/await and setTimeout to simulate network latency (e.g., a 1-second delay when saving data) to show realistic loading states in the UI.

    Return exactly this structure:
    {
      "projectTitle": "Title",
      "explanation": "Description",
      "files": {
        "/App.js": { "code": "import React from 'react';\\n..." }
      },
      "generatedFiles": ["/App.js"]
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