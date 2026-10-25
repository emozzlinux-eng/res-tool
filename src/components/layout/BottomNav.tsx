import React from 'react';
import { Home, ClipboardList, Package, User, type LucideIcon } from 'lucide-react';
import { Page } from '../../types';

interface BottomNavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

interface NavItem {
  page: Page;
  label: string;
  Icon: LucideIcon;
}

const navItems: NavItem[] = [
  { page: 'home', label: 'Home', Icon: Home },
  { page: 'manage', label: 'Manage', Icon: ClipboardList },
  { page: 'restock', label: 'Restock', Icon: Package },
  { page: 'profile', label: 'Profile', Icon: User },
];

export const BottomNav: React.FC<BottomNavProps> = ({ currentPage, onNavigate }) => {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
      {navItems.map(({ page, label, Icon }) => {
        const isActive = currentPage === page;

        return (
          <button
            key={page}
            className={`nav-tab ${isActive ? 'active' : ''}`}
            onClick={() => onNavigate(page)}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
          >
            <div className="nav-tab__pill">
              <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
              <span>{label}</span>
            </div>
          </button>
        );
      })}
    </nav>
  );
};
