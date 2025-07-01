import React, { useState, useCallback, useMemo } from 'react';
import { Task, Comment, User, Project } from '../types';
import { COLUMNS } from '../constants';
import Icon from './Icon';
import { summarizeText } from '../services/geminiService';
import Spinner from './Spinner';


interface TaskModalProps {
  task: Task;
  onClose: () => void;
  onUpdateTask: (updatedTask: Task) => void;
  onAddComment: (taskId: string, comment: Comment) => void;
  currentUser: User;
  users: User[];
  allProjects: Project[];
}

type CommentWithChildren = Comment & { children: CommentWithChildren[] };

const TaskModal: React.FC<TaskModalProps> = ({ task, onClose, onUpdateTask, onAddComment, currentUser, users, allProjects }) => {
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const { canEditDetails, canChangeStatus, canComment, assignableUsers } = useMemo(() => {
    const project = allProjects.find(p => p.id === task.projectId);
    
    const isSuperAdmin = currentUser.role === 'Super Admin';
    const isTeamLeaderOfProject = currentUser.role === 'Team Leader' && currentUser.teamId === project?.teamId;
    const isAssignee = task.assigneeIds.includes(currentUser.id);
    const isGuest = currentUser.role === 'Guest';

    const canEditDetails = isSuperAdmin || isTeamLeaderOfProject;
    const canChangeStatus = isSuperAdmin || isTeamLeaderOfProject || isAssignee;
    const canComment = canChangeStatus || isGuest;

    let assignableUsersList: User[] = [];
    if (isSuperAdmin) {
        assignableUsersList = users.filter(u => u.role === 'Employee' || u.role === 'Team Leader');
    } else if (isTeamLeaderOfProject) {
        assignableUsersList = users.filter(u => u.teamId === currentUser.teamId);
    }

    return { canEditDetails, canChangeStatus, canComment, assignableUsers: assignableUsersList };
  }, [currentUser, task, users, allProjects]);


  const handleUpdateField = (field: keyof Task, value: any) => {
    onUpdateTask({ ...task, [field]: value });
  };
  
  const handleAddTopLevelComment = () => {
    if (newComment.trim() && canComment) {
      const comment: Comment = {
        id: `c${Date.now()}`,
        user: currentUser,
        text: newComment.trim(),
        timestamp: new Date().toISOString(),
      };
      onAddComment(task.id, comment);
      setNewComment('');
    }
  };

  const handleAddReply = (parentId: string) => {
    if (replyText.trim() && canComment) {
        const comment: Comment = {
            id: `c${Date.now()}`,
            user: currentUser,
            text: replyText.trim(),
            timestamp: new Date().toISOString(),
            parentId: parentId,
        };
        onAddComment(task.id, comment);
        setReplyingTo(null);
        setReplyText('');
    }
  };


  const handleAssigneeChange = (userId: string) => {
    if (!canEditDetails) return;
    const newAssigneeIds = task.assigneeIds.includes(userId)
      ? task.assigneeIds.filter(id => id !== userId)
      : [...task.assigneeIds, userId];
    handleUpdateField('assigneeIds', newAssigneeIds);
  };

  const handleSetBaseline = () => {
    if (!canEditDetails) return;
    onUpdateTask({
        ...task,
        baselineStartDate: task.startDate,
        baselineEndDate: task.endDate,
    });
  };

  const handleSummarize = async () => {
    if (task.comments.length < 2 || isSummarizing) return;

    setIsSummarizing(true);
    setSummary(null);

    const discussionThread = task.comments
      .map(c => `${c.user.name} (${new Date(c.timestamp).toLocaleString('he-IL')}):\n${c.text}`)
      .join('\n\n---\n\n');
    
    try {
      const result = await summarizeText(discussionThread);
      setSummary(result);
    } catch (error) {
      console.error("Summarization failed", error);
      setSummary("מצטער, לא הצלחתי ליצור סיכום כרגע.");
    } finally {
      setIsSummarizing(false);
    }
  };
  
  const commentsTree = useMemo(() => {
    const commentsById = new Map<string, CommentWithChildren>();
    task.comments.forEach(c => commentsById.set(c.id, { ...c, children: [] }));

    const tree: CommentWithChildren[] = [];
    commentsById.forEach(comment => {
        if (comment.parentId && commentsById.has(comment.parentId)) {
            commentsById.get(comment.parentId)!.children.push(comment);
        } else {
            tree.push(comment);
        }
    });

    tree.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    commentsById.forEach(comment => {
        comment.children.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    });

    return tree;
  }, [task.comments]);


  const CommentView: React.FC<{ comment: CommentWithChildren, level: number }> = ({ comment, level }) => {
    const isReplying = replyingTo === comment.id;
    return (
        <div style={{ marginRight: level > 0 ? `${level * 20}px` : '0px' }} className="mt-4">
            <div className="flex items-start space-x-3 space-x-reverse">
                <img src={comment.user.avatarUrl} alt={comment.user.name} className="w-9 h-9 rounded-full mt-1" />
                <div className="flex-1 bg-light p-3 rounded-lg w-full border border-dark/50">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-dimmed">{new Date(comment.timestamp).toLocaleString('he-IL')}</span>
                        <span className="font-semibold text-primary">{comment.user.name}</span>
                    </div>
                    <p className="text-primary text-sm whitespace-pre-wrap break-words">{comment.text}</p>
                    {canComment && <button onClick={() => { setReplyingTo(comment.id); setReplyText(''); }} className="text-xs text-accent hover:underline mt-2">הגב</button>}
                </div>
            </div>

            {isReplying && (
                <div className="flex items-start space-x-3 space-x-reverse mt-3 pr-5">
                    <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-8 h-8 rounded-full" />
                    <div className="flex-1">
                        <textarea
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            placeholder={`מגיב ל${comment.user.name}...`}
                            className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent"
                            rows={2}
                            autoFocus
                        />
                        <div className="flex justify-end space-x-2 space-x-reverse mt-2">
                             <button onClick={() => handleAddReply(comment.id)} disabled={!replyText.trim()} className="px-3 py-1 text-sm rounded-md bg-accent hover:bg-accent-hover text-primary disabled:opacity-50">שלח</button>
                            <button onClick={() => setReplyingTo(null)} className="px-3 py-1 text-sm rounded-md text-dimmed hover:bg-dark/50">בטל</button>
                        </div>
                    </div>
                </div>
            )}

            {comment.children.map(child => <CommentView key={child.id} comment={child} level={level + 1} />)}
        </div>
    );
  };
  
  const SummaryView: React.FC<{ content: string }> = ({ content }) => {
    const sections = content.split('**').filter(s => s.trim());
    
    return (
        <div className="text-sm text-primary space-y-2">
            {sections.map((section, idx) => {
                if (idx % 2 === 0) {
                    return <h5 key={idx} className="font-bold text-primary mt-2">{section.trim().replace(/:/g, '')}</h5>;
                } else {
                    const items = section.split('*').map(s => s.trim()).filter(Boolean);
                    return (
                        <ul key={idx} className="list-disc pr-5 space-y-1">
                            {items.map((item, itemIdx) => <li key={itemIdx}>{item}</li>)}
                        </ul>
                    );
                }
            })}
        </div>
    );
  };

  const scheduleSlippage = task.baselineEndDate && task.endDate > task.baselineEndDate;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div 
        role="dialog" 
        aria-modal="true"
        aria-labelledby="task-modal-title"
        className="bg-medium rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-dark" 
        onClick={e => e.stopPropagation()}
      >
        <header className="p-4 border-b border-dark flex justify-between items-center">
            <button onClick={onClose} aria-label="סגור חלון" className="text-dimmed hover:text-primary mr-4">
                <Icon name="close" className="w-7 h-7" />
            </button>
            <input
                id="task-modal-title"
                type="text"
                value={task.title}
                onChange={e => handleUpdateField('title', e.target.value)}
                disabled={!canEditDetails}
                className="text-2xl font-bold text-primary bg-transparent focus:outline-none focus:bg-dark/20 rounded-md px-2 w-full disabled:bg-transparent disabled:cursor-not-allowed"
            />
        </header>

        <div className="p-6 flex-grow overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <aside className="space-y-6">
             <div className="p-4 rounded-lg bg-light border border-dark">
                <h4 className="font-semibold text-dimmed mb-3 text-base">פרטים</h4>
                <div className="space-y-4">
                    <div>
                         <label className="font-medium text-sm text-primary mb-1 block">סטטוס</label>
                         <select value={task.columnId} onChange={e => handleUpdateField('columnId', e.target.value)} disabled={!canChangeStatus} className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:bg-dark/20 disabled:text-dimmed">
                             {COLUMNS.map(col => <option key={col.id} value={col.id}>{col.title}</option>)}
                         </select>
                    </div>
                    <div>
                        <label className="font-medium text-sm text-primary mb-1 block">משויכים</label>
                         <div className="bg-light p-2 rounded-md border border-dark max-h-32 overflow-y-auto">
                            {assignableUsers.length > 0 ? assignableUsers.map(user => (
                                <div key={user.id} className="flex items-center space-x-2 space-x-reverse p-1 rounded hover:bg-dark/50">
                                    <label htmlFor={`assignee-${user.id}-${task.id}`} className="flex items-center text-sm text-primary w-full cursor-pointer">
                                        <img src={user.avatarUrl} alt={user.name} className="w-6 h-6 rounded-full ml-2"/>
                                        {user.name}
                                    </label>
                                    <input
                                        type="checkbox"
                                        id={`assignee-${user.id}-${task.id}`}
                                        checked={task.assigneeIds.includes(user.id)}
                                        onChange={() => handleAssigneeChange(user.id)}
                                        disabled={!canEditDetails}
                                        className="h-4 w-4 text-accent bg-light border-dark rounded focus:ring-accent disabled:cursor-not-allowed"
                                    />
                                </div>
                            )) : users.filter(u => task.assigneeIds.includes(u.id)).map(user => (
                                 <div key={user.id} className="flex items-center space-x-2 space-x-reverse p-1 rounded">
                                     <label className="flex items-center text-sm text-dimmed w-full">
                                        <img src={user.avatarUrl} alt={user.name} className="w-6 h-6 rounded-full ml-2"/>
                                        {user.name}
                                    </label>
                                 </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="font-medium text-sm text-primary mb-1 block">תאריכים</label>
                        <div className="flex items-center space-x-2 space-x-reverse">
                             <input type="date" value={task.endDate} onChange={e => handleUpdateField('endDate', e.target.value)} disabled={!canEditDetails} className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent text-sm disabled:bg-dark/20 disabled:text-dimmed disabled:cursor-not-allowed"/>
                             <input type="date" value={task.startDate} onChange={e => handleUpdateField('startDate', e.target.value)} disabled={!canEditDetails} className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent text-sm disabled:bg-dark/20 disabled:text-dimmed disabled:cursor-not-allowed"/>
                        </div>
                        {scheduleSlippage && <p className="text-xs text-danger mt-1">לוח הזמנים חרג מהבייסליין.</p>}
                        {task.baselineEndDate && <p className="text-xs text-dimmed mt-1">בייסליין: {new Date(task.baselineStartDate!).toLocaleDateString('he-IL')} - {new Date(task.baselineEndDate).toLocaleDateString('he-IL')}</p>}
                        {canEditDetails && <button onClick={handleSetBaseline} className="text-xs flex items-center gap-1 mt-2 text-dimmed hover:text-accent transition"><Icon name="baseline" className="w-3 h-3 ml-1"/>קבע בייסליין נוכחי</button>}
                    </div>
                </div>
             </div>
          </aside>
          <div className="md:col-span-2 space-y-6">
            <div>
              <h3 className="font-semibold text-lg text-dimmed mb-2">תיאור</h3>
              <textarea
                value={task.description}
                onChange={e => handleUpdateField('description', e.target.value)}
                disabled={!canEditDetails}
                className="w-full bg-light text-primary p-2 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-dark/20 disabled:text-dimmed disabled:cursor-not-allowed"
                rows={4}
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-3">
                 <button
                  onClick={handleSummarize}
                  disabled={isSummarizing || task.comments.length < 2}
                  className="flex items-center gap-2 text-sm text-accent hover:text-primary disabled:opacity-50 disabled:cursor-wait transition-colors"
                >
                  <Icon name="sparkles" className="w-4 h-4" />
                  <span>סכם עם AI</span>
                  {isSummarizing && <Spinner className="w-4 h-4" />}
                </button>
                <h3 className="font-semibold text-lg text-dimmed">תגובות ({task.comments.length})</h3>
              </div>

              {summary && (
                <div className="bg-light p-4 rounded-lg mb-4 border border-accent/50">
                    <h4 className="text-base font-semibold text-primary flex items-center justify-end gap-2 mb-2">סיכום AI <Icon name="sparkles" className="w-4 h-4 text-accent" /></h4>
                    <SummaryView content={summary} />
                </div>
              )}
              
              <div className="max-h-96 overflow-y-auto pl-2">
                 {commentsTree.map(comment => <CommentView key={comment.id} comment={comment} level={0} />)}
              </div>
            </div>
          </div>
        </div>

        <footer className="p-4 border-t border-dark bg-medium/50">
          {canComment ? (
              <div className="flex items-start space-x-3 space-x-reverse">
                <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-9 h-9 rounded-full" />
                <div className="flex-1 relative">
                  <textarea value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddTopLevelComment(); }}} placeholder="הוסף תגובה..." className="w-full bg-light text-primary p-2 pr-10 rounded-md border border-dark focus:outline-none focus:ring-2 focus:ring-accent" rows={1} />
                  <button onClick={handleAddTopLevelComment} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-dimmed hover:text-accent disabled:text-dark/50" disabled={!newComment.trim()}>
                      <Icon name="send" className="w-5 h-5"/>
                  </button>
                </div>
              </div>
          ) : (
             <div className="text-center text-sm text-dimmed">אין לך הרשאה להגיב.</div>
          )}
        </footer>
      </div>
    </div>
  );
};

export default TaskModal;