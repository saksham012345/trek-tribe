import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { Review } from '../models/Review';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trekktribe';

// Demo Users
const demoUsers = [
  {
    name: 'Sarah Adventure',
    email: 'sarah@trekkertribe.com',
    password: 'password123',
    role: 'organizer' as const
  },
  {
    name: 'John Explorer',
    email: 'john@trekkertribe.com', 
    password: 'password123',
    role: 'traveler' as const
  },
  {
    name: 'Maria Mountain',
    email: 'maria@trekkertribe.com',
    password: 'password123',
    role: 'traveler' as const
  },
  {
    name: 'Admin User',
    email: 'admin@trekkertribe.com',
    password: 'admin123',
    role: 'admin' as const
  }
];

// Demo Trips
const demoTrips = [
  {
    title: 'Himalayan Base Camp Trek',
    description: 'Experience the breathtaking beauty of the Himalayas on this incredible 12-day trek to Everest Base Camp. Walk in the footsteps of legendary mountaineers as you journey through stunning Sherpa villages, ancient monasteries, and some of the most spectacular mountain scenery on Earth. This adventure of a lifetime includes acclimatization days, expert guides, and all necessary permits.',
    destination: 'Everest Base Camp, Nepal',
    price: 125000,
    capacity: 12,
    categories: ['Adventure', 'Mountain', 'Cultural'],
    startDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
    endDate: new Date(Date.now() + 57 * 24 * 60 * 60 * 1000), // 57 days from now
    difficultyLevel: 'advanced',
    includedItems: ['Accommodation', 'Meals', 'Guide', 'Permits', 'Equipment'],
    requirements: ['Good Physical Fitness', 'Previous Experience', 'Medical Certificate'],
    itinerary: `Day 1: Fly to Lukla, trek to Phakding
Day 2-3: Trek to Namche Bazaar, acclimatization
Day 4-5: Trek to Tengboche and Dingboche
Day 6: Acclimatization day in Dingboche
Day 7-8: Trek to Lobuche via Thukla
Day 9: Trek to EBC and back to Gorak Shep
Day 10-12: Return trek to Lukla`,
    schedule: [
      {
        day: 1,
        title: 'Arrival in Lukla',
        activities: ['Flight to Lukla (2,840m)', 'Meet the team and porters', 'Trek to Phakding (2,610m)', 'Overnight in tea house']
      },
      {
        day: 2,
        title: 'Trek to Namche Bazaar',
        activities: ['Cross suspension bridges', 'Enter Sagarmatha National Park', 'First views of Everest', 'Arrive in Namche (3,440m)']
      },
      {
        day: 9,
        title: 'Everest Base Camp Day',
        activities: ['Early morning trek to EBC', 'Celebrate at Base Camp (5,364m)', 'Photo opportunities', 'Return to Gorak Shep']
      }
    ]
  },
  {
    title: 'Kerala Backwater Adventure',
    description: 'Discover the serene beauty of Kerala\'s famous backwaters on this relaxing 6-day journey through coconut groves, spice plantations, and traditional villages. Cruise on traditional houseboats, experience local culture, enjoy authentic Kerala cuisine, and witness stunning sunsets over the backwaters. Perfect for those seeking tranquility and cultural immersion.',
    destination: 'Alleppey & Kumarakom, Kerala',
    price: 45000,
    capacity: 8,
    categories: ['Cultural', 'Nature', 'Relaxing'],
    startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 36 * 24 * 60 * 60 * 1000),
    difficultyLevel: 'beginner',
    includedItems: ['Accommodation', 'Meals', 'Transportation', 'Guide', 'Activities'],
    requirements: ['No special requirements'],
    itinerary: `Day 1: Arrival in Kochi, transfer to Alleppey
Day 2-3: Houseboat cruise through backwaters  
Day 4: Village visit and spice plantation tour
Day 5: Kumarakom bird sanctuary and fishing
Day 6: Departure from Kochi`,
    schedule: [
      {
        day: 1,
        title: 'Welcome to Kerala',
        activities: ['Arrival at Kochi Airport', 'Transfer to Alleppey', 'Welcome dinner with local cuisine', 'Overnight in heritage hotel']
      },
      {
        day: 2,
        title: 'Backwater Cruise Begins',
        activities: ['Board traditional houseboat', 'Cruise through narrow canals', 'Traditional Kerala lunch on boat', 'Sunset viewing from deck']
      }
    ]
  },
  {
    title: 'Rajasthan Desert Safari',
    description: 'Embark on an unforgettable desert adventure in the golden sands of Rajasthan. Experience camel safaris, camp under the stars, explore magnificent forts and palaces, and immerse yourself in the vibrant culture of the Thar Desert. This 8-day journey includes visits to Jaisalmer, Jodhpur, and remote desert villages where time seems to stand still.',
    destination: 'Jaisalmer & Thar Desert, Rajasthan',
    price: 65000,
    capacity: 10,
    categories: ['Adventure', 'Cultural', 'Desert'],
    startDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 68 * 24 * 60 * 60 * 1000),
    difficultyLevel: 'intermediate',
    includedItems: ['Accommodation', 'Meals', 'Transportation', 'Guide', 'Camel Safari'],
    requirements: ['Good Physical Fitness', 'Heat tolerance'],
    itinerary: `Day 1: Arrival in Jaisalmer
Day 2-3: Explore Jaisalmer Fort and city
Day 4-5: Camel safari and desert camping
Day 6: Visit to remote villages
Day 7: Jodhpur city tour
Day 8: Departure`,
    schedule: [
      {
        day: 1,
        title: 'Golden City Welcome',
        activities: ['Arrival in Jaisalmer', 'Check into heritage hotel', 'Evening walk in old city', 'Welcome dinner with folk performance']
      },
      {
        day: 4,
        title: 'Desert Safari Begins',
        activities: ['Meet your camel', 'Begin desert trek', 'Lunch in desert shade', 'Arrive at camp for sunset']
      }
    ]
  },
  {
    title: 'Goa Beach & Culture Tour',
    description: 'Experience the perfect blend of relaxation and adventure on this 5-day Goa getaway. Enjoy pristine beaches, water sports, Portuguese colonial architecture, vibrant nightlife, and delicious seafood. Visit spice plantations, historic churches, and local markets while soaking up the laid-back Goan lifestyle.',
    destination: 'North & South Goa',
    price: 35000,
    capacity: 15,
    categories: ['Beach', 'Cultural', 'Relaxing'],
    startDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    difficultyLevel: 'beginner',
    includedItems: ['Accommodation', 'Transportation', 'Some meals', 'Activities'],
    requirements: ['Swimming ability for water sports'],
    itinerary: `Day 1: Arrival, Calangute Beach
Day 2: Water sports and beach activities  
Day 3: Old Goa churches and spice plantation
Day 4: South Goa beaches and relaxation
Day 5: Shopping and departure`
  },
  {
    title: 'Ladakh High Altitude Adventure',
    description: 'Journey to the roof of the world on this incredible 10-day adventure through Ladakh. Experience dramatic landscapes, ancient monasteries, crystal-clear lakes, and the unique culture of the Himalayas. This high-altitude adventure includes visits to Leh, Nubra Valley, Pangong Lake, and remote Buddhist villages.',
    destination: 'Leh-Ladakh, Jammu & Kashmir',
    price: 95000,
    capacity: 8,
    categories: ['Adventure', 'Mountain', 'Cultural'],
    startDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
    difficultyLevel: 'advanced',
    includedItems: ['Accommodation', 'Meals', 'Transportation', 'Guide', 'Permits'],
    requirements: ['Good Physical Fitness', 'Medical Certificate', 'High altitude tolerance'],
    itinerary: `Day 1-2: Arrive Leh, acclimatization
Day 3-4: Nubra Valley via Khardung La
Day 5-6: Pangong Tso lake
Day 7-8: Tso Moriri and return
Day 9-10: Leh exploration and departure`
  }
];

