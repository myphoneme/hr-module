import { useState } from 'react';
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [currentPage, setCurrentPage] = useState('tasks');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handlePageChange = (page: string) => {
    setCurrentPage(page);
    // Navigation logic can be extended here
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        currentPage={currentPage}
        onPageChange={handlePageChange}
        collapsed={sidebarCollapsed}
        onToggle={setSidebarCollapsed}
      />
      <div className={`${sidebarCollapsed ? 'ml-16' : 'ml-64'} transition-all duration-300`}>
        <Header sidebarCollapsed={sidebarCollapsed} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

export { Sidebar } from './Sidebar';
export { Header } from './Header';
