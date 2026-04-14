import { codeModel, defaultGenerationConfig } from '@/configs/AiModel';

export async function POST(req) {
    try {
        const { prompt } = await req.json();

        const bulletproofPrompt = prompt + `
        
        CRITICAL CODING RULES YOU MUST FOLLOW FOR THIS REQUEST:
        1. NEVER declare the same component, function, or variable twice in the same file.
        2. Write completely valid, bug-free React code.
        3. DO NOT output placeholder text like "Hello World". You MUST dynamically write the ACTUAL, FULL complex application code requested.
        4. Provide the main entry point in "/App.js".
        5. If your code requires routing, wrap the main component in <BrowserRouter> inside App.js.
        6. Return the response strictly as a JSON object.
        7. QUOTES & APOSTROPHES (CRITICAL): Escape all double quotes inside your code (e.g., className=\\"text-white\\"). Prefer using single quotes (') for JSX attributes. HOWEVER, if a text string contains an apostrophe (like "ocean's" or "let's"), you MUST wrap that string in backticks (\`) or escaped double quotes (\\") to prevent JavaScript syntax errors!
        8. NO REGEX: Do not use Regular Expressions (Regex) for form validation. Use simple string checks (like .includes) to avoid backslash parsing errors.
        9. KEEP MOCK DATA MINIMAL: You MUST limit all mock data arrays to a MAXIMUM of 2 items.
        10. NO GHOST IMPORTS: If you import a component, you ABSOLUTELY MUST create that exact file in the "files" object.
        11. WORKING IMAGES ONLY: Use 'https://picsum.photos/seed/{random}/800/600' for general photos.
        12. CONCISE CODE: Keep all text paragraphs, descriptions, and hero subtitles strictly under 2 sentences to avoid JSON truncation. Use 'lucide-react' for icons instead of inline SVGs.
        13. EXTREME BREVITY: You MUST keep your total code output under 500 lines across all files combined. Use simple Tailwind classes and only build the essential UI components requested.

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

        // THE FIX: We use sendMessage() instead of sendMessageStream() to bypass the SDK parsing bug!
        const result = await GenAiCode.sendMessage(bulletproofPrompt);
        const fullText = result.response.text();

        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            start(controller) {
                try {
                    // Send the complete text payload to the frontend all at once
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: fullText })}\n\n`));

                    let cleanedText = fullText.replace(/```json\n?/gi, '').replace(/```/g, '').trim();
                    const parsedData = JSON.parse(cleanedText);
                    
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ final: parsedData, done: true })}\n\n`));
                    controller.close();
                } catch (parseError) {
                    console.error("JSON Parsing Error:", parseError);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "JSON Error: The AI failed to format the code properly. Please click Generate again.", done: true })}\n\n`));
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (e) {
        console.error("API Route Error:", e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}