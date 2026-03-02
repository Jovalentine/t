import { codeModel, defaultGenerationConfig } from '@/configs/AiModel';

export async function POST(req) {
    try {
        const { prompt } = await req.json();

        // ADDED RULE 10: Ban Ghost Imports
        const bulletproofPrompt = prompt + `
        
        CRITICAL CODING RULES YOU MUST FOLLOW FOR THIS REQUEST:
        1. NEVER declare the same component, function, or variable twice in the same file.
        2. Write completely valid, bug-free React code.
        3. DO NOT output placeholder text like "Hello World". You MUST dynamically write the ACTUAL, FULL complex application code requested.
        4. Provide the main entry point in "/App.js".
        5. If your code requires routing, wrap the main component in <BrowserRouter> inside App.js.
        6. Return the response strictly as a JSON object.
        7. ESCAPE BACKSLASHES: You must properly escape ALL special characters. Use \\\\ for backslashes!
        8. AVOID COMPLEX REGEX: Do not use complex Regex for form validation (like \\w patterns). Use simple string checks instead.
        9. KEEP MOCK DATA MINIMAL: You MUST limit all mock data arrays to a MAXIMUM of 2 items.
        10. NO GHOST IMPORTS: If you import a component or page, you ABSOLUTELY MUST create that exact file in the "files" object.
        11. WORKING IMAGES ONLY: NEVER use local image paths (like './images/profile.png') because those files do not exist. You MUST use fully qualified, working external URLs. For general photos, use 'https://picsum.photos/seed/{random_word}/800/600'. For profile pictures or avatars, use 'https://api.dicebear.com/7.x/avataaars/svg?seed={name}'.

        Return exactly this structure:
        {
          "projectTitle": "Dynamic Title",
          "explanation": "Explanation of the code",
          "files": {
            "/App.js": { "code": "import React from 'react';\\n// FULL COMPLEX CODE HERE..." }
          },
          "generatedFiles": ["/App.js"]
        }`;

        const GenAiCode = codeModel.startChat({
            generationConfig: {
                ...defaultGenerationConfig,
                responseMimeType: "application/json"
            },
            history: [],
        });

        const result = await GenAiCode.sendMessageStream(bulletproofPrompt);
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    let fullText = '';
                    for await (const chunk of result.stream) {
                        const chunkText = chunk.text();
                        fullText += chunkText;
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`));
                    }

                    try {
                        let cleanedText = fullText.replace(/```json\n?/gi, '').replace(/```/g, '').trim();
                        cleanedText = cleanedText.replace(/[\u0000-\u001F]+/g, "");
                        cleanedText = cleanedText.replace(/\\([^"\\/bfnrtu])/g, '\\\\$1');

                        const parsedData = JSON.parse(cleanedText);

                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ final: parsedData, done: true })}\n\n`));
                    } catch (parseError) {
                        console.error("JSON Parsing Error:", parseError);
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Invalid JSON response from AI.", done: true })}\n\n`));
                    }
                    controller.close();
                } catch (e) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: e.message, done: true })}\n\n`));
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}