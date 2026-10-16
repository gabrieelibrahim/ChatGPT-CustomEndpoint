import { UIIcon as I } from '../components/UIIcon';

export function SakelarRecommendation() {
  return <section className="d-sakelar-recommendation" aria-label="Rekomendasi token Sakelar">
    <div className="d-sakelar-heading"><span>S</span><div><small>REKOMENDASI</small><h3>Sakelar AI</h3></div></div>
    <p>Belum punya token? Lihat pilihan token di Sakelar AI.</p>
    <a href="https://sakelar.web.id" target="_blank" rel="noopener noreferrer">Beli token di Sakelar <I name="expand" size={16}/></a>
    <small>Kamu tetap bebas memakai endpoint penyedia lain.</small>
  </section>;
}
