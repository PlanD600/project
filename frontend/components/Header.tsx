// components/Header.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useDataStore } from '../stores/useDataStore';
import { Project } from '../types';
import Notifications from './Notifications';
import ProjectSelector from './ProjectSelector';
import GlobalSearch from './GlobalSearch';
import Icon from './Icon';
import Avatar from './Avatar';

interface HeaderProps {
  onGoToSettings: () => void;
  projectsForCurrentUser: Project[];
}

export const Header: React.FC<HeaderProps> = (props) => {
  // Fix: Get currentUser and handleLogout from useAuthStore
  const { currentUser, handleLogout } = useAuthStore();
  const { projectsForCurrentUser, onGoToSettings } = props;
  if (!currentUser) {
    return <div>Loading...</div>;
  }
  if (!Array.isArray(projectsForCurrentUser)) {
    return <div>Loading...</div>;
  }
  const {
    organization,
    organizations,
    userMemberships,
    activeOrganizationId,
    notifications,
    handleSetNotificationsRead,
    selectedProjectId,
    setSelectedProjectId,
    handleGlobalSearch,
    handleGetOrganizations,
    handleCreateOrganization,
    handleSwitchOrganization,
    handleGetUserMemberships,
    canManageOrganizations,
    getUserRoleInActiveOrg
  } = useDataStore();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [newOrganizationName, setNewOrganizationName] = useState('');
  const [showCreateOrgForm, setShowCreateOrgForm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (workspaceDropdownRef.current && !workspaceDropdownRef.current.contains(event.target as Node)) {
        setIsWorkspaceDropdownOpen(false);
        setShowCreateOrgForm(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load user memberships and organizations for super admin users
  useEffect(() => {
    if (currentUser && userMemberships.length === 0) {
      handleGetUserMemberships();
    }
    if (canManageOrganizations() && organizations.length === 0) {
      handleGetOrganizations();
    }
  }, [currentUser, userMemberships.length, organizations.length, canManageOrganizations, handleGetUserMemberships, handleGetOrganizations]);

  const handleCreateNewOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newOrganizationName.trim()) {
      await handleCreateOrganization(newOrganizationName.trim());
      setNewOrganizationName('');
      setShowCreateOrgForm(false);
    }
  };

  const handleSwitchOrg = async (orgId: string) => {
    await handleSwitchOrganization(orgId);
    setIsWorkspaceDropdownOpen(false);
  };

  if (!currentUser) return null;

  const userRoleInActiveOrg = getUserRoleInActiveOrg();
  const canManageOrgs = canManageOrganizations();

  return (
    <header className="bg-primary text-light shadow-lg p-4 sm:p-6 rounded-b-3xl relative z-20">
      <div className='max-w-7xl mx-auto'>
        <div className="flex flex-wrap items-center justify-between gap-y-4">
          {/* Left side: User Profile & Actions */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="relative z-50" ref={dropdownRef}>
              <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center space-x-3 cursor-pointer p-1 rounded-full" aria-haspopup="true" aria-expanded={isDropdownOpen} aria-controls="user-menu-dropdown" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setIsDropdownOpen(v => !v); }}>
                <Avatar user={currentUser} className="w-12 h-12 rounded-full border-2 border-light/50" />
              </button>
              {isDropdownOpen && (
                <div id="user-menu-dropdown" role="menu" aria-label="User menu" className="absolute right-0 mt-2 w-56 bg-light rounded-2xl shadow-neumorphic-convex py-2 text-right">
                  <div className="px-4 py-3 border-b border-shadow-dark">
                    <p className="font-semibold text-primary truncate">{currentUser.name}</p>
                    <p className="text-sm text-secondary truncate">{currentUser.email}</p>
                    {userRoleInActiveOrg && (
                      <p className="text-xs text-secondary mt-1">תפקיד: {userRoleInActiveOrg}</p>
                    )}
                  </div>
                  <a href="#" onClick={(e) => { e.preventDefault(); onGoToSettings(); setIsDropdownOpen(false); }} className="w-full flex items-center justify-end gap-3 text-right px-4 py-2 text-sm text-primary hover:bg-light/50">
                    הפרופיל שלי <Icon name="user" className="w-4 h-4 text-secondary" />
                  </a>
                  <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }} className="w-full flex items-center justify-end gap-3 text-right px-4 py-2 text-sm text-primary hover:bg-light/50">
                    התנתקות <Icon name="close" className="w-4 h-4 text-secondary" />
                  </a>
                </div>
              )}
            </div>
            
            {/* Organization & User Info - Always show user name, org name, and role */}
            <div className="text-right">
              <div className="text-lg font-bold text-light">{currentUser.name}</div>
              <div className="text-base text-light/80 mt-1">{organization ? organization.name : 'Loading...'}</div>
              {userRoleInActiveOrg && (
                <div className="text-sm text-light/60 mt-1">{userRoleInActiveOrg}</div>
              )}
            </div>
          </div>

          {/* Right side: Actions */}
          <div className="flex items-center space-x-2">
            <button onClick={onGoToSettings} aria-label="הגדרות" title="הגדרות" className="p-3 bg-light/10 hover:bg-light/20 rounded-full transition-colors">
              <Icon name="settings" className="w-6 h-6" />
            </button>
            <Notifications
              notifications={notifications}
              currentUser={currentUser}
              onSetRead={handleSetNotificationsRead}
            />
          </div>
        </div>

        {/* Bottom row: Search & Filter */}
        <div className="w-full flex flex-col md:flex-row items-center gap-4 mt-6">
          <div className="w-full md:flex-1 md:max-w-lg">
            <GlobalSearch onSearch={handleGlobalSearch} onSelectProject={setSelectedProjectId} />
          </div>
          <div className="w-full md:w-auto md:max-w-sm">
            <ProjectSelector />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;