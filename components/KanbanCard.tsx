import React from 'react';
import { Task, User } from '../types';
import Icon from './Icon';
import Avatar from './Avatar';

interface KanbanCardProps {
  task: Task;
  users: User[];
  onTaskClick: (task: Task) => void;
}

const KanbanCard: React.FC<KanbanCardProps> = ({ task, users, onTaskClick }) => {
  const assignees = users.filter(u => task.assigneeIds.includes(u.id));
  const { startDate, endDate } = task;
  
  const formatDate = (dateString: string) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      // Add timezone offset to prevent date from shifting
      const offsetDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
      return offsetDate.toLocaleDateString('he-IL', { month: 'short', day: 'numeric' });
  };

  return (
    <button
      type="button"
      onClick={() => onTaskClick(task)}
      className="w-full text-right bg-light p-4 rounded-xl shadow-neumorphic-convex hover:shadow-neumorphic-convex-sm active:shadow-neumorphic-concave-sm cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-light focus:ring-primary/50"
    >
      <h3 className="font-semibold text-primary mb-2">{task.title}</h3>
      
      {startDate && endDate && (
        <div className="flex items-center text-xs text-secondary my-2">
          <Icon name="calendar" className="w-4 h-4 ml-1.5" />
          <span>{formatDate(startDate)} - {formatDate(endDate)}</span>
        </div>
      )}

      <div className="flex justify-between items-center mt-3">
        <div className="flex items-center space-x-2 space-x-reverse text-sm text-secondary">
          {task.comments.length > 0 && (
            <div className="flex items-center pr-2">
              <span className="mr-1">{task.comments.length}</span>
              <Icon name="comment" className="w-4 h-4" />
            </div>
          )}
        </div>
        <div className="flex -space-x-3 overflow-hidden">
          {assignees.map(assignee => (
             <Avatar 
                key={assignee.id} 
                user={assignee} 
                className="inline-block h-7 w-7 rounded-full ring-2 ring-light"
              />
          ))}
        </div>
      </div>
    </button>
  );
};

export default KanbanCard;