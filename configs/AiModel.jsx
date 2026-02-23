const {
    GoogleGenerativeAI,
} = require("@google/generative-ai");

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// Using the smarter model for coding
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
});

const generationConfig = {
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
};

const CodeGenerationConfig = {
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
};

const EnhancePromptConfig = {
    temperature: 0.7,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 1000,
    responseMimeType: "application/json",
};

export const chatSession = model.startChat({
    generationConfig,
    history: [],
});

export const GenAiCode = model.startChat({
    generationConfig: CodeGenerationConfig,
    history: [
        {
            role: "user",
            parts: [
              {
                text: `You are an expert React and Tailwind developer. Generate a complete, fully functional programming code structure for a React project using Vite based exactly on the user's prompt.
    
    CRITICAL CODING RULES (MUST FOLLOW TO PREVENT CRASHES):
    1. NEVER declare the same component, function, or variable twice in the same file.
    2. Write completely valid, error-free React JavaScript code.
    3. Ensure all imports are correctly placed at the top of the file.
    4. Do not create an App.jsx file. There is an App.js file in the project structure, rewrite it to act as the main entry point containing the components requested.
    5. DO NOT just generate "Hello World". You MUST dynamically generate the FULL, complex, and complete code requested by the user, creating multiple components if necessary.
    
    Return the response strictly in JSON format matching this schema structure. The 'code' fields must contain the ACTUAL, complete React code for the application:
    {
      "projectTitle": "Title based on user prompt",
      "explanation": "Explanation of what was built",
      "files": {
        "/App.js": {
          "code": "// INSERT FULL, WORKING REACT CODE HERE TO RENDER THE APP"
        },
        "/components/ExampleComponent.js": {
          "code": "// INSERT FULL, WORKING REACT CODE HERE"
        }
      },
      "generatedFiles": ["/App.js", "/components/ExampleComponent.js"]
    }
    
    Additional Instructions:
    - Create separate files in a /components folder for different parts of the UI.
    - For placeholder images, use https://archive.org/download/
    - Add Emoji icons whenever needed to give a good user experience.
    - The lucide-react library is available to be imported IF NECESSARY.`
              },
            ],
          },
          {
            role: "model",
            parts: [
              {text: "```json\n{\n  \"projectTitle\": \"Understood\",\n  \"explanation\": \"I understand the instructions perfectly. I will dynamically generate the full, complex React code across multiple files based on the user's exact prompt. I will strictly adhere to the syntax rules, ensuring valid imports, and I will absolutely NEVER duplicate component or variable declarations within the same file.\",\n  \"files\": {\n    \"/App.js\": {\n      \"code\": \"import React from 'react';\\n\\nexport default function App() {\\n  return (\\n    <div className=\\\"min-h-screen bg-gray-50 flex items-center justify-center\\\">\\n      <p>App will be dynamically generated here based on user prompt.</p>\\n    </div>\\n  );\\n}\"\n    }\n  },\n  \"generatedFiles\": [\n    \"/App.js\"\n  ]\n}\n```\n"},
            ],
          },
    ],
});

export const enhancePromptSession = model.startChat({
    generationConfig: EnhancePromptConfig,
    history: [],
});