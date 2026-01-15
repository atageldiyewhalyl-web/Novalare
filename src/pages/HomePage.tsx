import { SEO } from "../components/SEO";
import { ShaderBackground } from "../components/shader-background";
import { KineticTypography } from "../components/kinetic-typography";

export function HomePage() {
  return (
    <div className="relative bg-black min-h-screen overflow-x-hidden">
      {/* SEO Meta Tags */}
      <SEO 
        title="Novalare - AI Copilot for Accountants | 10x Faster Bookkeeping"
        description="AI-powered accounting automation for European firms. Automate invoice extraction, bank reconciliation, and month-end close. Supports QuickBooks, Xero, and DATEV integration."
        keywords="accounting automation, AI bookkeeping, DATEV integration, invoice extraction, bank reconciliation, QuickBooks automation, Xero integration, AI copilot accountants, European accounting software"
      />
      
      {/* HERO SECTION: Intro with Kinetic Typography */}
      <section className="relative w-full h-screen overflow-hidden">
        <ShaderBackground />
        <KineticTypography />
      </section>
    </div>
  );
}
