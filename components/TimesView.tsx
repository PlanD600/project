import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Task } from '../types';
import TaskModal from './TaskModal';
import { exportGanttToPdf } from '../services/exportService';
import Icon from './Icon';
import InviteGuestModal from './InviteGuestModal';
import Avatar from './Avatar';
import { useAuthStore } from '../stores/useAuthStore';
import { useDataStore } from '../stores/useDataStore';


interface TimesViewProps {
  tasks: Task[];
}

interface HierarchicalTask extends Task {
  depth: number;
}

type InteractionType = 'move' | 'resize-end' | 'resize-start' | 'link';
interface InteractionState {
  type: InteractionType;
  taskId: string;
  initialMouseX: number;
  initialTaskStartPos: number;
  initialTaskWidth: number;
  linkFromPoint?: 'start' | 'end';
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
  const { currentUser } = useAuthStore();
  const { 
    users: allUsers, 
    projects: allProjects, 
    selectedProjectId,
    handleUpdateTask, 
    handleBulkUpdateTasks, 
    handleAddComment, 
    handleInviteGuest 
  } = useDataStore();
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number; width: number } | null>(null);
  const [linkLinePosition, setLinkLinePosition] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const ganttRef = useRef<HTMLDivElement>(null);
  const tasksRef = useRef(tasks);
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'gantt'>('gantt');
  
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

  const hierarchicalTasks = useMemo(() => buildTaskHierarchy(tasks), [tasks]);

  const { ganttStartDate, totalDays } = useMemo(() => {
    if (tasks.length === 0) {
      const today = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(today.getMonth() + 1);
      return { ganttStartDate: today, totalDays: 30 };
    }
    const dates = tasks.flatMap(t => [new Date(t.startDate), new Date(t.endDate)]);
    let minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    let maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 7);
    minDate.setDate(minDate.getDate() - (minDate.getDay() + 1) % 7); // Start week on Sunday
    
    const differenceInDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 3600 * 24));
    return { ganttStartDate: minDate, totalDays: differenceInDays > 0 ? differenceInDays : 30 };
  }, [tasks]);

  const dateToPosition = useCallback((dateStr: string) => {
    if (!dateStr) return 0;
    const date = new Date(dateStr);
    const diff = (new Date(date.toDateString()).getTime() - new Date(ganttStartDate.toDateString()).getTime()) / (1000 * 3600 * 24);
    return diff * GANTT_DAY_WIDTH;
  }, [ganttStartDate]);

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
    const isInteractive = currentUser?.role === 'Super Admin' || currentUser?.role === 'Team Leader';
    if (!isInteractive) return;
    
    e.stopPropagation();
    const taskPos = taskPositions[task.id];
    if (!taskPos) return;

    setInteraction({
      type,
      taskId: task.id,
      initialMouseX: e.clientX,
      initialTaskStartPos: taskPos.startX,
      initialTaskWidth: taskPos.width,
      linkFromPoint: type === 'link' ? (e.currentTarget.dataset.point as 'start' | 'end') : undefined
    });
    
    if (type !== 'link') {
      setGhostPosition({ x: taskPos.startX, width: taskPos.width, y: taskPos.y });
    }
  }, [currentUser?.role, taskPositions]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!interaction || !ganttRef.current) return;
    
    const ganttRect = ganttRef.current.getBoundingClientRect();
    const mouseXInGantt = e.clientX - ganttRect.left + ganttRef.current.scrollLeft;
    const deltaX = e.clientX - interaction.initialMouseX;

    const taskPos = taskPositions[interaction.taskId];
    if (!taskPos) return;

    if (interaction.type === 'move') {
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
    } else if (interaction.type === 'link') {
        const fromPoint = interaction.linkFromPoint;
        if (!taskPos || !fromPoint) return;
        const x1 = (fromPoint === 'start' ? taskPos.startX : taskPos.startX + taskPos.width) + 300;
        const y1 = taskPos.y + TASK_BAR_HEIGHT / 2;
        setLinkLinePosition({ x1, y1, x2: mouseXInGantt, y2: e.clientY - ganttRect.top });
    }
  }, [interaction, taskPositions]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!interaction) return;

    const originalTasksMap = new Map(tasksRef.current.map(t => [t.id, t]));
    const updatedTasksMap = new Map(tasksRef.current.map(t => [t.id, { ...t }]));
    const mainTask = updatedTasksMap.get(interaction.taskId);
    if (!mainTask) { setInteraction(null); return; }

    let finalTasksToUpdate: Task[] = [];
    const deltaX = e.clientX - interaction.initialMouseX;

    if (interaction.type === 'move') {
        const newX = interaction.initialTaskStartPos + deltaX;
        const snappedX = Math.round(newX / GANTT_DAY_WIDTH) * GANTT_DAY_WIDTH;
        const duration = (new Date(mainTask.endDate).getTime() - new Date(mainTask.startDate).getTime());
        mainTask.startDate = positionToDate(snappedX);
        mainTask.endDate = new Date(new Date(mainTask.startDate).getTime() + duration).toISOString().split('T')[0];
        finalTasksToUpdate.push(mainTask);
    } else if (interaction.type === 'resize-start') {
        const newX = interaction.initialTaskStartPos + deltaX;
        const snappedX = Math.round(newX / GANTT_DAY_WIDTH) * GANTT_DAY_WIDTH;
        if (positionToDate(snappedX) < mainTask.endDate) {
            mainTask.startDate = positionToDate(snappedX);
            finalTasksToUpdate.push(mainTask);
        }
    } else if (interaction.type === 'resize-end') {
        const newWidth = interaction.initialTaskWidth + deltaX;
        const snappedWidth = Math.max(GANTT_DAY_WIDTH, Math.round(newWidth / GANTT_DAY_WIDTH) * GANTT_DAY_WIDTH);
        const newEndDate = positionToDate(interaction.initialTaskStartPos + snappedWidth - GANTT_DAY_WIDTH);
        if (newEndDate > mainTask.startDate) {
            mainTask.endDate = newEndDate;
            finalTasksToUpdate.push(mainTask);
        }
    } else if (interaction.type === 'link') {
        const targetElement = e.target as HTMLElement;
        const targetTaskElement = targetElement.closest('[data-task-id]');
        const toTaskId = targetTaskElement?.getAttribute('data-task-id');
        const fromTaskId = interaction.taskId;
        
        const isCircular = (from: string, to: string): boolean => {
            const queue = [...(updatedTasksMap.get(to)?.dependencies || [])];
            const visited = new Set<string>([to]);
            while(queue.length > 0) {
                const currentId = queue.shift()!;
                if (currentId === from) return true;
                if(visited.has(currentId)) continue;
                visited.add(currentId);
                const task = updatedTasksMap.get(currentId);
                if (task) queue.push(...task.dependencies);
            }
            return false;
        };

        if (toTaskId && fromTaskId !== toTaskId && !isCircular(fromTaskId, toTaskId)) {
            const toTask = updatedTasksMap.get(toTaskId);
            if(toTask && !toTask.dependencies.includes(fromTaskId)) {
                toTask.dependencies.push(fromTaskId);
                finalTasksToUpdate.push(toTask);
            }
        }
    }
    
    if(finalTasksToUpdate.length > 0) {
        const updateQueue = [...finalTasksToUpdate.map(t => t.id)];
        const processed = new Set<string>(updateQueue.map(id => id));

        while(updateQueue.length > 0) {
            const currentId = updateQueue.shift()!;
            
            for(const task of updatedTasksMap.values()) {
                if(task.dependencies.includes(currentId)) {
                    const parentTask = updatedTasksMap.get(currentId)!;
                    const parentEndDate = new Date(parentTask.endDate);
                    const taskDuration = (new Date(task.endDate).getTime() - new Date(task.startDate).getTime());

                    const newStartDate = new Date(parentEndDate);
                    newStartDate.setDate(newStartDate.getDate() + 2); // 1 day buffer
                    
                    if(new Date(task.startDate).getTime() < newStartDate.getTime()){
                        task.startDate = newStartDate.toISOString().split('T')[0];
                        task.endDate = new Date(newStartDate.getTime() + taskDuration).toISOString().split('T')[0];
                        if(!processed.has(task.id)) {
                            finalTasksToUpdate.push(task);
                            updateQueue.push(task.id);
                            processed.add(task.id);
                        }
                    }
                }
            }
        }
        handleBulkUpdateTasks(finalTasksToUpdate, originalTasksMap);
    }

    setInteraction(null);
    setGhostPosition(null);
    setLinkLinePosition(null);
  }, [interaction, handleBulkUpdateTasks, positionToDate]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);
  
  const todayPosition = dateToPosition(new Date().toISOString().split('T')[0]);
  const taskColors = ['#83c5be', '#e29578', '#fec89a', '#a5a58d', '#b7b7a4', '#dda15e'];
  const getTaskColor = (taskId: string) => {
      let hash = 0;
      for (let i = 0; i < taskId.length; i++) hash = taskId.charCodeAt(i) + ((hash << 5) - hash);
      return taskColors[Math.abs(hash) % taskColors.length];
  }
  
  const handleKeyDown = (e: React.KeyboardEvent, task: Task) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setSelectedTask(task);
    }
  };

  const GanttHeader = React.memo(() => {
    const months = [];
    for (let i = 0; i < totalDays; i++) {
        const date = new Date(ganttStartDate);
        date.setDate(date.getDate() + i);
        if (i === 0 || date.getDate() === 1) {
            months.push({
                name: date.toLocaleString('he-IL', { month: 'long', year: 'numeric' }),
                start: i,
            });
        }
    }
    return (
        <div className="sticky top-0 z-20 bg-light shadow-sm" style={{ height: 60 }}>
            <div className="flex h-full">
                 <div className="flex-1">
                    <div className="relative flex h-8 border-b border-dark">
                        {months.map((month, index) => {
                             const nextMonthStart = months[index + 1] ? months[index + 1].start : totalDays;
                             const width = (nextMonthStart - month.start) * GANTT_DAY_WIDTH;
                             return (
                                <div key={month.name} style={{ width, minWidth: width }} className="h-full flex items-center justify-center text-sm font-semibold border-l border-dark text-primary">
                                    {month.name}
                                </div>
                             )
                        })}
                    </div>
                    <div className="relative flex h-8">
                        {Array.from({ length: totalDays }).map((_, i) => {
                            const date = new Date(ganttStartDate);
                            date.setDate(date.getDate() + i);
                            const isWeekend = date.getDay() === 5 || date.getDay() === 6; // Fri/Sat
                            return (
                                <div key={i} style={{ width: GANTT_DAY_WIDTH, minWidth: GANTT_DAY_WIDTH }} className={`flex items-center justify-center border-l border-dark text-xs ${isWeekend ? 'bg-medium text-dimmed' : 'text-primary'}`}>
                                    <span>{date.getDate()}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="w-[300px] border-b border-l border-dark flex items-center justify-between font-semibold text-primary px-4">
                     <button onClick={() => ganttRef.current && exportGanttToPdf(ganttRef.current!)} aria-label="ייצוא תרשים גאנט ל-PDF" className="flex items-center bg-transparent border border-primary text-primary hover:bg-dark/50 font-bold py-1 px-3 rounded-lg transition-colors text-sm">
                        <Icon name="download" className="w-4 h-4 mr-2" />
                        ייצוא
                    </button>
                    <span>משימות</span>
                </div>
            </div>
        </div>
    );
  });
  
  if (!currentUser) return null;

  if (!selectedProjectId) {
      return (
        <div className="flex items-center justify-center h-full bg-medium p-8 rounded-lg">
            <p className="text-lg text-dimmed">אנא בחר פרויקט כדי להציג את ציר הזמן שלו.</p>
        </div>
      )
  }

  const project = allProjects.find(p => p.id === selectedProjectId);
  const canInvite = selectedProjectId && (currentUser.role === 'UserRole.ADMIN' || currentUser.role === 'Team Leader');
  
  const GhostTask = () => ghostPosition && (
    <div className="absolute h-8 rounded-md flex items-center px-2 bg-accent opacity-50 z-30 pointer-events-none" style={{
        right: 300 + ghostPosition.x,
        top: ghostPosition.y,
        width: ghostPosition.width,
    }}/>
  );
  
  const LinkLine = () => linkLinePosition && (
    <svg className="absolute top-0 right-0 w-full h-full pointer-events-none" style={{ zIndex: 40 }}>
        <path d={`M ${linkLinePosition.x1} ${linkLinePosition.y1} L ${linkLinePosition.x2} ${linkLinePosition.y2}`} stroke="#d5bdaf" strokeWidth="2" strokeDasharray="5,5" />
    </svg>
  );

  const GanttView = () => (
     <div ref={ganttRef} className="bg-light text-primary rounded-lg shadow-sm h-[calc(100vh-18rem)] overflow-auto relative select-none border border-dark">
        <div className="relative" style={{ width: 300 + totalDays * GANTT_DAY_WIDTH, height: 60 + hierarchicalTasks.length * GANTT_ROW_HEIGHT }}>
            <GanttHeader />
            <div className="relative" style={{ height: hierarchicalTasks.length * GANTT_ROW_HEIGHT }}>
                {/* Grid lines */}
                <div className="absolute top-0 right-0 w-full h-full">
                    {Array.from({ length: totalDays }).map((_, i) => {
                        const date = new Date(ganttStartDate);
                        date.setDate(date.getDate() + i);
                        const isWeekend = date.getDay() === 5 || date.getDay() === 6;
                        return <div key={i} className={`absolute top-0 h-full ${isWeekend ? 'bg-medium' : ''}`} style={{ right: 300 + i * GANTT_DAY_WIDTH, width: GANTT_DAY_WIDTH, borderLeft: '1px solid #d6ccc2' }}/>
                    })}
                    {hierarchicalTasks.map((_, i) => (
                        <div key={i} className="absolute right-0 w-full border-b border-dark" style={{ top: i * GANTT_ROW_HEIGHT + GANTT_ROW_HEIGHT -1 }}/>
                    ))}
                </div>
                
                {/* Today Marker */}
                <div className="absolute top-0 w-0.5 bg-danger z-20" style={{ right: 300 + todayPosition + (GANTT_DAY_WIDTH/2), height: '100%' }} >
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-danger ring-2 ring-light"/>
                </div>

                {/* Dependency Lines */}
                <svg className="absolute top-0 right-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
                    <defs>
                        <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                            <polygon points="0 0, 6 2, 0 4" fill="#9a948d" />
                        </marker>
                    </defs>
                    {hierarchicalTasks.flatMap(task => 
                        task.dependencies.map(depId => {
                            const from = taskPositions[depId];
                            const to = taskPositions[task.id];
                            if (!from || !to) return null;
                            const fromX = 300 + from.startX + from.width;
                            const toX = 300 + to.startX;
                            const fromY = from.y + TASK_BAR_HEIGHT / 2;
                            const toY = to.y + TASK_BAR_HEIGHT / 2;
                            const path = `M ${fromX} ${fromY} C ${fromX + 25} ${fromY}, ${toX - 25} ${toY}, ${toX} ${toY}`;
                            return <path key={`${depId}-${task.id}`} d={path} stroke="#9a948d" strokeWidth="1.5" fill="none" markerEnd="url(#arrowhead)" />;
                        })
                    )}
                </svg>
                
                {/* Task Rows */}
                {hierarchicalTasks.map((task, index) => {
                    const assignees = allUsers.filter(u => task.assigneeIds.includes(u.id));
                    const position = taskPositions[task.id];
                    if(!position) return null;
                    const isInteractive = currentUser.role === 'UserRole.ADMIN' || (currentUser.role === 'Team Leader' && !task.isMilestone);
                    
                    return (
                        <div key={task.id} data-task-id={task.id} className="absolute flex items-center h-12" style={{ top: index * GANTT_ROW_HEIGHT, right: 0, width: '100%', zIndex: 15 }}>
                             {/* Task Bar */}
                            <div 
                                role="button"
                                tabIndex={isInteractive ? 0 : -1}
                                onKeyDown={(e) => handleKeyDown(e, task)}
                                aria-label={`פתח פרטי משימה: ${task.title}`}
                                className={`absolute h-8 rounded flex items-center px-2 group ${isInteractive ? 'cursor-move' : 'cursor-pointer'} transition-all duration-150 shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent focus:z-20`}
                                style={{ 
                                    right: 300 + position.startX, 
                                    width: position.width, 
                                    top: (GANTT_ROW_HEIGHT - TASK_BAR_HEIGHT)/2, 
                                    backgroundColor: getTaskColor(task.id) 
                                }}
                                onClick={!interaction ? () => setSelectedTask(task) : undefined}
                                onMouseDown={isInteractive ? (e) => handleMouseDown(e, 'move', task) : undefined}
                            >
                                <span className="text-primary text-sm font-medium truncate">{task.title}</span>
                                <div className="flex -space-x-2 overflow-hidden ml-2">
                                {assignees.slice(0, 2).map(a => <Avatar key={a.id} user={a} className="w-6 h-6 rounded-full ring-1 ring-light/50"/>)}
                                </div>
                                {isInteractive && <>
                                    <div data-point="start" onMouseDown={(e) => handleMouseDown(e, 'resize-start', task)} className="absolute w-2 h-full right-0 top-0 cursor-ew-resize"/>
                                    <div data-point="end" onMouseDown={(e) => handleMouseDown(e, 'resize-end', task)} className="absolute w-2 h-full left-0 top-0 cursor-ew-resize"/>
                                    <div data-point="start" onMouseDown={(e) => handleMouseDown(e, 'link', task)} title="קשר מהתחלה" className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-light border-2 border-accent rounded-full cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div data-point="end" onMouseDown={(e) => handleMouseDown(e, 'link', task)} title="קשר מהסוף" className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-light border-2 border-accent rounded-full cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity" />
                                </>}
                            </div>
                            <div className="w-[300px] h-full flex items-center px-2 border-l border-dark" style={{ paddingRight: `${task.depth * 20 + 8}px` }}>
                                <span className="truncate text-sm font-medium text-primary">{task.title}</span>
                            </div>
                        </div>
                    );
                })}
                <GhostTask />
                <LinkLine />
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
                const assignees = allUsers.filter(u => task.assigneeIds.includes(u.id));
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
  
  return (
    <>
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
            {canInvite && (
                 <button onClick={() => setInviteModalOpen(true)} title="הזמן אורח לפרויקט" className="flex items-center space-x-2 space-x-reverse bg-medium hover:bg-dark/50 text-primary hover:text-accent p-2 rounded-lg transition-colors border border-dark">
                    <Icon name="share-alt" className="w-5 h-5" />
                    <span className="text-sm font-semibold">שתף</span>
                </button>
            )}
            <div className="bg-light p-1 rounded-lg flex items-center shadow-neumorphic-convex-sm">
                <button onClick={() => setViewMode('list')} className={`px-3 py-1 rounded-md text-sm ${viewMode === 'list' ? 'bg-primary text-light shadow-inner' : 'text-dimmed'}`}>רשימה</button>
                <button onClick={() => setViewMode('gantt')} className={`px-3 py-1 rounded-md text-sm ${viewMode === 'gantt' ? 'bg-primary text-light shadow-inner' : 'text-dimmed'}`}>גאנט</button>
            </div>
        </div>
        <h2 className="text-2xl font-bold text-primary">{project?.name || "לוח זמנים"}</h2>
      </div>

      {viewMode === 'gantt' ? <GanttView /> : <ListView />}
      
      {selectedTask && (
        <TaskModal
          key={selectedTask.id}
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdateTask={handleUpdateTask}
          onAddComment={handleAddComment}
          currentUser={currentUser}
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
};

export default TimesView;