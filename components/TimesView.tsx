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
    handleInviteGuest, 
    handleAddTask 
  } = useDataStore();
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number; width: number } | null>(null);
  const [linkLinePosition, setLinkLinePosition] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const ganttRef = useRef<HTMLDivElement>(null);
  const tasksRef = useRef(tasks);
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'gantt'>('gantt');
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickTaskName, setQuickTaskName] = useState('');
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [hoveredDependency, setHoveredDependency] = useState<{from: string, to: string} | null>(null);
  const [showDependencies, setShowDependencies] = useState(true);
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
    const isInteractive = currentUser?.role === 'ADMIN' || currentUser?.role === 'TEAM_MANAGER';
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

    const updatedTasksMap = new Map(tasksRef.current.map(t => [t.id, Object.assign({}, t)]));
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
            if(toTask && toTask.dependencies && !toTask.dependencies.includes(fromTaskId)) {
                toTask.dependencies = [...toTask.dependencies, fromTaskId];
                finalTasksToUpdate.push(toTask);
            }
        }
    }
    
    if (finalTasksToUpdate.length > 0) {
        handleBulkUpdateTasks(finalTasksToUpdate);
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

  const handleQuickAddKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleQuickAdd();
    } else if (e.key === 'Escape') {
      setIsQuickAdding(false);
      setQuickTaskName('');
    }
  };

  const handleCancelQuickAdd = () => {
    setIsQuickAdding(false);
    setQuickTaskName('');
  };

  // Smart path calculation for dependency lines
  const calculateSmartPath = (fromX: number, fromY: number, toX: number, toY: number, taskPositions: Record<string, any>, fromTaskId: string, toTaskId: string) => {
    const distance = Math.abs(toX - fromX);
    const controlPointOffset = Math.min(distance * 0.3, 50); // Smart control point calculation
    
    // Check if we need to avoid obstacles
    const obstacles = Object.entries(taskPositions).filter(([taskId, pos]) => {
      if (taskId === fromTaskId || taskId === toTaskId) return false;
      return pos.startX < Math.max(fromX, toX) && pos.startX + pos.width > Math.min(fromX, toX);
    });

    if (obstacles.length > 0) {
      // Use S-curve to avoid obstacles
      const midX = (fromX + toX) / 2;
      const midY = (fromY + toY) / 2;
      const verticalOffset = 20;
      
      return `M ${fromX} ${fromY} 
              C ${fromX + controlPointOffset} ${fromY}, ${midX - controlPointOffset} ${midY - verticalOffset}, ${midX} ${midY - verticalOffset}
              C ${midX + controlPointOffset} ${midY - verticalOffset}, ${toX - controlPointOffset} ${toY}, ${toX} ${toY}`;
    } else {
      // Simple curve for direct connections
      return `M ${fromX} ${fromY} C ${fromX + controlPointOffset} ${fromY}, ${toX - controlPointOffset} ${toY}, ${toX} ${toY}`;
    }
  };

  // Check dependency status for coloring
  const getDependencyStatus = (fromTask: Task, toTask: Task) => {
    const fromEndDate = new Date(fromTask.endDate);
    const toStartDate = new Date(toTask.startDate);
    
    // Check for schedule conflicts
    if (toStartDate < fromEndDate) {
      return 'conflict'; // Red - schedule conflict
    }
    
    // Check for tight dependencies (less than 1 day gap)
    const gapDays = (toStartDate.getTime() - fromEndDate.getTime()) / (1000 * 60 * 60 * 24);
    if (gapDays <= 1) {
      return 'tight'; // Orange - tight dependency
    }
    
    return 'normal'; // Gray - normal dependency
  };

  // Get dependency line color based on status and hover state
  const getDependencyColor = (status: string, isHighlighted: boolean, isHovered: boolean) => {
    if (isHighlighted) {
      return '#d5bdaf'; // Brand primary color when highlighted
    }
    
    switch (status) {
      case 'conflict':
        return isHovered ? '#ef4444' : '#dc2626'; // Red
      case 'tight':
        return isHovered ? '#f97316' : '#ea580c'; // Orange
      default:
        return isHovered ? '#9a948d' : '#6b7280'; // Gray
    }
  };

  // Get dependency line opacity based on hover state
  const getDependencyOpacity = (isHighlighted: boolean, isHovered: boolean) => {
    if (isHighlighted) return 1;
    if (isHovered) return 0.3; // Dimmed when other task is hovered
    return 0.6; // Default semi-transparent
  };

  const GanttHeader = React.memo(() => {
    const months: Array<{ name: string; start: number }> = [];
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
  const canInvite = selectedProjectId && (currentUser.role === 'ADMIN' || currentUser.role === 'TEAM_MANAGER');
  
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

  const DependencyLegend = () => (
    <div className="absolute top-2 left-2 bg-light/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-dark z-50">
      <h4 className="text-sm font-semibold text-primary mb-2">מפתח תלויות</h4>
      <div className="space-y-2 text-xs">
        <div className="flex items-center space-x-2 space-x-reverse">
          <div className="w-3 h-0.5 bg-gray-500"></div>
          <span className="text-dimmed">תלות רגילה</span>
        </div>
        <div className="flex items-center space-x-2 space-x-reverse">
          <div className="w-3 h-0.5 bg-orange-500"></div>
          <span className="text-dimmed">תלות הדוקה</span>
        </div>
        <div className="flex items-center space-x-2 space-x-reverse">
          <div className="w-3 h-0.5 bg-red-500"></div>
          <span className="text-dimmed">סכסוך לוח זמנים</span>
        </div>
        <div className="flex items-center space-x-2 space-x-reverse">
          <div className="w-2 h-2 rounded-full bg-blue-500 border border-light"></div>
          <span className="text-dimmed">תלות נכנסת</span>
        </div>
        <div className="flex items-center space-x-2 space-x-reverse">
          <div className="w-2 h-2 rounded-full bg-green-500 border border-light"></div>
          <span className="text-dimmed">תלות יוצאת</span>
        </div>
      </div>
    </div>
  );

  const DependencyTooltip = () => {
    if (!hoveredDependency) return null;
    
    const fromTask = hierarchicalTasks.find(t => t.id === hoveredDependency.from);
    const toTask = hierarchicalTasks.find(t => t.id === hoveredDependency.to);
    
    if (!fromTask || !toTask) return null;
    
    const status = getDependencyStatus(fromTask, toTask);
    const statusText = {
      'normal': 'תלות רגילה',
      'tight': 'תלות הדוקה',
      'conflict': 'סכסוך לוח זמנים'
    }[status];
    
    const gapDays = status === 'normal' ? 
      (new Date(toTask.startDate).getTime() - new Date(fromTask.endDate).getTime()) / (1000 * 60 * 60 * 24) : 0;
    
    return (
      <div className="absolute bg-light/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-dark z-50 pointer-events-none" data-dependency-tooltip>
        <div className="text-xs space-y-1">
          <div className="font-semibold text-primary">{statusText}</div>
          <div className="text-dimmed">
            <div>מ: {fromTask.title}</div>
            <div>אל: {toTask.title}</div>
            {status === 'normal' && gapDays > 0 && (
              <div>מרווח: {Math.round(gapDays)} ימים</div>
            )}
            {status === 'conflict' && (
              <div className="text-red-500">סכסוך: המשימה מתחילה לפני שהמשימה הקודמת מסתיימת</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const DependencySummary = () => {
    const allDependencies = hierarchicalTasks.flatMap(task => 
      task.dependencies.map(depId => {
        const fromTask = hierarchicalTasks.find(t => t.id === depId);
        return fromTask ? { from: fromTask, to: task } : null;
      }).filter(Boolean)
    );

    const statusCounts = allDependencies.reduce((acc, dep) => {
      if (!dep) return acc;
      const status = getDependencyStatus(dep.from, dep.to);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalDependencies = allDependencies.length;
    const conflicts = statusCounts.conflict || 0;
    const tightDeps = statusCounts.tight || 0;
    const normalDeps = statusCounts.normal || 0;

    if (totalDependencies === 0) return null;

    return (
      <div className="absolute top-2 right-2 bg-light/95 backdrop-blur-sm rounded-lg p-2 shadow-lg border border-dark z-50">
        <div className="text-xs space-y-1">
          <div className="font-semibold text-primary">סיכום תלויות</div>
          <div className="flex space-x-3 space-x-reverse text-dimmed">
            <span>סה"כ: {totalDependencies}</span>
            {conflicts > 0 && <span className="text-red-500">סכסוכים: {conflicts}</span>}
            {tightDeps > 0 && <span className="text-orange-500">הדוקות: {tightDeps}</span>}
            {normalDeps > 0 && <span>רגילות: {normalDeps}</span>}
          </div>
        </div>
      </div>
    );
  };

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

                {/* Enhanced Dependency Lines */}
                {showDependencies && (
                  <svg className="absolute top-0 right-0 w-full h-full" style={{ zIndex: 10 }}>
                      <defs>
                          <marker id="arrowhead-normal" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                              <polygon points="0 0, 8 3, 0 6" fill="#6b7280" />
                          </marker>
                          <marker id="arrowhead-tight" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                              <polygon points="0 0, 8 3, 0 6" fill="#ea580c" />
                          </marker>
                          <marker id="arrowhead-conflict" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                              <polygon points="0 0, 8 3, 0 6" fill="#dc2626" />
                          </marker>
                          <marker id="arrowhead-highlighted" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                              <polygon points="0 0, 8 3, 0 6" fill="#d5bdaf" />
                          </marker>
                      </defs>
                      {hierarchicalTasks.flatMap(task => 
                          task.dependencies.map(depId => {
                              const fromTask = hierarchicalTasks.find(t => t.id === depId);
                              const from = taskPositions[depId];
                              const to = taskPositions[task.id];
                              
                              if (!from || !to || !fromTask) return null;
                              
                              // Calculate connection points (end of source task to start of target task)
                              const fromX = 300 + from.startX + from.width; // End of source task
                              const toX = 300 + to.startX; // Start of target task
                              const fromY = from.y + TASK_BAR_HEIGHT / 2;
                              const toY = to.y + TASK_BAR_HEIGHT / 2;
                              
                              // Calculate smart path
                              const path = calculateSmartPath(fromX, fromY, toX, toY, taskPositions, depId, task.id);
                              
                              // Determine dependency status and styling
                              const status = getDependencyStatus(fromTask, task);
                              const isHighlighted = hoveredTaskId === depId || hoveredTaskId === task.id;
                              const isHovered = hoveredTaskId !== null && hoveredTaskId !== depId && hoveredTaskId !== task.id;
                              
                              const color = getDependencyColor(status, isHighlighted, isHovered);
                              const opacity = getDependencyOpacity(isHighlighted, isHovered);
                              const strokeWidth = isHighlighted ? 3 : 2;
                              
                              // Choose appropriate arrowhead
                              let arrowheadId = 'arrowhead-normal';
                              if (isHighlighted) {
                                  arrowheadId = 'arrowhead-highlighted';
                              } else if (status === 'conflict') {
                                  arrowheadId = 'arrowhead-conflict';
                              } else if (status === 'tight') {
                                  arrowheadId = 'arrowhead-tight';
                              }
                              
                              return (
                                  <g key={`${depId}-${task.id}`}>
                                      {/* Interactive hit area */}
                                      <path 
                                          d={path} 
                                          stroke="transparent" 
                                          strokeWidth="8" 
                                          fill="none" 
                                          className="cursor-pointer"
                                          onMouseEnter={(e) => {
                                              setHoveredDependency({ from: depId, to: task.id });
                                              // Position tooltip near mouse
                                              const rect = e.currentTarget.getBoundingClientRect();
                                              const tooltip = document.querySelector('[data-dependency-tooltip]') as HTMLElement;
                                              if (tooltip) {
                                                  tooltip.style.left = `${e.clientX + 10}px`;
                                                  tooltip.style.top = `${e.clientY - 10}px`;
                                              }
                                          }}
                                          onMouseLeave={() => setHoveredDependency(null)}
                                      />
                                      {/* Visible line */}
                                      <path 
                                          d={path} 
                                          stroke={color} 
                                          strokeWidth={strokeWidth} 
                                          fill="none" 
                                          markerEnd={`url(#${arrowheadId})`}
                                          opacity={opacity}
                                          className="transition-all duration-200"
                                      />
                                      {/* Add subtle glow effect for highlighted lines */}
                                      {isHighlighted && (
                                          <path 
                                              d={path} 
                                              stroke={color} 
                                              strokeWidth={strokeWidth + 2} 
                                              fill="none" 
                                              opacity={0.3}
                                              className="transition-all duration-200"
                                          />
                                      )}
                                      {/* Add pulsing animation for conflict dependencies */}
                                      {status === 'conflict' && (
                                          <path 
                                              d={path} 
                                              stroke={color} 
                                              strokeWidth={strokeWidth + 1} 
                                              fill="none" 
                                              opacity={0.4}
                                              className="animate-pulse"
                                          />
                                      )}
                                  </g>
                              );
                          })
                      )}
                  </svg>
                )}
                
                {/* Task Rows */}
                {hierarchicalTasks.map((task, index) => {
                    const assignees = allUsers.filter(u => task.assigneeIds && task.assigneeIds.includes(u.id));
                    const position = taskPositions[task.id];
                    if(!position) return null;
                    const isInteractive = currentUser.role === 'ADMIN' || (currentUser.role === 'TEAM_MANAGER' && !task.isMilestone);
                    
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
                                onMouseEnter={() => setHoveredTaskId(task.id)}
                                onMouseLeave={() => setHoveredTaskId(null)}
                            >
                                <span className="text-primary text-sm font-medium truncate">{task.title}</span>
                                <div className="flex -space-x-2 overflow-hidden ml-2">
                                {assignees.slice(0, 2).map(a => <Avatar key={a.id} user={a} className="w-6 h-6 rounded-full ring-1 ring-light/50"/>)}
                                </div>
                                
                                {/* Dependency Status Indicator */}
                                {(() => {
                                    const hasDependencies = task.dependencies.length > 0;
                                    const hasDependents = hierarchicalTasks.some(t => t.dependencies.includes(task.id));
                                    
                                    if (!hasDependencies && !hasDependents) return null;
                                    
                                    const dependencyStatuses = task.dependencies.map(depId => {
                                        const depTask = hierarchicalTasks.find(t => t.id === depId);
                                        return depTask ? getDependencyStatus(depTask, task) : 'normal';
                                    });
                                    
                                    const hasConflicts = dependencyStatuses.includes('conflict');
                                    const hasTightDeps = dependencyStatuses.includes('tight');
                                    
                                    return (
                                        <div className="absolute -top-1 -right-1 flex space-x-1 space-x-reverse">
                                            {hasDependencies && (
                                                <div 
                                                    className={`w-2 h-2 rounded-full border border-light ${
                                                        hasConflicts ? 'bg-red-500' : 
                                                        hasTightDeps ? 'bg-orange-500' : 'bg-blue-500'
                                                    }`}
                                                    title={hasConflicts ? 'סכסוך לוח זמנים' : hasTightDeps ? 'תלות הדוקה' : 'תלות רגילה'}
                                                />
                                            )}
                                            {hasDependents && (
                                                <div 
                                                    className="w-2 h-2 rounded-full bg-green-500 border border-light"
                                                    title="משימה תלויה"
                                                />
                                            )}
                                        </div>
                                    );
                                })()}
                                
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
                {showDependencies && <DependencyLegend />}
                <DependencyTooltip />
                {showDependencies && <DependencySummary />}
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
            
            {/* Quick Add Task */}
            {!isQuickAdding && (currentUser.role === 'ADMIN' || currentUser.role === 'TEAM_MANAGER') && (
              <button
                onClick={() => setIsQuickAdding(true)}
                className="flex items-center space-x-2 space-x-reverse bg-accent hover:bg-accent/80 text-light p-2 rounded-lg transition-colors"
                title="הוסף משימה מהירה"
              >
                <Icon name="plus" className="w-5 h-5" />
                <span className="text-sm font-semibold">משימה מהירה</span>
              </button>
            )}

            {/* Quick Add Input */}
            {isQuickAdding && (
              <div className="flex items-center space-x-2 space-x-reverse bg-light border border-accent rounded-lg p-2">
                <input
                  type="text"
                  value={quickTaskName}
                  onChange={(e) => setQuickTaskName(e.target.value)}
                  onKeyDown={handleQuickAddKeyPress}
                  placeholder="שם המשימה..."
                  className="bg-transparent text-primary border-none outline-none text-sm w-32"
                  autoFocus
                />
                <button
                  onClick={handleQuickAdd}
                  disabled={!quickTaskName.trim()}
                  className="px-2 py-1 text-xs bg-accent text-light rounded hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  הוסף
                </button>
                <button
                  onClick={handleCancelQuickAdd}
                  className="px-2 py-1 text-xs text-secondary hover:text-primary"
                >
                  ביטול
                </button>
              </div>
            )}

            <div className="bg-light p-1 rounded-lg flex items-center shadow-neumorphic-convex-sm">
                <button onClick={() => setViewMode('list')} className={`px-3 py-1 rounded-md text-sm ${viewMode === 'list' ? 'bg-primary text-light shadow-inner' : 'text-dimmed'}`}>רשימה</button>
                <button onClick={() => setViewMode('gantt')} className={`px-3 py-1 rounded-md text-sm ${viewMode === 'gantt' ? 'bg-primary text-light shadow-inner' : 'text-dimmed'}`}>גאנט</button>
            </div>
            
            {/* Dependency Toggle */}
            {viewMode === 'gantt' && (
              <button
                onClick={() => setShowDependencies(!showDependencies)}
                className={`flex items-center space-x-2 space-x-reverse p-2 rounded-lg transition-colors border ${
                  showDependencies 
                    ? 'bg-accent text-light border-accent' 
                    : 'bg-light text-dimmed border-dark hover:text-primary'
                }`}
                title={showDependencies ? 'הסתר תלויות' : 'הצג תלויות'}
              >
                <Icon name="gantt-chart" className="w-4 h-4" />
                <span className="text-xs font-semibold">תלויות</span>
              </button>
            )}
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