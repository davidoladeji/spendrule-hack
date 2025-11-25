import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>

      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />

          <main id="main-content" className="flex-1 overflow-auto bg-background" role="main">
            <div className="p-4">{children}</div>
          </main>
        </div>
      </div>
    </>
  );
}
