const COMMIT = (import.meta.env.VITE_COMMIT as string | undefined)?.slice(0, 7) ?? 'dev';

export function App() {
  return (
    <main className="hello">
      <h1>KalitateLab</h1>
      <p lang="eu">Kaixo! Kalitate-kontrol estatistikoko eta prozesu-gaitasuneko ariketak entrenatzeko aplikazioa (garapenean).</p>
      <p lang="es">¡Hola! Aplicación para entrenar ejercicios de control estadístico de calidad y capacidad de proceso (en desarrollo).</p>
      <p className="meta">v0.0.0 · {COMMIT}</p>
    </main>
  );
}
