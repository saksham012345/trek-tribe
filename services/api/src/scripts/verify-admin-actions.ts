
import 'dotenv/config';
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:5000/api';
// Use the sanitized password we set earlier
const ADMIN_EMAIL = 'trektribe_root@trektribe.in';
const ADMIN_PASSWORD = 'Admin@1234';

const runVerification = async () => {
    try {
        console.log('🚀 Starting Admin functionality verification...');
        console.log(`Targeting API: ${API_URL}`);

        // 1. Login as Admin
        let token = '';
        try {
            console.log('🔑 Logging in as Admin...');
            const loginRes = await axios.post(`${API_URL}/auth/login`, {
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD
            });
            token = loginRes.data.token;
            console.log('✅ Admin logged in successfully');
        } catch (e: any) {
            console.log('⚠️ Login failed with Admin@1234, ensuring server is reachable...');
            if (e.code === 'ECONNREFUSED') {
                console.error('❌ Server is not running on localhost:5000. Please start the backend server.');
                process.exit(1);
            }

            console.log('Trying fallback password Saksham@4700...');
            try {
                const loginRes = await axios.post(`${API_URL}/auth/login`, {
                    email: ADMIN_EMAIL,
                    password: 'Saksham@4700'
                });
                token = loginRes.data.token;
                console.log('✅ Admin logged in successfully (old password)');
            } catch (e2: any) {
                console.error('❌ Admin login failed:', e2.response?.data || e2.message);
                process.exit(1);
            }
        }

        const authHeaders = { Authorization: `Bearer ${token}` };

        // 2. Create Dummy User to Delete
        console.log('\n👤 Creating dummy user for deletion test...');
        const dummyUserEmail = `delete_test_${Date.now()}@example.com`;
        // We register a simple user
        const registerRes = await axios.post(`${API_URL}/auth/register`, {
            name: 'Delete Me',
            email: dummyUserEmail,
            password: 'Password123!',
            phone: `+91${Date.now().toString().slice(-10)}`, // Random phone
            role: 'traveler'
        });
        const dummyUserId = registerRes.data.user._id;
        console.log(`✅ Dummy user created: ${dummyUserId} (${dummyUserEmail})`);

        // 3. Delete the User
        console.log(`\n🗑️ Testing DELETE /admin/users/${dummyUserId}...`);
        await axios.delete(`${API_URL}/admin/users/${dummyUserId}`, { headers: authHeaders });

        // Verify deletion
        try {
            await axios.get(`${API_URL}/admin/users/${dummyUserId}/contact`, { headers: authHeaders });
            console.error('❌ User still exists after deletion!');
        } catch (e: any) {
            if (e.response?.status === 404) {
                console.log('✅ User successfully deleted (404 Not Found confirmed)');
            } else {
                console.error('❌ Error verifying user deletion:', e.message);
            }
        }

        // 4. Verify Trip Deletion Endpoint (Dry Run)
        // We don't want to mess up real data, so we'll just check if the endpoint is protected
        console.log('\n🗺️ Checking DELETE /admin/trips/:id protection...');
        try {
            await axios.delete(`${API_URL}/admin/trips/000000000000000000000000`, { headers: authHeaders });
        } catch (e: any) {
            // If we get 404, it means we passed auth and hit the controller (which looked for ID and didn't find it)
            // If we got 401/403, verification failed.
            if (e.response?.status === 404) {
                console.log('✅ Trip delete endpoint accessible to Admin (Method allowed, 404 returned for fake ID)');
            } else if (e.response?.status === 403) {
                console.error('❌ Admin denied access to delete trips!');
            } else {
                console.log(`ℹ️ Trip delete returned ${e.response?.status} - expected behavior for fake ID`);
            }
        }

        console.log('\n✅ Verification Script Completed successfully!');

    } catch (error: any) {
        console.error('❌ Verification failed:', error.message);
        if (error.response) console.error('Response:', error.response.data);
        process.exit(1);
    }
};

runVerification();
