import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ScreenHeader } from '../components/ScreenHeader';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface ChecklistItem {
  id: string;
  label: string;
  status: 'pass' | 'fail' | null;
  note: string;
  critical: boolean; // true = blocks shift, false = logs only
}

interface ChecklistSection {
  id: string;
  title: string;
  items: ChecklistItem[];
  expanded: boolean;
}

interface PreStartChecklistScreenProps {
  onSubmit: (hasFails: boolean) => void;
  onBack: () => void;
}

export function PreStartChecklistScreen({ onSubmit, onBack }: PreStartChecklistScreenProps) {
  const [sections, setSections] = useState<ChecklistSection[]>([
    {
      id: 'tyres',
      title: 'Tyres & Wheels',
      expanded: true,
      items: [
        { id: 'tyre-pressure', label: 'Tyre pressure adequate', status: null, note: '', critical: false },
        { id: 'tyre-tread', label: 'Tread depth acceptable', status: null, note: '', critical: true },
        { id: 'wheel-nuts', label: 'Wheel nuts secure', status: null, note: '', critical: true },
      ]
    },
    {
      id: 'lights',
      title: 'Lights & Indicators',
      expanded: false,
      items: [
        { id: 'headlights', label: 'Headlights working', status: null, note: '', critical: true },
        { id: 'indicators', label: 'Indicators working', status: null, note: '', critical: true },
        { id: 'brake-lights', label: 'Brake lights working', status: null, note: '', critical: true },
      ]
    },
    {
      id: 'fluids',
      title: 'Fluids',
      expanded: false,
      items: [
        { id: 'engine-oil', label: 'Engine oil level', status: null, note: '', critical: true },
        { id: 'coolant', label: 'Coolant level', status: null, note: '', critical: true },
        { id: 'washer-fluid', label: 'Washer fluid', status: null, note: '', critical: false },
      ]
    },
    {
      id: 'brakes',
      title: 'Brakes',
      expanded: false,
      items: [
        { id: 'brake-function', label: 'Brake function test', status: null, note: '', critical: true },
        { id: 'park-brake', label: 'Park brake working', status: null, note: '', critical: true },
      ]
    },
    {
      id: 'exterior',
      title: 'Exterior Damage',
      expanded: false,
      items: [
        { id: 'body-damage', label: 'No visible body damage', status: null, note: '', critical: false },
        { id: 'windscreen', label: 'Windscreen intact', status: null, note: '', critical: true },
        { id: 'mirrors', label: 'Mirrors intact and clean', status: null, note: '', critical: false },
      ]
    }
  ]);

  const toggleSection = (sectionId: string) => {
    setSections(sections.map(section =>
      section.id === sectionId
        ? { ...section, expanded: !section.expanded }
        : section
    ));
  };

  const updateItemStatus = (sectionId: string, itemId: string, status: 'pass' | 'fail') => {
    setSections(sections.map(section =>
      section.id === sectionId
        ? {
            ...section,
            items: section.items.map(item =>
              item.id === itemId ? { ...item, status } : item
            )
          }
        : section
    ));
  };

  const updateItemNote = (sectionId: string, itemId: string, note: string) => {
    setSections(sections.map(section =>
      section.id === sectionId
        ? {
            ...section,
            items: section.items.map(item =>
              item.id === itemId ? { ...item, note } : item
            )
          }
        : section
    ));
  };

  const hasFailedItems = sections.some(section =>
    section.items.some(item => item.status === 'fail')
  );

  const hasCriticalFailures = sections.some(section =>
    section.items.some(item => item.status === 'fail' && item.critical)
  );

  const allItemsCompleted = sections.every(section =>
    section.items.every(item => item.status !== null)
  );

  const failedItemsHaveNotes = sections.every(section =>
    section.items.every(item =>
      item.status !== 'fail' || (item.status === 'fail' && item.note.trim() !== '')
    )
  );

  const canSubmit = allItemsCompleted && failedItemsHaveNotes;

  return (
    <div className="h-full flex flex-col bg-white">
      <ScreenHeader title="Vehicle Checklist" onBack={onBack} />
      
      {hasFailedItems && (
        <div className="bg-[#FFEBEE] border-l-4 border-[#D32F2F] p-4 flex gap-3">
          <AlertTriangle className="text-[#D32F2F] flex-shrink-0" size={20} />
          <p className="text-sm text-[#2E2E2E]">
            Failed items will notify operations
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-3 pb-24">
          {sections.map(section => (
            <Card key={section.id}>
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between"
              >
                <h3>{section.title}</h3>
                {section.expanded ? (
                  <ChevronUp className="text-[#9E9E9E]" size={20} />
                ) : (
                  <ChevronDown className="text-[#9E9E9E]" size={20} />
                )}
              </button>

              {section.expanded && (
                <div className="mt-4 flex flex-col gap-4">
                  {section.items.map(item => (
                    <div key={item.id} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[#2E2E2E]">{item.label}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateItemStatus(section.id, item.id, 'pass')}
                            className={`px-4 py-1 rounded-full text-sm transition-colors ${
                              item.status === 'pass'
                                ? 'bg-[#66BB6A] text-white'
                                : 'bg-[#F2F2F2] text-[#9E9E9E]'
                            }`}
                          >
                            Pass
                          </button>
                          <button
                            onClick={() => updateItemStatus(section.id, item.id, 'fail')}
                            className={`px-4 py-1 rounded-full text-sm transition-colors ${
                              item.status === 'fail'
                                ? 'bg-[#D32F2F] text-white'
                                : 'bg-[#F2F2F2] text-[#9E9E9E]'
                            }`}
                          >
                            Fail
                          </button>
                        </div>
                      </div>

                      {item.status === 'fail' && (
                        <textarea
                          placeholder="Required: Describe the issue"
                          value={item.note}
                          onChange={(e) => updateItemNote(section.id, item.id, e.target.value)}
                          rows={2}
                          className="px-3 py-2 rounded-lg border-2 border-[#D32F2F] focus:outline-none text-sm resize-none"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#F2F2F2] p-4 flex gap-2">
        <Button variant="outline" onClick={onBack}>
          Save Draft
        </Button>
        <Button
          variant="primary"
          fullWidth
          onClick={() => onSubmit(hasCriticalFailures)}
          disabled={!canSubmit}
        >
          Submit Checklist
        </Button>
      </div>
    </div>
  );
}