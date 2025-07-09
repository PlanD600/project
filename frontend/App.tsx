import React, { useEffect, Suspense, lazy, useState, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/useAuthStore';
import { useDataStore } from './stores/useDataStore';
import { UserRole } from './types';
import { useUIStore } from './stores/useUIStore';

// Components & Types
import Spinner from './components/Spinner';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import { Tab } from './components/TabBar';
import { ActiveSection } from './components/SettingsView';
import Header from './components/Header';
import KanbanBoard from './components/KanbanBoard';
import TimesView from './components/TimesView';
import FinancesView from './components/FinancesView';
import PortfolioView from './components/PortfolioView';
import TabBar from './components/TabBar';
import OnboardingModal from './components/OnboardingModal';
import HealthCheck from './components/HealthCheck';

// Lazy-loaded Views
const LoginView = lazy(() => import('./components/LoginView'));
const ResetPasswordView = lazy(() => import('./components/ResetPasswordView'));
const SettingsView = lazy(() => import('./components/SettingsView'));


const App: React.FC = () => {
    // FIX: שלפנו את כל המשתנים הנדרשים מה-store בקריאה אחת, כולל isAuthenticated
    const { 
        currentUser, 
        isAuthenticated, 
        isAppLoading, 
        checkAuthStatus 
    } = useAuthStore();

    const { projects, tasks, selectedProjectId, setSelectedProjectId, getUserRoleInActiveOrg, needsOrganizationSetup } = useDataStore();
    const { notification, setNotification } = useUIStore();

    const [activeTab, setActiveTab] = useState<Tab>('Portfolio');
    const [view, setView] = useState<'dashboard' | 'settings'>('dashboard');
    const [settingsInitialSection, setSettingsInitialSection] = useState<ActiveSection | null>(null);
    const [showOnboardingModal, setShowOnboardingModal] = useState(false);

    const projectsForCurrentUser = useMemo(() => {
        if (!currentUser) return [];
        const userRole = getUserRoleInActiveOrg();
        if (!selectedProjectId) {
            if (userRole === 'EMPLOYEE') return projects.filter(project => 
                tasks.some(task => task.projectId === project.id && task.assigneeIds && task.assigneeIds.includes(currentUser.id))
            );
            return [];
        }
        const project = projects.find(p => p.id === selectedProjectId);
        if (!project) return [];
        
        if (['GUEST', 'SUPER_ADMIN', 'ORG_ADMIN', 'TEAM_LEADER'].includes(userRole || '')) {
            return [project];
        }
        // For EMPLOYEE, only return project if they have tasks in it
        const hasTasksInProject = tasks.some(task => 
            task.projectId === project.id && task.assigneeIds && task.assigneeIds.includes(currentUser.id)
        );
        return hasTasksInProject ? [project] : [];
    }, [currentUser, projects, tasks, selectedProjectId, getUserRoleInActiveOrg]);

    useEffect(() => {
        checkAuthStatus();
    }, [checkAuthStatus]);

    useEffect(() => {
        if (projectsForCurrentUser.length > 0 && !projectsForCurrentUser.find(p => p.id === selectedProjectId)) {
            setSelectedProjectId(projectsForCurrentUser[0].id);
        } else if (projectsForCurrentUser.length === 0) {
            setSelectedProjectId(null);
        }
    }, [projectsForCurrentUser, selectedProjectId, setSelectedProjectId]);

    useEffect(() => {
        if (!currentUser) return;
        const userRole = getUserRoleInActiveOrg();
        let availableTabs: Tab[] = ['משימות', 'זמנים'];
        if (userRole === 'SUPER_ADMIN' || userRole === 'ORG_ADMIN') availableTabs = ['Portfolio', 'משימות', 'זמנים', 'כספים'];
        else if (userRole === 'TEAM_LEADER') availableTabs = ['משימות', 'זמנים', 'כספים'];
        if (!availableTabs.includes(activeTab)) {
            setActiveTab((userRole === 'SUPER_ADMIN' || userRole === 'ORG_ADMIN') ? 'Portfolio' : 'משימות');
        }
    }, [currentUser, activeTab, getUserRoleInActiveOrg]);

    useEffect(() => {
        let title = 'PlanD';
        if (view === 'settings') {
            title = 'הגדרות | ' + title;
        } else if (selectedProjectId && projects.length > 0) {
            const projectName = projects.find(p => p.id === selectedProjectId)?.name || '';
            title = projectName ? `${activeTab} - ${projectName} | ${title}` : `${activeTab} | ${title}`;
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

    if (isAppLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-light">
                <Spinner className="w-12 h-12 text-primary"/>
                <p className="text-primary ml-4">טוען נתונים...</p>
            </div>
        );
    }
    if (!currentUser) {
        return (
            <div className="flex items-center justify-center h-screen bg-light">
                <Spinner className="w-12 h-12 text-primary"/>
                <p className="text-primary ml-4">טוען משתמש...</p>
            </div>
        );
    }
    if (!currentUser.memberships) {
        return (
            <div className="flex items-center justify-center h-screen bg-light">
                <Spinner className="w-12 h-12 text-primary"/>
                <p className="text-primary ml-4">טוען שיוכים...</p>
            </div>
        );
    }
    
    if (needsOrganizationSetup) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <h1 className="text-2xl font-bold mb-4">No organizations found</h1>
                <p className="mb-4">Create a new organization to get started.</p>
                {/* You can add your create organization form/component here */}
            </div>
        );
    }

    const renderMainContent = () => {
        if (view === 'settings') {
            return (
                <SettingsView 
                    onBackToDashboard={handleBackToDashboard}
                    initialSection={settingsInitialSection}
                />
            );
        }
        
        switch (activeTab) {
            case 'Portfolio':
                const userRole = getUserRoleInActiveOrg();
                return (userRole === 'SUPER_ADMIN' || userRole === 'ORG_ADMIN') ? <PortfolioView /> : null;
            case 'זמנים':
                return <TimesView tasks={tasks.filter(task => 
                    projectsForCurrentUser.some(project => project.id === task.projectId)
                )} />;
            case 'כספים':
                const financeUserRole = getUserRoleInActiveOrg();
                return ['SUPER_ADMIN', 'ORG_ADMIN', 'TEAM_LEADER'].includes(financeUserRole || '') ? <FinancesView /> : null;
            case 'משימות':
                return <KanbanBoard />;
            default:
                return null;
        }
    };

    return (
        <ErrorBoundary>
            <Router>
                <Suspense fallback={<div className="flex items-center justify-center h-screen bg-light"><Spinner /></div>}>
                    <div className="min-h-screen bg-light font-sans flex flex-col" dir="rtl">
                        <a href="#main-content" className="absolute w-px h-px p-0 -m-px overflow-hidden [clip:rect(0,0,0,0)] whitespace-nowrap border-0 focus:w-auto focus:h-auto focus:p-2 focus:m-0 focus:overflow-visible focus:[clip:auto] focus:z-[100] focus:top-2 focus:right-2 bg-accent text-light rounded-lg">דלג לתוכן המרכזי</a>
                        {notification && (
                            <Toast
                                message={notification.message}
                                type={notification.type}
                                onClose={() => setNotification(null)}
                            />
                        )}

                        {/* FIX: שינינו את לוגיקת הניתוב להשתמש ב-isAuthenticated */}
                        {!isAuthenticated ? (
                             <Routes>
                                <Route path="/login" element={<LoginView />} />
                                <Route path="/reset-password/:token" element={<ResetPasswordView />} />
                                <Route path="/health" element={<HealthCheck />} />
                                <Route path="*" element={<Navigate to="/login" replace />} />
                            </Routes>
                        ) : (
                            <>
                                <Header onGoToSettings={handleToggleSettings} projectsForCurrentUser={projectsForCurrentUser} />
                                {showOnboardingModal && currentUser && (
                                    <OnboardingModal
                                        user={currentUser}
                                        onClose={() => setShowOnboardingModal(false)}
                                        onGoToCreateTeam={handleGoToCreateTeam}
                                    />
                                )}
                                <div className="p-4 sm:p-6 lg:p-8 flex-grow">
                                    {view === 'dashboard' && currentUser && (
                                        <TabBar activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentUser} />
                                    )}
                                    <main id="main-content" className="mt-6 flex-grow">
                                       {renderMainContent()}
                                    </main>
                                </div>
                            </>
                        )}
                    </div>
                </Suspense>
            </Router>
        </ErrorBoundary>
    );
};

export default App;