// Demo Reviews
const demoReviews = [
  {
    rating: 5,
    title: 'Absolutely Amazing Trek!',
    comment: 'Absolutely incredible experience! The views were breathtaking and our guide was fantastic. The trek was challenging but so rewarding. Made lifelong friends and memories. Highly recommend this adventure to anyone seeking a life-changing experience!',
    reviewType: 'trip' as const,
    tags: ['safety', 'guide-quality', 'activities'],
    isVerified: true
  },
  {
    rating: 4,
    title: 'Great Trip Overall',
    comment: 'Great trip overall! The organization was good and the destinations were beautiful. Food was delicious and accommodation was comfortable. Only minor issue was some delays, but nothing that ruined the experience.',
    reviewType: 'trip' as const,
    tags: ['organization', 'food', 'accommodation'],
    isVerified: true
  },
  {
    rating: 5,
    title: 'Perfect Relaxing Getaway',
    comment: 'Perfect for a relaxing getaway! The backwaters were so peaceful and the houseboat experience was unique. Local culture immersion was wonderful. Exactly what I needed after a stressful year.',
    reviewType: 'trip' as const,
    tags: ['accommodation', 'value-for-money', 'location'],
    isVerified: true
  }
];

async function seedDatabase() {
  try {
    console.log('⚠️  This script has been disabled to prevent fake data seeding.');
    console.log('📝 Only preset admin/agent users should be created via setup-preset-users.ts');
    console.log('🚫 All fake data (demo users, trips, reviews) has been removed.');
    console.log('\n✅ To set up admin/agent users, run: npm run setup-preset-users');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the seeder (disabled)
if (require.main === module) {
  seedDatabase();
}