import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Project, Task, Comment } from '../types';
import Icon from './Icon';

type SearchResults = {
    projects: Project[];
    tasks: Task[];
    comments: (Comment & {task: Task})[];
}

interface GlobalSearchProps {
    onSearch: (query: string) => SearchResults;
    onSelectProject: (projectId: string) => void;
}

const useDebounce = <T,>(value: T, delay: number): T => {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};


const GlobalSearch: React.FC<GlobalSearchProps> = ({ onSearch, onSelectProject }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResults | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const debouncedQuery = useDebounce(query, 300);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (debouncedQuery.length >= 3) {
            const searchResults = onSearch(debouncedQuery);
            setResults(searchResults);
            setIsOpen(true);
        } else {
            setResults(null);
            setIsOpen(false);
        }
    }, [debouncedQuery, onSearch]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelectProject = (projectId: string) => {
        onSelectProject(projectId);
        setIsOpen(false);
        setQuery('');
    };
    
    const highlightMatch = (text: string, highlight: string) => {
        if (!highlight.trim()) {
            return text;
        }
        const parts = text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
        return <span>{parts.map((part, i) => 
            part.toLowerCase() === highlight.toLowerCase() ? 
            <strong key={i} className="text-primary/80">{part}</strong> : 
            <React.Fragment key={i}>{part}</React.Fragment>
        )}</span>;
    }

    return (
        <div className="relative" ref={searchRef}>
            <div className="relative">
                <Icon name="search" className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" />
                <input
                    type="text"
                    placeholder="חפש משימות, פרויקטים, תגובות..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length >= 3 && setIsOpen(true)}
                    className="w-full bg-light text-primary pr-12 pl-4 py-3 rounded-xl border-none shadow-neumorphic-concave-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
            </div>
            {isOpen && results && (
                <div className="absolute left-0 right-0 mt-2 bg-light rounded-2xl shadow-neumorphic-convex z-30 text-right">
                    <div className="max-h-[60vh] overflow-y-auto p-2">
                        {results.projects.length === 0 && results.tasks.length === 0 && results.comments.length === 0 ? (
                             <div className="p-4 text-center text-secondary">לא נמצאו תוצאות.</div>
                        ): (
                            <>
                                {results.projects.length > 0 && (
                                    <div>
                                        <div className="px-4 py-2 text-xs font-bold text-secondary uppercase">פרויקטים</div>
                                        {results.projects.map(p => (
                                            <div key={p.id} onClick={() => handleSelectProject(p.id)} className="px-4 py-3 hover:bg-shadow-dark/20 rounded-lg cursor-pointer">
                                                <div className="font-semibold text-primary">{highlightMatch(p.name, query)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {results.tasks.length > 0 && (
                                     <div>
                                        <div className="px-4 py-2 text-xs font-bold text-secondary uppercase">משימות</div>
                                        {results.tasks.map(t => (
                                            <div key={t.id} onClick={() => handleSelectProject(t.projectId)} className="px-4 py-3 hover:bg-shadow-dark/20 rounded-lg cursor-pointer">
                                                <div className="font-semibold text-primary">{highlightMatch(t.title, query)}</div>
                                                <div className="text-sm text-secondary truncate">{highlightMatch(t.description, query)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                 {results.comments.length > 0 && (
                                     <div>
                                        <div className="px-4 py-2 text-xs font-bold text-secondary uppercase">תגובות</div>
                                        {results.comments.map(c => (
                                            <div key={c.id} onClick={() => handleSelectProject(c.task.projectId)} className="px-4 py-3 hover:bg-shadow-dark/20 rounded-lg cursor-pointer">
                                                <div className="text-sm text-primary">"{highlightMatch(c.text, query)}"</div>
                                                <div className="text-xs text-secondary mt-1">במשימה: {c.task.title}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GlobalSearch;