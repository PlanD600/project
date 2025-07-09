import React, { useState, useRef, useEffect } from 'react';
import Icon from './Icon';

interface ColorPickerProps {
  selectedColor?: string;
  onColorSelect: (color: string) => void;
  className?: string;
}

// Predefined brand-matching colors
const TASK_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280', // Gray
];

export const ColorPicker: React.FC<ColorPickerProps> = ({ 
  selectedColor, 
  onColorSelect, 
  className = '' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-assign color if none selected
  const currentColor = selectedColor || TASK_COLORS[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleColorSelect = (color: string) => {
    onColorSelect(color);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 space-x-reverse p-2 rounded-lg border border-gray-300 hover:border-gray-400 transition-colors"
        title="בחר צבע למשימה"
      >
        <div 
          className="w-6 h-6 rounded-full border-2 border-gray-300"
          style={{ backgroundColor: currentColor }}
        />
        <Icon name="edit" className="w-4 h-4 text-gray-500" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 p-3 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[200px]">
          <div className="grid grid-cols-5 gap-2">
            {TASK_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleColorSelect(color)}
                className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                  selectedColor === color ? 'border-gray-800' : 'border-gray-300'
                }`}
                style={{ backgroundColor: color }}
                title={`צבע: ${color}`}
              />
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-gray-200">
            <button
              type="button"
              onClick={() => handleColorSelect('')}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              הסר צבע
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorPicker; 