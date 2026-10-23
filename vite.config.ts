import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { localMcpRelay } from './scripts/localMcpRelay.mjs';
import { localMcpOAuthRelay } from './scripts/localMcpOAuthRelay.mjs';
import { localProviderRelay } from './scripts/localProviderRelay.mjs';
import { codexAgentBridge } from './scripts/codexAgentBridge.mjs';
import { sdkBridge } from './scripts/sdkBridge.mjs';
export default defineConfig(({command,mode})=>({plugins:[react(),tailwindcss(),...(command==='serve'?[localProviderRelay(),localMcpRelay(),localMcpOAuthRelay(),codexAgentBridge(),sdkBridge()]:[])],define:{__LOCAL_PROVIDER_RELAY__:JSON.stringify(command==='serve'),__GOOGLE_OAUTH_CLIENT_ID__:JSON.stringify(loadEnv(mode,process.cwd(),'VITE_').VITE_GOOGLE_OAUTH_CLIENT_ID||'')},build:{rollupOptions:{output:{manualChunks(id){
 // Keep the shared React runtime cached independently as SDK components expand.
 if(/[/\\]node_modules[/\\](react|react-dom|scheduler)[/\\]/.test(id))return 'react-vendor';
 if(/[/\\]node_modules[/\\](katex|rehype-katex|remark-math|micromark-extension-math|mdast-util-math)[/\\]/.test(id))return 'rich-math';
}}}}}));
