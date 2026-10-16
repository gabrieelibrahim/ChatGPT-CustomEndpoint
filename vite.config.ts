import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { localProviderRelay } from './scripts/localProviderRelay.mjs';
import { codexAgentBridge } from './scripts/codexAgentBridge.mjs';
export default defineConfig(({command})=>({plugins:[react(),tailwindcss(),...(command==='serve'?[localProviderRelay(),codexAgentBridge()]:[])],define:{__LOCAL_PROVIDER_RELAY__:JSON.stringify(command==='serve')},build:{rollupOptions:{output:{manualChunks(id){
 // Keep the shared React runtime cached independently as SDK components expand.
 if(/[/\\]node_modules[/\\](react|react-dom|scheduler)[/\\]/.test(id))return 'react-vendor';
}}}}}));
