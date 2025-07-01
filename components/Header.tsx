import React, { useState, useRef, useEffect } from 'react';
import Notifications from './Notifications';
import ProjectSelector from './ProjectSelector';
import GlobalSearch from './GlobalSearch';
import Icon from './Icon';
import { useAuthStore } from '../stores/useAuthStore';
import { useDataStore } from '../stores/useDataStore';
import { Project } from '../types';

interface HeaderProps {
  onGoToSettings: () => void;
  projectsForCurrentUser: Project[];
}

const Header: React.FC<HeaderProps> = ({ onGoToSettings, projectsForCurrentUser }) => {
  const { currentUser, handleLogout } = useAuthStore();
  const { 
    notifications,
    handleSetNotificationsRead,
    selectedProjectId,
    setSelectedProjectId,
    handleGlobalSearch
  } = useDataStore();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!currentUser) return null;

  return (
    <header className="bg-primary text-light shadow-lg p-4 sm:p-6 rounded-b-3xl relative z-20">
      <div className='max-w-7xl mx-auto'>
        <div className="flex flex-wrap items-center justify-between gap-y-4">
          {/* Left side: User Profile & Actions */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center space-x-3 cursor-pointer p-1 rounded-full">
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-12 h-12 rounded-full border-2 border-light/50"
                />
              </button>
              {isDropdownOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-light rounded-2xl shadow-neumorphic-convex py-2 text-right">
                  <div className="px-4 py-3 border-b border-shadow-dark">
                      <p className="font-semibold text-primary truncate">{currentUser.name}</p>
                      <p className="text-sm text-secondary truncate">{currentUser.email}</p>
                  </div>
                   <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); onGoToSettings(); setIsDropdownOpen(false); }}
                      className="w-full flex items-center justify-end gap-3 text-right px-4 py-2 text-sm text-primary hover:bg-light/50"
                    >
                      הפרופיל שלי
                      <Icon name="user" className="w-4 h-4 text-secondary" />
                    </a>
                   <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); handleLogout(); }}
                      className="w-full flex items-center justify-end gap-3 text-right px-4 py-2 text-sm text-primary hover:bg-light/50"
                    >
                      התנתקות
                      <Icon name="close" className="w-4 h-4 text-secondary" />
                    </a>
                </div>
              )}
            </div>
            <div>
              <h2 className='text-xl font-bold'>{currentUser.name}</h2>
              <p className='text-sm text-light/80'>{currentUser.role}</p>
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