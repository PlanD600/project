import React, { useState, useRef, useEffect } from 'react';
import { Task, User } from '../types';
import { COLUMNS } from '../constants';
import Icon from './Icon';
import Avatar from './Avatar';
import { useAuthStore } from '../stores/useAuthStore';
import { useDataStore } from '../stores/useDataStore';
import { UserRoleEnum } from './SettingsView';

interface KanbanCardProps {
  task: Task;
  users: User[];
  onTaskClick: (task: Task) => void;
  onEditTask?: (task: Task) => void;
}

const KanbanCard: React.FC<KanbanCardProps> = (props) => {
  const { task, users, onTaskClick } = props;
  if (!task || !Array.isArray(users)) {
    return <div>Loading...</div>;
  }
  try {
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const optionsRef = useRef<HTMLDivElement>(null);
    const { currentUser } = useAuthStore();
    const { handleUpdateTask, handleDeleteTask, getUserRoleInActiveOrg } = useDataStore();
    
    const assignees = users.filter(u => task.assigneeIds && task.assigneeIds.includes(u.id));
    const { startDate, endDate } = task;
    
    // Check if user can modify the task (temporary until schema migration)
    const userRole = getUserRoleInActiveOrg();
    const canModifyTask = userRole === UserRoleEnum.ORG_ADMIN || userRole === UserRoleEnum.TEAM_LEADER;
    
    const canDeleteTask = userRole === UserRoleEnum.ORG_ADMIN || userRole === UserRoleEnum.TEAM_LEADER;
    
    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        // Add timezone offset to prevent date from shifting
        const offsetDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
        return offsetDate.toLocaleDateString('he-IL', { month: 'short', day: 'numeric' });
    };

    const getCurrentStatusInfo = () => {
      return COLUMNS.find(col => col.id === task.columnId) || COLUMNS[0];
    };

    const handleStatusChange = async (newColumnId: string) => {
      if (!canModifyTask) return;
      
      try {
        await handleUpdateTask({
          ...task,
          columnId: newColumnId
        });
        setShowStatusDropdown(false);
      } catch (error) {
        console.error('Failed to update task status:', error);
      }
    };

    const handleEditTask = () => {
      if (props.onEditTask) {
        props.onEditTask(task);
      } else {
        onTaskClick(task);
      }
      setShowOptionsMenu(false);
    };

    const handleDeleteTaskClick = async () => {
      if (!canDeleteTask) return;
      
      const confirmed = window.confirm(`האם אתה בטוח שברצונך למחוק את המשימה '${task.title}'? פעולה זו אינה הפיכה.`);
      if (confirmed) {
        try {
          await handleDeleteTask(task.id);
          setShowOptionsMenu(false);
        } catch (error) {
          console.error('Failed to delete task:', error);
        }
      }
    };

    // Close dropdowns when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setShowStatusDropdown(false);
        }
        if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
          setShowOptionsMenu(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentStatus = getCurrentStatusInfo();

    return (
      <div 
        className="w-full text-right bg-light p-4 rounded-xl shadow-neumorphic-convex hover:shadow-neumorphic-convex-sm active:shadow-neumorphic-concave-sm transition-all duration-200 cursor-pointer relative overflow-hidden"
        onClick={() => onTaskClick(task)}
        style={{
          borderLeft: task.color ? `4px solid ${task.color}` : undefined
        }}
      >
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-primary hover:text-primary/80 transition-colors">
            {task.title}
          </h3>
          
          <div className="flex items-center space-x-2 space-x-reverse">
            {/* Quick Status Change Dropdown */}
            {canModifyTask && (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowStatusDropdown(!showStatusDropdown);
                  }}
                  className={`px-2 py-1 rounded-full text-xs font-medium text-light transition-all hover:opacity-80 ${currentStatus.color}`}
                >
                  {currentStatus.title}
                </button>
                
                {showStatusDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-32 bg-light border border-dark rounded-lg shadow-lg z-50">
                    {COLUMNS.map((column) => (
                      <button
                        key={column.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(column.id);
                        }}
                        className={`w-full text-right px-3 py-2 text-sm hover:bg-dark/50 transition-colors ${
                          column.id === task.columnId ? 'bg-dark/30' : ''
                        }`}
                      >
                        <span className={`inline-block w-3 h-3 rounded-full ml-2 ${column.color}`}></span>
                        {column.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* More Options Menu */}
            {(canModifyTask || canDeleteTask) && (
              <div className="relative" ref={optionsRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOptionsMenu(!showOptionsMenu);
                  }}
                  className="p-1 text-secondary hover:text-primary transition-colors"
                  title="אפשרויות נוספות"
                >
                  <Icon name="ellipsis-vertical" className="w-4 h-4" />
                </button>
                
                {showOptionsMenu && (
                  <div className="absolute top-full left-0 mt-1 w-32 bg-light border border-dark rounded-lg shadow-lg z-50">
                    {canModifyTask && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTask();
                        }}
                        className="w-full text-right px-3 py-2 text-sm hover:bg-dark/50 transition-colors flex items-center"
                      >
                        <Icon name="edit" className="w-4 h-4 ml-2" />
                        ערוך משימה
                      </button>
                    )}
                    {canDeleteTask && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTaskClick();
                        }}
                        className="w-full text-right px-3 py-2 text-sm hover:bg-dark/50 transition-colors text-danger flex items-center"
                      >
                        <Icon name="trash" className="w-4 h-4 ml-2" />
                        מחק משימה
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
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
      </div>
    );
  } catch (error) {
    return <div className="text-danger">שגיאה בטעינת כרטיס: {String(error)}</div>;
  }
};

export default KanbanCard;