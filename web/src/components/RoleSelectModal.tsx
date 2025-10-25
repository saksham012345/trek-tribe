import React from 'react';

interface RoleSelectModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (
    role: 'traveler' | 'organizer',
    organizerData?: {
      experience?: string;
      yearsOfExperience?: number;
      specialties?: string[];
      languages?: string[];
      bio?: string;
    }
  ) => void;
}

const RoleSelectModal: React.FC<RoleSelectModalProps> = ({ open, onClose, onSelect }) => {
  const [selected, setSelected] = React.useState<'traveler' | 'organizer' | null>(null);
  const [experience, setExperience] = React.useState('');
  const [years, setYears] = React.useState<number | ''>('');
  const [specialties, setSpecialties] = React.useState('');
  const [languages, setLanguages] = React.useState('');
  const [bio, setBio] = React.useState('');

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[92vw] max-w-xl">
        <div className="bg-gradient-to-br from-forest-600 to-nature-600 text-white rounded-t-2xl px-6 py-4 shadow-lg flex items-center gap-3">
          <span className="text-2xl">🌲</span>
          <div>
            <h3 className="text-xl font-extrabold">Join Trek Tribe</h3>
            <p className="text-white/80 text-xs">Choose how you want to get started</p>
          </div>
        </div>
        <div className="relative bg-white rounded-b-2xl shadow-2xl p-6 sm:p-8 border border-forest-200 border-t-0">
          {/* Role Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <button
              onClick={() => setSelected('traveler')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                selected === 'traveler'
                  ? 'border-nature-500 bg-nature-50'
                  : 'border-forest-200 hover:border-nature-400 hover:bg-nature-50/50'
              }`}
            >
              <div className="text-2xl mb-1">🎒</div>
              <div className="font-semibold text-forest-800">Adventurer</div>
              <div className="text-xs text-forest-600">Discover and join treks</div>
            </button>

            <button
              onClick={() => setSelected('organizer')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                selected === 'organizer'
                  ? 'border-forest-500 bg-forest-50'
                  : 'border-forest-200 hover:border-forest-400 hover:bg-forest-50/50'
              }`}
            >
              <div className="text-2xl mb-1">🗺️</div>
              <div className="font-semibold text-forest-800">Organizer</div>
              <div className="text-xs text-forest-600">Create and lead adventures</div>
            </button>
          </div>

          {/* Organizer Basics */}
          {selected === 'organizer' && (
            <div className="space-y-3 mt-2">
              <div className="text-sm font-semibold text-forest-800">Organizer basics</div>
              <textarea
                placeholder="Brief experience (e.g., Led 20+ treks in Himalayas)"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className="w-full px-3 py-2 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-400"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="number"
                  min={0}
                  placeholder="Years of experience"
                  value={years as number | ''}
                  onChange={(e) => setYears(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-400"
                />
                <input
                  placeholder="Languages (comma separated)"
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-400"
                />
              </div>
              <input
                placeholder="Specialties (comma separated)"
                value={specialties}
                onChange={(e) => setSpecialties(e.target.value)}
                className="w-full px-3 py-2 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-400"
              />
              <textarea
                placeholder="Short bio (optional)"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3 py-2 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-400"
              />
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border-2 border-forest-200 text-forest-700 hover:bg-forest-50">Cancel</button>
            <button
              disabled={!selected}
              onClick={() => {
                if (!selected) return;
                if (selected === 'organizer') {
                  onSelect('organizer', {
                    experience: experience || undefined,
                    yearsOfExperience: typeof years === 'number' ? years : undefined,
                    specialties: specialties ? specialties.split(',').map(s => s.trim()).filter(Boolean) : undefined,
                    languages: languages ? languages.split(',').map(s => s.trim()).filter(Boolean) : undefined,
                    bio: bio || undefined,
                  });
                } else {
                  onSelect('traveler');
                }
              }}
              className={`px-4 py-2 rounded-xl text-white font-semibold transition-all ${
                selected ? 'bg-gradient-to-r from-forest-600 to-nature-600 hover:from-forest-700 hover:to-nature-700' : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleSelectModal;