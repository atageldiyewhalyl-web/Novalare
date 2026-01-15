import { useState, useEffect } from 'react';
import { Users, Mail, Trash2, X, Crown, Shield, User, Plus, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';

interface TeamMember {
  userId: string;
  email: string;
  fullName: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

interface PendingInvitation {
  email: string;
  role: string;
  invitedAt: string;
  expiresAt: string;
  status: string;
}

interface TeamData {
  teamMembers: TeamMember[];
  pendingInvitations: PendingInvitation[];
  currentPlan: string;
  seatLimit: number;
  seatsUsed: number;
  seatsAvailable: number;
}

export function TeamSettings() {
  const { user, session } = useAuth();
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (session?.access_token) {
      fetchTeamData();
    }
  }, [session]);

  const fetchTeamData = async () => {
    if (!session?.access_token) {
      console.error('No access token available');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/team/members`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Team data fetch error:', errorData);
        throw new Error(errorData.error || 'Failed to fetch team data');
      }

      const data = await response.json();
      setTeamData(data);
    } catch (error) {
      console.error('Error fetching team data:', error);
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteEmail || !inviteEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!session?.access_token) {
      toast.error('Authentication required');
      return;
    }

    setSending(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/team/invite`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: inviteEmail,
            role: inviteRole
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.message && data.message.includes('seat limit')) {
          toast.error(data.message, {
            description: 'Please upgrade your plan to add more team members'
          });
        } else {
          toast.error(data.error || 'Failed to send invitation');
        }
        return;
      }

      toast.success('Invitation sent!', {
        description: `An invitation email has been sent to ${inviteEmail}`
      });

      setInviteEmail('');
      setInviteRole('member');
      setShowInviteModal(false);
      fetchTeamData();
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast.error('Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from your team?`)) {
      return;
    }

    if (!session?.access_token) {
      toast.error('Authentication required');
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/team/members/${userId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to remove team member');
        return;
      }

      toast.success(`${memberName} has been removed from your team`);
      fetchTeamData();
    } catch (error) {
      console.error('Error removing team member:', error);
      toast.error('Failed to remove team member');
    }
  };

  const handleCancelInvitation = async (email: string) => {
    if (!confirm(`Are you sure you want to cancel the invitation to ${email}?`)) {
      return;
    }

    if (!session?.access_token) {
      toast.error('Authentication required');
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/team/invitations/${encodeURIComponent(email)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to cancel invitation');
        return;
      }

      toast.success('Invitation cancelled');
      fetchTeamData();
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast.error('Failed to cancel invitation');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return <User className="w-4 h-4 text-gray-400" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'trial':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'starter':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'professional':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'enterprise':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const currentUserMember = teamData?.teamMembers.find(m => m.userId === user?.id);
  const canManageTeam = currentUserMember?.role === 'owner' || currentUserMember?.role === 'admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!teamData) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        Failed to load team data
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl text-gray-900 dark:text-white">Team Management</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage your team members and invitations
          </p>
        </div>
        {canManageTeam && (
          <Button
            onClick={() => setShowInviteModal(true)}
            disabled={teamData.seatsAvailable <= 0}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Invite Team Member
          </Button>
        )}
      </div>

      {/* Seat Usage */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-900 dark:text-white">Seat Usage</h3>
          <span className={`px-3 py-1 rounded-full text-sm capitalize ${getPlanBadgeColor(teamData.currentPlan)}`}>
            {teamData.currentPlan} Plan
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">
                {teamData.seatsUsed} of {teamData.seatLimit} seats used
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                {teamData.seatsAvailable} available
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  teamData.seatsUsed >= teamData.seatLimit
                    ? 'bg-red-500'
                    : teamData.seatsAvailable <= 1
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${(teamData.seatsUsed / teamData.seatLimit) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {teamData.seatsAvailable <= 0 && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-400">
              You've reached your seat limit. <a href="/pricing" className="underline font-medium">Upgrade your plan</a> to add more team members.
            </p>
          </div>
        )}
      </div>

      {/* Team Members */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-500" />
            <h3 className="text-gray-900 dark:text-white">Team Members ({teamData.teamMembers.length})</h3>
          </div>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {teamData.teamMembers.filter(member => member != null).map((member) => (
            <div key={member.userId} className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
                  {member.fullName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-gray-900 dark:text-white">{member.fullName || member.email}</p>
                    {member.userId === user?.id && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">(You)</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Joined {new Date(member.joinedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm flex items-center gap-1.5 ${getRoleBadgeColor(member.role)}`}>
                  {getRoleIcon(member.role)}
                  {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                </span>

                {canManageTeam && member.role !== 'owner' && member.userId !== user?.id && (
                  <button
                    onClick={() => handleRemoveMember(member.userId, member.fullName || member.email)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Remove team member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invitations */}
      {teamData.pendingInvitations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-gray-500" />
              <h3 className="text-gray-900 dark:text-white">
                Pending Invitations ({teamData.pendingInvitations.length})
              </h3>
            </div>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {teamData.pendingInvitations.filter(invitation => invitation != null && invitation.email).map((invitation) => (
              <div key={invitation.email} className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-gray-900 dark:text-white">{invitation.email}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Invited {new Date(invitation.invitedAt).toLocaleDateString()} · Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                    Pending
                  </span>

                  {canManageTeam && (
                    <button
                      onClick={() => handleCancelInvitation(invitation.email)}
                      className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Cancel invitation"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl text-gray-900 dark:text-white">Invite Team Member</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Admins can invite and manage other team members
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={sending}
                  className="flex-1"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}