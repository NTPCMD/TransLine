import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { TextArea } from '../components/TextArea';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { OfflineBanner } from '../components/OfflineBanner';
import { Modal } from '../components/Modal';
import { ScreenHeader } from '../components/ScreenHeader';
import { Truck, AlertTriangle, Bell } from 'lucide-react';

interface ComponentsLibraryScreenProps {
  onBack: () => void;
}

export function ComponentsLibraryScreen({ onBack }: ComponentsLibraryScreenProps) {
  const [inputValue, setInputValue] = useState('');
  const [textareaValue, setTextareaValue] = useState('');
  const [selectedChip, setSelectedChip] = useState('breakdown');
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="h-full flex flex-col bg-white">
      <ScreenHeader title="Components Library" onBack={onBack} />
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-8 pb-8">
          {/* Buttons */}
          <div>
            <h3 className="mb-4">Buttons</h3>
            <div className="flex flex-col gap-3">
              <Button variant="primary" fullWidth>Primary Button</Button>
              <Button variant="secondary" fullWidth>Secondary Button</Button>
              <Button variant="outline" fullWidth>Outline Button</Button>
              <Button variant="text" fullWidth>Text Button</Button>
              <Button variant="primary" fullWidth disabled>Disabled Button</Button>
            </div>
          </div>

          {/* Inputs */}
          <div>
            <h3 className="mb-4">Inputs</h3>
            <div className="flex flex-col gap-4">
              <Input
                label="Default Input"
                placeholder="Enter text"
                value={inputValue}
                onChange={setInputValue}
              />
              <Input
                label="Error Input"
                placeholder="Enter text"
                value=""
                onChange={() => {}}
                error="This field is required"
              />
            </div>
          </div>

          {/* Text Area */}
          <div>
            <h3 className="mb-4">Text Area</h3>
            <TextArea
              label="Message"
              placeholder="Type your message..."
              value={textareaValue}
              onChange={setTextareaValue}
              rows={4}
            />
          </div>

          {/* Cards */}
          <div>
            <h3 className="mb-4">Cards</h3>
            <div className="flex flex-col gap-3">
              <Card>
                <div className="flex items-center gap-3">
                  <div className="bg-[#F2F2F2] p-3 rounded-lg">
                    <Truck className="text-[#C62828]" size={24} />
                  </div>
                  <div className="flex-1">
                    <h3>Vehicle Card</h3>
                    <p className="text-[#9E9E9E] text-sm">ABC-123 · Rigid Truck</p>
                    <p className="text-[#9E9E9E] text-sm">Sydney Depot</p>
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="mb-2">Checklist Item</h3>
                <div className="flex items-center justify-between">
                  <p className="text-[#2E2E2E]">Tyre pressure adequate</p>
                  <div className="flex gap-2">
                    <button className="px-4 py-1 rounded-full text-sm bg-[#66BB6A] text-white">
                      Pass
                    </button>
                    <button className="px-4 py-1 rounded-full text-sm bg-[#F2F2F2] text-[#9E9E9E]">
                      Fail
                    </button>
                  </div>
                </div>
              </Card>

              <Card className="bg-[#F2F2F2]">
                <h3 className="mb-3">Summary Card</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#9E9E9E]">Start Time</span>
                  <span>8:30 AM</span>
                </div>
                <div className="h-px bg-[#9E9E9E] my-2"></div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#9E9E9E]">Duration</span>
                  <span>4h 15m</span>
                </div>
              </Card>
            </div>
          </div>

          {/* Badges */}
          <div>
            <h3 className="mb-4">Badges</h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant="on-shift">ON SHIFT</Badge>
              <Badge variant="failed">FAILED</Badge>
              <Badge variant="issue">ISSUE</Badge>
              <Badge variant="pending">Pending</Badge>
              <Badge variant="approved">Approved</Badge>
              <Badge variant="rejected">Rejected</Badge>
              <Badge variant="unread">Unread</Badge>
            </div>
          </div>

          {/* Chips */}
          <div>
            <h3 className="mb-4">Chips (Incident Categories)</h3>
            <div className="flex flex-wrap gap-2">
              {['Breakdown', 'Accident', 'Flat Tyre', 'Mechanical', 'Other'].map(category => (
                <Chip
                  key={category}
                  label={category}
                  selected={selectedChip === category.toLowerCase().replace(' ', '-')}
                  onClick={() => setSelectedChip(category.toLowerCase().replace(' ', '-'))}
                />
              ))}
            </div>
          </div>

          {/* Offline Indicator */}
          <div>
            <h3 className="mb-4">Offline Indicator</h3>
            <OfflineBanner />
          </div>

          {/* Announcement Card */}
          <div>
            <h3 className="mb-4">Announcement Card</h3>
            <Card>
              <div className="flex items-start gap-3">
                <div className="bg-[#F2F2F2] p-2 rounded-lg">
                  <Bell className="text-[#C62828]" size={20} />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="flex-1">New Safety Protocol</h3>
                    <Badge variant="unread">New</Badge>
                  </div>
                  <p className="text-sm text-[#9E9E9E] mb-2">Updated pre-start checklist procedures</p>
                  <p className="text-xs text-[#9E9E9E]">Dec 29, 2024</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Declaration Checkbox */}
          <div>
            <h3 className="mb-4">Declaration Checkbox</h3>
            <div className="bg-[#FFF3E0] border-l-4 border-[#FFA726] p-4 rounded-lg flex gap-3">
              <AlertTriangle className="text-[#FFA726] flex-shrink-0" size={24} />
              <div>
                <p className="text-[#2E2E2E] mb-3">
                  I confirm I am fit for duty, not under the influence of drugs or alcohol, and medically safe to operate this vehicle.
                </p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 w-5 h-5 accent-[#C62828] cursor-pointer"
                  />
                  <span className="text-[#2E2E2E]">I agree to the above declaration</span>
                </label>
              </div>
            </div>
          </div>

          {/* Modals */}
          <div>
            <h3 className="mb-4">Modals</h3>
            <div className="flex flex-col gap-3">
              <Button variant="outline" fullWidth onClick={() => setShowModal(true)}>
                Show Start Shift Modal
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Confirm Start Shift"
        actions={
          <>
            <Button variant="outline" fullWidth onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" fullWidth onClick={() => setShowModal(false)}>
              Confirm
            </Button>
          </>
        }
      >
        <p>Are you ready to start your shift?</p>
        <p className="text-[#9E9E9E] text-sm mt-2">
          You will need to complete a pre-start vehicle checklist.
        </p>
      </Modal>
    </div>
  );
}
