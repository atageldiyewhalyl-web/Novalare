import dashboardImage from '../assets/Companies.png';

export function DashboardShowcase() {
  return (
    <section className="relative py-20 px-6 bg-gradient-to-b from-[#0a0a0f] via-[#0a0a0f] to-black pb-32">
      <div className="max-w-7xl mx-auto">
        {/* Dashboard Image Container */}
        <div className="relative">
          {/* Glow effect background */}
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 rounded-3xl blur-3xl opacity-50"></div>

          {/* Main dashboard container */}
          <div className="relative bg-gradient-to-br from-gray-900/50 to-gray-800/50 rounded-2xl p-1.5 backdrop-blur-sm border border-white/10">
            <div className="bg-[#0a0a0f] rounded-xl overflow-hidden shadow-2xl">
              <img
                src={dashboardImage}
                alt="Novalare Dashboard - Your Companies View"
                className="w-full h-auto"
              />
            </div>
          </div>

          {/* Floating accent elements */}
          <div className="absolute -top-6 -left-6 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl"></div>
        </div>
      </div>

      {/* Gradient transition overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-b from-transparent via-black/50 to-black pointer-events-none"></div>
    </section>
  );
}