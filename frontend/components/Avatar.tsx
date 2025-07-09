import React from 'react';
import { User } from '../types';

interface AvatarProps {
  user: Pick<User, 'id' | 'name' | 'avatarUrl'>;
  className?: string;
}

const getInitials = (name: string): string => {
  if (!name) return '?';
  const nameParts = name.trim().split(' ');
  const firstInitial = nameParts[0] ? nameParts[0][0] : '';
  const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1][0] : '';
  return `${firstInitial}${lastInitial}`.toUpperCase();
};

const colorPalette = [
    'bg-red-400', 'bg-orange-400', 'bg-amber-400',
    'bg-yellow-400', 'bg-lime-400', 'bg-green-400', 'bg-emerald-400',
    'bg-teal-400', 'bg-cyan-400', 'bg-sky-400', 'bg-blue-400',
    'bg-indigo-400', 'bg-violet-400', 'bg-purple-400', 'bg-fuchsia-400',
    'bg-pink-400', 'bg-rose-400'
];

const stringToColor = (str: string): string => {
  if (!str) return colorPalette[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % colorPalette.length;
  return colorPalette[index];
};


const Avatar: React.FC<AvatarProps> = ({ user, className = 'w-8 h-8' }) => {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        title={user.name}
        className={`${className} object-cover`}
      />
    );
  }

  const initials = getInitials(user.name);
  const bgColor = stringToColor(user.id);

  return (
    <div
      title={user.name}
      className={`${className} ${bgColor} flex items-center justify-center text-light font-bold select-none`}
    >
      <span>{initials}</span>
    </div>
  );
};

export default Avatar;
