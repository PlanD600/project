import React, { useEffect, Suspense, lazy, useState, useMemo } from 'react'; // הוספה: useState, useMemo
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/useAuthStore';
import { useDataStore, calculateProjectsForCurrentUser } from './stores/useDataStore';
import { useUIStore } from './stores/useUIStore';
import Spinner from './components/Spinner';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';

// ייבוא טיפוסים וקומפוננטות מותאמות אישית
import { Tab } from './components/TabBar'; // ייבוא טיפוס Tab
import { ActiveSection } from './components/SettingsView'; // ייבוא טיפוס ActiveSection

// ייבוא עצל (Lazy loading) של קומפוננטות ראשיות
const Dashboard = lazy(() => import('./components/Dashboard'));
const LoginView = lazy(() => import('./components/LoginView'));
const LegalDocumentView = lazy(() => import('./components/LegalDocumentView'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const ResetPasswordView = lazy(() => import('./components/ResetPasswordView'));

// ייבוא ישיר של קומפוננטות שאינן בטעינה עצלה או מוצגות ישירות
import Header from './components/Header';
import KanbanBoard from './components/KanbanBoard';
import TimesView from './components/TimesView';
import FinancesView from './components/FinancesView';
import PortfolioView from './components/PortfolioView';
import TabBar from './components/TabBar';
import OnboardingModal from './components/OnboardingModal';


// קומפוננטת עזר לניתוב פרטי (Private Route)
const PrivateRoute: React.FC<{ children: JSX.Element }> = ({ children }) => {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// קומפוננטת עזר לניתוב ציבורי (Public Route)
const PublicRoute: React.FC<{ children: JSX.Element }> = ({ children }) => {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
};

const App: React.FC = () => {
    console.log('App: Component rendering...');
    const checkAuthStatus = useAuthStore((state) => state.checkAuthStatus);
    const isAppLoading = useAuthStore((state) => state.isAppLoading);
    const { currentUser } = useAuthStore();
    const { projects, tasks, selectedProjectId, setSelectedProjectId } = useDataStore();
    const { notification, setNotification } = useUIStore();

    const [activeTab, setActiveTab] = useState<Tab>('Portfolio');
    const [view, setView] = useState<'dashboard' | 'settings'>('dashboard');
    const [settingsInitialSection, setSettingsInitialSection] = useState<ActiveSection | null>(null);
    const [showOnboardingModal, setShowOnboardingModal] = useState(false);

    const projectsForCurrentUser = useMemo(() => calculateProjectsForCurrentUser(currentUser, projects, tasks), [currentUser, projects, tasks]);

    const tasksForView = useMemo(() => {
        if (!currentUser || !selectedProjectId) {
            if (currentUser?.role === 'EMPLOYEE') return tasks.filter(task => task.assigneeIds.includes(currentUser.id));
            return [];
        }
        const projectTasks = tasks.filter(task => task.projectId === selectedProjectId);
        if (currentUser.role === 'GUEST' || currentUser.role === 'ADMIN' || currentUser.role === 'TEAM_MANAGER') {
            return projectTasks;
        }
        return projectTasks.filter(task => task.assigneeIds.includes(currentUser.id));
    }, [currentUser, tasks, selectedProjectId]);

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
        if (currentUser.role === 'ADMIN') availableTabs = ['Portfolio', 'משימות', 'זמנים', 'כספים'];
        else if (currentUser.role === 'TEAM_MANAGER') availableTabs = ['משימות', 'זמנים', 'כספים'];
        else if (currentUser.role === 'GUEST') availableTabs = ['משימות', 'זמנים'];

        if (!availableTabs.includes(activeTab)) {
            if (currentUser.role === 'ADMIN') setActiveTab('Portfolio');
            else setActiveTab('משימות');
        }
    }, [currentUser, activeTab]);

    useEffect(() => {
        let title = 'ניהול פרויקטים ';
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

    console.log('App Render Check: isAppLoading =', isAppLoading);
    if (isAppLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-light">
                <Spinner className="w-12 h-12 text-primary"/>
                <p className="text-primary ml-2">טוען יישום...</p>
            </div>
        )
    }

    console.log('App Render Check: isAuthenticated =', isAuthenticated, 'currentUser =', currentUser);
    
    if (!isAuthenticated || !currentUser) {
        return (
            <Router>
                <Routes>
                    <Route path="/login" element={<PublicRoute><LoginView /></PublicRoute>} />
                    <Route path="/reset-password" element={<PublicRoute><ResetPasswordView /></PublicRoute>} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
                {notification && (
                    <Toast
                        message={notification.message}
                        type={notification.type}
                        onClose={() => setNotification(null)}
                    />
                )}
            </Router>
        );
    }

    const renderContent = () => {
        console.log('renderContent: Active Tab =', activeTab, 'Current User Role =', currentUser?.role);
        switch (activeTab) {
            case 'Portfolio':
                return currentUser.role === 'ADMIN' ? <div id="tabpanel-Portfolio" role="tabpanel" aria-labelledby="tab-Portfolio"><PortfolioView /></div> : null;
            case 'זמנים':
                return <div id="tabpanel-זמנים" role="tabpanel" aria-labelledby="tab-זמנים"><TimesView tasks={tasksForView} /></div>;
            case 'כספים':
                return (currentUser.role === 'ADMIN' || currentUser.role === 'TEAM_MANAGER') ? <div id="tabpanel-כספים" role="tabpanel" aria-labelledby="tab-כספים"><FinancesView /></div> : null;
            case 'משימות':
                return <div id="tabpanel-משימות" role="tabpanel" aria="tab-משימות"><KanbanBoard tasks={tasksForView} /></div>;
            default:
                return null;
        }
    };

    console.log('App Render Check: Rendering main layout. View =', view, 'Active Tab =', activeTab);
    return (
        <ErrorBoundary>
            <Router>
                <div className="min-h-screen bg-light font-sans flex flex-col">
                    <a href="#main-content" className="absolute w-px h-px p-0 -m-px overflow-hidden [clip:rect(0,0,0,0)] whitespace-nowrap border-0 focus:w-auto focus:h-auto focus:p-2 focus:m-0 focus:overflow-visible focus:[clip:auto] focus:z-[100] focus:top-2 focus:right-2 bg-accent text-light rounded-lg">דלג לתוכן המרכזי</a>
                    {notification && (
                        <Toast
                            message={notification.message}
                            type={notification.type}
                            onClose={() => setNotification(null)}
                        />
                    )}
                    <Header onGoToSettings={handleToggleSettings} projectsForCurrentUser={projectsForCurrentUser} />
                    {showOnboardingModal && (
                        <OnboardingModal
                            user={currentUser}
                            onClose={() => setShowOnboardingModal(false)}
                            onGoToCreateTeam={handleGoToCreateTeam}
                        />
                    )}
                    <div className="p-4 sm:p-6 lg:p-8 flex-grow">
                        {view === 'dashboard' && <TabBar activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentUser} />}
                        <main id="main-content" className="mt-6 flex-grow">
                            <Routes>
                                <Route path="/dashboard" element={renderContent()} />
                                <Route path="/settings" element={
                                    <SettingsView 
                                        onBackToDashboard={handleBackToDashboard}
                                        initialSection={settingsInitialSection}
                                    />
                                } />
                                <Route path="*" element={<Navigate to="/dashboard" replace />} />
                            </Routes>
                        </main>
                    </div>
                </div>
            </Router>
        </ErrorBoundary>
    );
};

export default App;