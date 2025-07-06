import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useDataStore } from '../stores/useDataStore';
import { useUIStore } from '../stores/useUIStore';
import { SUBSCRIPTION_PLANS } from '../constants';

const SubscriptionView: React.FC = () => {
  const { currentUser } = useAuthStore();
  const { subscriptionInfo, handleGetSubscriptionInfo, handleCreateCheckoutSession, handleCreatePortalSession } = useDataStore();
  const { setNotification } = useUIStore();
  
  const [loading, setLoading] = useState(false);

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-neumorphic-convex">
              <h3 className="text-lg font-bold text-primary mb-2">תוכן המנוי</h3>
              <p className="text-secondary">
                {subscriptionInfo.currentPlan || subscriptionInfo.status}
                <br />
                תאריך תחילת מנוי: {formatDate(subscriptionInfo.startDate)}
                <br />
                תאריך סיום מנוי: {formatDate(subscriptionInfo.endDate)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-neumorphic-convex">
              <h3 className="text-lg font-bold text-primary mb-2">סטטוס התשלום</h3>
              <p className="text-secondary">
                תשלום אחרון: {formatDate(subscriptionInfo.lastPaymentDate)}
                <br />
                תשלום בפיגור: {subscriptionInfo.isPastDue ? 'כן' : 'לא'}
                <br />
                סטטוס התשלום: {getPlanStatusText(subscriptionInfo.status)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-neumorphic-convex">
              <h3 className="text-lg font-bold text-primary mb-2">פרטי תשלום</h3>
              <p className="text-secondary">
                מספר חשבון: {subscriptionInfo.stripeCustomerId}
                <br />
                מספר תשלום: {subscriptionInfo.stripeSubscriptionId}
                <br />
                מספר תשלום בפיגור: {subscriptionInfo.stripeLatestInvoiceId}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Plans */}
      <div className="bg-light rounded-xl p-6 mb-8 shadow-neumorphic-convex">
        <h2 className="text-2xl font-bold text-primary mb-4">תוכניות מנוי</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SUBSCRIPTION_PLANS.map(plan => (
            <div key={plan.id} className="bg-white rounded-lg p-6 shadow-neumorphic-convex">
              <h3 className="text-xl font-bold text-primary mb-2">{plan.name}</h3>
              <p className="text-3xl font-bold text-primary mb-4">₪{plan.price}</p>
              <button
                onClick={() => handleUpgrade(plan.id)}
                className="w-full bg-primary text-white py-2 px-4 rounded-lg font-semibold hover:bg-primary-dark transition-colors"
                disabled={loading}
              >
                {loading ? 'טוען...' : 'עדכן מנוי'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Billing Management */}
      <div className="bg-light rounded-xl p-6 mb-8 shadow-neumorphic-convex">
        <h2 className="text-2xl font-bold text-primary mb-4">ניהול תשלומים</h2>
        <p className="text-secondary mb-4">
          ניתן לנהל את התשלומים שלך ולעדכן את הפרטים שלך בפורטל Stripe.
        </p>
        <button
          onClick={handleManageBilling}
          className="w-full bg-secondary text-white py-2 px-4 rounded-lg font-semibold hover:bg-secondary-dark transition-colors"
          disabled={loading}
        >
          {loading ? 'טוען...' : 'ניהול תשלומים'}
        </button>
      </div>
    </div>
  );
};

export default SubscriptionView;