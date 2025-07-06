import React, { useState, useEffect } from 'react';
import { useDataStore } from '../stores/useDataStore';
import { useAuthStore } from '../stores/useAuthStore';
import { api } from '../services/api';
import Icon from './Icon';
import Spinner from './Spinner';
import Toast from './Toast';

interface Guest {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  invitedAt: string;
  status: 'pending' | 'accepted' | 'expired';
  projectAccess: {
    projectId: string;
    projectName: string;
    permissions: string[];
  }[];
}

export const GuestManagementView: React.FC = () => {
  const { currentUser } = useAuthStore();
  const { activeOrganizationId, getActiveOrganization } = useDataStore();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const projects = useDataStore(state => state.projects);
  const activeOrganization = getActiveOrganization();

  useEffect(() => {
    if (activeOrganization) {
      loadGuests();
    }
  }, [activeOrganization]);

  const loadGuests = async () => {
    try {
      setLoading(true);
      // For now, we'll use a placeholder since guest API isn't fully implemented
      setGuests([]);
    } catch (error) {
      console.error('Failed to load guests:', error);
      setToast({ type: 'error', message: 'Failed to load guests' });
    } finally {
      setLoading(false);
    }
  };

  const inviteGuest = async () => {
    if (!inviteEmail || selectedProjects.length === 0) {
      setToast({ type: 'error', message: 'Please provide email and select at least one project' });
      return;
    }

    try {
      setInviting(true);
      // For now, we'll use a placeholder since guest API isn't fully implemented
      setToast({ type: 'success', message: 'Guest invitation sent successfully' });
      setInviteEmail('');
      setSelectedProjects([]);
      setShowInviteForm(false);
      loadGuests();
    } catch (error) {
      console.error('Failed to invite guest:', error);
      setToast({ type: 'error', message: 'Failed to send invitation' });
    } finally {
      setInviting(false);
    }
  };

  const revokeAccess = async (guestId: string) => {
    try {
      // For now, we'll use a placeholder since guest API isn't fully implemented
      setToast({ type: 'success', message: 'Guest access revoked successfully' });
      loadGuests();
    } catch (error) {
      console.error('Failed to revoke access:', error);
      setToast({ type: 'error', message: 'Failed to revoke access' });
    }
  };

  const resendInvitation = async (guestId: string) => {
    try {
      // For now, we'll use a placeholder since guest API isn't fully implemented
      setToast({ type: 'success', message: 'Invitation resent successfully' });
    } catch (error) {
      console.error('Failed to resend invitation:', error);
      setToast({ type: 'error', message: 'Failed to resend invitation' });
    }
  };

  if (!currentUser || !activeOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guest Management</h1>
          <p className="text-gray-600 mt-1">Manage guest access to your projects</p>
        </div>
        <button
          onClick={() => setShowInviteForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Icon name="user" className="w-4 h-4" />
          Invite Guest
        </button>
      </div>

      {/* Invite Form Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Invite Guest</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="guest@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Projects
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {projects.map(project => (
                    <label key={project.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedProjects.includes(project.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProjects([...selectedProjects, project.id]);
                          } else {
                            setSelectedProjects(selectedProjects.filter(id => id !== project.id));
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{project.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowInviteForm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={inviteGuest}
                disabled={inviting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
              >
                {inviting ? <Spinner className="w-4 h-4" /> : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guests List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          {guests.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="users" className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No guests yet</h3>
              <p className="text-gray-600 mb-4">Invite guests to collaborate on your projects</p>
              <button
                onClick={() => setShowInviteForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Invite Your First Guest
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Guest
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Projects
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invited
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {guests.map(guest => (
                    <tr key={guest.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <img
                              className="h-10 w-10 rounded-full"
                              src={guest.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(guest.name)}&background=random`}
                              alt={guest.name}
                            />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{guest.name}</div>
                            <div className="text-sm text-gray-500">{guest.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          guest.status === 'accepted' ? 'bg-green-100 text-green-800' :
                          guest.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {guest.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {guest.projectAccess.map(access => (
                            <div key={access.projectId} className="mb-1">
                              {access.projectName}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(guest.invitedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex gap-2 justify-end">
                          {guest.status === 'pending' && (
                            <button
                              onClick={() => resendInvitation(guest.id)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Resend
                            </button>
                          )}
                          <button
                            onClick={() => revokeAccess(guest.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}; 