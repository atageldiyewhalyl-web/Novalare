// REPLACE lines 806-848 in /components/devportal/workflows/CCRecReview.tsx with this:

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleApproveForJE(item, 'cc')}
                        >
                          <ThumbsUp className="size-3.5" />
                          Approve for JE
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 bg-white"
                          onClick={() => handleOpenMatchDialog(item)}
                        >
                          <Link className="size-3.5" />
                          Match
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 bg-white"
                          onClick={() => handleEditTransaction(item, 'cc')}
                        >
                          <Edit2 className="size-3.5" />
                          Edit / Correct
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="gap-1 bg-white">
                              More Actions
                              <ChevronDown className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenFollowUpDialog(item, 'cc')}>
                              <MessageSquare className="size-4 mr-2" />
                              Request Information
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMarkAsTimingDifference(item, 'cc')}>
                              <Clock className="size-4 mr-2" />
                              Mark as Timing Difference
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleMarkAsIgnored(item, 'cc')}>
                              <EyeOff className="size-4 mr-2" />
                              Mark as Non-Issue
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
