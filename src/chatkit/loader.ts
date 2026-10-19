let loading: Promise<void> | null = null;
export function loadChatKit() {
  if (customElements.get('openai-chatkit')) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.platform.openai.com/deployments/chatkit/chatkit.js';
    script.async = true; script.crossOrigin = 'anonymous'; script.referrerPolicy = 'no-referrer';
    const timer = window.setTimeout(() => { script.remove(); reject(Error('ChatKit belum berhasil dimuat dari CDN OpenAI. Periksa jaringan lalu coba lagi.')); }, 20000);
    script.onload = () => { window.clearTimeout(timer); if (!customElements.get('openai-chatkit')) { reject(Error('Komponen ChatKit tidak tersedia.')); return; } resolve(); };
    script.onerror = () => { window.clearTimeout(timer); script.remove(); reject(Error('CDN ChatKit tidak dapat dihubungi.')); };
    document.head.appendChild(script);
  }).catch(error => { loading = null; throw error; });
  return loading;
}
