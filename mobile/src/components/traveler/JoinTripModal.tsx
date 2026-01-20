import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Image,
    Alert,
    Linking
} from 'react-native';
import { X, ShieldCheck, IndianRupee, Camera, CheckCircle2, Copy } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../../api/client';
import Loader from '../ui/Loader';

interface JoinTripModalProps {
    trip: any;
    isVisible: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const JoinTripModal: React.FC<JoinTripModalProps> = ({ trip, isVisible, onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [proofImage, setProofImage] = useState<string | null>(null);

    // UPI Config from Organizer Data
    const upiId = trip.organizerId?.organizerProfile?.bankDetails?.upiId || 'trektribe@upi';
    const upiName = trip.organizerId?.name || 'Trek Tribe Organizer';
    const upiUrl = `upi://pay?pa=${upiId}&pn=${upiName}&am=${trip.price}&tn=Booking for ${trip.title}&cu=INR`;

    const handleJoinInit = async () => {
        setLoading(true);
        try {
            // Step 1: Create the booking (pending state)
            const response = await apiClient.post('/bookings', {
                tripId: trip._id,
                numberOfTravelers: 1,
                // Other fields can be added here
            });

            if (response.data.booking) {
                setStep(2); // Move to Payment
            }
        } catch (error: any) {
            console.error('Booking creation failed:', error);
            Alert.alert('Error', error.response?.data?.error || 'Failed to initialize booking');
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            setProofImage(result.assets[0].uri);
        }
    };

    const handleSubmitProof = async () => {
        if (!proofImage) {
            Alert.alert('Required', 'Please upload a screenshot of your payment');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('paymentScreenshot', {
                uri: proofImage,
                name: 'proof.jpg',
                type: 'image/jpeg',
            } as any);

            await apiClient.post(`/bookings/my-bookings/upload-proof`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setStep(3); // Success!
        } catch (error: any) {
            console.error('Proof upload failed:', error);
            Alert.alert('Error', 'Failed to upload proof. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const renderStep1 = () => (
        <View style={styles.stepContent}>
            <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total to Pay</Text>
                <Text style={styles.summaryValue}>₹{trip.price.toLocaleString()}</Text>
            </View>

            <Text style={styles.sectionTitle}>Important Notes</Text>
            <View style={styles.noteItem}>
                <CheckCircle2 size={18} color="#047857" />
                <Text style={styles.noteText}>Full refund if cancelled 7 days before trip</Text>
            </View>
            <View style={styles.noteItem}>
                <CheckCircle2 size={18} color="#047857" />
                <Text style={styles.noteText}>Follow all safety guidelines from the guide</Text>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleJoinInit}>
                <Text style={styles.primaryBtnText}>Confirm Participation</Text>
            </TouchableOpacity>
        </View>
    );

    const renderStep2 = () => (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.paymentTitle}>Scan & Pay Unique Amount</Text>
            <Text style={styles.paymentSub}>Payment goes directly to {upiName}</Text>

            <View style={styles.qrContainer}>
                <QRCode value={upiUrl} size={200} />
                <View style={styles.upiBadge}>
                    <Text style={styles.upiIdText}>{upiId}</Text>
                    <TouchableOpacity onPress={() => { }}>
                        <Copy size={16} color="#666" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.uploadSection}>
                <Text style={styles.uploadTitle}>Step 2: Upload Screenshot</Text>
                <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
                    {proofImage ? (
                        <Image source={{ uri: proofImage }} style={styles.previewImage} />
                    ) : (
                        <View style={styles.uploadPlaceholder}>
                            <Camera size={40} color="#9ca3af" />
                            <Text style={styles.uploadLabel}>Click to upload payment proof</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={[styles.primaryBtn, !proofImage && styles.disabledBtn]}
                onPress={handleSubmitProof}
                disabled={!proofImage}
            >
                <Text style={styles.primaryBtnText}>Submit for Verification</Text>
            </TouchableOpacity>
        </ScrollView>
    );

    const renderStep3 = () => (
        <View style={[styles.stepContent, { alignItems: 'center', paddingVertical: 40 }]}>
            <View style={styles.successIcon}>
                <CheckCircle2 size={64} color="#047857" />
            </View>
            <Text style={styles.successTitle}>Booking Requested!</Text>
            <Text style={styles.successMsg}>
                The organizer has been notified. You'll get a confirmation once your payment is verified.
            </Text>
            <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                    onSuccess();
                    onClose();
                }}
            >
                <Text style={styles.primaryBtnText}>Back to Trips</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <Modal visible={isVisible} animationType="slide" transparent>
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Join Adventure</Text>
                        <TouchableOpacity onPress={onClose}>
                            <X size={24} color="#666" />
                        </TouchableOpacity>
                    </View>

                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}

                    {loading && <Loader fullScreen message="Processing..." />}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    content: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        minHeight: '70%',
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#111827',
    },
    stepContent: {
        flex: 1,
    },
    summaryCard: {
        backgroundColor: '#f0fdf4',
        padding: 24,
        borderRadius: 24,
        alignItems: 'center',
        marginBottom: 32,
    },
    summaryLabel: {
        fontSize: 14,
        color: '#065f46',
        marginBottom: 4,
        textTransform: 'uppercase',
        fontWeight: '600',
    },
    summaryValue: {
        fontSize: 36,
        fontWeight: '900',
        color: '#047857',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    noteItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    noteText: {
        fontSize: 15,
        color: '#4b5563',
    },
    primaryBtn: {
        backgroundColor: '#047857',
        padding: 18,
        borderRadius: 20,
        alignItems: 'center',
        marginTop: 20,
    },
    primaryBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    paymentTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 8,
    },
    paymentSub: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 24,
    },
    qrContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    upiBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        marginTop: 16,
    },
    upiIdText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    uploadSection: {
        marginBottom: 20,
    },
    uploadTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    uploadBox: {
        width: '100%',
        height: 180,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    uploadPlaceholder: {
        alignItems: 'center',
    },
    uploadLabel: {
        fontSize: 14,
        color: '#9ca3af',
        marginTop: 8,
        fontWeight: '500',
    },
    disabledBtn: {
        backgroundColor: '#9ca3af',
    },
    successIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#ecfdf5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 12,
    },
    successMsg: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 20,
        marginBottom: 32,
    },
});

export default JoinTripModal;
