import React, { useState } from 'react';
import api from '../../config/api';
import LeadScoreBadge from './LeadScoreBadge';

export interface Lead {
  _id: string;
  name: string;
  email: string;
  leadScore: number;
  pipelineStage: 'new' | 'contacted' | 'interested' | 'negotiating' | 'booked' | 'lost';
}

interface Column {
  key: Lead['pipelineStage'];
  label: string;
  headerBg: string;
  headerText: string;
  borderColor: string;
}

const COLUMNS: Column[] = [
  { key: 'new',         label: 'New',         headerBg: 'bg-gray-100',   headerText: 'text-gray-700',   borderColor: 'border-gray-300' },
  { key: 'contacted',   label: 'Contacted',   headerBg: 'bg-blue-100',   headerText: 'text-blue-700',   borderColor: 'border-blue-300' },
  { key: 'interested',  label: 'Interested',  headerBg: 'bg-indigo-100', headerText: 'text-indigo-700', borderColor: 'border-indigo-300' },
  { key: 'negotiating', label: 'Negotiating', headerBg: 'bg-yellow-100', headerText: 'text-yellow-700', borderColor: 'border-yellow-300' },
  { key: 'booked',      label: 'Booked',      headerBg: 'bg-green-100',  headerText: 'text-green-700',  borderColor: 'border-green-300' },
  { key: 'lost',        label: 'Lost',        headerBg: 'bg-red-100',    headerText: 'text-red-700',    borderColor: 'border-red-300' },
];

interface LeadKanbanProps {
  leads: Lead[];
  onStageChange: (leadId: string, stage: string) => void;
}

const LeadKanban: React.FC<LeadKanbanProps> = ({ leads, onStageChange }) => {
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, leadId: string) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, columnKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnKey);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, columnKey: string) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedLeadId) return;

    const lead = leads.find(l => l._id === draggedLeadId);
    if (!lead || lead.pipelineStage === columnKey) {
      setDraggedLeadId(null);
      return;
    }

    try {
      await api.patch(`/api/crm/leads/${draggedLeadId}/pipeline-stage`, { pipelineStage: columnKey });
      onStageChange(draggedLeadId, columnKey);
    } catch (err) {
      console.error('Failed to update pipeline stage', err);
    } finally {
      setDraggedLeadId(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedLeadId(null);
    setDragOverColumn(null);
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {COLUMNS.map(col => {
          const colLeads = leads.filter(l => l.pipelineStage === col.key);
          const isOver = dragOverColumn === col.key;

          return (
            <div
              key={col.key}
              className={`flex flex-col w-64 rounded-lg border-2 transition-colors ${col.borderColor} ${isOver ? 'ring-2 ring-offset-1 ring-blue-400 bg-blue-50' : 'bg-gray-50'}`}
              onDragOver={e => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.key)}
            >
              {/* Column header */}
              <div className={`flex items-center justify-between px-3 py-2 rounded-t-md ${col.headerBg}`}>
                <span className={`text-sm font-semibold ${col.headerText}`}>{col.label}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${col.headerBg} ${col.headerText} border ${col.borderColor}`}>
                  {colLeads.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 p-2 min-h-[120px]">
                {colLeads.map(lead => (
                  <div
                    key={lead._id}
                    draggable
                    onDragStart={e => handleDragStart(e, lead._id)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white rounded-md border border-gray-200 p-3 shadow-sm cursor-grab active:cursor-grabbing select-none transition-opacity ${draggedLeadId === lead._id ? 'opacity-40' : 'opacity-100'}`}
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{lead.name}</p>
                    <p className="text-xs text-gray-500 truncate mb-2">{lead.email}</p>
                    <LeadScoreBadge score={lead.leadScore} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LeadKanban;
