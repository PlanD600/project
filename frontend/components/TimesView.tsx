import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Task } from '../types';
import TaskModal from './TaskModal';
import { exportGanttToPdf } from '../services/exportService';
import Icon from './Icon';
import InviteGuestModal from './InviteGuestModal';
import Avatar from './Avatar';
import { useAuthStore } from '../stores/useAuthStore';
import { useDataStore } from '../stores/useDataStore';
import { useUIStore } from '../stores/useUIStore';
import AddTaskModal from './AddTaskModal';
import { UserRoleEnum } from './SettingsView';
import path from 'path';

interface TimesViewProps {
  tasks: Task[];
}

interface HierarchicalTask extends Task {
  depth: number;
}

type InteractionType = 'move' | 'resize-end' | 'resize-start' | 'reorder';
interface InteractionState {
  type: InteractionType;
  taskId: string;
  initialMouseX: number;
  initialMouseY: number;
  initialTaskStartPos: number;
  initialTaskWidth: number;
  initialTaskIndex: number;
}

const GANTT_ROW_HEIGHT = 48;
const GANTT_DAY_WIDTH = 40;
const TASK_BAR_HEIGHT = 32;

const buildTaskHierarchy = (tasks: Task[]): HierarchicalTask[] => {
    const taskMap = new Map(tasks.map(t => [t.id, { ...t, children: [] as Task[] }]));
    const roots: Task[] = [];

    tasks.forEach(task => {
        if (task.parentId && taskMap.has(task.parentId)) {
            taskMap.get(task.parentId)!.children.push(task);
        } else {
            roots.push(task);
        }
    });

    const flattened: HierarchicalTask[] = [];
    const traverse = (task: Task, depth: number) => {
        flattened.push({ ...task, depth });
        taskMap.get(task.id)?.children.sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()).forEach(child => traverse(child, depth + 1));
    };

    roots.sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    roots.forEach(root => traverse(root, 0));

    return flattened;
};

