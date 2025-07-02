import React, { useState, useMemo, useEffect } from 'react';
import Header from './components/Header';
import KanbanBoard from './components/KanbanBoard';
import TabBar, { Tab } from './components/TabBar';
import TimesView from './components/TimesView';
import FinancesView from './components/FinancesView';
import PortfolioView from './components/PortfolioView';
import SettingsView, { ActiveSection } from './components/SettingsView';
import LoginView from './components/LoginView';
import OnboardingModal from './components/OnboardingModal';
import Spinner from './components/Spinner';
import Toast from './components/Toast';
import { useAuthStore } from './stores/useAuthStore';
import { useDataStore, calculateProjectsForCurrentUser } from './stores/useDataStore';
import { useUIStore } from './stores/useUIStore';
// הוסר: import { UserRole } from './types'; // כבר לא צריך לייבא אם משווים למחרוזות ישירות

const App: React.FC = () => {
  console.log('App: Component rendering...');
  // --- START OF HOOKS SECTION ---
  const { currentUser, isAuthenticated, isAppLoading, handleLogin, handleLogout, handleRegistration, checkAuthStatus } = useAuthStore();
  const { projects, tasks, selectedProjectId, setSelectedProjectId } = useDataStore();
  // This is your excellent new notification state
  const { notification, setNotification } = useUIStore();

  const [activeTab, setActiveTab] = useState<Tab>('Portfolio');
  const [view, setView] = useState<'dashboard' | 'settings'>('dashboard');
  const [settingsInitialSection, setSettingsInitialSection] = useState<ActiveSection | null>(null);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  const projectsForCurrentUser = useMemo(() => calculateProjectsForCurrentUser(currentUser, projects, tasks), [currentUser, projects, tasks]);

  // This useMemo was moved up here to fix the hook order error
  const tasksForView = useMemo(() => {
    if (!currentUser || !selectedProjectId) {
      if (currentUser?.role === 'Employee') return tasks.filter(task => task.assigneeIds.includes(currentUser.id));
      return [];
    }
    const projectTasks = tasks.filter(task => task.projectId === selectedProjectId);
    // שינוי: שימוש במחרוזות ישירות
    if (currentUser.role === 'GUEST' || currentUser.role === 'ADMIN' || currentUser.role === 'TEAM_MANAGER') {
      return projectTasks;
    }
    return projectTasks.filter(task => task.assigneeIds.includes(currentUser.id));
  }, [currentUser, tasks, selectedProjectId]);
  // --- END OF HOOKS SECTION ---

  useEffect(() => {
    console.log('App useEffect: Running checkAuthStatus...');
    checkAuthStatus();
  }, [checkAuthStatus]);

  useEffect(() => {
    if(projectsForCurrentUser.length > 0 && !projectsForCurrentUser.find(p => p.id === selectedProjectId)) {
        setSelectedProjectId(projectsForCurrentUser[0].id);
    } else if (projectsForCurrentUser.length === 0) {
        setSelectedProjectId(null);
    }
  }, [projectsForCurrentUser, selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    if (!currentUser) return;

    let availableTabs: Tab[] = ['משימות', 'זמנים'];
    // שינוי: שימוש במחרוזות ישירות
    if (currentUser.role === 'ADMIN') availableTabs = ['Portfolio', 'משימות', 'זמנים', 'כספים'];
    else if (currentUser.role === 'TEAM_MANAGER') availableTabs = ['משימות', 'זמנים', 'כספים'];
    else if (currentUser.role === 'GUEST') availableTabs = ['משימות', 'זמנים'];

    if (!availableTabs.includes(activeTab)) {
      if (currentUser.role === 'ADMIN') setActiveTab('Portfolio');
      else setActiveTab('משימות');
    }
  }, [currentUser, activeTab]);

  useEffect(() => {
    let title = 'מנהל פרויקטים חכם';
    if (view === 'settings') {
      title = 'הגדרות | ' + title;
    } else if (selectedProjectId && projects.length > 0) {
      const projectName = projects.find(p => p.id === selectedProjectId)?.name || '';
      if(projectName) {
        title = `${activeTab} - ${projectName} | ${title}`;
      } else {
        title = `${activeTab} | ${title}`;
      }
    } else {
      title = `${activeTab} | ${title}`;
    }
    document.title = title;
  }, [activeTab, view, selectedProjectId, projects]);

  const handleToggleSettings = () => {
    setView(prev => prev === 'dashboard' ? 'settings' : 'dashboard');
    setSettingsInitialSection(null);
  };

  const handleGoToCreateTeam = () => {
    setShowOnboardingModal(false);
    setView('settings');
    setSettingsInitialSection('team-management');
  };

  const handleBackToDashboard = () => {
      setView('dashboard');
      setSettingsInitialSection(null);
  };

  const handleSuccessfulRegistration = () => {
      setView('dashboard');
      setActiveTab('Portfolio');
      setShowOnboardingModal(true);
  };

  console.log('App Render Check: isAppLoading =', isAppLoading);
  if (isAppLoading) {
      return (
          <div className="flex items-center justify-center h-screen bg-light">
              <Spinner className="w-12 h-12 text-primary"/>
          </div>
      )
  }

  console.log('App Render Check: isAuthenticated =', isAuthenticated, 'currentUser =', currentUser);
  if (!isAuthenticated || !currentUser) {
    return <LoginView onLogin={handleLogin} onRegister={handleRegistration} onRegistrationSuccess={handleSuccessfulRegistration} />;
  }

  const renderContent = () => {
    console.log('renderContent: Active Tab =', activeTab, 'Current User Role =', currentUser?.role);
    switch (activeTab) {
      case 'Portfolio':
        // שינוי: שימוש במחרוזות ישירות
        return currentUser.role === 'ADMIN' ? <div id="tabpanel-Portfolio" role="tabpanel" aria-labelledby="tab-Portfolio"><PortfolioView /></div> : null;
      case 'זמנים':
        return <div id="tabpanel-זמנים" role="tabpanel" aria-labelledby="tab-זמנים"><TimesView tasks={tasksForView} /></div>;
      case 'כספים':
        // שינוי: שימוש במחרוזות ישירות
        return (currentUser.role === 'ADMIN' || currentUser.role === 'TEAM_MANAGER') ? <div id="tabpanel-כספים" role="tabpanel" aria-labelledby="tab-כספים"><FinancesView /></div> : null;
      case 'משימות':
        return <div id="tabpanel-משימות" role="tabpanel" aria="tabpanel" aria-labelledby="tab-משימות"><KanbanBoard tasks={tasksForView} /></div>;
      default:
        return null;
    }
  };

  console.log('App Render Check: Rendering main layout. View =', view, 'Active Tab =', activeTab);
  return (
    <div className="min-h-screen bg-light font-sans flex flex-col">
       <a href="#main-content" className="absolute w-px h-px p-0 -m-px overflow-hidden [clip:rect(0,0,0,0)] whitespace-nowrap border-0 focus:w-auto focus:h-auto focus:p-2 focus:m-0 focus:overflow-visible focus:[clip:auto] focus:z-[100] focus:top-2 focus:right-2 bg-accent text-light rounded-lg">דלג לתוכן המרכזי</a>
      <Toast
        message={notification?.message ?? null}
        type={notification?.type ?? 'error'}
        onClose={() => setNotification(null)}
      />
      <Header onGoToSettings={handleToggleSettings} projectsForCurrentUser={projectsForCurrentUser} />
      {showOnboardingModal && (
          <OnboardingModal
              user={currentUser}
              onClose={() => setShowOnboardingModal(false)}
              onGoToCreateTeam={handleGoToCreateTeam}
          />
      )}
      <div className="p-4 sm:p-6 lg:p-8">
        {view === 'dashboard' && <TabBar activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentUser} />}
        <main id="main-content" className="mt-6 flex-grow">
          {view === 'dashboard' ? (
              renderContent()
          ) : (
              <SettingsView 
                  onBackToDashboard={handleBackToDashboard}
                  initialSection={settingsInitialSection}
              />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;