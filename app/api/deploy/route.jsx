export const runtime = 'edge';

export async function POST(req) {
  try {
    const { files, projectTitle } = await req.json();

    if (!files) {
      return new Response(JSON.stringify({ error: "No files provided" }), { status: 400 });
    }

    // 1. EXTRACTION: Safely pull out any custom dependencies
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

    // 2. Format the AI files safely
    let vercelFiles = Object.keys(files).map((filePath) => {
      const cleanPath = filePath.replace(/^\//, '');
      let fileContent = "";
      if (typeof files[filePath] === 'string') {
          fileContent = files[filePath];
      } else if (files[filePath] && typeof files[filePath] === 'object') {
          fileContent = files[filePath].code || JSON.stringify(files[filePath], null, 2);
      }
      return { file: cleanPath, data: fileContent };
    });

    // 3. Delete core config files
    const coreFilesToOverride = [
        'package.json', 'vite.config.js', 'index.html', 'index.js', 
        'index.jsx', 'main.jsx', 'main.js', 'tailwind.config.js', 'postcss.config.js'
    ];
    vercelFiles = vercelFiles.filter(f => !coreFilesToOverride.includes(f.file));

    // 4. THE CSS BLACK HOLE: Merge all CSS into one perfect file
    let masterCssContent = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n`;
    
    vercelFiles.forEach(f => {
        if (f.file.endsWith('.css')) {
            // Remove redundant tailwind tags so we don't duplicate them
            let cleanCss = f.data.replace(/@tailwind (base|components|utilities);/g, '');
            
            // Append to our master file
            masterCssContent += `\n/* --- CSS from ${f.file} --- */\n${cleanCss}\n`;
            
            // Empty the original file so Vite doesn't crash, but imports still resolve!
            f.data = `/* Content securely moved to master-tailwind.css */`;
        }
    });

    // Add our bulletproof master CSS
    vercelFiles.push({
        file: 'master-tailwind.css',
        data: masterCssContent
    });

    // 5. TAILWIND CONFIG: Fixed the scanning warning to make builds ultra-fast
    vercelFiles.push({
        file: 'tailwind.config.js',
        data: `/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}", "./*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
}`
    });

    vercelFiles.push({
        file: 'postcss.config.js',
        data: `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }`
    });

    // 6. ESBUILD HACK: Forces Vite to accept JSX inside .js files
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

    // 7. SMART MERGE: Package.json
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

    // 8. index.html
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

    // 9. SMART APP LOADER: Automatically mounts the Master CSS
    let appImportPath = './App';
    if (vercelFiles.some(f => f.file === 'src/App.js' || f.file === 'src/App.jsx')) {
        appImportPath = './src/App';
    }

    vercelFiles.push({
        file: 'index.jsx',
        data: `import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '${appImportPath}';

// Our master file guarantees Tailwind works everywhere!
import './master-tailwind.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
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
        projectSettings: { framework: "vite" },
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
      deploymentId: data.id 
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("Deployment Route Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}