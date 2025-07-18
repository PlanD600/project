import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Team, NotificationPreferences, UserRole } from '../types';
import Icon from './Icon';
import Avatar from './Avatar';
import { useAuthStore } from '../stores/useAuthStore';
import { useDataStore } from '../stores/useDataStore';
import { useUIStore } from '../stores/useUIStore';
import SubscriptionView from './SubscriptionView';
import { GuestManagementView } from './GuestManagementView';


export type ActiveSection = 'my-profile' | 'user-management' | 'team-management' | 'general' | 'billing' | 'my-team' | 'guest-management';

interface SettingsViewProps {
    onBackToDashboard: () => void;
    initialSection: ActiveSection | null;
}

// Helper to get user role for active org
function getUserRoleForActiveOrg(user: User | null, activeOrganizationId: string | null): UserRole | undefined {
  if (!user || !activeOrganizationId) return undefined;
  return user.memberships.find(m => m.organizationId === activeOrganizationId)?.role;
}

// If UserRole is a type alias, define a UserRoleEnum for value comparisons
export const UserRoleEnum = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ORG_ADMIN: 'ORG_ADMIN',
  TEAM_LEADER: 'TEAM_LEADER',
  EMPLOYEE: 'EMPLOYEE',
  GUEST: 'GUEST',
} as const;

const SettingsView: React.FC<SettingsViewProps> = ({ onBackToDashboard, initialSection }) => {
    const { organizations } = useDataStore();
    const { currentUser } = useAuthStore();
    const { activeOrganizationId } = useDataStore();
    
    if (!Array.isArray(organizations) || !currentUser) {
        return <div>Loading...</div>;
    }
    try {
        const getDefaultSection = (role: string | undefined): ActiveSection => {
            if (role === UserRoleEnum.ORG_ADMIN) return 'general';
            if (role === UserRoleEnum.TEAM_LEADER) return 'my-team';
            return 'my-profile';
        };
        
        const userRole = getUserRoleForActiveOrg(currentUser, activeOrganizationId);
        const [activeSection, setActiveSection] = useState<ActiveSection>(
            initialSection || (currentUser ? getDefaultSection(userRole) : 'my-profile')
        );

        useEffect(() => {
            if (initialSection) {
                setActiveSection(initialSection);
            }
        }, [initialSection]);

        const menuItems = useMemo(() => {
            if (!currentUser) return [];
            const userRole = getUserRoleForActiveOrg(currentUser, activeOrganizationId);
            const items: { id: ActiveSection, label: string, icon: any }[] = [
                { id: 'my-profile', label: '\u05d4\u05e8\u05d5\u05e4\u05d9\u05dc \u05e9\u05dc\u05d9', icon: 'user' },
            ];

            if (userRole === UserRoleEnum.TEAM_LEADER) {
                items.push({ id: 'my-team', label: '\u05d4\u05e6\u05d5\u05d5\u05ea \u05e9\u05dc\u05d9', icon: 'team' });
            }

            if (userRole === UserRoleEnum.ORG_ADMIN) {
                items.unshift(
                    { id: 'general', label: '\u05db\u05dc\u05dc\u05d9', icon: 'settings' },
                    { id: 'user-management', label: '\u05e0\u05d9\u05d4\u05d5\u05dc \u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd', icon: 'users' },
                    { id: 'team-management', label: '\u05e0\u05d9\u05d4\u05d5\u05dc \u05e6\u05d5\u05d5\u05ea\u05d9\u05dd', icon: 'team' },
                    { id: 'guest-management', label: '\u05e0\u05d9\u05d4\u05d5\u05dc \u05d0\u05d5\u05e8\u05d7\u05d9\u05dd', icon: 'users' },
                    { id: 'billing', label: '\u05d7\u05d9\u05d5\u05d1\u05d9\u05dd', icon: 'billing' }
                );
            }
            return items;
        }, [currentUser, activeOrganizationId]);
        
        if (!currentUser) return null;

        const userRoleForSections = String(getUserRoleForActiveOrg(currentUser, activeOrganizationId));
        return (
            <div className="bg-medium p-6 rounded-lg shadow-sm border border-dark">
                <button onClick={onBackToDashboard} className="flex items-center text-sm text-accent hover:underline mb-6">
                    &rarr; חזרה ללוח המחוונים
                </button>
                <div className="flex flex-col md:flex-row-reverse gap-8">
                    <aside className="md:w-1/4">
                        <h2 className="text-xl font-bold text-primary mb-4">הגדרות</h2>
                        <nav className="space-y-2">
                            {menuItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveSection(item.id)}
                                    className={`w-full flex items-center space-x-3 space-x-reverse px-3 py-2 rounded-lg text-right transition-colors ${
                                        activeSection === item.id 
                                        ? 'bg-primary text-light font-semibold' 
                                        : 'text-dimmed hover:bg-dark/50 hover:text-primary'
                                    }`}
                                >
                                    <Icon name={item.icon} className="w-5 h-5" />
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </nav>
                    </aside>
                    <main className="flex-1 min-w-0">
                        {activeSection === 'my-profile' && <MyProfileSection />}
                        {userRoleForSections === UserRoleEnum.ORG_ADMIN && activeSection === 'general' && <GeneralSettingsSection />}
                        {userRoleForSections === UserRoleEnum.ORG_ADMIN && activeSection === 'user-management' && <UserManagementSection />}
                        {userRoleForSections === UserRoleEnum.ORG_ADMIN && activeSection === 'team-management' && <SuperAdminTeamManagementSection />}
                        {userRoleForSections === UserRoleEnum.ORG_ADMIN && activeSection === 'guest-management' && <GuestManagementView />}
                        {userRoleForSections === UserRoleEnum.ORG_ADMIN && activeSection === 'billing' && <BillingSection />}
                        {userRoleForSections === UserRoleEnum.TEAM_LEADER && activeSection === 'my-team' && <TeamLeaderTeamSection />}
                    </main>
                </div>
            </div>
        );
    } catch (error) {
        return <div className="text-danger">שגיאה בטעינת הגדרות: {String(error)}</div>;
    }
};

