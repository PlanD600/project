import React from 'react';
import KanbanCard from './KanbanCard';
import { Task, Column, User } from '../types';
import { useDataStore } from '../../stores/useDataStore';
import { useUIStore } from '../../stores/useUIStore';
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
      </div>
    </div>
  );
};

export default KanbanColumn;