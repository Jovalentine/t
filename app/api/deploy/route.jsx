export const runtime = 'edge';

export async function POST(req) {
  try {
    const { files, projectTitle } = await req.json();

    if (!files) {
      return new Response(JSON.stringify({ error: "No files provided" }), { status: 400 });
    }

    // 1. Safely extract AI dependencies
    let aiDependencies = {};
    const aiPkgFile = files['package.json'] || files['/package.json'];
    if (aiPkgFile) {
        try {
            const content = typeof aiPkgFile === 'string' ? aiPkgFile : (aiPkgFile.code || JSON.stringify(aiPkgFile));
            const parsed = JSON.parse(content);
            if (parsed.dependencies) {
                aiDependencies = parsed.dependencies;
            }
        } catch (e) {}
    }

    // 2. Format AI files & Aggressively rename .js to .jsx
    let vercelFiles = Object.keys(files).map((filePath) => {
      let cleanPath = filePath.replace(/^\//, '');
      let fileContent = "";
      
      if (typeof files[filePath] === 'string') {
          fileContent = files[filePath];
      } else if (files[filePath] && typeof files[filePath] === 'object') {
          fileContent = files[filePath].code || JSON.stringify(files[filePath], null, 2);
      }

      // Force JSX extension for any file containing React code
      if (cleanPath.endsWith('.js') && (fileContent.includes('from "react"') || fileContent.includes("from 'react'") || fileContent.includes('</') || fileContent.includes('/>'))) {
          cleanPath = cleanPath.replace(/\.js$/, '.jsx');
      }

      // Fix internal imports inside the files
      fileContent = fileContent.replace(/\.js(['"])/g, '.jsx$1');

      return { file: cleanPath, data: fileContent };
    });

    // 3. Delete core config files so we can overwrite them safely
    const coreFilesToOverride = [
        'package.json', 'vite.config.js', 'index.html', 'index.js', 
        'index.jsx', 'main.jsx', 'main.js', 'tailwind.config.js', 'postcss.config.js', 'vercel.json'
    ];
    vercelFiles = vercelFiles.filter(f => !coreFilesToOverride.includes(f.file));

    // 4. THE CSS BLACK HOLE: Merge all CSS into one perfect file
    let masterCssContent = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n`;
    vercelFiles.forEach(f => {
        if (f.file.endsWith('.css')) {
            let cleanCss = f.data.replace(/@tailwind (base|components|utilities);/g, '');
            masterCssContent += `\n/* --- CSS from ${f.file} --- */\n${cleanCss}\n`;
            f.data = `/* Content securely moved to master-tailwind.css */`;
        }
    });
    vercelFiles.push({ file: 'master-tailwind.css', data: masterCssContent });

    // 5. Tailwind & PostCSS Config
    vercelFiles.push({
        file: 'tailwind.config.js',
        data: `/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}", "./*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./pages/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
}`
    });
    vercelFiles.push({
        file: 'postcss.config.js',
        data: `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }`
    });

    // 6. VITE CONFIG WITH ESBUILD HACK
    // This forces Vite to accept JSX inside .js files just in case the AI messes up
    vercelFiles.push({
        file: 'vite.config.js',
        data: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  esbuild: { loader: 'jsx', include: /.*\\.jsx?$/, exclude: [] },
  optimizeDeps: { esbuildOptions: { loader: { '.js': 'jsx' } } }
});`
    });

    // 7. Vercel SPA Routing (Fixes 404s when refreshing pages)
    vercelFiles.push({
        file: 'vercel.json',
        data: JSON.stringify({
            "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
        }, null, 2)
    });

    // 8. SMART MERGE: Package.json
    vercelFiles.push({
        file: 'package.json',
        data: JSON.stringify({
            name: "ai-generated-app",
            private: true,
            version: "0.0.0",
            type: "module",
            scripts: { "dev": "vite", "build": "vite build", "preview": "vite preview" },
            dependencies: {
                ...aiDependencies,
                "react": "^18.2.0",
                "react-dom": "^18.2.0",
                "lucide-react": "latest", 
                "framer-motion": "^10.0.0",
                "react-router-dom": "^6.0.0",
            },
            devDependencies: {
                "vite": "^5.0.0",
                "@vitejs/plugin-react": "^4.2.1",
                "tailwindcss": "^3.4.1",
                "postcss": "^8.4.35",
                "autoprefixer": "^10.4.17",
                "tailwind-merge": "^2.2.1",
                "clsx": "^2.1.0"
            }
        }, null, 2)
    });

    // 9. Root HTML
    vercelFiles.push({
        file: 'index.html',
        data: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectTitle || 'AI Generated App'}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/index.jsx"></script>
  </body>
</html>`
    });

    // 10. React Entry Point (FIXED: Removed Double BrowserRouter)
    let appImportPath = './App';
    if (vercelFiles.some(f => f.file === 'src/App.jsx' || f.file === 'src/App.js')) {
        appImportPath = './src/App';
    }
    vercelFiles.push({
        file: 'index.jsx',
        data: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '${appImportPath}';
import './master-tailwind.css';

// We removed the <BrowserRouter> wrapper here because the AI 
// already adds it inside App.js!
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
    });

    // --- Execute Vercel API Call ---
    const VERCEL_TOKEN = process.env.VERCEL_API_TOKEN;

    if (!VERCEL_TOKEN) {
        return new Response(JSON.stringify({ error: "Vercel API token is missing in .env.local" }), { status: 500 });
    }

    const response = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectTitle ? projectTitle.toLowerCase().replace(/[^a-z0-9-]/g, '-') : "ai-generated-site",
        files: vercelFiles,
        // 🔥 CRITICAL FIX: Explicitly forcing Vercel to install, build, and serve the output directory!
        projectSettings: { 
            framework: "vite",
            buildCommand: "npm run build",
            installCommand: "npm install",
            outputDirectory: "dist"
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Vercel API Error:", data);
      return new Response(JSON.stringify({ error: data.error?.message || "Deployment failed" }), { status: response.status });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      url: `https://${data.url}`,
      inspectorUrl: data.inspectorUrl,
      deploymentId: data.id 
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("Deployment Route Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}