const SectionWrapper: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div>
        <h3 className="text-2xl font-bold text-primary border-b border-dark pb-3 mb-6">{title}</h3>
        <div className="space-y-6">{children}</div>
    </div>
);

const MyProfileSection: React.FC = () => {
    const { currentUser, handleUploadAvatar } = useAuthStore();
    const { handleUpdateUser } = useDataStore();
    const { setNotification } = useUIStore();
    const { activeOrganizationId } = useDataStore();
    
    const [user, setUser] = useState(currentUser);
    const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setUser(currentUser);
    }, [currentUser]);

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) { // 5MB
            setNotification({ message: "הקובץ גדול מדי. הגודל המקסימלי הוא 5MB.", type: 'error' });
            return;
        }
        if (!['image/jpeg', 'image/png'].includes(file.type)) {
            setNotification({ message: "סוג קובץ לא נתמך. אנא בחר קובץ JPG או PNG.", type: 'error' });
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
            handleUploadAvatar(reader.result as string);
        };
        reader.onerror = () => {
            setNotification({ message: "שגיאה בקריאת הקובץ.", type: 'error' });
        };
    };

    const handlePrefChange = (pref: keyof NotificationPreferences) => {
        if (!user) return;
        const newPrefs = { ...user.notificationPreferences, [pref]: !user.notificationPreferences?.[pref] };
        setUser({ ...user, notificationPreferences: newPrefs as NotificationPreferences });
    };

    const handleSaveChanges = () => {
        if(user) {
            handleUpdateUser(user);
            setNotification({ message: 'הפרטים עודכנו בהצלחה.', type: 'success' });
        }
    };
    
    const handleUpdatePassword = () => {
        setNotification({ message: 'פונקציונליות סיסמה תיושם בקרוב.', type: 'info' });
    };

    if (!user) return null;

    return (
        <SectionWrapper title="הפרופיל שלי">
            <div className="bg-light p-6 rounded-lg border border-dark flex flex-col md:flex-row items-center gap-6">
                <div className="relative group w-24 h-24 cursor-pointer" onClick={handleAvatarClick}>
                    <Avatar user={user} className="w-24 h-24 rounded-full" />
                    <div className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Icon name="camera" className="w-8 h-8 text-light" />
                        <span className="text-xs text-light mt-1">שנה תמונה</span>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/png, image/jpeg"
                    />
                </div>
                <div className="flex-1 w-full">
                    <h4 className="text-lg font-semibold text-primary mb-4">פרטים אישיים</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="text-sm font-medium text-dimmed block mb-1">שם מלא</label>
                            <input type="text" value={user.name} onChange={e => setUser({...user, name: e.target.value})} className="w-full bg-light p-2 rounded-md text-primary border border-dark"/>
                        </div>
                         <div>
                            <label className="text-sm font-medium text-dimmed block mb-1">אימייל</label>
                            <input type="email" value={user.email} onChange={e => setUser({...user, email: e.target.value})} className="w-full bg-light p-2 rounded-md text-primary border border-dark"/>
                        </div>
                    </div>
                     <button onClick={handleSaveChanges} className="mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-light rounded-md text-sm">שמור שינויים</button>
                </div>
            </div>

            <div className="bg-light p-6 rounded-lg border border-dark">
                <h4 className="text-lg font-semibold text-primary mb-4">שינוי סיסמה</h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div>
                        <label className="text-sm font-medium text-dimmed block mb-1">סיסמה נוכחית</label>
                        <input type="password" value={passwordData.current} onChange={e => setPasswordData(p => ({...p, current: e.target.value}))} className="w-full bg-light p-2 rounded-md text-primary border border-dark"/>
                    </div>
                     <div>
                        <label className="text-sm font-medium text-dimmed block mb-1">סיסמה חדשה</label>
                        <input type="password" value={passwordData.new} onChange={e => setPasswordData(p => ({...p, new: e.target.value}))} className="w-full bg-light p-2 rounded-md text-primary border border-dark"/>
                    </div>
                     <div>
                        <label className="text-sm font-medium text-dimmed block mb-1">אימות סיסמה חדשה</label>
                        <input type="password" value={passwordData.confirm} onChange={e => setPasswordData(p => ({...p, confirm: e.target.value}))} className="w-full bg-light p-2 rounded-md text-primary border border-dark"/>
                    </div>
                </div>
                 <button onClick={handleUpdatePassword} className="mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-light rounded-md text-sm">עדכן סיסמה</button>
            </div>
            {user.notificationPreferences && (
             <div className="bg-light p-6 rounded-lg border border-dark">
                <h4 className="text-lg font-semibold text-primary mb-4">העדפות התראות</h4>
                <div className="space-y-2">
                    {Object.keys(user.notificationPreferences).map(key => (
                         <label key={key} className="flex items-center space-x-3 space-x-reverse cursor-pointer">
                            <input type="checkbox" checked={user.notificationPreferences?.[key as keyof NotificationPreferences]} onChange={() => handlePrefChange(key as keyof NotificationPreferences)} className="h-5 w-5 rounded bg-light border-dark text-accent focus:ring-accent"/>
                            <span className="text-primary">קבל התראה על: {key.replace('on', '').replace(/([A-Z])/g, ' $1')}</span>
                        </label>
                    ))}
                </div>
                 <button onClick={handleSaveChanges} className="mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-light rounded-md text-sm">שמור העדפות</button>
            </div>
            )}
        </SectionWrapper>
    );
};


