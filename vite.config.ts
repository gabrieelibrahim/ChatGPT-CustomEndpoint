import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { localProviderRelay } from './scripts/localProviderRelay.mjs';
export default defineConfig(({command})=>({plugins:[react(),tailwindcss(),...(command==='serve'?[localProviderRelay()]:[])],define:{__LOCAL_PROVIDER_RELAY__:JSON.stringify(command==='serve')}}));
