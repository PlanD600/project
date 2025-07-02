import React from 'react';
import { User } from '../types';
import Icon from './Icon';

export type Tab = 'Portfolio' | 'זמנים' | 'כספים' | 'משימות';

interface TabBarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  currentUser: User;
}

interface TabItem {
    name: Tab;
    label: string;
    icon: 'briefcase' | 'gantt-chart' | 'banknotes' | 'users';
}

const TABS: TabItem[] = [
    { name: 'Portfolio', label: 'מבט-על', icon: 'briefcase' },
    { name: 'משימות', label: 'משימות', icon: 'users' },
    { name: 'זמנים', label: 'זמנים', icon: 'gantt-chart' },
    { name: 'כספים', label: 'כספים', icon: 'banknotes' },
];

const TabBar: React.FC<TabBarProps> = ({ activeTab, setActiveTab, currentUser }) => {
    let availableTabs: TabItem[];

    switch (currentUser.role) {
        case 'ADMIN':
            availableTabs = TABS;
            break;
        case 'TEAM_MANAGER':
            availableTabs = TABS.filter(tab => tab.name !== 'Portfolio');
            break;
        case 'Employee':
            availableTabs = TABS.filter(tab => tab.name !== 'Portfolio' && tab.name !== 'כספים');
            break;
        case 'GUEST':
            availableTabs = TABS.filter(tab => tab.name === 'משימות' || tab.name === 'זמנים');
            break;
        default:
            availableTabs = [];
    }

  return (
    <nav aria-label="ניווט ראשי">
<div role="tablist" className="bg-light p-2 rounded-2xl shadow-neumorphic-convex grid grid-cols-2 md:grid-cols-4 gap-2">        {availableTabs.map((tab) => (
          <button
            key={tab.name}
            id={`tab-${tab.name}`}
            role="tab"
            aria-selected={activeTab === tab.name}
            aria-controls={`tabpanel-${tab.name}`}
            onClick={() => setActiveTab(tab.name)}
            className={`flex-1 flex items-center justify-center space-x-2 space-x-reverse px-3 py-3 text-sm font-medium transition-all duration-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-light focus:ring-primary/50
              ${
                activeTab === tab.name
                  ? 'shadow-neumorphic-concave-sm text-primary font-bold'
                  : 'text-secondary hover:text-primary'
              }`}
          >
            <Icon name={tab.icon} className="w-5 h-5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default TabBar;