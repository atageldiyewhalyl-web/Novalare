                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-gray-700">Posting Date</th>
                            <th className="px-4 py-3 text-left text-gray-700">Vendor</th>
                            <th className="px-4 py-3 text-left text-gray-700">Memo</th>
                            <th className="px-4 py-3 text-right text-gray-700">Debit</th>
                            <th className="px-4 py-3 text-right text-gray-700">Credit</th>
                            <th className="px-4 py-3 text-left text-gray-700">GL Account</th>
                            <th className="px-4 py-3 text-left text-gray-700">Reference</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ccLedgerEntries.map((entry, idx) => (
                            <tr key={entry.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-4 py-3 text-gray-900">
                                {new Date(entry.date).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 text-gray-900">{entry.vendor}</td>
                              <td className="px-4 py-3 text-gray-600">{entry.memo || '-'}</td>
                              <td className={`px-4 py-3 text-right ${entry.debit > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                                ${formatCurrency(entry.debit)}
                              </td>
                              <td className={`px-4 py-3 text-right ${entry.credit > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                ${formatCurrency(entry.credit)}
                              </td>
                              <td className="px-4 py-3 text-gray-900">{entry.glAccount || '-'}</td>
                              <td className="px-4 py-3 text-gray-600">{entry.reference || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-100">
                          <tr>
                            <td colSpan={3} className="px-4 py-3 text-right text-gray-700">
                              Totals:
                            </td>
                            <td className="px-4 py-3 text-right text-gray-900">
                              ${formatCurrency(
                                ccLedgerEntries.reduce((sum, entry) => sum + entry.debit, 0)
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-green-600">
                              ${formatCurrency(
                                ccLedgerEntries.reduce((sum, entry) => sum + entry.credit, 0)
                              )}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
