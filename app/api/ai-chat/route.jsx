import { chatModel, defaultGenerationConfig } from "@/configs/AiModel";

export async function POST(req) {
    try {
        const { prompt } = await req.json();

        if (!prompt) {
            return new Response(JSON.stringify({error: 'Prompt is required'}), {status: 400});
        }

        // CREATE A FRESH SESSION FOR EVERY REQUEST
        const chatSession = chatModel.startChat({
            generationConfig: { ...defaultGenerationConfig, responseMimeType: "text/plain" },
            history: [],
        });

        const result = await chatSession.sendMessageStream(prompt);
        
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    let fullText = '';
                    for await (const chunk of result.stream) {
                        const chunkText = chunk.text();
                        fullText += chunkText;
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({chunk: chunkText})}\n\n`));
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({result: fullText, done: true})}\n\n`));
                    controller.close();
                } catch (e) {
                    console.error("Stream error in ai-chat:", e);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({error: 'Chat stream failed', done: true})}\n\n`));
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
    } catch(e) {
        console.error("API Route Error in ai-chat:", e);
        return new Response(JSON.stringify({error: e.message || 'AI chat failed'}), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}