import React from 'react';
import { useNavigate } from 'react-router-dom';

interface CRMPreviewProps {
    hasCRMAccess: boolean;
    crmSubscription: any;
}

const CRMPreviewSection: React.FC<CRMPreviewProps> = ({ hasCRMAccess, crmSubscription }) => {
    const navigate = useNavigate();

    // Sample CRM preview data
    const sampleCrm = {
        stats: {
            activeLeads: 18,
            hotLeads: 6,
            conversionRate: 32,
            avgResponseMins: 18,
        },
        leads: [
            { name: 'Aditi Sharma', trip: 'Kedarkantha Winter Trek', stage: 'Hot lead', budget: '₹18,000', followUp: 'Today 5:30 PM' },
            { name: 'Rohan Patil', trip: 'Valley of Flowers', stage: 'Negotiation', budget: '₹22,000', followUp: 'Tomorrow 10:00 AM' },
            { name: 'Sara Thomas', trip: 'Chadar Frozen River', stage: 'New', budget: '₹35,000', followUp: 'Today 2:00 PM' },
        ],
        pipeline: [
            { label: 'New', value: 9 },
            { label: 'Contacted', value: 7 },
            { label: 'Negotiation', value: 4 },
            { label: 'Won', value: 3 },
        ],
        tasks: [
            { title: 'Send GST invoice to corporate client', due: 'Today', priority: 'High' },
            { title: 'Share packing list for Hampta Pass', due: 'Tomorrow', priority: 'Medium' },
            { title: 'Confirm permits for Sandakphu', due: 'In 2 days', priority: 'Low' },
        ],
    };

    return (
        <div className="max-w-7xl mx-auto mt-8">
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-forest-800">📋 CRM Access</h2>
                    {hasCRMAccess && (
                        <button
                            onClick={() => navigate('/organizer/crm')}
                            className="px-6 py-2 bg-gradient-to-r from-forest-600 to-nature-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                        >
                            📊 Open CRM Dashboard
                        </button>
                    )}
                </div>
                {!crmSubscription ? (
                    <div className="space-y-4">
                        <div className="text-sm text-forest-600">
                            <p>You do not have CRM access currently.</p>
                            <p className="mt-2">Preview what you get with the CRM bundle below.</p>
                        </div>

                        {/* Sample CRM Preview */}
                        <div className="grid md:grid-cols-4 gap-4">
                            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200">
                                <p className="text-xs text-forest-700">Active leads</p>
                                <p className="text-2xl font-bold text-forest-900">{sampleCrm.stats.activeLeads}</p>
                                <p className="text-xs text-forest-600 mt-1">Across all trips</p>
                            </div>
                            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-yellow-100 border border-amber-200">
                                <p className="text-xs text-forest-700">Hot leads</p>
                                <p className="text-2xl font-bold text-forest-900">{sampleCrm.stats.hotLeads}</p>
                                <p className="text-xs text-forest-600 mt-1">Need action today</p>
                            </div>
                            <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-100 border border-indigo-200">
                                <p className="text-xs text-forest-700">Conversion rate</p>
                                <p className="text-2xl font-bold text-forest-900">{sampleCrm.stats.conversionRate}%</p>
                                <p className="text-xs text-forest-600 mt-1">Last 30 days</p>
                            </div>
                            <div className="p-4 rounded-xl bg-gradient-to-br from-rose-50 to-pink-100 border border-rose-200">
                                <p className="text-xs text-forest-700">Avg response</p>
                                <p className="text-2xl font-bold text-forest-900">{sampleCrm.stats.avgResponseMins} mins</p>
                                <p className="text-xs text-forest-600 mt-1">Reply time</p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="p-4 rounded-xl border border-forest-100 bg-forest-50/50">
                                <h4 className="text-sm font-semibold text-forest-900 mb-2">Top leads</h4>
                                <div className="space-y-3 text-sm">
                                    {sampleCrm.leads.map((lead, idx) => (
                                        <div key={idx} className="p-3 rounded-lg bg-white border border-forest-100 shadow-sm">
                                            <div className="font-semibold text-forest-900">{lead.name}</div>
                                            <div className="text-forest-700">{lead.trip}</div>
                                            <div className="flex justify-between text-xs text-forest-600 mt-1">
                                                <span>{lead.stage}</span>
                                                <span>{lead.budget}</span>
                                            </div>
                                            <div className="text-xs text-forest-500 mt-1">Next: {lead.followUp}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-4 rounded-xl border border-forest-100 bg-white shadow-sm">
                                <h4 className="text-sm font-semibold text-forest-900 mb-3">Pipeline snapshot</h4>
                                <div className="space-y-2">
                                    {sampleCrm.pipeline.map((stage, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <div className="w-24 text-xs text-forest-700">{stage.label}</div>
                                            <div className="flex-1 h-2 rounded-full bg-forest-50">
                                                <div className="h-2 rounded-full bg-gradient-to-r from-forest-500 to-nature-500" style={{ width: `${stage.value * 6}%` }}></div>
                                            </div>
                                            <div className="text-xs font-semibold text-forest-900 w-6 text-right">{stage.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-4 rounded-xl border border-forest-100 bg-gradient-to-br from-blue-50 to-indigo-50">
                                <h4 className="text-sm font-semibold text-forest-900 mb-3">Today’s to-dos</h4>
                                <div className="space-y-2 text-sm">
                                    {sampleCrm.tasks.map((task, idx) => (
                                        <div key={idx} className="p-3 bg-white rounded-lg border border-forest-100 shadow-sm flex justify-between items-center">
                                            <div>
                                                <div className="font-semibold text-forest-900">{task.title}</div>
                                                <div className="text-xs text-forest-600">Due: {task.due}</div>
                                            </div>
                                            <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">{task.priority}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-forest-600 mt-3">Unlock full CRM to track leads, tasks, tickets, billing and more.</p>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-4">
                            <button
                                onClick={() => navigate('/subscribe')}
                                className="flex-1 px-6 py-3 bg-gradient-to-r from-forest-600 to-nature-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                            >
                                ✨ Upgrade to Professional Plan (₹2,199)
                            </button>
                            <button
                                onClick={() => navigate('/organizer/subscriptions')}
                                className="flex-1 px-6 py-3 bg-white border-2 border-forest-600 text-forest-600 font-semibold rounded-lg hover:bg-forest-50 transition-all"
                            >
                                📊 View All Plans
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <p className="text-xs text-forest-600">Status</p>
                            <p className="font-semibold text-forest-800">{crmSubscription.status}</p>
                        </div>
                        <div>
                            <p className="text-xs text-forest-600">CRM Access</p>
                            <p className="font-semibold text-forest-800">{crmSubscription.crmBundle?.hasAccess ? 'Enabled' : 'Disabled'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-forest-600">Billing</p>
                            <p className="font-semibold text-forest-800">{crmSubscription.billingHistory?.length || 0} transactions</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CRMPreviewSection;
