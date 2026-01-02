import React, { useState } from 'react';
import { Menu, X, Clock, FileText, Fuel, MessageSquare, Bell, Wrench, Heart, LogOut } from 'lucide-react';

interface HamburgerMenuProps {
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

export function HamburgerMenu({ onNavigate, onLogout }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { id: 'active-shift', label: 'Active Shift', icon: Clock },
    { id: 'shift-details', label: 'Shift Details', icon: FileText },
    { id: 'fuel-log', label: 'Fuel Log', icon: Fuel },
    { id: 'send-note', label: 'Notes', icon: MessageSquare },
    { id: 'announcements', label: 'Announcements', icon: Bell },
    { id: 'maintenance-log', label: 'Vehicle Maintenance Log', icon: Wrench },
    { id: 'medical-absence', label: 'Medical Absence', icon: Heart },
  ];

  const handleNavigate = (screenId: string) => {
    setIsOpen(false);
    onNavigate(screenId);
  };

  const handleLogout = () => {
    setIsOpen(false);
    onLogout();
  };

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-[#F2F2F2] transition-colors"
        aria-label="Menu"
      >
        <Menu size={24} className="text-[#2E2E2E]" />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Side Menu */}
      <div
        className={`fixed top-0 left-0 h-full w-[280px] bg-white shadow-lg z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#F2F2F2]">
            <h2>Menu</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-lg hover:bg-[#F2F2F2] transition-colors"
            >
              <X size={24} className="text-[#2E2E2E]" />
            </button>
          </div>

          {/* Menu Items */}
          <div className="flex-1 overflow-y-auto py-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F2F2F2] transition-colors"
                >
                  <Icon size={20} className="text-[#9E9E9E]" />
                  <span className="text-[#2E2E2E]">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Logout */}
          <div className="border-t border-[#F2F2F2] p-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F2F2F2] transition-colors text-[#D32F2F]"
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
