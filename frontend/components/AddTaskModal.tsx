import React, { useState, useMemo } from 'react';
import { User, Task } from '../types';
import Icon from './Icon';
import Avatar from './Avatar';
import { useDataStore } from '../stores/useDataStore';
import { UserRoleEnum } from './SettingsView';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (taskData: Omit<Task, 'id' | 'columnId' | 'comments' | 'plannedCost' | 'actualCost' | 'dependencies'>) => void;
  users: User[];
  currentUser: User;
  projectId: string;
}

const AddTaskModal: React.FC<AddTaskModalProps> = (props) => {
  if (!props) return <div>Loading...</div>;
  try {
    const d = (days: number) => new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
    const { getUserRoleInActiveOrg, getActiveOrganization } = useDataStore();
    
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
    const [startDate, setStartDate] = useState(d(0));
    const [endDate, setEndDate] = useState(d(7));

    const userRole = getUserRoleInActiveOrg();
    const canManageAssignees = userRole === UserRoleEnum.SUPER_ADMIN || userRole === UserRoleEnum.ORG_ADMIN || userRole === UserRoleEnum.TEAM_LEADER;

    const assignableUsers = useMemo(() => {
        if (userRole === UserRoleEnum.SUPER_ADMIN || userRole === UserRoleEnum.ORG_ADMIN) {
            return props.users.filter(u => (u as any).role === UserRoleEnum.EMPLOYEE || (u as any).role === UserRoleEnum.TEAM_LEADER);
        }
        if (userRole === UserRoleEnum.TEAM_LEADER) {
            return props.users.filter(u => u.teamId === props.currentUser.teamId);
        }
        return [];
    }, [userRole, props.users, props.currentUser.teamId]);

    const handleAssigneeChange = (userId: string) => {
      setAssigneeIds(prev => 
        prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
      );
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim()) return;
      
      const finalAssigneeIds = canManageAssignees ? assigneeIds : [props.currentUser.id];
      const activeOrg = getActiveOrganization();

      props.onSubmit({ 
        title, 
        description, 
        assigneeIds: finalAssigneeIds, 
        startDate, 
        endDate, 
        projectId: props.projectId,
        organizationId: activeOrg?.id || ''
      });
      
      props.onClose();
    };
    
    if (!props.isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={props.onClose}>
        <form 
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-task-modal-title"
          className="bg-medium rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-dark" 
          onClick={e => e.stopPropagation()} 
          onSubmit={handleSubmit}
        >
          <header className="p-4 border-b border-dark flex justify-between items-center">
            <button type="button" onClick={props.onClose} aria-label="סגור חלון" className="text-dimmed hover:text-primary">
              <Icon name="close" className="w-7 h-7" />
            </button>
            <h2 id="add-task-modal-title" className="text-2xl font-bold text-primary">יצירת משימה חדשה</h2>
          </header>

          <div className="p-6 flex-grow overflow-y-auto space-y-6">
            <div>
              <label htmlFor="task-title" className="font-semibold text-lg text-dimmed mb-2 block">כותרת המשימה <span className="text-danger">*</span></label>
              <input
                id="task-title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                placeholder="לדוגמה: עיצוב הלוגו החדש של החברה"
                className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label htmlFor="task-description" className="font-semibold text-lg text-dimmed mb-2 block">תיאור</label>
              <textarea
                id="task-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="הוסף פרטים נוספים על המשימה..."
                className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent"
                rows={4}
              />
            </div>

            {canManageAssignees && (
              <div>
                <label className="font-semibold text-lg text-dimmed mb-2 block">שייך לעובדים</label>
                <div className="bg-light p-2 rounded-md border border-dark max-h-40 overflow-y-auto">
                  {assignableUsers.map(user => (
                    <div key={user.id} className="flex items-center space-x-2 space-x-reverse p-1 rounded hover:bg-dark/50">
                      <label htmlFor={`add-task-assignee-${user.id}`} className="flex items-center text-sm text-primary w-full cursor-pointer">
                        <Avatar user={user} className="w-6 h-6 rounded-full ml-2"/>
                        {user.name} ({(user as any).role})
                      </label>
                      <input
                        type="checkbox"
                        id={`add-task-assignee-${user.id}`}
                        checked={assigneeIds.includes(user.id)}
                        onChange={() => handleAssigneeChange(user.id)}
                        className="h-4 w-4 text-accent bg-light border-dark rounded focus:ring-accent"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div>
              <label className="font-semibold text-lg text-dimmed mb-2 block">תאריכים</label>
              <div className="flex flex-wrap items-center gap-2">
                  <input 
                      type="date" 
                      value={endDate} 
                      onChange={e => setEndDate(e.target.value)} 
                      className="flex-1 min-w-0 bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent box-border" 
                      required 
                  />
                  <input 
                      type="date" 
                      value={startDate} 
                      onChange={e => setStartDate(e.target.value)} 
                      className="flex-1 min-w-0 bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent box-border" 
                      required 
                  />
              </div>
            </div>
          </div>

          <footer className="p-4 border-t border-dark bg-medium/50 flex justify-end space-x-4 space-x-reverse">
            <button type="submit" disabled={!title.trim()} className="px-6 py-2 text-sm font-semibold rounded-md bg-primary hover:bg-primary/90 text-light disabled:opacity-50 disabled:cursor-not-allowed">
              צור משימה
            </button>
            <button type="button" onClick={props.onClose} className="px-4 py-2 text-sm rounded-md text-primary bg-dark/50 hover:bg-dark">
              בטל
            </button>
          </footer>
        </form>
      </div>
    );
  } catch (error) {
    return <div className="text-danger">שגיאה בטעינת מודאל הוספת משימה: {String(error)}</div>;
  }
}

export default AddTaskModal;