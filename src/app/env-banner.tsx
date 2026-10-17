// A loud strip on test deployments (Vercel "preview"), so nobody mistakes them for the real site.
export default function EnvBanner() {
  if (process.env.NEXT_PUBLIC_VERCEL_ENV !== "preview") return null;
  return (
    <div role="note" className="fixed inset-x-0 top-0 z-[100] bg-warn py-1 text-center text-xs font-bold text-black">
      AMBIENTE DE PRUEBAS · no es creadsia.com · los pagos y datos aquí no son reales
    </div>
  );
}
