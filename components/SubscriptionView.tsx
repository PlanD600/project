import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useDataStore } from '../stores/useDataStore';
import { useUIStore } from '../stores/useUIStore';
import { SUBSCRIPTION_PLANS, SubscriptionPlan } from '../constants';
import { SubscriptionInfo } from '../types';
import Icon from './Icon';

const SubscriptionView: React.FC = () => {
  const { currentUser } = useAuthStore();
  const { subscriptionInfo, handleGetSubscriptionInfo, handleCreateCheckoutSession, handleCreatePortalSession } = useDataStore();
  const { setNotification } = useUIStore();
  
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      handleGetSubscriptionInfo();
    }
  }, [currentUser, handleGetSubscriptionInfo]);

  const handleUpgrade = async (planId: string) => {
    if (planId === 'free') return;
    
    setLoading(true);
    try {
      const { url } = await handleCreateCheckoutSession(planId);
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      setNotification({ 
        message: `שגיאה ביצירת תשלום: ${(error as Error).message}`, 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    if (!subscriptionInfo?.stripeCustomerId) {
      setNotification({ 
        message: 'אין לך מנוי פעיל לניהול', 
        type: 'error' 
      });
      return;
    }

    setLoading(true);
    try {
      const { url } = await handleCreatePortalSession();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      setNotification({ 
        message: `שגיאה בפתיחת ניהול תשלומים: ${(error as Error).message}`, 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPlan = () => {
    return SUBSCRIPTION_PLANS.find(plan => plan.id === subscriptionInfo?.currentPlan?.toLowerCase());
  };

  const getPlanStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-success';
      case 'PAST_DUE': return 'text-danger';
      case 'CANCELED': return 'text-secondary';
      default: return 'text-secondary';
    }
  };

  const getPlanStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'פעיל';
      case 'PAST_DUE': return 'תשלום בפיגור';
      case 'CANCELED': return 'בוטל';
      default: return 'לא ידוע';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-lg text-dimmed">אנא התחבר כדי לצפות במנוי שלך</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">מנוי וחשבוניות</h1>
        <p className="text-secondary">נהל את המנוי שלך ותשלומים</p>
      </div>

      {/* Current Subscription Status */}
      {subscriptionInfo && (
        <div className="bg-light rounded-xl p-6 mb-8 shadow-neumorphic-convex">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-primary">המנוי הנוכחי</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPlanStatusColor(subscriptionInfo.status)}`}>
              {getPlanStatusText(subscriptionInfo.status)}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{subscriptionInfo.projectCount}</div>
              <div className="text-sm text-secondary">פרויקטים נוכחיים</div>
              <div className="text-xs text-dimmed">מתוך {subscriptionInfo.projectLimit}</div>
            </div>
            
            {currentUser.role === 'ADMIN' && (
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{subscriptionInfo.companyCount}</div>
                <div className="text-sm text-secondary">חברות נוכחיות</div>
                <div className="text-xs text-dimmed">מתוך {subscriptionInfo.companyLimit}</div>
              </div>
            )}
            
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{getCurrentPlan()?.name}</div>
              <div className="text-sm text-secondary">תוכנית נוכחית</div>
              <div className="text-xs text-dimmed">
                {getCurrentPlan()?.price === 0 ? 'חינם' : `${getCurrentPlan()?.price} ₪ לחודש`}
              </div>
            </div>
          </div>

          {subscriptionInfo.nextBillingDate && (
            <div className="mt-4 pt-4 border-t border-dark">
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary">תאריך החיוב הבא:</span>
                <span className="text-sm font-medium text-primary">
                  {formatDate(subscriptionInfo.nextBillingDate)}
                </span>
              </div>
            </div>
          )}

          {subscriptionInfo.stripeCustomerId && (
            <div className="mt-4">
              <button
                onClick={handleManageBilling}
                disabled={loading}
                className="bg-accent text-light px-4 py-2 rounded-lg hover:bg-accent/80 transition-colors disabled:opacity-50"
              >
                {loading ? 'טוען...' : 'נהל תשלומים'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Subscription Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const isCurrentPlan = subscriptionInfo?.currentPlan?.toLowerCase() === plan.id;
          const canUpgrade = !isCurrentPlan && plan.id !== 'free';
          const canDowngrade = isCurrentPlan && plan.id === 'free' && subscriptionInfo?.canDowngrade;
          
          return (
            <div
              key={plan.id}
              className={`bg-light rounded-xl p-6 shadow-neumorphic-convex border-2 transition-all ${
                isCurrentPlan 
                  ? 'border-accent shadow-neumorphic-convex-lg' 
                  : 'border-transparent hover:border-accent/30'
              }`}
            >
              {isCurrentPlan && (
                <div className="bg-accent text-light text-xs font-medium px-2 py-1 rounded-full inline-block mb-4">
                  התוכנית שלך
                </div>
              )}
              
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-primary mb-2">{plan.name}</h3>
                <div className="text-3xl font-bold text-accent mb-1">
                  {plan.price === 0 ? 'חינם' : `${plan.price} ₪`}
                </div>
                <div className="text-sm text-secondary">לחודש</div>
              </div>

              <div className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-center text-sm">
                    <Icon name="check" className="w-4 h-4 text-success ml-2 flex-shrink-0" />
                    <span className="text-primary">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="text-center">
                {isCurrentPlan ? (
                  <button
                    disabled
                    className="w-full bg-dark/20 text-secondary px-4 py-2 rounded-lg cursor-not-allowed"
                  >
                    התוכנית הנוכחית
                  </button>
                ) : canUpgrade ? (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={loading}
                    className="w-full bg-accent text-light px-4 py-2 rounded-lg hover:bg-accent/80 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'טוען...' : 'שדרג עכשיו'}
                  </button>
                ) : canDowngrade ? (
                  <button
                    onClick={() => handleUpgrade('free')}
                    disabled={loading}
                    className="w-full bg-secondary text-light px-4 py-2 rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'טוען...' : 'הורד תוכנית'}
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full bg-dark/20 text-secondary px-4 py-2 rounded-lg cursor-not-allowed"
                  >
                    לא זמין
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Usage Limits Warning */}
      {subscriptionInfo && !subscriptionInfo.canDowngrade && (
        <div className="mt-8 bg-warning/10 border border-warning rounded-xl p-4">
          <div className="flex items-start">
            <Icon name="warning" className="w-5 h-5 text-warning ml-2 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-primary mb-1">לא ניתן להוריד תוכנית</h4>
              <p className="text-sm text-secondary">
                יש לך {subscriptionInfo.projectCount} פרויקטים פעילים, אך התוכנית החינמית מאפשרת רק {subscriptionInfo.projectLimit} פרויקטים. 
                אנא מחק פרויקטים לפני הורדת התוכנית.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionView; 