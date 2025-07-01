import React from 'react';
import KanbanCard from './KanbanCard';
import { Task, Column, User } from '../types';
import Icon from './Icon';

interface KanbanColumnProps {
  column: Column;
  tasks: Task[];
  users: User[];
  onTaskClick: (task: Task) => void;
  onOpenAddTaskModal: () => void;
  canAddTask: boolean;
  canAddProject: boolean;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ column, tasks, users, onTaskClick, onOpenAddTaskModal, canAddTask, canAddProject }) => {
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
        {canAddTask && (
          <button
            onClick={onOpenAddTaskModal}
            disabled={!canAddProject}
            className="w-full flex items-center justify-center p-3 text-secondary hover:text-primary rounded-xl transition-colors mt-2 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:opacity-50"
          >
            <Icon name="plus" className="w-5 h-5 mr-2" />
            הוסף כרטיס
          </button>
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;