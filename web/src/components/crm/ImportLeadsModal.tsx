
import React, { useState } from 'react';
import api from '../../config/api';
import { useToast } from '../ui/Toast';

interface ImportLeadsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const ImportLeadsModal: React.FC<ImportLeadsModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { add } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [tripId, setTripId] = useState('');
    const [trips, setTrips] = useState<any[]>([]);
    const [isFetchingTrips, setIsFetchingTrips] = useState(false);

    React.useEffect(() => {
        if (isOpen) {
            fetchOrganizerTrips();
        }
    }, [isOpen]);

    const fetchOrganizerTrips = async () => {
        setIsFetchingTrips(true);
        try {
            const response = await api.get('/api/trips/organizer/my-trips');
            setTrips(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch trips:', error);
        } finally {
            setIsFetchingTrips(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
                add('Please upload a CSV file', 'error');
                return;
            }
            setFile(selectedFile);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            add('Please select a file', 'error');
            return;
        }

        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        if (tripId) {
            formData.append('tripId', tripId);
        }

        try {
            const response = await api.post('/api/crm/import/leads', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.data.success) {
                add(`Successfully imported ${response.data.count} leads`, 'success');
                onSuccess();
            } else {
                throw new Error(response.data.error || 'Import failed');
            }
        } catch (error: any) {
            console.error('Import error:', error);
            add(error.response?.data?.error || 'Failed to import leads. Ensure CSV format is correct (Name, Email, Phone, Message).', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-900">📥 Import Leads</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <h3 className="font-semibold text-blue-800 mb-2">📋 CSV Format Requirements</h3>
                        <p className="text-sm text-blue-700">
                            Your CSV should have the following headers:
                            <br />
                            <code className="bg-blue-100 px-1 rounded">Name, Email, Phone, Message</code>
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Associate with Trip (Optional)
                        </label>
                        <select
                            value={tripId}
                            onChange={(e) => setTripId(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={isFetchingTrips}
                        >
                            <option value="">No specific trip</option>
                            {trips.map((trip) => (
                                <option key={trip._id} value={trip._id}>
                                    {trip.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select CSV File
                        </label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-blue-500 transition-colors cursor-pointer relative">
                            <div className="space-y-1 text-center">
                                <svg
                                    className="mx-auto h-12 w-12 text-gray-400"
                                    stroke="currentColor"
                                    fill="none"
                                    viewBox="0 0 48 48"
                                    aria-hidden="true"
                                >
                                    <path
                                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                                <div className="flex text-sm text-gray-600">
                                    <span className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500">
                                        {file ? file.name : 'Upload a file'}
                                    </span>
                                    {!file && <p className="pl-1">or drag and drop</p>}
                                </div>
                                <p className="text-xs text-gray-500 text-center">CSV files up to 10MB</p>
                            </div>
                            <input
                                type="file"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                accept=".csv"
                                onChange={handleFileChange}
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !file}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Importing...' : 'Start Import'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ImportLeadsModal;