const TimesView: React.FC<TimesViewProps> = ({ tasks }) => {
  const { projects: allProjects } = useDataStore();
  const { currentUser } = useAuthStore();
  if (!Array.isArray(tasks) || !Array.isArray(allProjects) || !currentUser) {
    return <div>Loading...</div>;
  }
  try {
    const { 
      users: allUsers, 
      selectedProjectId,
      handleUpdateTask, 
      handleAddComment, 
      handleInviteGuest, 
      handleAddTask, 
      getUserRoleInActiveOrg 
    } = useDataStore();
  
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [interaction, setInteraction] = useState<InteractionState | null>(null);
    const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number; width: number } | null>(null);
    const [reorderGhost, setReorderGhost] = useState<{ y: number; taskId: string } | null>(null);
    const ganttRef = useRef<HTMLDivElement>(null);
    const tasksRef = useRef(tasks);
    const [isInviteModalOpen, setInviteModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'gantt'>('gantt');
    const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
    const { setNotification } = useUIStore();
    
    useEffect(() => {
      const checkMobile = () => {
          if (window.innerWidth < 768) {
              setViewMode('list');
          } else {
              setViewMode('gantt');
          }
      };
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        tasksRef.current = tasks;
    }, [tasks]);

    const ganttStartDate = useMemo(() => {
      if (tasks.length === 0) {
        const today = new Date();
        const nextMonth = new Date();
        nextMonth.setMonth(today.getMonth() + 1);
        return today;
      }
      const dates = tasks.flatMap(t => [new Date(t.startDate), new Date(t.endDate)]);
      let minDate = new Date(Math.min(...dates.map(d => d.getTime())));
      let maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
      
      minDate.setDate(minDate.getDate() - 7);
      maxDate.setDate(maxDate.getDate() + 7);
      minDate.setDate(minDate.getDate() - (minDate.getDay() + 1) % 7); // Start week on Sunday
      
      return minDate;
    }, [tasks]);

    const dateToPosition = useCallback((dateStr: string) => {
      if (!dateStr) return 0;
      const date = new Date(dateStr);
      const diff = (new Date(date.toDateString()).getTime() - new Date(ganttStartDate.toDateString()).getTime()) / (1000 * 3600 * 24);
      return diff * GANTT_DAY_WIDTH;
    }, [ganttStartDate]);

    const scrollToToday = useCallback(() => {
      if (ganttRef.current) {
        const today = new Date();
        const todayPosition = dateToPosition(today.toISOString().split('T')[0]);
        const containerWidth = ganttRef.current.clientWidth;
        const scrollTo = Math.max(0, todayPosition - containerWidth / 2);
        
        ganttRef.current.scrollTo({
          left: scrollTo,
          behavior: 'smooth'
        });
      }
    }, [dateToPosition]);

    // Auto-scroll to today's position when component mounts
    useEffect(() => {
      if (ganttRef.current && tasks.length > 0) {
        scrollToToday();
      }
    }, [tasks, scrollToToday]);

    const hierarchicalTasks = useMemo(() => buildTaskHierarchy(tasks), [tasks]);

    const { totalDays } = useMemo(() => {
      if (tasks.length === 0) {
        const today = new Date();
        const nextMonth = new Date();
        nextMonth.setMonth(today.getMonth() + 1);
        return { totalDays: 30 };
      }
      const dates = tasks.flatMap(t => [new Date(t.startDate), new Date(t.endDate)]);
      let minDate = new Date(Math.min(...dates.map(d => d.getTime())));
      let maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
      
      minDate.setDate(minDate.getDate() - 7);
      maxDate.setDate(maxDate.getDate() + 7);
      minDate.setDate(minDate.getDate() - (minDate.getDay() + 1) % 7); // Start week on Sunday
      
      const differenceInDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 3600 * 24));
      return { totalDays: differenceInDays > 0 ? differenceInDays : 30 };
    }, [tasks]);

    const positionToDate = useCallback((pos: number) => {
      const date = new Date(ganttStartDate);
      date.setDate(date.getDate() + Math.round(pos / GANTT_DAY_WIDTH));
      return date.toISOString().split('T')[0];
    }, [ganttStartDate]);

    const taskPositions = useMemo(() => {
      const positions: Record<string, { y: number, startX: number, width: number }> = {};
      hierarchicalTasks.forEach((task, index) => {
        const startX = dateToPosition(task.startDate);
        const endX = dateToPosition(task.endDate);
        positions[task.id] = {
          y: index * GANTT_ROW_HEIGHT + (GANTT_ROW_HEIGHT - TASK_BAR_HEIGHT) / 2,
          startX,
          width: Math.max(GANTT_DAY_WIDTH, endX - startX + GANTT_DAY_WIDTH),
        };
      });
      return positions;
    }, [hierarchicalTasks, dateToPosition]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>, type: InteractionType, task: HierarchicalTask) => {
      const userRole = getUserRoleInActiveOrg();
      if (userRole !== UserRoleEnum.ORG_ADMIN && userRole !== UserRoleEnum.TEAM_LEADER) return;
      
      e.stopPropagation();
      const taskPos = taskPositions[task.id];
      if (!taskPos) return;

      const taskIndex = hierarchicalTasks.findIndex(t => t.id === task.id);

      setInteraction({
        type,
        taskId: task.id,
        initialMouseX: e.clientX,
        initialMouseY: e.clientY,
        initialTaskStartPos: taskPos.startX,
        initialTaskWidth: taskPos.width,
        initialTaskIndex: taskIndex,
      });
      
      if (type === 'reorder') {
        setReorderGhost({ y: taskPos.y, taskId: task.id });
      } else {
        setGhostPosition({ x: taskPos.startX, width: taskPos.width, y: taskPos.y });
      }
    }, [getUserRoleInActiveOrg, taskPositions, hierarchicalTasks]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
      if (!interaction || !ganttRef.current) return;
      
      const ganttRect = ganttRef.current.getBoundingClientRect();
      const mouseXInGantt = e.clientX - ganttRect.left + ganttRef.current.scrollLeft;
      const deltaX = e.clientX - interaction.initialMouseX;
      const deltaY = e.clientY - interaction.initialMouseY;

      const taskPos = taskPositions[interaction.taskId];
      if (!taskPos) return;

      if (interaction.type === 'reorder') {
        const newY = taskPos.y + deltaY;
        const newIndex = Math.max(0, Math.min(hierarchicalTasks.length - 1, Math.round(newY / GANTT_ROW_HEIGHT)));
        setReorderGhost({ y: newIndex * GANTT_ROW_HEIGHT + (GANTT_ROW_HEIGHT - TASK_BAR_HEIGHT) / 2, taskId: interaction.taskId });
      } else if (interaction.type === 'move') {
        const newX = interaction.initialTaskStartPos + deltaX;
        const snappedX = Math.round(newX / GANTT_DAY_WIDTH) * GANTT_DAY_WIDTH;
        setGhostPosition(g => g ? { ...g, x: snappedX } : null);
      } else if (interaction.type === 'resize-start') {
          const newWidth = interaction.initialTaskWidth - deltaX;
          const newX = interaction.initialTaskStartPos + deltaX;
          const snappedWidth = Math.max(GANTT_DAY_WIDTH, Math.round(newWidth / GANTT_DAY_WIDTH) * GANTT_DAY_WIDTH);
          const snappedX = Math.round(newX / GANTT_DAY_WIDTH) * GANTT_DAY_WIDTH;
          setGhostPosition({ x: snappedX, width: snappedWidth, y: taskPos.y });
      } else if (interaction.type === 'resize-end') {
          const newWidth = interaction.initialTaskWidth + deltaX;
          const snappedWidth = Math.max(GANTT_DAY_WIDTH, Math.round(newWidth / GANTT_DAY_WIDTH) * GANTT_DAY_WIDTH);
          setGhostPosition({ x: interaction.initialTaskStartPos, width: snappedWidth, y: taskPos.y });
      }
    }, [interaction, taskPositions, hierarchicalTasks]);

    const handleMouseUp = useCallback(async () => {
      if (!interaction) {
        setInteraction(null);
        setGhostPosition(null);
        setReorderGhost(null);
        return;
      }

      // Defensive check for tasksRef.current
      if (!Array.isArray(tasksRef.current)) return;
      const task = tasksRef.current.find(t => t.id === interaction.taskId);
      if (!task) {
        setInteraction(null);
        setGhostPosition(null);
        setReorderGhost(null);
        return;
      }

      if (interaction.type === 'reorder') {
        // Handle reordering logic here if needed
        setInteraction(null);
        setReorderGhost(null);
        return;
      }

      if (!ghostPosition) {
        setInteraction(null);
        setGhostPosition(null);
        return;
      }

      const newStartDate = positionToDate(ghostPosition.x);
      const newEndDate = positionToDate(ghostPosition.x + ghostPosition.width);

      try {
        await handleUpdateTask({
          ...task,
          startDate: newStartDate,
          endDate: newEndDate,
        });
        setNotification({ message: 'המשימה עודכנה בהצלחה!', type: 'success' });
      } catch (error) {
        setNotification({ 
          message: `שגיאה בעדכון המשימה: ${(error as Error).message}`, 
          type: 'error' 
        });
      }

      setInteraction(null);
      setGhostPosition(null);
    }, [interaction, ghostPosition, positionToDate, handleUpdateTask, setNotification]);

    useEffect(() => {
      if (interaction) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };
      }
    }, [interaction, handleMouseMove, handleMouseUp]);

    const getTaskColor = (task: Task) => {
      // Use task color if set, otherwise fall back to status-based colors
      if (task.color) return task.color;
      
      const columnId = task.columnId;
      if (columnId === 'col-done') return '#10b981';
      if (columnId === 'col-stuck') return '#ef4444';
      if (columnId === 'col-progress') return '#f59e0b';
      return '#6366f1';
    };

    const isWeekend = (date: Date) => {
      const day = date.getDay();
      return day === 0 || day === 6; // Sunday or Saturday
    };

    const handleCreateTask = useCallback((taskData: Pick<Task, 'title' | 'description' | 'assigneeIds' | 'startDate' | 'endDate' | 'projectId'>) => {
      // Defensive check for allProjects
      if (!Array.isArray(allProjects)) return;
      const project = allProjects.find(p => p.id === selectedProjectId);
      if (!project) return;
      
      handleAddTask({
        ...taskData,
        organizationId: project.organizationId
      });
      setIsAddTaskModalOpen(false);
    }, [handleAddTask, allProjects, selectedProjectId]);

    const userRole = getUserRoleInActiveOrg();
    const canInvite = selectedProjectId && (userRole === UserRoleEnum.ORG_ADMIN || userRole === UserRoleEnum.TEAM_LEADER);

    const GhostTask = () => ghostPosition && (
      <div
        className="absolute bg-primary/30 border-2 border-primary border-dashed rounded-lg pointer-events-none z-10"
        style={{
          left: ghostPosition.x,
          top: ghostPosition.y,
          width: ghostPosition.width,
          height: TASK_BAR_HEIGHT,
        }}
      />
    );

    const ReorderGhost = () => reorderGhost && (
      <div
        className="absolute bg-accent/30 border-2 border-accent border-dashed rounded-lg pointer-events-none z-10"
        style={{
          left: 0,
          top: reorderGhost.y,
          width: '100%',
          height: TASK_BAR_HEIGHT,
        }}
      />
    );

    const GanttView = () => (
      <div className="bg-light rounded-2xl shadow-neumorphic-convex overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-dark">
          <h2 className="text-xl font-bold text-primary">תכנון זמן</h2>
          <div className="flex items-center space-x-3 space-x-reverse">
            {/* Today Button */}
            <button 
              onClick={scrollToToday}
              className="flex items-center space-x-2 space-x-reverse bg-accent hover:bg-accent/80 text-light font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              <Icon name="calendar" className="w-4 h-4" />
              <span>היום</span>
            </button>
            
            {/* Central Add Task Button */}
            {(userRole === UserRoleEnum.ORG_ADMIN || userRole === UserRoleEnum.TEAM_LEADER) && selectedProjectId && (
              <button 
                onClick={() => setIsAddTaskModalOpen(true)} 
                className="flex items-center space-x-2 space-x-reverse bg-primary hover:bg-primary/90 text-light font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                <Icon name="plus" className="w-4 h-4" />
                <span>+ הוסף משימה</span>
              </button>
            )}
            {canInvite && (
              <button onClick={() => setInviteModalOpen(true)} title="הזמן אורח לפרויקט" className="flex items-center space-x-2 space-x-reverse bg-light text-secondary hover:text-primary p-3 rounded-xl shadow-neumorphic-convex hover:shadow-neumorphic-convex-sm active:shadow-neumorphic-concave-sm transition-all">
                <Icon name="share-alt" className="w-5 h-5" />
                <span className="text-sm font-semibold">שתף</span>
              </button>
            )}
            <button onClick={() => exportGanttToPdf(ganttRef.current!)} className="flex items-center space-x-2 space-x-reverse bg-light text-secondary hover:text-primary p-3 rounded-xl shadow-neumorphic-convex hover:shadow-neumorphic-convex-sm active:shadow-neumorphic-concave-sm transition-all">
              <Icon name="download" className="w-5 h-5" />
              <span className="text-sm font-semibold">ייצוא</span>
            </button>
          </div>
        </div>
        
        <div className="relative overflow-auto" ref={ganttRef}>
          <div className="min-w-full" style={{ width: totalDays * GANTT_DAY_WIDTH + 300 }}>
            {/* Header with dates */}
            <div className="sticky top-0 bg-light border-b border-dark z-20">
              <div className="flex">
                <div className="w-72 bg-light border-r border-dark p-4">
                  <h3 className="font-semibold text-primary">משימות</h3>
                </div>
                <div className="flex-1 relative">
                  {Array.from({ length: totalDays }, (_, i) => {
                    const date = new Date(ganttStartDate);
                    date.setDate(date.getDate() + i);
                    const isToday = date.toDateString() === new Date().toDateString();
                    const isWeekendDay = isWeekend(date);
                    return (
                      <div
                        key={i}
                        className={`absolute top-0 bottom-0 border-r border-dark/30 flex items-center justify-center text-xs ${
                          isToday ? 'bg-primary/10 border-primary' : ''
                        } ${isWeekendDay ? 'bg-gray-50' : ''}`}
                        style={{ left: i * GANTT_DAY_WIDTH, width: GANTT_DAY_WIDTH }}
                      >
                        <div className="text-center">
                          <div className={`font-semibold ${isWeekendDay ? 'text-gray-500' : 'text-primary'}`}>
                            {date.toLocaleDateString('he-IL', { day: 'numeric' })}
                          </div>
                          <div className={`${isWeekendDay ? 'text-gray-400' : 'text-dimmed'}`}>
                            {date.toLocaleDateString('he-IL', { month: 'short' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {/* Today marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
                    style={{ left: dateToPosition(new Date().toISOString().split('T')[0]) }}
                  />
                </div>
              </div>
            </div>

            {/* Task rows */}
            <div className="relative">
              {hierarchicalTasks.map((task, index) => {
                const position = taskPositions[task.id];
                if (!position) return null;

                const assignees = allUsers.filter(u => task.assigneeIds && task.assigneeIds.includes(u.id));
                const isInteractive = userRole === UserRoleEnum.ORG_ADMIN || userRole === UserRoleEnum.TEAM_LEADER;

                return (
                  <div key={task.id} className="flex border-b border-dark/30" style={{ height: GANTT_ROW_HEIGHT }}>
                    {/* Task info */}
                    <div className="w-72 bg-light border-r border-dark/30 p-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 
                          className="font-semibold text-primary truncate cursor-pointer hover:text-primary/80 transition-colors"
                          onClick={() => setSelectedTask(task)}
                        >
                          {task.title}
                        </h4>
                        <div className="flex items-center space-x-2 space-x-reverse mt-1">
                          {assignees.slice(0, 2).map(user => (
                            <Avatar key={user.id} user={user} className="w-6 h-6" />
                          ))}
                          {assignees.length > 2 && (
                            <span className="text-xs text-dimmed">+{assignees.length - 2}</span>
                          )}
                        </div>
                      </div>
                      {/* Reorder handle */}
                      {isInteractive && (
                        <div
                          className="cursor-move p-1 text-dimmed hover:text-primary transition-colors"
                          onMouseDown={(e) => handleMouseDown(e, 'reorder', task)}
                          title="גרור לסידור מחדש"
                        >
                          <Icon name="ellipsis-vertical" className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    {/* Task bar */}
                    <div className="flex-1 relative">
                      <div
                        className="absolute rounded-lg cursor-pointer transition-all hover:opacity-80"
                        style={{
                          left: position.startX,
                          top: position.y,
                          width: position.width,
                          height: TASK_BAR_HEIGHT,
                          backgroundColor: getTaskColor(task),
                        }}
                        onClick={() => setSelectedTask(task)}
                        onMouseDown={(e) => isInteractive && handleMouseDown(e, 'move', task)}
                      >
                        <div className="flex items-center justify-center h-full text-light text-xs font-medium px-2">
                          {task.title}
                        </div>
                        
                        {/* Resize handles */}
                        {isInteractive && (
                          <>
                            <div
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-light/20"
                              onMouseDown={(e) => handleMouseDown(e, 'resize-start', task)}
                            />
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-light/20"
                              onMouseDown={(e) => handleMouseDown(e, 'resize-end', task)}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <GhostTask />
              <ReorderGhost />
            </div>
          </div>
        </div>
      </div>
    );

    const formatDateRange = (start: string, end: string) => {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      return `${startDate.toLocaleDateString('he-IL', options)} - ${endDate.toLocaleDateString('he-IL', options)}`;
    }

    const ListView = () => (
      <div className="bg-medium p-4 rounded-lg shadow-sm h-[calc(100vh-18rem)] overflow-y-auto border border-dark">
          <div className="space-y-3">
              {hierarchicalTasks.map(task => {
                  const assignees = allUsers.filter(u => task.assigneeIds && task.assigneeIds.includes(u.id));
                  return (
                      <button key={task.id} onClick={() => setSelectedTask(task)} className="w-full flex items-center justify-between text-right p-3 bg-light rounded-lg shadow-neumorphic-convex hover:shadow-neumorphic-convex-sm active:shadow-neumorphic-concave-sm transition-all">
                          <div className="flex-1 min-w-0">
                              <p className="text-primary font-semibold truncate">{task.title}</p>
                              <p className="text-sm text-dimmed">{formatDateRange(task.startDate, task.endDate)}</p>
                          </div>
                          <div className="flex items-center space-x-2 space-x-reverse ml-4">
                              <div className="flex -space-x-2 overflow-hidden">
                                  {assignees.map(assignee => (
                                      <Avatar key={assignee.id} user={assignee} className="w-7 h-7 rounded-full ring-2 ring-light"/>
                                  ))}
                              </div>
                          </div>
                      </button>
                  )
              })}
          </div>
      </div>
    );
    
    if (!selectedProjectId || !allProjects.find(p => p.id === selectedProjectId)) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          <h2 className="text-xl font-bold text-primary mb-2">No project selected</h2>
          <p className="text-secondary">Please select a project or create a new one to get started.</p>
        </div>
      );
    }

    return (
      <>
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
              
              {/* Quick Add Task */}
              {!isAddTaskModalOpen && (userRole === UserRoleEnum.ORG_ADMIN || userRole === UserRoleEnum.TEAM_LEADER) && (
                <button
                  onClick={() => setIsAddTaskModalOpen(true)}
                  className="flex items-center space-x-2 space-x-reverse bg-accent hover:bg-accent/80 text-light p-2 rounded-lg transition-colors"
                  title="הוסף משימה מהירה"
                >
                  <Icon name="plus" className="w-5 h-5" />
                  <span className="text-sm font-semibold">משימה מהירה</span>
                </button>
              )}

              {/* Quick Add Input */}
              {isAddTaskModalOpen && (
                <AddTaskModal
                  isOpen={isAddTaskModalOpen}
                  onClose={() => setIsAddTaskModalOpen(false)}
                  onSubmit={handleCreateTask}
                  currentUser={currentUser!}
                  users={allUsers}
                  projectId={selectedProjectId!}
                />
              )}

              <div className="bg-light p-1 rounded-lg flex items-center shadow-neumorphic-convex-sm">
                  <button onClick={() => setViewMode('list')} className={`px-3 py-1 rounded-md text-sm ${viewMode === 'list' ? 'bg-primary text-light shadow-inner' : 'text-dimmed'}`}>רשימה</button>
                  <button onClick={() => setViewMode('gantt')} className={`px-3 py-1 rounded-md text-sm ${viewMode === 'gantt' ? 'bg-primary text-light shadow-inner' : 'text-dimmed'}`}>גאנט</button>
              </div>
              
          </div>
          <h2 className="text-2xl font-bold text-primary">{Array.isArray(allProjects) ? allProjects.find(p => p.id === selectedProjectId)?.name || "לוח זמנים" : "לוח זמנים"}</h2>
        </div>

        {viewMode === 'gantt' ? <GanttView /> : <ListView />}
        
        {selectedTask && (
          <TaskModal
            key={selectedTask.id}
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onUpdateTask={handleUpdateTask}
            onAddComment={handleAddComment}
            currentUser={currentUser!}
            users={allUsers}
            allProjects={allProjects}
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
    return <div className="text-danger">שגיאה בטעינת נתוני זמנים: {String(error)}</div>;
  }
};

export default TimesView;