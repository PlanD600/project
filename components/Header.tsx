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
  const { currentUser, projectsForCurrentUser } = props;
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
              <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center space-x-3 cursor-pointer p-1 rounded-full">
                <Avatar user={currentUser} className="w-12 h-12 rounded-full border-2 border-light/50" />
              </button>
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-light rounded-2xl shadow-neumorphic-convex py-2 text-right">
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
            
            {/* Organization & User Info - Clickable for Super Admin */}
            <div className="relative" ref={workspaceDropdownRef}>
              <button
                onClick={() => canManageOrgs && setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
                className={`text-right ${canManageOrgs ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
              >
                {/* Organization Name - Large and Prominent */}
                <h2 className='text-2xl font-bold text-light leading-tight'>
                  {organization ? organization.name : 'Loading...'}
                </h2>
                {/* User Name - Smaller Font */}
                <p className='text-sm text-light/80 mt-1'>
                  {currentUser.name}
                </p>
                {/* Workspace Switcher Icon for Super Admin */}
                {canManageOrgs && (
                  <Icon name="briefcase" className="w-4 h-4 text-light/60 mt-1" />
                )}
              </button>
              
              {/* Workspace Switcher Dropdown for Super Admin Users */}
              {canManageOrgs && isWorkspaceDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-light rounded-2xl shadow-neumorphic-convex py-2 text-right z-50">
                  <div className="px-4 py-2 border-b border-dark">
                    <p className="text-sm font-semibold text-primary">בחר חברה</p>
                  </div>
                  
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => handleSwitchOrg(org.id)}
                      className={`w-full text-right px-4 py-2 text-sm hover:bg-dark/50 transition-colors flex items-center justify-between ${
                        organization?.name === org.name ? 'bg-dark/30' : ''
                      }`}
                    >
                      <span className="text-primary">{org.name}</span>
                      {org._count && (
                        <span className="text-xs text-secondary">
                          {org._count.users} משתמשים, {org._count.projects} פרויקטים
                        </span>
                      )}
                    </button>
                  ))}
                  
                  <div className="border-t border-dark mt-2 pt-2">
                    {showCreateOrgForm ? (
                      <form onSubmit={handleCreateNewOrganization} className="px-4 py-2">
                        <input
                          type="text"
                          value={newOrganizationName}
                          onChange={(e) => setNewOrganizationName(e.target.value)}
                          placeholder="שם החברה החדשה"
                          className="w-full bg-dark/20 text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent"
                          autoFocus
                        />
                        <div className="flex space-x-2 space-x-reverse mt-2">
                          <button
                            type="submit"
                            className="px-3 py-1 bg-accent text-light rounded-md text-sm hover:bg-accent/80"
                          >
                            צור
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCreateOrgForm(false);
                              setNewOrganizationName('');
                            }}
                            className="px-3 py-1 bg-dark/20 text-primary rounded-md text-sm hover:bg-dark/30"
                          >
                            ביטול
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        onClick={() => setShowCreateOrgForm(true)}
                        className="w-full text-right px-4 py-2 text-sm text-accent hover:bg-dark/50 transition-colors flex items-center"
                      >
                        <Icon name="plus" className="w-4 h-4 ml-2" />
                        צור חברה חדשה
                      </button>
                    )}
                  </div>
                </div>
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
            <ProjectSelector
              projects={projectsForCurrentUser}
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              currentUser={currentUser}
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;