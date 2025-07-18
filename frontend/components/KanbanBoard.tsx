import React, { useState, useCallback, useMemo } from 'react';
import { COLUMNS } from '../constants';
import { Task } from '../types';
import KanbanColumn from './KanbanColumn';
import TaskModal from './TaskModal';
import AddTaskModal from './AddTaskModal';
import Icon from './Icon';
import InviteGuestModal from './InviteGuestModal';
import { useAuthStore } from '../stores/useAuthStore';
import { useDataStore } from '../stores/useDataStore';
import { UserRoleEnum } from './SettingsView';

// תיקון: הקומפוננטה כבר לא צריכה לקבל props, היא לוקחת את כל המידע שלה מה-store
const KanbanBoard: React.FC = () => {
    const { projects: allProjects, tasks } = useDataStore();
    const { currentUser } = useAuthStore();
    if (!Array.isArray(allProjects) || !Array.isArray(tasks) || !currentUser) {
        return <div>Loading...</div>;
    }
    try {
        const {
            users,
            selectedProjectId,
            handleUpdateTask,
            handleAddTask,
            handleAddComment,
            handleInviteGuest,
            getUserRoleInActiveOrg,
            activeOrganizationId
        } = useDataStore();

        const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
        const [isAddTaskModalOpen, setAddTaskModalOpen] = useState(false);
        const [isInviteModalOpen, setInviteModalOpen] = useState(false);

        // תיקון: סינון המשימות לפי הפרויקט הנבחר מתבצע פעם אחת כאן
        const tasksInProject = useMemo(() => {
            if (!selectedProjectId) return [];
            return tasks.filter(task => task.projectId === selectedProjectId);
        }, [tasks, selectedProjectId]);

        // Wrap all handler functions in useCallback with correct dependencies
        const handleTaskClick = useCallback((task: Task) => {
            setSelectedTaskId(task.id);
        }, []);
        const handleCloseModal = useCallback(() => {
            setSelectedTaskId(null);
        }, []);
        const handleOpenAddTaskModal = useCallback(() => {
            setAddTaskModalOpen(true);
        }, []);
        const handleCloseAddTaskModal = useCallback(() => {
            setAddTaskModalOpen(false);
        }, []);
        const handleCreateTask = useCallback((taskData: Pick<Task, 'title' | 'description' | 'assigneeIds' | 'startDate' | 'endDate' | 'projectId'>) => {
            if (!activeOrganizationId) return;
            handleAddTask({ ...taskData, organizationId: activeOrganizationId });
            setAddTaskModalOpen(false);
        }, [handleAddTask, activeOrganizationId]);
        const handleUpdateAndCloseModal = useCallback((updatedTask: Task) => {
            handleUpdateTask(updatedTask);
        }, [handleUpdateTask]);

        const project = allProjects.find(p => p.id === selectedProjectId);
        const userRole = getUserRoleInActiveOrg();
        const canInvite = selectedProjectId && (userRole === UserRoleEnum.ORG_ADMIN || userRole === UserRoleEnum.TEAM_LEADER);

        if (!currentUser) return null;

        if (!selectedProjectId || !project) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[300px]">
                    <h2 className="text-xl font-bold text-primary mb-2">No project selected</h2>
                    <p className="text-secondary">Please select a project or create a new one to get started.</p>
                </div>
            );
        }

        // תיקון: המשימה הנבחרת נלקחת מתוך רשימת המשימות שכבר סוננה לפרויקט הנוכחי
        const selectedTask = selectedTaskId ? tasksInProject.find(t => t.id === selectedTaskId) : null;

        return (
            <>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-primary">{project?.name || "משימות"}</h2>
                    <div className="flex items-center space-x-3 space-x-reverse">
                        {/* Central Add Full Task Button */}
                        {(userRole === UserRoleEnum.ORG_ADMIN || userRole === UserRoleEnum.TEAM_LEADER) && selectedProjectId && (
                            <button 
                                onClick={handleOpenAddTaskModal} 
                                className="flex items-center space-x-2 space-x-reverse bg-primary hover:bg-primary/90 text-light font-semibold py-2 px-4 rounded-lg transition-colors"
                            >
                                <Icon name="plus" className="w-4 h-4" />
                                <span>+ הוסף משימה מלאה</span>
                            </button>
                        )}
                        {canInvite && (
                            <button onClick={() => setInviteModalOpen(true)} title="הזמן אורח לפרויקט" className="flex items-center space-x-2 space-x-reverse bg-light text-secondary hover:text-primary p-3 rounded-xl shadow-neumorphic-convex hover:shadow-neumorphic-convex-sm active:shadow-neumorphic-concave-sm transition-all">
                                <Icon name="share-alt" className="w-5 h-5" />
                                <span className="text-sm font-semibold">שתף</span>
                            </button>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                    {COLUMNS.map(column => (
                        <KanbanColumn
                            key={column.id}
                            column={column}
                            tasks={tasksInProject.filter(task => task.columnId === column.id)}
                            onTaskClick={handleTaskClick}
                            canAddTask={userRole === UserRoleEnum.ORG_ADMIN || userRole === UserRoleEnum.TEAM_LEADER}
                            canAddProject={!!selectedProjectId}
                            users={users}
                            selectedProjectId={selectedProjectId}
                        />
                    ))}
                </div>
                {selectedTask && (
                    <TaskModal
                        key={selectedTask.id}
                        task={selectedTask}
                        onClose={handleCloseModal}
                        onUpdateTask={handleUpdateAndCloseModal}
                        onAddComment={handleAddComment}
                        currentUser={currentUser}
                        users={users}
                        allProjects={allProjects}
                    />
                )}
                {/* תיקון: הוספת בדיקה ש-selectedProjectId קיים לפני רינדור המודאל */}
                {isAddTaskModalOpen && selectedProjectId && (
                    <AddTaskModal
                        isOpen={isAddTaskModalOpen}
                        onClose={handleCloseAddTaskModal}
                        onSubmit={handleCreateTask}
                        users={users}
                        currentUser={currentUser}
                        projectId={selectedProjectId}
                    />
                )}
                {isInviteModalOpen && selectedProjectId && (
                    <InviteGuestModal
                        isOpen={isInviteModalOpen}
                        onClose={() => setInviteModalOpen(false)}
                        onInvite={(email) => handleInviteGuest(email, selectedProjectId)}
                    />
                )}
            </>
        );
    } catch (error) {
        return <div className="text-danger">שגיאה בטעינת לוח קנבן: {String(error)}</div>;
    }
};

export default KanbanBoard;