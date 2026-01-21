import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    Dimensions
} from 'react-native';
import { ChevronRight, ChevronLeft, Save, Plus, Trash2, Camera, MapPin, X, FileText } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import Loader from '../../components/ui/Loader';
import apiClient from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');

const STEPS = [
    'Essentials', 'Logistics', 'Taxonomy', 'Itinerary', 'Packages', 'Meeting Points', 'Media'
];

const CreateTripWizard: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // Subscription Guard
    const isPremium = user?.role === 'admin' || (user?.role === 'organizer' && user.organizerProfile?.autoPay?.autoPayEnabled);

    React.useEffect(() => {
        if (user && user.role === 'organizer' && !isPremium) {
            Alert.alert(
                'Subscription Required',
                'You need an active subscription (AutoPay enabled) to create trips.',
                [{ text: 'Go Back', onPress: () => navigation.goBack() }]
            );
        }
    }, [user, isPremium, navigation]);

    if (user?.role === 'organizer' && !isPremium) {
        return <Loader fullScreen message="Checking subscription..." />;
    }

    // Unified State for 7 Steps
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        destination: '',
        difficultyLevel: 'beginner',
        price: '',
        capacity: '',
        startDate: '',
        endDate: '',
        categories: [] as string[],
        requirements: [] as string[],
        itinerary: [{ title: '', activities: [''] }],
        packages: [{ name: 'Basic', price: '', description: '' }],
        meetingPoints: [{ name: '', address: '', time: '', contact: '' }],
        images: [] as string[],
        itineraryPdf: null as string | null,
    });

    const updateField = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleFinalSubmit();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) setCurrentStep(currentStep - 1);
    };

    const handleFinalSubmit = async () => {
        setLoading(true);
        try {
            await apiClient.post('/trips', formData);
            Alert.alert('Success', 'Your adventure has been created!', [
                { text: 'Awesome', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            console.error('Failed to create trip:', error);
            Alert.alert('Error', 'Failed to create trip. Please check your data.');
        } finally {
            setLoading(false);
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 0: // Essentials
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.label}>Trip Title</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Magical Manali Trek"
                            value={formData.title}
                            onChangeText={val => updateField('title', val)}
                        />
                        <Text style={styles.label}>Destination</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Manali, Himachal"
                            value={formData.destination}
                            onChangeText={val => updateField('destination', val)}
                        />
                        <Text style={styles.label}>Description</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Tell travelers about the journey..."
                            multiline
                            numberOfLines={4}
                            value={formData.description}
                            onChangeText={val => updateField('description', val)}
                        />
                        <Text style={styles.label}>Difficulty Level</Text>
                        <View style={styles.difficultyContainer}>
                            {['beginner', 'intermediate', 'advanced'].map(level => (
                                <TouchableOpacity
                                    key={level}
                                    style={[
                                        styles.difficultyBtn,
                                        formData.difficultyLevel === level && styles.activeDifficultyBtn
                                    ]}
                                    onPress={() => updateField('difficultyLevel', level)}
                                >
                                    <Text style={[
                                        styles.difficultyBtnText,
                                        formData.difficultyLevel === level && styles.activeDifficultyBtnText
                                    ]}>{level.charAt(0).toUpperCase() + level.slice(1)}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );
            case 1: // Logistics
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.label}>Price per Person (₹)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. 12000"
                            keyboardType="numeric"
                            value={formData.price}
                            onChangeText={val => updateField('price', val)}
                        />
                        <Text style={styles.label}>Group Capacity</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. 12"
                            keyboardType="numeric"
                            value={formData.capacity}
                            onChangeText={val => updateField('capacity', val)}
                        />
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Start Date</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="YYYY-MM-DD"
                                    value={formData.startDate}
                                    onChangeText={val => updateField('startDate', val)}
                                />
                            </View>
                            <View style={{ width: 16 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>End Date</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="YYYY-MM-DD"
                                    value={formData.endDate}
                                    onChangeText={val => updateField('endDate', val)}
                                />
                            </View>
                        </View>
                    </View>
                );
            case 2: // Taxonomy
                return (
                    <ScrollView style={styles.stepContainer}>
                        <Text style={styles.label}>Categories</Text>
                        <View style={styles.chipContainer}>
                            {['Adventure', 'Cultural', 'Wildlife', 'Spiritual', 'Photography', 'Culinary'].map(cat => {
                                const isSelected = formData.categories.includes(cat);
                                return (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[styles.chip, isSelected && styles.activeChip]}
                                        onPress={() => {
                                            const newCats = isSelected
                                                ? formData.categories.filter(c => c !== cat)
                                                : [...formData.categories, cat];
                                            updateField('categories', newCats);
                                        }}
                                    >
                                        <Text style={[styles.chipText, isSelected && styles.activeChipText]}>{cat}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <Text style={styles.label}>Requirements</Text>
                        <View style={styles.chipContainer}>
                            {['Physical Fitness', 'Swimming', 'Mountain Gear', 'Medical Certificate', 'ID Proof'].map(req => {
                                const isSelected = formData.requirements.includes(req);
                                return (
                                    <TouchableOpacity
                                        key={req}
                                        style={[styles.chip, isSelected && styles.activeChip]}
                                        onPress={() => {
                                            const newReqs = isSelected
                                                ? formData.requirements.filter(r => r !== req)
                                                : [...formData.requirements, req];
                                            updateField('requirements', newReqs);
                                        }}
                                    >
                                        <Text style={[styles.chipText, isSelected && styles.activeChipText]}>{req}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>
                );
            case 3: // Itinerary (Day-wise)
                return (
                    <ScrollView style={styles.stepContainer}>
                        <Text style={styles.stepTitle}>Day-wise Itinerary</Text>
                        {formData.itinerary.map((day, idx) => (
                            <View key={idx} style={styles.itemCard}>
                                <View style={styles.itemHeader}>
                                    <Text style={styles.itemLabel}>Day {idx + 1}</Text>
                                    <TouchableOpacity onPress={() => {
                                        const newIt = [...formData.itinerary];
                                        newIt.splice(idx, 1);
                                        updateField('itinerary', newIt);
                                    }}><Trash2 size={18} color="#dc2626" /></TouchableOpacity>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Day Title"
                                    value={day.title}
                                    onChangeText={val => {
                                        const newIt = [...formData.itinerary];
                                        newIt[idx].title = val;
                                        updateField('itinerary', newIt);
                                    }}
                                />
                            </View>
                        ))}
                        <TouchableOpacity
                            style={styles.addBtn}
                            onPress={() => updateField('itinerary', [...formData.itinerary, { title: '', activities: [''] }])}
                        >
                            <Plus size={20} color="#4f46e5" />
                            <Text style={styles.addBtnText}>Add Day</Text>
                        </TouchableOpacity>
                    </ScrollView>
                );
            case 4: // Packages
                return (
                    <ScrollView style={styles.stepContainer}>
                        {formData.packages.map((pkg, idx) => (
                            <View key={idx} style={styles.itemCard}>
                                <View style={styles.itemHeader}>
                                    <Text style={styles.itemLabel}>Package {idx + 1}</Text>
                                    <TouchableOpacity onPress={() => {
                                        const newPkgs = [...formData.packages];
                                        newPkgs.splice(idx, 1);
                                        updateField('packages', newPkgs);
                                    }}><Trash2 size={18} color="#dc2626" /></TouchableOpacity>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Package Name (e.g. Standard)"
                                    value={pkg.name}
                                    onChangeText={val => {
                                        const newPkgs = [...formData.packages];
                                        newPkgs[idx].name = val;
                                        updateField('packages', newPkgs);
                                    }}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Price per person (₹)"
                                    keyboardType="numeric"
                                    value={pkg.price}
                                    onChangeText={val => {
                                        const newPkgs = [...formData.packages];
                                        newPkgs[idx].price = val;
                                        updateField('packages', newPkgs);
                                    }}
                                />
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    placeholder="Description/Inclusions"
                                    multiline
                                    value={pkg.description}
                                    onChangeText={val => {
                                        const newPkgs = [...formData.packages];
                                        newPkgs[idx].description = val;
                                        updateField('packages', newPkgs);
                                    }}
                                />
                            </View>
                        ))}
                        <TouchableOpacity
                            style={styles.addBtn}
                            onPress={() => updateField('packages', [...formData.packages, { name: '', price: '', description: '' }])}
                        >
                            <Plus size={20} color="#4f46e5" />
                            <Text style={styles.addBtnText}>Add Package</Text>
                        </TouchableOpacity>
                    </ScrollView>
                );
            case 5: // Meeting Points
                return (
                    <ScrollView style={styles.stepContainer}>
                        {formData.meetingPoints.map((point, idx) => (
                            <View key={idx} style={styles.itemCard}>
                                <View style={styles.itemHeader}>
                                    <Text style={styles.itemLabel}>Meeting Point {idx + 1}</Text>
                                    <TouchableOpacity onPress={() => {
                                        const newPoints = [...formData.meetingPoints];
                                        newPoints.splice(idx, 1);
                                        updateField('meetingPoints', newPoints);
                                    }}><Trash2 size={18} color="#dc2626" /></TouchableOpacity>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Location Name (e.g. New Delhi Station)"
                                    value={point.name}
                                    onChangeText={val => {
                                        const newPoints = [...formData.meetingPoints];
                                        newPoints[idx].name = val;
                                        updateField('meetingPoints', newPoints);
                                    }}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Full Address"
                                    multiline
                                    value={point.address}
                                    onChangeText={val => {
                                        const newPoints = [...formData.meetingPoints];
                                        newPoints[idx].address = val;
                                        updateField('meetingPoints', newPoints);
                                    }}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Reporting Time (e.g. 08:30 AM)"
                                    value={point.time}
                                    onChangeText={val => {
                                        const newPoints = [...formData.meetingPoints];
                                        newPoints[idx].time = val;
                                        updateField('meetingPoints', newPoints);
                                    }}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Contact Person (Optional)"
                                    value={point.contact}
                                    onChangeText={val => {
                                        const newPoints = [...formData.meetingPoints];
                                        newPoints[idx].contact = val;
                                        updateField('meetingPoints', newPoints);
                                    }}
                                />
                            </View>
                        ))}
                        <TouchableOpacity
                            style={styles.addBtn}
                            onPress={() => updateField('meetingPoints', [...formData.meetingPoints, { name: '', address: '', time: '', contact: '' }])}
                        >
                            <Plus size={20} color="#4f46e5" />
                            <Text style={styles.addBtnText}>Add Point</Text>
                        </TouchableOpacity>
                    </ScrollView>
                );
            case 6: // Media
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.label}>Trip Gallery</Text>
                        <TouchableOpacity style={styles.uploadBox} onPress={() => { }}>
                            <Camera size={40} color="#9ca3af" />
                            <Text style={styles.uploadText}>Select Images</Text>
                        </TouchableOpacity>
                        <Text style={styles.helperText}>Select high-quality images of the destination</Text>

                        <Text style={[styles.label, { marginTop: 32 }]}>Itinerary PDF (Optional)</Text>
                        <TouchableOpacity style={styles.pdfBtn} onPress={() => { }}>
                            <FileText size={20} color="#4f46e5" />
                            <Text style={styles.pdfBtnText}>Upload PDF Document</Text>
                        </TouchableOpacity>
                        <Text style={styles.helperText}>Used for detailed offline itinerary</Text>
                    </View>
                );
            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            {/* Progress Stepper */}
            <View style={styles.stepper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepperScroll}>
                    {STEPS.map((step, idx) => (
                        <View key={idx} style={styles.stepItem}>
                            <View style={[
                                styles.stepCircle,
                                currentStep >= idx ? styles.activeCircle : styles.inactiveCircle
                            ]}>
                                <Text style={[styles.stepNumber, currentStep >= idx && styles.activeNumber]}>{idx + 1}</Text>
                            </View>
                            {idx < STEPS.length - 1 && <View style={styles.stepLine} />}
                        </View>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.content}>
                <Text style={styles.currentStepTitle}>{STEPS[currentStep]}</Text>
                {renderStepContent()}
            </View>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.navBtn, currentStep === 0 && styles.disabledBtn]}
                    onPress={handleBack}
                    disabled={currentStep === 0}
                >
                    <ChevronLeft size={20} color={currentStep === 0 ? "#9ca3af" : "#4f46e5"} />
                    <Text style={[styles.navBtnText, currentStep === 0 && styles.disabledText]}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
                    <Text style={styles.nextBtnText}>{currentStep === STEPS.length - 1 ? 'Finish' : 'Next Step'}</Text>
                    {currentStep < STEPS.length - 1 && <ChevronRight size={20} color="#fff" />}
                    {currentStep === STEPS.length - 1 && <Save size={20} color="#fff" />}
                </TouchableOpacity>
            </View>
            {loading && <Loader fullScreen message="Building your adventure..." />}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    stepper: {
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    stepperScroll: {
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stepCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
    },
    activeCircle: {
        backgroundColor: '#4f46e5',
        borderColor: '#4f46e5',
    },
    inactiveCircle: {
        backgroundColor: '#fff',
        borderColor: '#e2e8f0',
    },
    stepNumber: {
        fontSize: 14,
        fontWeight: '700',
        color: '#94a3b8',
    },
    activeNumber: {
        color: '#fff',
    },
    stepLine: {
        width: 40,
        height: 2,
        backgroundColor: '#e2e8f0',
        marginHorizontal: 8,
    },
    content: {
        flex: 1,
        padding: 24,
    },
    currentStepTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 24,
    },
    stepContainer: {
        flex: 1,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#1e293b',
        marginBottom: 20,
    },
    textArea: {
        height: 120,
        textAlignVertical: 'top',
    },
    footer: {
        flexDirection: 'row',
        padding: 24,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    navBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    navBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4f46e5',
    },
    disabledBtn: {
        opacity: 0.5,
    },
    nextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#4f46e5',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 14,
        gap: 8,
    },
    nextBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    placeholderText: {
        fontSize: 16,
        color: '#94a3b8',
        textAlign: 'center',
        marginTop: 100,
        fontStyle: 'italic',
    },
    stepTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 16,
    },
    disabledText: {
        color: '#9ca3af',
    },
    itemCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    itemLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#4f46e5',
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        gap: 8,
        marginTop: 8,
    },
    addBtnText: {
        color: '#4f46e5',
        fontWeight: '700',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
    },
    difficultyContainer: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },
    difficultyBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    activeDifficultyBtn: {
        backgroundColor: '#4f46e5',
        borderColor: '#4f46e5',
    },
    difficultyBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    activeDifficultyBtnText: {
        color: '#fff',
    },
    row: {
        flexDirection: 'row',
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 24,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    activeChip: {
        backgroundColor: '#4f46e5',
        borderColor: '#4f46e5',
    },
    chipText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '600',
    },
    activeChipText: {
        color: '#fff',
    },
    helperText: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 8,
    },
    uploadBox: {
        height: 160,
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
    },
    uploadText: {
        marginTop: 8,
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    pdfBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#f5f3ff',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ddd6fe',
        marginTop: 12,
    },
    pdfBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4f46e5',
    },
});

export default CreateTripWizard;
