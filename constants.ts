import { Column } from './types';

export const COLUMNS: Column[] = [
  { id: 'col-not-started', title: 'טרם התחיל', color: 'bg-medium' },
  { id: 'col-started', title: 'התחיל', color: 'bg-accent' },
  { id: 'col-in-progress', title: 'בתהליך', color: 'bg-warning' },
  { id: 'col-nearing-completion', title: 'לקראת סיום', color: 'bg-accent' },
  { id: 'col-stuck', title: 'תקוע', color: 'bg-danger' },
  { id: 'col-done', title: 'הסתיים', color: 'bg-success' },
];

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  projectLimit: number;
  companyLimit: number;
  features: string[];
  stripePriceId?: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'NIS',
    projectLimit: 10,
    companyLimit: 1,
    features: [
      'עד 10 פרויקטים',
      'עד חברה אחת למנהל',
      'ייצוא בסיסי',
      'תמיכה בסיסית'
    ]
  },
  {
    id: 'business',
    name: 'Business',
    price: 30,
    currency: 'NIS',
    projectLimit: 40,
    companyLimit: 3,
    features: [
      'עד 40 פרויקטים',
      'עד 3 חברות למנהל',
      'ייצוא מתקדם',
      'תמיכה מתקדמת',
      'ניתוחים מתקדמים'
    ],
    stripePriceId: 'price_business_monthly' // Replace with actual Stripe price ID
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 100,
    currency: 'NIS',
    projectLimit: 400,
    companyLimit: 15,
    features: [
      'עד 400 פרויקטים',
      'עד 15 חברות למנהל',
      'ייצוא מלא',
      'תמיכה 24/7',
      'ניתוחים מתקדמים',
      'API גישה',
      'אינטגרציות מתקדמות'
    ],
    stripePriceId: 'price_enterprise_monthly' // Replace with actual Stripe price ID
  }
];
