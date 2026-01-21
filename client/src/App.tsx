import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { AdminPanel } from './components/AdminPanel';
import { CompanyBranchManager } from './components/CompanyBranchManager';
import { BankAccountManager } from './components/BankAccountManager';
import { ProjectManager } from './components/ProjectManager';
import { VendorManager } from './components/VendorManager';
import { EmployeeManager } from './components/EmployeeManager';
import { TransactionNatureManager } from './components/TransactionNatureManager';
import { CategoryGroupManager } from './components/CategoryGroupManager';
import { CategoryManager } from './components/CategoryManager';
import OfferLetterManager from './components/OfferLetterManager';
import RAGOfferLetterManager from './components/RAGOfferLetterManager';
import PromptOfferLetterGenerator from './components/PromptOfferLetterGenerator';
import LetterheadManager from './components/LetterheadManager';
import { RecruitmentHub } from './components/RecruitmentHub';
import { Sidebar, Header } from './components/layout';
import { AIAssistant } from './components/AIAssistant';
import { Messages } from './components/Messages';
import { Toaster } from './components/Toaster';
import { MockRecruitmentProvider } from './contexts/MockRecruitmentContext';

function App() {
  const { user, isLoading, isAdmin } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showAIChat, setShowAIChat] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    // Handle Gmail OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail') === 'connected') {
      if (window.opener) {
        // We are in a popup
        window.opener.postMessage({ type: 'gmail-oauth-success' }, window.location.origin);
        window.close();
      }
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-orange-500 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 40 40" className="w-10 h-10 text-white">
              <path
                fill="currentColor"
                d="M20 4C11.16 4 4 11.16 4 20c0 3.09.88 5.97 2.4 8.4L4 36l7.6-2.4C14.03 35.12 16.91 36 20 36c8.84 0 16-7.16 16-16S28.84 4 20 4zm-2 22v-8h8v-4h-8V8h4v6h8v8h-8v4h-4z"
              />
            </svg>
          </div>
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading Phoneme Workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // Render admin pages first
  if (currentPage === 'admin' && isAdmin) return <AdminPanel onBack={() => setCurrentPage('dashboard')} />;
  if (currentPage === 'companies' && isAdmin) return <CompanyBranchManager onBack={() => setCurrentPage('dashboard')} />;
  if (currentPage === 'bank-accounts' && isAdmin) return <BankAccountManager onBack={() => setCurrentPage('dashboard')} />;
  if (currentPage === 'projects' && isAdmin) return <ProjectManager onBack={() => setCurrentPage('dashboard')} />;
  if (currentPage === 'vendors' && isAdmin) return <VendorManager onBack={() => setCurrentPage('dashboard')} />;
  if (currentPage === 'employees' && isAdmin) return <EmployeeManager onBack={() => setCurrentPage('dashboard')} />;
  if (currentPage === 'transaction-nature' && isAdmin) return <TransactionNatureManager onBack={() => setCurrentPage('dashboard')} />;
  if (currentPage === 'category-group' && isAdmin) return <CategoryGroupManager onBack={() => setCurrentPage('dashboard')} />;
  if (currentPage === 'category' && isAdmin) return <CategoryManager onBack={() => setCurrentPage('dashboard')} />;
  if (currentPage === 'offer-letters' && isAdmin) return <OfferLetterManager onBack={() => setCurrentPage('dashboard')} />;
  if (currentPage === 'ai-training' && isAdmin) return <RAGOfferLetterManager onBack={() => setCurrentPage('dashboard')} />;
  if (currentPage === 'ai-offer-generator' && isAdmin) return <PromptOfferLetterGenerator onBack={() => setCurrentPage('dashboard')} />;
  if (currentPage === 'letterheads' && isAdmin) return <LetterheadManager onBack={() => setCurrentPage('dashboard')} />;

  // Main app with sidebar
  return (
    <MockRecruitmentProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Toaster />
        <Sidebar
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          collapsed={sidebarCollapsed}
          onToggle={setSidebarCollapsed}
        />
        <div className={`${sidebarCollapsed ? 'ml-16' : 'ml-64'} transition-all duration-300`}>
          <Header
            onOpenAIChat={() => setShowAIChat(true)}
            onOpenMessages={() => setShowMessages(true)}
            sidebarCollapsed={sidebarCollapsed}
          />
          <main>
            {currentPage === 'dashboard' && <DashboardPage />}
            {currentPage === 'recruitment-hub' && <RecruitmentHub />}
          </main>
        </div>

        <AIAssistant isOpen={showAIChat} onClose={() => setShowAIChat(false)} />
        <Messages isOpen={showMessages} onClose={() => setShowMessages(false)} />
      </div>
    </MockRecruitmentProvider>
  );
}

function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h1>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
        <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Welcome to Phoneme Workspace</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Your central hub for team collaboration and task management.
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Dashboard analytics and insights coming soon.
        </p>
      </div>
    </div>
  );
}

export default App;
