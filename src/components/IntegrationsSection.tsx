import datevLogo from 'figma:asset/c34879bb2e6d841ef07fe2ed148bf4cab3b299f4.png';
import driveLogo from 'figma:asset/1158dfc693f4ae5a01939f799ec6db9b61d3b284.png';
import gmailLogo from 'figma:asset/69a23a2de347341093d72bdffa6e46ae1b2375bb.png';
import quickbooksLogo from 'figma:asset/5264239cb79885dbc9631e17fedb6d0d0f1d214c.png';
import dropboxLogo from 'figma:asset/3fb4f4e9cbb895cdb7874910c1d38cffa054fd1f.png';
import onedriveLogo from 'figma:asset/84d50433fafe72c36e6db27bb435ee194c3c379b.png';
import xeroLogo from 'figma:asset/7766f1180086653e337ce2f0f67234870226671c.png';
import sageLogo from 'figma:asset/e1a4aed4a4ada83730e07e41ffea732ddebfb099.png';
import outlookLogo from 'figma:asset/139949b8ecc4e3f9b043080a29242ae7dbac6bb6.png';
import excelLogo from 'figma:asset/01b9efd5d81dc633a9b4a5901fb46f8fb0f5708f.png';

export function IntegrationsSection() {
  const integrations = {
    row1: [
      { name: 'Gmail', logo: gmailLogo },
      { name: 'Google Drive', logo: driveLogo },
      { name: 'OneDrive', logo: onedriveLogo },
      { name: 'Outlook', logo: outlookLogo },
      { name: 'Sage', logo: sageLogo },
    ],
    row2: [
      { name: 'Datev', logo: datevLogo },
      { name: 'Xero', logo: xeroLogo },
      { name: 'Dropbox', logo: dropboxLogo },
      { name: 'QuickBooks', logo: quickbooksLogo },
      { name: 'Excel', logo: excelLogo },
    ],
  };

  return (
    <section className="relative py-24 md:py-32 bg-black overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
        {/* Title */}
        <h2 
          className="text-3xl md:text-4xl lg:text-5xl text-white mb-16"
          style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700', letterSpacing: '-0.02em' }}
        >
          Compatible With Your Favourite Tools
        </h2>

        {/* Logos Grid */}
        <div className="space-y-12 mb-16">
          {/* First Row */}
          <div className="flex justify-center items-center gap-8 md:gap-16 flex-wrap">
            {integrations.row1.map((integration) => (
              <div 
                key={integration.name}
                className="w-24 h-24 md:w-32 md:h-32 lg:w-40 lg:h-40 flex items-center justify-center transition-all hover:scale-110 p-2"
              >
                {integration.logo ? (
                  <img 
                    src={integration.logo} 
                    alt={integration.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-white/30 text-xs text-center px-2">
                    {integration.name}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Second Row */}
          <div className="flex justify-center items-center gap-8 md:gap-16 flex-wrap">
            {integrations.row2.map((integration) => (
              <div 
                key={integration.name}
                className="w-24 h-24 md:w-32 md:h-32 lg:w-40 lg:h-40 flex items-center justify-center transition-all hover:scale-110 p-2"
              >
                {integration.logo ? (
                  <img 
                    src={integration.logo} 
                    alt={integration.name}
                    className={`object-contain ${integration.name === 'Excel' ? 'w-[70%] h-[70%]' : 'w-full h-full'}`}
                  />
                ) : (
                  <div className="text-white/30 text-xs text-center px-2">
                    {integration.name}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer Text */}
        <p 
          className="text-gray-400 text-lg"
          style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}
        >
          Novalare can import data from different platforms, organize and structure, and export them to your main accounting tools
        </p>
      </div>

      {/* Background Gradient Glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-3xl"></div>
      </div>
    </section>
  );
}