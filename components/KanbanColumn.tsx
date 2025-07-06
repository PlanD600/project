import React, { useState } from 'react';
import KanbanCard from './KanbanCard';
import { Task, Column, User } from '../types';
import { useDataStore } from '../stores/useDataStore';
import { useUIStore } from '../stores/useUIStore';
import Icon from './Icon';

interface KanbanColumnProps {
  column: Column;
  tasks: Task[];
  users: User[];
  onTaskClick: (task: Task) => void;
  canAddTask: boolean;
  canAddProject: boolean;
  selectedProjectId: string | null;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ 
  column, 
  tasks, 
  users, 
  onTaskClick, 
  canAddTask, 
  canAddProject,
  selectedProjectId 
}) => {
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickTaskName, setQuickTaskName] = useState('');
  const { handleAddTask } = useDataStore();
  const { setNotification } = useUIStore();

  const handleQuickAdd = async () => {
    if (!quickTaskName.trim() || !selectedProjectId) return;

    try {
      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + 7); // Default to 1 week from now

      await handleAddTask({
        title: quickTaskName.trim(),
        description: '',
        startDate: today.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        projectId: selectedProjectId,
        assigneeIds: []
      });

      setQuickTaskName('');
      setIsQuickAdding(false);
      setNotification({ message: 'המשימה נוספה בהצלחה!', type: 'success' });
    } catch (error) {
      setNotification({ 
        message: `שגיאה ביצירת משימה: ${(error as Error).message}`, 
        type: 'error' 
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleQuickAdd();
    } else if (e.key === 'Escape') {
      setIsQuickAdding(false);
      setQuickTaskName('');
    }
  };

  const handleCancel = () => {
    setIsQuickAdding(false);
    setQuickTaskName('');
  };

  return (
    <div className="bg-light rounded-2xl shadow-neumorphic-convex flex flex-col max-h-[calc(100vh-20rem)]">
      <div className={`p-4 border-b-2 border-shadow-dark flex justify-between items-center`}>
        <h2 className={`font-bold text-lg text-primary`}>{column.title}</h2>
        <span className={`bg-light text-secondary font-bold text-sm rounded-full px-2.5 py-1 shadow-neumorphic-convex-sm`}>
          {tasks.length}
        </span>
      </div>
      <div className="p-2 space-y-3 overflow-y-auto flex-grow">
        {tasks.map(task => (
          <KanbanCard key={task.id} task={task} onTaskClick={onTaskClick} users={users} />
        ))}
        
        {/* Quick Add Task - Keep this for quick task creation */}
        {canAddTask && !isQuickAdding && (
          <button
            onClick={() => setIsQuickAdding(true)}
            disabled={!canAddProject}
            className="w-full flex items-center justify-center p-3 text-secondary hover:text-primary rounded-xl transition-colors mt-2 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:opacity-50 hover:bg-dark/10"
          >
            <Icon name="plus" className="w-5 h-5 ml-2" />
            הוסף משימה מהירה
          </button>
        )}

        {/* Quick Add Input */}
        {isQuickAdding && (
          <div className="bg-light border border-accent rounded-xl p-3 mt-2 shadow-neumorphic-convex">
            <input
              type="text"
              value={quickTaskName}
              onChange={(e) => setQuickTaskName(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="שם המשימה..."
              className="w-full bg-transparent text-primary p-2 border-none outline-none text-sm"
              autoFocus
            />
            <div className="flex justify-end space-x-2 space-x-reverse mt-2">
              <button
                onClick={handleQuickAdd}
                disabled={!quickTaskName.trim()}
                className="px-3 py-1 text-xs bg-accent text-light rounded-md hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                הוסף
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-1 text-xs text-secondary hover:text-primary"
              >
                ביטול
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;