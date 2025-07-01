import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../services/logger';
import Icon from './Icon';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Uncaught error in React component tree', {
      error: {
        message: error.message,
        stack: error.stack,
      },
      errorInfo,
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-light flex flex-col justify-center items-center p-4 font-sans text-center">
            <div className="w-full max-w-lg bg-medium p-8 rounded-2xl shadow-neumorphic-convex border border-dark">
                <Icon name="close" className="w-12 h-12 text-danger mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-primary mb-2">אוי, משהו השתבש</h1>
                <p className="text-secondary mb-6">
                    אנו מצטערים, אך נתקלנו בתקלה בלתי צפויה. הצוות שלנו קיבל הודעה על הבעיה.
                </p>
                <button
                    onClick={this.handleReload}
                    className="px-6 py-2 text-sm font-semibold rounded-md bg-primary hover:bg-primary/90 text-light"
                >
                    נסה שוב
                </button>
                 {process.env.NODE_ENV !== 'production' && this.state.error && (
                    <details className="mt-6 text-left text-xs bg-light p-3 rounded">
                        <summary className="cursor-pointer text-secondary">פרטי שגיאה (לפיתוח)</summary>
                        <pre className="mt-2 whitespace-pre-wrap break-words text-danger">
                            {this.state.error.stack}
                        </pre>
                    </details>
                )}
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;