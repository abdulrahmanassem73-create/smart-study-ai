import * as React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center px-6">
            <div className="text-center max-w-md">
              <h1 className="text-2xl font-extrabold">عذراً، حدث خطأ غير متوقع في النظام</h1>
              <p className="mt-2 text-sm text-muted-foreground leading-6">
                يمكنك إعادة تحميل الصفحة أو الرجوع للرئيسية. إذا تكرر الخطأ، جرّب تحديث المتصفح أو تسجيل الخروج ثم الدخول مرة أخرى.
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
                >
                  إعادة تحميل الصفحة
                </button>

                <button
                  onClick={() => {
                    // Hash router (wouter/use-hash-location)
                    window.location.hash = "#/";
                  }}
                  className="px-4 py-2 border rounded-md"
                >
                  العودة للرئيسية
                </button>
              </div>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

