import { CheckCircle, AlertTriangle, FileText, CreditCard, Landmark, TrendingUp, Clock, ArrowRightLeft, Coins } from 'lucide-react';

export function ReconciliationFeaturesBento() {
  return (
    <section className="py-12 px-6 bg-black">
      <div className="max-w-6xl mx-auto">
        {/* Bento Grid - 3 columns for proper alignment */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

          {/* Card 1 - Statement Intelligence (Wide, spans 2 columns) */}
          <div className="lg:col-span-2 bg-gradient-to-br from-[#0f1c33] to-[#0a1424] rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
            <h3 className="text-white mb-1 text-base font-semibold">
              Statement intelligence
            </h3>
            <p className="text-gray-300 text-sm mb-3">
              Instant extraction from bank, vendor, and credit card statements
            </p>

            {/* Visual: Transaction table like DevPortal */}
            <div className="bg-[#0a0f1f] rounded-lg border border-white/5 overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-[80px_1fr_80px_100px] gap-2 px-3 py-2 bg-[#0d1420] border-b border-white/5">
                <span className="text-gray-500 text-[10px] font-medium">Date</span>
                <span className="text-gray-500 text-[10px] font-medium">Description</span>
                <span className="text-gray-500 text-[10px] font-medium text-right">Amount</span>
                <span className="text-gray-500 text-[10px] font-medium">Reference</span>
              </div>

              {/* Transaction Rows */}
              <div className="divide-y divide-white/5">
                {[
                  { date: '7/1/19', desc: 'Deposit 131-A', amount: '€209.54', ref: 'BS-0701-209.54', color: 'text-green-400' },
                  { date: '7/1/19', desc: 'Deposit 131-B', amount: '€389.77', ref: 'BS-0701-389.77', color: 'text-green-400' },
                  { date: '7/1/19', desc: 'ACH C&J Clark', amount: '€21.70', ref: 'BS-0701-21.70', color: 'text-red-400' },
                  { date: '7/2/19', desc: 'Deposit 131', amount: '€76.02', ref: 'BS-0702-76.02', color: 'text-green-400' },
                  { date: '7/2/19', desc: 'Customer Receipt', amount: '€74.00', ref: 'TIMING-0702', color: 'text-green-400' },
                  { date: '7/3/19', desc: 'Deposit Correction', amount: '€13.04', ref: 'BS-0703-13.04', color: 'text-green-400' },
                ].map((txn, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[80px_1fr_80px_100px] gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
                  >
                    <span className="text-gray-400 text-[10px]">{txn.date}</span>
                    <span className="text-white text-[10px] truncate">{txn.desc}</span>
                    <span className={`${txn.color} text-[10px] text-right font-medium`}>{txn.amount}</span>
                    <span className="text-gray-500 text-[10px] truncate">{txn.ref}</span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="bg-[#0d1420] px-3 py-2 border-t border-white/5 flex items-center justify-between">
                <span className="text-gray-400 text-[10px]">Chase Business • Dec 2024</span>
                <span className="text-white text-[10px] font-medium">247 transactions</span>
              </div>
            </div>
          </div>

          {/* Card 2 - Auto-matching Engine */}
          <div className="bg-gradient-to-br from-[#0f1c33] to-[#0a1424] rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
            <h3 className="text-white mb-1 text-base font-semibold">
              Auto-matching
            </h3>
            <p className="text-gray-300 text-sm mb-3">
              Handles complex scenarios
            </p>

            <div className="space-y-1.5">
              {[
                { label: 'Exact', icon: CheckCircle, color: 'text-green-400' },
                { label: 'One-to-many', icon: ArrowRightLeft, color: 'text-blue-400' },
                { label: 'Many-to-one', icon: ArrowRightLeft, color: 'text-purple-400' },
                { label: 'FX convert', icon: Coins, color: 'text-yellow-400' },
                { label: 'Date diff', icon: Clock, color: 'text-cyan-400' },
              ].map((type, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-[#0a0f1f] rounded p-2 border border-white/5">
                  <type.icon className={`w-3.5 h-3.5 ${type.color} flex-shrink-0`} />
                  <span className="text-white text-xs flex-1">{type.label}</span>
                  <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Card 3 - Review Interface (Tall) */}
          <div className="lg:row-span-2 bg-gradient-to-br from-[#0f1c33] to-[#0a1424] rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
            <h3 className="text-white mb-1 text-base font-semibold">
              Review interface
            </h3>
            <p className="text-gray-300 text-sm mb-3">
              Fast review and approval
            </p>

            <div className="bg-[#0a0f1f] rounded-lg border border-white/5 overflow-hidden">
              <div className="bg-[#0d1420] px-3 py-2 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                  <span className="text-white text-xs font-medium">Matched</span>
                </div>
                <span className="text-gray-400 text-[10px]">247</span>
              </div>

              <div className="divide-y divide-white/5">
                {[
                  { desc: 'Wire - ABC Corp', amount: '12,500', conf: 98 },
                  { desc: 'Payroll', amount: '45,230', conf: 95 },
                  { desc: 'Office Supplies', amount: '1,247', conf: 92 },
                ].map((item, idx) => (
                  <div key={idx} className="p-2.5">
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">{item.desc}</p>
                        <span className="text-[10px] text-gray-500">{item.conf}% match</span>
                      </div>
                      <div className="text-right ml-2">
                        <p className="text-white text-xs font-medium">${item.amount}</p>
                        <CheckCircle className="w-3 h-3 text-green-400 ml-auto mt-0.5" />
                      </div>
                    </div>
                    <div className="w-full h-0.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-400 rounded-full"
                        style={{ width: `${item.conf}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[#0d1420] px-3 py-2 border-t border-white/5 grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-gray-500 text-[10px]">Match Rate</p>
                  <p className="text-white text-xs font-medium">94.2%</p>
                </div>
                <div>
                  <p className="text-gray-500 text-[10px]">Reviewed</p>
                  <p className="text-white text-xs font-medium">189/247</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4 - Missing Entry Alerts */}
          <div className="lg:row-span-2 bg-gradient-to-br from-[#0f1c33] to-[#0a1424] rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
            <h3 className="text-white mb-1 text-base font-semibold">
              Missing alerts
            </h3>
            <p className="text-gray-300 text-sm mb-3">
              Instant flagging system
            </p>

            <div className="space-y-2.5">
              {[
                { desc: 'Unmatched txn', detail: '$5,230', color: 'red' },
                { desc: 'Missing entry', detail: 'Vendor pay', color: 'yellow' },
                { desc: 'Date mismatch', detail: '3 days off', color: 'blue' },
              ].map((alert, idx) => (
                <div key={idx} className="bg-[#0a0f1f] border border-white/5 rounded-lg p-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className={`w-4 h-4 text-${alert.color}-400 flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium mb-1">{alert.desc}</p>
                      <p className="text-gray-400 text-xs">{alert.detail}</p>
                    </div>
                  </div>
                </div>
              ))}

              <div className="bg-[#0a0f1f] rounded-lg p-3 border border-white/5 flex items-center justify-between mt-auto">
                <span className="text-gray-400 text-sm">Total</span>
                <span className="text-white font-medium text-lg">12</span>
              </div>
            </div>
          </div>

          {/* Card 5 - Audit Trail */}
          <div className="lg:row-span-2 bg-gradient-to-br from-[#0f1c33] to-[#0a1424] rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
            <h3 className="text-white mb-1 text-base font-semibold">
              Audit trail
            </h3>
            <p className="text-gray-300 text-sm mb-3">
              Complete compliance log
            </p>

            <div className="space-y-2.5">
              {[
                { action: 'Locked', user: 'S. Chen', time: '2h', color: 'green' },
                { action: 'Adjusted', user: 'J. Smith', time: '3h', color: 'blue' },
                { action: 'Approved', user: 'S. Chen', time: '4h', color: 'purple' },
                { action: 'Exported', user: 'System', time: '5h', color: 'cyan' },
              ].map((log, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <div className="relative">
                    <div className={`w-2 h-2 rounded-full bg-${log.color}-400 mt-2`}></div>
                    {idx < 3 && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-px h-8 bg-white/10"></div>
                    )}
                  </div>
                  <div className="flex-1 bg-[#0a0f1f] rounded-lg p-2.5 border border-white/5">
                    <p className="text-white text-sm font-medium mb-1">{log.action}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>{log.user}</span>
                      <span>•</span>
                      <span>{log.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}