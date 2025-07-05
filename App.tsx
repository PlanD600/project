import React, { useEffect, Suspense, lazy, useState, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/useAuthStore';
import { useDataStore, calculateProjectsForCurrentUser } from './stores/useDataStore';
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

// Lazy-loaded Views
const LoginView = lazy(() => import('./components/LoginView'));
const ResetPasswordView = lazy(() => import('./components/ResetPasswordView'));
const SettingsView = lazy(() => import('./components/SettingsView'));

const App: React.FC = () => {
    // שלב 1: שליפת כל המידע הנדרש מה-stores בצורה מרוכזת
    const { currentUser, isAuthenticated, isAppLoading, checkAuthStatus } = useAuthStore();
    const { projects, tasks, selectedProjectId, setSelectedProjectId } = useDataStore();
    const { notification, setNotification } = useUIStore();

    // שלב 2: ניהול state פנימי של הקומפוננטה
    const [activeTab, setActiveTab] = useState<Tab>('Portfolio');
    const [view, setView] = useState<'dashboard' | 'settings'>('dashboard');
    const [settingsInitialSection, setSettingsInitialSection] = useState<ActiveSection | null>(null);
    const [showOnboardingModal, setShowOnboardingModal] = useState(false);

    // שלב 3: חישובים ונתונים מבוססי memoization לשיפור ביצועים
    const projectsForCurrentUser = useMemo(() => calculateProjectsForCurrentUser(currentUser, projects, tasks), [currentUser, projects, tasks]);

    const tasksForView = useMemo(() => {
        if (!currentUser) return [];
        if (!selectedProjectId) {
            if (currentUser.role === 'EMPLOYEE') return tasks.filter(task => task.assigneeIds.includes(currentUser.id));
            return [];
        }
        const projectTasks = tasks.filter(task => task.projectId === selectedProjectId);
        if (['GUEST', 'ADMIN', 'TEAM_MANAGER'].includes(currentUser.role)) {
            return projectTasks;
        }
        return projectTasks.filter(task => task.assigneeIds.includes(currentUser.id));
    }, [currentUser, tasks, selectedProjectId]);

    // שלב 4: Hooks של useEffect לניהול side effects
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
        let availableTabs: Tab[] = ['משימות', 'זמנים'];
        if (currentUser.role === 'ADMIN') availableTabs = ['Portfolio', 'משימות', 'זמנים', 'כספים'];
        else if (currentUser.role === 'TEAM_MANAGER') availableTabs = ['משימות', 'זמנים', 'כספים'];
        if (!availableTabs.includes(activeTab)) {
            setActiveTab(currentUser.role === 'ADMIN' ? 'Portfolio' : 'משימות');
        }
    }, [currentUser, activeTab]);

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

    // שלב 5: פונקציות event handlers
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
    };

    // שלב 6: לוגיקת רינדור (Render)
    if (isAppLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-light">
                <Spinner className="w-12 h-12 text-primary"/>
                <p className="text-primary ml-4">טוען נתונים...</p>
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
                return currentUser?.role === 'ADMIN' ? <PortfolioView /> : null;
            case 'זמנים':
                return <TimesView tasks={tasksForView} />;
            case 'כספים':
                return ['ADMIN', 'TEAM_MANAGER'].includes(currentUser?.role || '') ? <FinancesView /> : null;
            case 'משימות':
                return <KanbanBoard tasks={tasksForView} />;
            default:
                return null;
        }
    };

    return (
        <ErrorBoundary>
            <Router>
                <Suspense fallback={<div className="flex items-center justify-center h-screen bg-light"><Spinner /></div>}>
                    <div className="min-h-screen bg-light font-sans flex flex-col" dir="rtl">
                        {notification && (
                            <Toast
                                message={notification.message}
                                type={notification.type}
                                onClose={() => setNotification(null)}
                            />
                        )}
                        {!isAuthenticated ? (
                            <Routes>
                                <Route path="/login" element={<LoginView />} />
                                <Route path="/reset-password/:token" element={<ResetPasswordView />} />
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