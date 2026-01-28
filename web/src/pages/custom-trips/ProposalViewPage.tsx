import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../config/api';
import { useToast } from '../../components/ui/Toast';
import LoadingButton from '../../components/ui/LoadingButton';

interface Proposal {
    _id: string;
    organizerId: {
        _id: string;
        name: string;
        organizerProfile?: {
            companyName?: string;
        }
    };
    price: number;
    message: string;
    itinerarySummary: string;
    inclusions: string[];
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: string;
}

const ProposalViewPage: React.FC = () => {
    const { requestId, proposalId } = useParams<{ requestId: string; proposalId: string }>();
    const navigate = useNavigate();
    const { add } = useToast();
    const [proposal, setProposal] = useState<Proposal | null>(null);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);

    useEffect(() => {
        // In a real app, you might fetch the specific proposal via a direct endpoint or filter from the request
        // For now, let's assume we fetch the request and find the proposal
        const fetchProposal = async () => {
            try {
                const response = await api.get(`/api/custom-trips/${requestId}`);
                const request = response.data.data;
                const found = request.proposals.find((p: any) => p._id === proposalId);
                if (found) {
                    setProposal(found);
                } else {
                    add('Proposal not found', 'error');
                    navigate('/my-requests');
                }
            } catch (error) {
                console.error('Error fetching proposal:', error);
                add('Failed to load proposal', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchProposal();
    }, [requestId, proposalId, navigate, add]);

    const handleAccept = async () => {
        setAccepting(true);
        try {
            const response = await api.post(`/api/custom-trips/${requestId}/proposals/${proposalId}/accept`);
            if (response.data.success) {
                add('Proposal accepted! A private trip has been created for you.', 'success');
                // Redirect to the newly created trip
                navigate(`/trip/${response.data.tripId}`);
            } else {
                add(response.data.error || 'Failed to accept proposal', 'error');
            }
        } catch (error: any) {
            console.error('Accept error:', error);
            add(error.response?.data?.error || 'Failed to accept proposal', 'error');
        } finally {
            setAccepting(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center">Loading proposal...</div>;
    }

    if (!proposal) return null;

    return (
        <div className="min-h-screen bg-forest-50 py-12 px-4">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                <div className="bg-nature-600 px-6 py-4 text-white flex justify-between items-center">
                    <h1 className="text-xl font-bold">Proposal from {proposal.organizerId.organizerProfile?.companyName || proposal.organizerId.name}</h1>
                    <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                        ₹{proposal.price.toLocaleString()}
                    </span>
                </div>

                <div className="p-8 space-y-6">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Message</h3>
                        <p className="text-gray-800 bg-gray-50 p-4 rounded-lg">{proposal.message}</p>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Itinerary Summary</h3>
                        <p className="text-gray-800 whitespace-pre-line">{proposal.itinerarySummary}</p>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Inclusions</h3>
                        <ul className="grid grid-cols-2 gap-2">
                            {proposal.inclusions.map((item, idx) => (
                                <li key={idx} className="flex items-center text-gray-700">
                                    <span className="text-green-500 mr-2">✓</span> {item}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
                        <button
                            onClick={() => navigate('/my-requests')}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Back
                        </button>
                        {proposal.status === 'pending' && (
                            <LoadingButton
                                loading={accepting}
                                onClick={handleAccept}
                                className="px-6 py-2 bg-nature-600 text-white font-semibold rounded-lg hover:bg-nature-700 shadow-md"
                            >
                                Accept Proposal
                            </LoadingButton>
                        )}
                        {proposal.status === 'accepted' && (
                            <span className="px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium">
                                Accepted
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProposalViewPage;
