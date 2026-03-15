import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, UserPlus, Users, LogOut, Activity, Briefcase, Search, BarChart3 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Add Candidate", href: "/add-candidate", icon: UserPlus },
  { name: "All Candidates", href: "/candidates", icon: Users },
  { name: "Employee Monitor", href: "/employees", icon: Activity },
  { name: "Attrition", href: "/attrition", icon: BarChart3 },
  { name: "Candidate Matching", href: "/candidate-matching", icon: Briefcase },
  { name: "Talent Search", href: "/talent-search", icon: Search },
];

const Layout = ({ children }) => {
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">AI</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">
                Candidate Intelligence
              </span>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                      isActive
                        ? "bg-primary-50 text-primary-700"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="hidden sm:block text-sm text-gray-600 truncate max-w-40">
                {user?.email || "User"}
              </span>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden border-t border-gray-100 px-4 py-2">
          <nav className="flex items-center gap-1 overflow-x-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors duration-200 ${
                    isActive
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
