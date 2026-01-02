import React, { useState } from 'react';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { ScreenHeader } from '../components/ScreenHeader';
import { Bell } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  message: string;
  shortMessage: string;
  date: string;
  read: boolean;
}

interface AnnouncementsScreenProps {
  onBack: () => void;
}

const mockAnnouncements: Announcement[] = [
  {
    id: '1',
    title: 'New Safety Protocol',
    shortMessage: 'Updated pre-start checklist procedures',
    message: 'Effective immediately, all drivers must complete the enhanced pre-start checklist including additional tyre pressure checks and mirror adjustments. This is part of our commitment to road safety.',
    date: 'Dec 29, 2024',
    read: false
  },
  {
    id: '2',
    title: 'Holiday Schedule',
    shortMessage: 'Operations hours during holiday period',
    message: 'Please note that our operations center will have reduced hours between December 24-26 and January 1. Emergency support remains available 24/7.',
    date: 'Dec 28, 2024',
    read: false
  },
  {
    id: '3',
    title: 'Fuel Card Update',
    shortMessage: 'New fuel card system rollout',
    message: 'The new fuel card system will be implemented on January 15. Please attend the training session scheduled for next week. All current cards will remain active until then.',
    date: 'Dec 27, 2024',
    read: true
  },
  {
    id: '4',
    title: 'Weather Alert',
    shortMessage: 'Severe weather expected this week',
    message: 'Heavy rain and strong winds are forecasted for Sydney and surrounding areas. Please exercise extra caution, allow additional travel time, and postpone non-urgent trips if conditions become dangerous.',
    date: 'Dec 26, 2024',
    read: true
  }
];

export function AnnouncementsScreen({ onBack }: AnnouncementsScreenProps) {
  const [announcements, setAnnouncements] = useState(mockAnnouncements);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const markAsRead = (id: string) => {
    setAnnouncements(prev =>
      prev.map(ann => ann.id === id ? { ...ann, read: true } : ann)
    );
  };

  const handleAnnouncementClick = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    markAsRead(announcement.id);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <ScreenHeader title="Announcements" onBack={onBack} />
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-3">
          {announcements.map(announcement => (
            <Card key={announcement.id} onClick={() => handleAnnouncementClick(announcement)}>
              <div className="flex items-start gap-3">
                <div className="bg-[#F2F2F2] p-2 rounded-lg">
                  <Bell className="text-[#C62828]" size={20} />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="flex-1">{announcement.title}</h3>
                    {!announcement.read && <Badge variant="unread">New</Badge>}
                  </div>
                  <p className="text-sm text-[#9E9E9E] mb-2">{announcement.shortMessage}</p>
                  <p className="text-xs text-[#9E9E9E]">{announcement.date}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Modal
        isOpen={!!selectedAnnouncement}
        onClose={() => setSelectedAnnouncement(null)}
        title={selectedAnnouncement?.title || ''}
        actions={
          <Button variant="primary" fullWidth onClick={() => setSelectedAnnouncement(null)}>
            Close
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[#9E9E9E]">{selectedAnnouncement?.date}</p>
          <p>{selectedAnnouncement?.message}</p>
        </div>
      </Modal>
    </div>
  );
}
