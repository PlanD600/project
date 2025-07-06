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

// תיקון: הקומפוננטה כבר לא צריכה לקבל props, היא לוקחת את כל המידע שלה מה-store
const KanbanBoard: React.FC = () => {
    const { currentUser } = useAuthStore();
    const {
        users,
        selectedProjectId,
        projects: allProjects,
        tasks: allTasks, // לוקחים את כל המשימות מה-store
        handleUpdateTask,
        handleAddTask,
        handleAddComment,
        handleInviteGuest
    } = useDataStore();

    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [isAddTaskModalOpen, setAddTaskModalOpen] = useState(false);
    const [isInviteModalOpen, setInviteModalOpen] = useState(false);

    // תיקון: סינון המשימות לפי הפרויקט הנבחר מתבצע פעם אחת כאן
    const tasksInProject = useMemo(() => {
        if (!selectedProjectId) return [];
        return allTasks.filter(task => task.projectId === selectedProjectId);
    }, [allTasks, selectedProjectId]);

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
        handleAddTask(taskData);
        setAddTaskModalOpen(false);
    }, [handleAddTask]);
    
    const handleUpdateAndCloseModal = useCallback((updatedTask: Task) => {
        handleUpdateTask(updatedTask);
    }, [handleUpdateTask]);

    const project = allProjects.find(p => p.id === selectedProjectId);
    const canInvite = selectedProjectId && (currentUser?.role === 'ADMIN' || currentUser?.role === 'TEAM_MANAGER');

    if (!currentUser) return null;

    // תיקון: המשימה הנבחרת נלקחת מתוך רשימת המשימות שכבר סוננה לפרויקט הנוכחי
    const selectedTask = selectedTaskId ? tasksInProject.find(t => t.id === selectedTaskId) : null;

    return (
        <>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-primary">{project?.name || "משימות"}</h2>
                {canInvite && (
                    <button onClick={() => setInviteModalOpen(true)} title="הזמן אורח לפרויקט" className="flex items-center space-x-2 space-x-reverse bg-light text-secondary hover:text-primary p-3 rounded-xl shadow-neumorphic-convex hover:shadow-neumorphic-convex-sm active:shadow-neumorphic-concave-sm transition-all">
                        <Icon name="share-alt" className="w-5 h-5" />
                        <span className="text-sm font-semibold">שתף</span>
                    </button>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                {COLUMNS.map(column => (
                    <KanbanColumn
                        key={column.id}
                        column={column}
                        tasks={tasksInProject.filter(task => task.columnId === column.id)}
                        onTaskClick={handleTaskClick}
                        onOpenAddTaskModal={handleOpenAddTaskModal}
                        canAddTask={currentUser.role === 'ADMIN' || currentUser.role === 'TEAM_MANAGER'}
                        canAddProject={!!selectedProjectId}
                        users={users}
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
};

export default KanbanBoard;