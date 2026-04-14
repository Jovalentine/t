"use client"
import { MessagesContext } from '@/context/MessagesContext';
import { api } from '@/convex/_generated/api';
import Lookup from '@/data/Lookup';
import Prompt from '@/data/Prompt';
import { useConvex, useMutation } from 'convex/react';
import JSZip from 'jszip';
import { Download, Loader2Icon, Rocket } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useCallback, useContext, useEffect, useState } from 'react';

const SandpackProvider = dynamic(() => import("@codesandbox/sandpack-react").then(mod => mod.SandpackProvider), { ssr: false });
const SandpackLayout = dynamic(() => import("@codesandbox/sandpack-react").then(mod => mod.SandpackLayout), { ssr: false });
const SandpackCodeEditor = dynamic(() => import("@codesandbox/sandpack-react").then(mod => mod.SandpackCodeEditor), { ssr: false });
const SandpackPreview = dynamic(() => import("@codesandbox/sandpack-react").then(mod => mod.SandpackPreview), { ssr: false });
const SandpackFileExplorer = dynamic(() => import("@codesandbox/sandpack-react").then(mod => mod.SandpackFileExplorer), { ssr: false });

function CodeView() {
    const { id } = useParams();
    const [activeTab, setActiveTab] = useState('code');
    const [files, setFiles] = useState(Lookup?.DEFAULT_FILE);
    const { messages } = useContext(MessagesContext);
    const UpdateFiles = useMutation(api.workspace.UpdateFiles);
    const convex = useConvex();
    
    const [loading, setLoading] = useState(false);
    
    // Deployment States
    const [isDeploying, setIsDeploying] = useState(false);
    const [liveUrl, setLiveUrl] = useState(null);

    const preprocessFiles = useCallback((files) => {
        const processed = {};
        Object.entries(files).forEach(([path, content]) => {
            if (typeof content === 'string') {
                processed[path] = { code: content };
            } else if (content && typeof content === 'object') {
                if (!content.code && typeof content === 'object') {
                    processed[path] = { code: JSON.stringify(content, null, 2) };
                } else {
                    processed[path] = content;
                }
            }
        });
        return processed;
    }, []);

    const GetFiles = useCallback(async () => {
        const result = await convex.query(api.workspace.GetWorkspace, {
            workspaceId: id
        });
        const processedFiles = preprocessFiles(result?.fileData || {});
        const mergedFiles = { ...Lookup.DEFAULT_FILE, ...processedFiles };
        setFiles(mergedFiles);
    }, [id, convex, preprocessFiles]);

    useEffect(() => {
        id && GetFiles();
    }, [id, GetFiles]);

    const GenerateAiCode = useCallback(async () => {
        setLoading(true);
        const PROMPT = JSON.stringify(messages) + " " + Prompt.CODE_GEN_PROMPT;
        
        try {
            const response = await fetch('/api/gen-ai-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: PROMPT }),
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let finalData = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.done && data.final) {
                                finalData = data.final;
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }

            if (finalData && finalData.files) {
                const processedAiFiles = preprocessFiles(finalData.files || {});
                const mergedFiles = { ...Lookup.DEFAULT_FILE, ...processedAiFiles };
                setFiles(mergedFiles);

                await UpdateFiles({
                    workspaceId: id,
                    files: finalData.files
                });
            }
        } catch (error) {
            console.error('Error generating AI code:', error);
        } finally {
            setLoading(false);
        }
    }, [messages, id, UpdateFiles, preprocessFiles]);

    useEffect(() => {
        if (messages?.length > 0) {
            const role = messages[messages?.length - 1].role;
            if (role === 'user') {
                GenerateAiCode();
            }
        }
    }, [messages, GenerateAiCode]);
    
    const downloadFiles = useCallback(async () => {
        try {
            const zip = new JSZip();
            Object.entries(files).forEach(([filename, content]) => {
                let fileContent;
                if (typeof content === 'string') {
                    fileContent = content;
                } else if (content && typeof content === 'object') {
                    if (content.code) {
                        fileContent = content.code;
                    } else {
                        fileContent = JSON.stringify(content, null, 2);
                    }
                }

                if (fileContent) {
                    const cleanFileName = filename.startsWith('/') ? filename.slice(1) : filename;
                    zip.file(cleanFileName, fileContent);
                }
            });

            const packageJson = {
                name: "generated-project",
                version: "1.0.0",
                private: true,
                dependencies: Lookup.DEPENDANCY,
                scripts: {
                    "dev": "vite",
                    "build": "vite build",
                    "preview": "vite preview"
                }
            };
            zip.file("package.json", JSON.stringify(packageJson, null, 2));

            const blob = await zip.generateAsync({ type: "blob" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'project-files.zip';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading files:', error);
        }
    }, [files]);

    // --- Direct Vercel Deployment Function ---
    const handleDeploy = async () => {
        setIsDeploying(true);
        try {
            const response = await fetch('/api/deploy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    files: files, 
                    projectTitle: "my-ai-generated-app" 
                }),
            });

            const data = await response.json();

            if (data.success) {
                setLiveUrl(data.url);
                // UX FIX: Alert the user about the build time
                alert("Deployment started! It will take about 1-2 minutes for Vercel to build the site. Opening build logs now...");
                
                // UX FIX: Open the inspector URL so they don't see a 404 page
                const targetUrl = data.inspectorUrl || data.url;
                window.open(targetUrl, '_blank');
            } else {
                alert("Deployment failed: " + data.error);
            }
        } catch (error) {
            console.error("Error calling deploy API:", error);
            alert("Something went wrong during deployment.");
        } finally {
            setIsDeploying(false);
        }
    };

    return (
        <div className='relative'>
            <div className='bg-[#181818] w-full p-2 border'>
                <div className='flex items-center justify-between'>
                    <div className='flex items-center flex-wrap shrink-0 bg-black p-1 justify-center w-[140px] gap-3 rounded-full'>
                        <h2 onClick={() => setActiveTab('code')}
                            className={`text-sm cursor-pointer ${activeTab == 'code' && 'text-blue-500 bg-blue-500 bg-opacity-25 p-1 px-2 rounded-full'}`}>
                            Code
                        </h2>
                        <h2 onClick={() => setActiveTab('preview')}
                            className={`text-sm cursor-pointer ${activeTab == 'preview' && 'text-blue-500 bg-blue-500 bg-opacity-25 p-1 px-2 rounded-full'}`}>
                            Preview
                        </h2>
                    </div>
                    
                    {/* Action Buttons Container */}
                    <div className="flex items-center gap-3">
                        {/* Download Button */}
                        <button
                            onClick={downloadFiles}
                            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full transition-colors duration-200"
                        >
                            <Download className="h-4 w-4" />
                            <span>Download Files</span>
                        </button>

                        {/* Deploy Button */}
                        {liveUrl ? (
                            <a 
                                href={liveUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-full transition-colors duration-200"
                            >
                                <Rocket className="h-4 w-4" />
                                <span>Live Site</span>
                            </a>
                        ) : (
                            <button
                                onClick={handleDeploy}
                                disabled={isDeploying || !files}
                                className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-full transition-colors duration-200 disabled:opacity-50"
                            >
                                {isDeploying ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                                <span>{isDeploying ? "Deploying..." : "Deploy"}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
            
            <SandpackProvider 
                files={files}
                template="react" 
                theme={'dark'}
                customSetup={{
                    dependencies: {
                        ...Lookup.DEPENDANCY
                    },
                    entry: '/index.js'
                }}
                options={{
                    externalResources: ['https://cdn.tailwindcss.com'],
                    bundlerTimeoutSecs: 120,
                    recompileMode: "immediate",
                    recompileDelay: 300
                }}
            >
                <div className="relative">
                    <SandpackLayout>
                        {activeTab == 'code' ? <>
                            <SandpackFileExplorer style={{ height: '80vh' }} />
                            <SandpackCodeEditor 
                                style={{ height: '80vh' }}
                                showTabs
                                showLineNumbers
                                showInlineErrors
                                wrapContent 
                            />
                        </> : <>
                            <SandpackPreview 
                                style={{ height: '80vh' }} 
                                showNavigator={true}
                                showOpenInCodeSandbox={false}
                                showRefreshButton={true}
                            />
                        </>}
                    </SandpackLayout>
                </div>
            </SandpackProvider>

            {loading && <div className='p-10 bg-gray-900 opacity-80 absolute top-0 rounded-lg w-full h-full flex items-center justify-center'>
                <Loader2Icon className='animate-spin h-10 w-10 text-white'/>
                <h2 className='text-white'> Generating files...</h2>
            </div>}
        </div>
    );
}

export default CodeView;