const GeneralSettingsSection: React.FC = () => {
    const { organization, setOrganizationSettings } = useDataStore();
    const [settings, setSettings] = useState(organization || { name: '' });

    const handleSave = () => {
        setOrganizationSettings(settings);
        // In a real app, this would also make an API call.
    };
    
    return (
    <SectionWrapper title="הגדרות ארגון כלליות">
         <div className="bg-light p-6 rounded-lg border border-dark">
            <h4 className="text-lg font-semibold text-primary mb-4">פרטי הארגון</h4>
            <div>
                <label className="text-sm font-medium text-dimmed block mb-1">שם הארגון</label>
                <input type="text" value={settings.name} onChange={e => setSettings({...settings, name: e.target.value})} className="w-full md:w-1/2 bg-light p-2 rounded-md text-primary border border-dark"/>
            </div>
             <div className="mt-4">
                <label className="text-sm font-medium text-dimmed block mb-1">לוגו</label>
                <input type="file" className="text-sm text-primary file:ml-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-primary hover:file:bg-accent-hover"/>
            </div>
            <button onClick={handleSave} className="mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-light rounded-md text-sm">שמור שינויים</button>
        </div>
    </SectionWrapper>
    );
}

const UserManagementSection: React.FC = () => {
    const { users, teams, handleDeleteUser, activeOrganizationId } = useDataStore();
    const [isUserModalOpen, setUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [resettingUser, setResettingUser] = useState<User | null>(null);
    const [showAddUserForm, setShowAddUserForm] = useState(false);
    const [addUserForm, setAddUserForm] = useState({
        fullName: '',
        email: '',
        password: '',
        role: 'EMPLOYEE',
    });
    const [addUserLoading, setAddUserLoading] = useState(false);
    const [addUserError, setAddUserError] = useState<string | null>(null);
    const { setNotification } = useUIStore();

    const handleOpenCreate = () => {
        setEditingUser(null);
        setUserModalOpen(true);
    };

    const handleOpenEdit = (user: User) => {
        setEditingUser(user);
        setUserModalOpen(true);
    };
    
    const handleResetPassword = (user: User) => setResettingUser(user);
    
    const confirmAndSendReset = () => {
        if (!resettingUser) return;
        // This would call an API endpoint in a real app
        setResettingUser(null);
    };

    // --- Add User Form Submission ---
    const handleAddUserSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddUserError(null);
        setAddUserLoading(true);
        try {
            const response = await fetch(`/api/organizations/${activeOrganizationId}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(addUserForm),
            });
            const data = await response.json();
            if (!response.ok) {
                setAddUserError(data.error || 'שגיאה בהוספת משתמש');
                setAddUserLoading(false);
                return;
            }
            setNotification({ message: 'המשתמש נוסף בהצלחה!', type: 'success' });
            setShowAddUserForm(false);
            setAddUserForm({ fullName: '', email: '', password: '', role: 'EMPLOYEE' });
            // Optionally, update users list in store (or refetch)
            // For now, reload page or refetch users if needed
        } catch (err) {
            setAddUserError('שגיאה בהוספת משתמש');
        } finally {
            setAddUserLoading(false);
        }
    };

    return(
        <SectionWrapper title="ניהול משתמשים">
             <div className="bg-light p-6 rounded-lg border border-dark">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => setShowAddUserForm(f => !f)} className="flex items-center space-x-2 space-x-reverse px-3 py-1.5 bg-primary text-light rounded-md text-sm"><Icon name="plus" className="w-4 h-4" /> <span>הוסף משתמש</span></button>
                    <h4 className="text-lg font-semibold text-primary">כל המשתמשים</h4>
                </div>
                {showAddUserForm && (
                    <form onSubmit={handleAddUserSubmit} className="mb-6 bg-medium p-4 rounded-lg border border-dark flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium mb-1">שם מלא</label>
                                <input type="text" value={addUserForm.fullName} onChange={e => setAddUserForm(f => ({ ...f, fullName: e.target.value }))} required className="w-full p-2 rounded-md border border-dark" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium mb-1">אימייל</label>
                                <input type="email" value={addUserForm.email} onChange={e => setAddUserForm(f => ({ ...f, email: e.target.value }))} required className="w-full p-2 rounded-md border border-dark" />
                            </div>
                        </div>
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium mb-1">סיסמה ראשונית</label>
                                <input type="password" value={addUserForm.password} onChange={e => setAddUserForm(f => ({ ...f, password: e.target.value }))} required className="w-full p-2 rounded-md border border-dark" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium mb-1">תפקיד</label>
                                <select value={addUserForm.role} onChange={e => setAddUserForm(f => ({ ...f, role: e.target.value }))} required className="w-full p-2 rounded-md border border-dark">
                                    <option value="ORG_ADMIN">מנהל מערכת</option>
                                    <option value="TEAM_LEADER">ראש צוות</option>
                                    <option value="EMPLOYEE">עובד</option>
                                    <option value="GUEST">אורח</option>
                                </select>
                            </div>
                        </div>
                        {addUserError && <div className="text-danger text-sm">{addUserError}</div>}
                        <div className="flex gap-2">
                            <button type="submit" disabled={addUserLoading} className="bg-primary text-light px-6 py-2 rounded-md text-sm font-semibold disabled:opacity-50">{addUserLoading ? 'מוסיף...' : 'הוסף משתמש'}</button>
                            <button type="button" onClick={() => setShowAddUserForm(false)} className="bg-dark/20 text-primary px-6 py-2 rounded-md text-sm font-semibold">ביטול</button>
                        </div>
                    </form>
                )}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right text-primary">
                        <thead className="text-xs uppercase bg-medium text-dimmed">
                            <tr>
                                <th className="px-4 py-3">שם</th>
                                <th className="px-4 py-3">תפקיד</th>
                                <th className="px-4 py-3">צוות</th>
                                <th className="px-4 py-3">סטטוס</th>
                                <th className="px-4 py-3">פעולות</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.filter(u => getUserRoleForActiveOrg(u, activeOrganizationId) !== UserRoleEnum.GUEST).map(user => (
                                <tr key={user.id} className="border-b border-dark hover:bg-medium">
                                    <td className="px-4 py-3 font-semibold text-primary flex items-center gap-3">
                                        <Avatar user={user} className="w-8 h-8 rounded-full" />
                                        <div>
                                            {user.name}
                                            <div className="text-xs text-dimmed">{user.email}</div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">{String(getUserRoleForActiveOrg(user, activeOrganizationId))}</td>
                                    <td className="px-4 py-3 text-dimmed">{Array.isArray(teams) ? teams.find(t => t.id === user.teamId)?.name || 'ללא שיוך' : 'ללא שיוך'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 text-xs rounded-full ${user.disabled ? 'bg-danger/20 text-danger' : 'bg-success/20 text-success'}`}>
                                            {user.disabled ? 'מושבת' : 'פעיל'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3 text-dimmed">
                                            <button onClick={() => handleOpenEdit(user)} aria-label={`ערוך את ${user.name}`} title="ערוך משתמש" className="hover:text-accent"><Icon name="edit" className="w-4 h-4"/></button>
                                            <button onClick={() => handleResetPassword(user)} aria-label={`אפס סיסמה עבור ${user.name}`} title="אפס סיסמה" className="hover:text-accent"><Icon name="key" className="w-4 h-4"/></button>
                                            <button onClick={() => handleDeleteUser(user.id)} aria-label={`השבת את ${user.name}`} title="השבת משתמש" className="hover:text-danger"><Icon name="trash" className="w-4 h-4"/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {isUserModalOpen && <UserModal isOpen={isUserModalOpen} onClose={() => setUserModalOpen(false)} userToEdit={editingUser} />}
            {resettingUser && <ResetPasswordModal isOpen={!!resettingUser} onClose={() => setResettingUser(null)} onConfirm={confirmAndSendReset} userEmail={resettingUser.email} />}
        </SectionWrapper>
    );
};

const SuperAdminTeamManagementSection: React.FC = () => {
    const { teams, users, handleDeleteTeam, activeOrganizationId } = useDataStore();
    const [isTeamModalOpen, setTeamModalOpen] = useState(false);
    const [editingTeam, setEditingTeam] = useState<Team | null>(null);

    const handleOpenCreate = () => { setEditingTeam(null); setTeamModalOpen(true); };
    const handleOpenEdit = (team: Team) => { setEditingTeam(team); setTeamModalOpen(true); };

    return(
        <SectionWrapper title="ניהול צוותים">
             <div className="bg-light p-6 rounded-lg border border-dark">
                 <div className="flex justify-between items-center mb-4">
                    <button onClick={handleOpenCreate} className="flex items-center space-x-2 space-x-reverse px-3 py-1.5 bg-primary text-light rounded-md text-sm"><Icon name="plus" className="w-4 h-4" /> <span>צור צוות</span></button>
                    <h4 className="text-lg font-semibold text-primary">כל הצוותים</h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right text-primary">
                         <thead className="text-xs uppercase bg-medium text-dimmed">
                            <tr>
                                <th className="px-4 py-3">שם הצוות</th>
                                <th className="px-4 py-3">ראש צוות</th>
                                <th className="px-4 py-3">חברים</th>
                                <th className="px-4 py-3">פעולות</th>
                            </tr>
                        </thead>
                         <tbody>
                            {teams.map(team => {
                                const leader = Array.isArray(users) ? users.find(l => l.teamId === team.id && getUserRoleForActiveOrg(l, activeOrganizationId) === UserRoleEnum.TEAM_LEADER) : undefined;
                                const members = users.filter(u => u.teamId === team.id);
                                return (
                                    <tr key={team.id} className="border-b border-dark hover:bg-medium">
                                        <td className="px-4 py-3 font-semibold text-primary">{team.name}</td>
                                        <td className="px-4 py-3 text-dimmed">{leader?.name || 'לא שויך'}</td>
                                        <td className="px-4 py-3 text-dimmed">{members.length}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3 text-dimmed">
                                                <button onClick={() => handleOpenEdit(team)} aria-label={`ערוך את צוות ${team.name}`} title="ערוך צוות" className="hover:text-accent"><Icon name="edit" className="w-4 h-4"/></button>
                                                <button onClick={() => handleDeleteTeam(team.id)} aria-label={`מחק את צוות ${team.name}`} title="מחק צוות" className="hover:text-danger"><Icon name="trash" className="w-4 h-4"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                         </tbody>
                    </table>
                </div>
            </div>
             {isTeamModalOpen && <TeamModal isOpen={isTeamModalOpen} onClose={() => setTeamModalOpen(false)} teamToEdit={editingTeam} />}
        </SectionWrapper>
    );
};

const TeamLeaderTeamSection: React.FC = () => {
    const { currentUser } = useAuthStore();
    const { teams, users, handleUpdateTeam, handleAddUsersToTeam, handleRemoveUserFromTeam, activeOrganizationId } = useDataStore();
    const [teamName, setTeamName] = useState('');
    const [isAddMemberOpen, setAddMemberOpen] = useState(false);
    
    const myTeam = useMemo(() => Array.isArray(teams) ? teams.find(t => t.id === currentUser?.teamId) : undefined, [teams, currentUser]);
    const myTeamMembers = useMemo(() => users.filter(u => u.teamId === currentUser?.teamId && u.id !== currentUser?.id), [users, currentUser]);

    useEffect(() => {
        if (myTeam) setTeamName(myTeam.name);
    }, [myTeam]);

    if (!myTeam || !currentUser) return <SectionWrapper title="הצוות שלי">אינך משויך לצוות.</SectionWrapper>;
    
    const unassignedUsers = users.filter(u => !u.teamId && getUserRoleForActiveOrg(u, activeOrganizationId) === UserRoleEnum.EMPLOYEE);

    const handleUpdateTeamName = () => {
        handleUpdateTeam({ ...myTeam, name: teamName }, currentUser.id, myTeamMembers.map(m => m.id));
    };
    
    const handleAddSelectedUsers = (selectedUserIds: string[]) => {
        handleAddUsersToTeam(selectedUserIds, myTeam.id);
        setAddMemberOpen(false);
    }

    return (
         <SectionWrapper title="הצוות שלי">
             <div className="bg-light p-6 rounded-lg border border-dark">
                 <h4 className="text-lg font-semibold text-primary mb-4">הגדרות צוות</h4>
                 <div>
                    <label className="text-sm font-medium text-dimmed block mb-1">שם הצוות</label>
                    <input type="text" value={teamName} onChange={e => setTeamName(e.target.value)} className="w-full md:w-1/2 bg-light p-2 rounded-md text-primary border border-dark"/>
                 </div>
                 <button onClick={handleUpdateTeamName} className="mt-4 px-4 py-2 bg-primary text-light rounded-md text-sm">שמור שינויים</button>
            </div>
            <div className="bg-light p-6 rounded-lg border border-dark">
                 <div className="flex justify-between items-center mb-4">
                    <button onClick={() => setAddMemberOpen(true)} className="flex items-center space-x-2 space-x-reverse px-3 py-1.5 bg-primary text-light rounded-md text-sm"><Icon name="plus" className="w-4 h-4" /> <span>הוסף חבר צוות</span></button>
                    <h4 className="text-lg font-semibold text-primary">חברי הצוות ({myTeamMembers.length + 1})</h4>
                </div>
                 <div className="space-y-3">
                     <div className="flex items-center space-x-3 space-x-reverse bg-medium p-3 rounded-md">
                         <Avatar user={currentUser} className="w-10 h-10 rounded-full" />
                         <div>
                             <div className="text-primary font-bold">{currentUser.name} <span className="text-xs font-normal px-2 py-0.5 bg-accent/50 text-primary rounded-full">ראש צוות</span></div>
                             <div className="text-sm text-dimmed">{currentUser.email}</div>
                         </div>
                     </div>
                     {myTeamMembers.map(user => (
                         <div key={user.id} className="flex items-center justify-between space-x-3 space-x-reverse bg-medium p-3 rounded-md">
                              <div className="flex items-center space-x-3 space-x-reverse">
                                <Avatar user={user} className="w-10 h-10 rounded-full" />
                                <div>
                                    <div className="text-primary font-medium">{user.name}</div>
                                    <div className="text-sm text-dimmed">{user.email}</div>
                                </div>
                             </div>
                             <button onClick={() => handleRemoveUserFromTeam(user.id, myTeam.id)} aria-label={`הסר את ${user.name} מהצוות`} title="הסר מהצוות" className="text-dimmed hover:text-danger p-1 rounded-full"><Icon name="close" className="w-5 h-5"/></button>
                         </div>
                     ))}
                 </div>
            </div>
             {isAddMemberOpen && <AddTeamMemberModal isOpen={isAddMemberOpen} onClose={() => setAddMemberOpen(false)} unassignedUsers={unassignedUsers} onAddMembers={handleAddSelectedUsers} />}
         </SectionWrapper>
    )
};

const BillingSection: React.FC = () => (
    <SubscriptionView />
);

const UserModal: React.FC<{ isOpen: boolean; onClose: () => void; userToEdit: User | null }> = ({ isOpen, onClose, userToEdit }) => {
    const { teams, handleCreateUser, handleUpdateUser } = useDataStore();
    const [formData, setFormData] = useState({
        name: userToEdit?.name || '',
        email: userToEdit?.email || '',
        teamId: userToEdit?.teamId || '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (userToEdit) {
            handleUpdateUser({ ...userToEdit, ...formData, teamId: formData.teamId || undefined });
        } else {
            handleCreateUser({
                ...formData,
                memberships: [],
                ledProjects: [],
            } as Omit<User, 'id' | 'avatarUrl'>);
        }
        onClose();
    };
    
    if (!isOpen) return null;

    return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <form 
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-modal-title"
        className="bg-medium rounded-lg shadow-2xl w-full max-w-lg border border-dark" 
        onClick={e => e.stopPropagation()} 
        onSubmit={handleSubmit}
      >
        <header className="p-4 border-b border-dark flex justify-between items-center">
            <button type="button" onClick={onClose} aria-label="סגור חלון"><Icon name="close" /></button>
            <h2 id="user-modal-title" className="text-xl font-bold text-primary">{userToEdit ? 'ערוך משתמש' : 'הוסף משתמש חדש'}</h2>
        </header>
        <main className="p-6 space-y-4">
            <div>
                <label className="text-sm text-dimmed block mb-1">שם מלא</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-light p-2 rounded-md text-primary border border-dark" required />
            </div>
             <div>
                <label className="text-sm text-dimmed block mb-1">כתובת אימייל</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-light p-2 rounded-md text-primary border border-dark" disabled={!!userToEdit} required />
            </div>
             <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-sm text-dimmed block mb-1">צוות</label>
                     <select value={formData.teamId} onChange={e => setFormData({...formData, teamId: e.target.value})} className="w-full bg-light p-2 rounded-md text-primary border border-dark">
                        <option value="">ללא שיוך</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
             </div>
        </main>
        <footer className="p-4 bg-medium/50 border-t border-dark flex justify-end gap-3">
            <button type="submit" className="px-4 py-2 text-sm rounded-md bg-primary hover:bg-primary/90 text-light">{userToEdit ? 'שמור שינויים' : 'צור משתמש'}</button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-dark hover:bg-dark/80 text-primary">ביטול</button>
        </footer>
      </form>
    </div>
    )
};


const TeamModal: React.FC<{ isOpen: boolean; onClose: () => void; teamToEdit: Team | null }> = ({ isOpen, onClose, teamToEdit }) => {
    const { users, handleCreateTeam, handleUpdateTeam, activeOrganizationId } = useDataStore();
    const leaderAndAdmins = useMemo(() => users.filter(u => getUserRoleForActiveOrg(u, activeOrganizationId) === UserRoleEnum.TEAM_LEADER || getUserRoleForActiveOrg(u, activeOrganizationId) === UserRoleEnum.ORG_ADMIN), [users]);
    const employees = useMemo(() => users.filter(u => getUserRoleForActiveOrg(u, activeOrganizationId) === UserRoleEnum.EMPLOYEE), [users]);

    const getInitialMembers = () => teamToEdit ? users.filter(u => u.teamId === teamToEdit.id && getUserRoleForActiveOrg(u, activeOrganizationId) === UserRoleEnum.EMPLOYEE).map(u => u.id) : [];
    const getInitialLeader = () => teamToEdit ? (Array.isArray(users) ? users.find(u => u.teamId === teamToEdit.id && (getUserRoleForActiveOrg(u, activeOrganizationId) === UserRoleEnum.TEAM_LEADER || getUserRoleForActiveOrg(u, activeOrganizationId) === UserRoleEnum.ORG_ADMIN)) : undefined) : undefined;

    const initialLeader = getInitialLeader();
    const [name, setName] = useState(teamToEdit?.name || '');
    const [leaderId, setLeaderId] = useState<string | null>(initialLeader ? initialLeader.id : null);
    const [memberIds, setMemberIds] = useState<string[]>(getInitialMembers());

    const availableMembers = employees.filter(e => !e.teamId || (memberIds && memberIds.includes(e.id)));
    
    const handleMemberToggle = (id: string) => {
        setMemberIds(prev => prev && prev.includes(id) ? prev.filter(mId => mId !== id) : [...(prev || []), id]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!leaderId) return;
        if (teamToEdit) {
            handleUpdateTeam({ ...teamToEdit, name }, leaderId, memberIds);
        } else {
            if (!activeOrganizationId) return;
            handleCreateTeam({ name, organizationId: activeOrganizationId }, leaderId, memberIds);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
     <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <form 
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-modal-title"
        className="bg-medium rounded-lg shadow-2xl w-full max-w-lg border border-dark" 
        onClick={e => e.stopPropagation()} 
        onSubmit={handleSubmit}
      >
        <header className="p-4 border-b border-dark flex justify-between items-center">
            <button type="button" onClick={onClose} aria-label="סגור חלון"><Icon name="close" /></button>
            <h2 id="team-modal-title" className="text-xl font-bold text-primary">{teamToEdit ? 'ערוך צוות' : 'צור צוות חדש'}</h2>
        </header>
        <main className="p-6 space-y-4">
             <div>
                <label className="text-sm text-dimmed block mb-1">שם הצוות</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-light p-2 rounded-md text-primary border border-dark" required />
            </div>
             <div>
                <label className="text-sm text-dimmed block mb-1">בחר ראש צוות</label>
                <select value={leaderId || ''} onChange={e => setLeaderId(e.target.value)} className="w-full bg-light p-2 rounded-md text-primary border border-dark" required>
                    <option value="" disabled>בחר ראש צוות</option>
                    {leaderAndAdmins.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
            </div>
            <div>
                <label className="text-sm text-dimmed block mb-1">הוסף חברי צוות</label>
                <div className="bg-light p-2 rounded-md border border-dark max-h-48 overflow-y-auto">
                    {availableMembers.map(user => (
                         <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-dark/50 rounded-md cursor-pointer">
                            <input type="checkbox" checked={memberIds && memberIds.includes(user.id)} onChange={() => handleMemberToggle(user.id)} className="h-4 w-4 rounded bg-light border-dark text-accent focus:ring-accent"/>
                            <Avatar user={user} className="w-7 h-7 rounded-full"/>
                            <span className="text-primary">{user.name}</span>
                        </label>
                    ))}
                </div>
            </div>
        </main>
        <footer className="p-4 bg-medium/50 border-t border-dark flex justify-end gap-3">
            <button type="submit" className="px-4 py-2 text-sm rounded-md bg-primary hover:bg-primary/90 text-light">{teamToEdit ? 'שמור שינויים' : 'צור צוות'}</button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-dark hover:bg-dark/80 text-primary">ביטול</button>
        </footer>
      </form>
    </div>
    )
};

const AddTeamMemberModal: React.FC<{ isOpen: boolean; onClose: () => void; unassignedUsers: User[]; onAddMembers: (selectedIds: string[]) => void; }> = ({ isOpen, onClose, unassignedUsers, onAddMembers }) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const handleToggle = (id: string) => {
        setSelectedIds(prev => prev && prev.includes(id) ? prev.filter(uId => uId !== id) : [...(prev || []), id]);
    };

    const handleSubmit = () => {
        onAddMembers(selectedIds);
        onClose();
    };

    if (!isOpen) return null;

     return (
     <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-member-modal-title"
        className="bg-medium rounded-lg shadow-2xl w-full max-w-md border border-dark" 
        onClick={e => e.stopPropagation()}>
        <header className="p-4 border-b border-dark flex justify-between items-center">
            <button type="button" onClick={onClose} aria-label="סגור חלון"><Icon name="close" /></button>
            <h2 id="add-member-modal-title" className="text-xl font-bold text-primary">הוסף חברי צוות</h2>
        </header>
        <main className="p-6">
            <p className="text-sm text-dimmed mb-4">בחר מבין העובדים הלא משויכים כדי להוסיף לצוות שלך.</p>
            <div className="bg-light p-2 rounded-md border border-dark max-h-64 overflow-y-auto space-y-1">
                {unassignedUsers.length > 0 ? unassignedUsers.map(user => (
                    <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-dark/50 rounded-md cursor-pointer">
                        <input type="checkbox" checked={selectedIds && selectedIds.includes(user.id)} onChange={() => handleToggle(user.id)} className="h-4 w-4 rounded bg-light border-dark text-accent focus:ring-accent"/>
                        <Avatar user={user} className="w-7 h-7 rounded-full"/>
                        <span className="text-primary">{user.name}</span>
                    </label>
                )) : (
                    <div className="text-center text-dimmed p-4">אין עובדים לא משויכים זמינים.</div>
                )}
            </div>
        </main>
        <footer className="p-4 bg-medium/50 border-t border-dark flex justify-end gap-3">
            <button onClick={handleSubmit} disabled={selectedIds.length === 0} className="px-4 py-2 text-sm rounded-md bg-primary hover:bg-primary/90 text-light disabled:opacity-50">הוסף נבחרים</button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-dark hover:bg-dark/80 text-primary">ביטול</button>
        </footer>
      </div>
    </div>
    )
};

const ResetPasswordModal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: () => void; userEmail: string; }> = ({ isOpen, onClose, onConfirm, userEmail }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[70] p-4" onClick={onClose}>
            <div 
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="reset-password-title"
                aria-describedby="reset-password-desc"
                className="bg-medium rounded-lg shadow-2xl w-full max-w-md border border-dark" 
                onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-dark flex justify-between items-center">
                    <button type="button" onClick={onClose} aria-label="סגור חלון" className="text-dimmed hover:text-primary">
                        <Icon name="close" className="w-6 h-6" />
                    </button>
                    <h2 id="reset-password-title" className="text-xl font-bold text-primary">אישור איפוס סיסמה</h2>
                </header>
                <div className="p-6">
                    <p id="reset-password-desc" className="text-primary">
                        האם אתה בטוח שברצונך לשלוח קישור לאיפוס סיסמה אל <strong className="text-primary">{userEmail}</strong>?
                    </p>
                    <p className="text-sm text-dimmed mt-2">
                        המשתמש יקבל אימייל עם הוראות לקביעת סיסמה חדשה.
                    </p>
                </div>
                <footer className="p-4 bg-medium/50 border-t border-dark flex justify-end gap-3">
                    <button type="button" onClick={onConfirm} className="px-4 py-2 text-sm rounded-md bg-primary hover:bg-primary/90 text-light">אשר ושלח</button>
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-dark hover:bg-dark/80 text-primary">ביטול</button>
                </footer>
            </div>
        </div>
    );
};

export default SettingsView;