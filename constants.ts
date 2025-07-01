import { Column } from './types';

export const COLUMNS: Column[] = [
  { id: 'col-not-started', title: 'טרם התחיל', color: 'bg-medium' },
  { id: 'col-started', title: 'התחיל', color: 'bg-accent' },
  { id: 'col-in-progress', title: 'בתהליך', color: 'bg-warning' },
  { id: 'col-nearing-completion', title: 'לקראת סיום', color: 'bg-accent' },
  { id: 'col-stuck', title: 'תקוע', color: 'bg-danger' },
  { id: 'col-done', title: 'הסתיים', color: 'bg-success' },
];
