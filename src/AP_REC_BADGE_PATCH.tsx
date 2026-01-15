// PATCH FILE: Replace lines 1502-1515 in APReconciliation.tsx

// ORIGINAL CODE (lines 1502-1515):
/*
                                      <Badge 
                                        variant="outline" 
                                        className={theme === 'premium-dark' ? 'bg-white/[0.05] text-white border-white/10' : 'bg-gray-50 text-gray-600 border-gray-200'}
                                      >
                                        {match.match_type === 'exact_match' ? 'exact' 
                                          : match.match_type === 'deterministic_multi' ? '1:many'
                                          : match.match_type === 'ai_fuzzy_multi' ? 'AI multi'
                                          : match.match_type === 'ai_fuzzy' ? 'AI'
                                          : match.match_type}
                                      </Badge>
                                    </td>
                                    <td className="py-4 px-6 text-sm text-gray-600">
                                      {match.match_confidence}%
                                    </td>
*/

// NEW CODE (replace with):
                                      <Badge 
                                        variant="outline" 
                                        className={
                                          match.match_type === 'exact_match' 
                                            ? 'bg-violet-50 text-violet-700 border-violet-200' 
                                            : match.match_type === 'one_to_many'
                                            ? 'bg-green-50 text-green-700 border-green-200'
                                            : match.match_type === 'many_to_one'
                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                            : match.match_type === 'fx_tolerance'
                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                            : 'bg-gray-50 text-gray-600 border-gray-200'
                                        }
                                      >
                                        {match.match_type === 'exact_match' ? 'exact' 
                                          : match.match_type === 'one_to_many' ? '1:many'
                                          : match.match_type === 'many_to_one' ? `${(match.additional_vendor_transactions?.length || 0) + 1}:1`
                                          : match.match_type === 'fx_tolerance' ? 'Tolerance'
                                          : match.match_type}
                                      </Badge>
                                    </td>
                                    <td className="py-4 px-6">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">
                                          {typeof match.match_confidence === 'number' ? Math.round(match.match_confidence) : match.match_confidence}%
                                        </span>
                                        {match.match_status === 'manual_review_required' && (
                                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                                            Review Required
                                          </Badge>
                                        )}
                                        {match.match_status === 'review_recommended' && (
                                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
                                            Review
                                          </Badge>
                                        )}
                                        {match.match_status === 'auto_approved' && (
                                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                                            ✓
                                          </Badge>
                                        )}
                                      </div>
                                    </td>
