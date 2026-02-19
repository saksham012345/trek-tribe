/**
 * Comprehensive CRM Feature Testing Script
 * Tests all CRM features including database import, lead management, and analytics
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from './src/models/User';
import Lead from './src/models/Lead';
import CRMSubscription from './src/models/CRMSubscription';
import ImportedDatabase from './src/models/ImportedDatabase';
import { databaseImportService } from './src/services/databaseImportService';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Test credentials should be provided via environment variables
const TEST_ORGANIZER_EMAIL = process.env.TEST_ORGANIZER_EMAIL || 'test@example.com';
const TEST_ORGANIZER_PASSWORD = process.env.TEST_ORGANIZER_PASSWORD || 'TestPassword123!';

interface TestResults {
  passed: number;
  failed: number;
  tests: {
    name: string;
    status: 'PASS' | 'FAIL';
    message?: string;
    duration?: number;
  }[];
}

const results: TestResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name: string, status: 'PASS' | 'FAIL', message?: string, duration?: number) {
  results.tests.push({ name, status, message, duration });
  if (status === 'PASS') {
    results.passed++;
    console.log(`✅ ${name}${duration ? ` (${duration}ms)` : ''}`);
  } else {
    results.failed++;
    console.log(`❌ ${name}: ${message}`);
  }
}

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/trek-tribe-test';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB\n');
}

async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...');
  await User.deleteOne({ email: TEST_ORGANIZER_EMAIL });
  await Lead.deleteMany({ email: /test.*@example\.com/ });
  await ImportedDatabase.deleteMany({ fileName: /test.*\.csv/ });
  console.log('✅ Cleanup complete\n');
}

async function createTestOrganizer() {
  console.log('👤 Creating test organizer with CRM access...');
  
  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash(TEST_ORGANIZER_PASSWORD, 12);
  
  const user = await User.create({
    email: TEST_ORGANIZER_EMAIL,
    passwordHash,
    name: 'CRM Test Organizer',
    phone: '+919999999999',
    role: 'organizer',
    emailVerified: true,
    phoneVerified: true
  });

  // Create CRM subscription
  await CRMSubscription.create({
    organizerId: user._id,
    planType: 'crm_bundle',
    status: 'active',
    crmBundle: {
      hasAccess: true,
      price: 2100,
      features: [
        'Lead Management',
        'Database Import',
        'Analytics Dashboard',
        'Support Ticketing',
        'Chat Support'
      ]
    },
    startDate: new Date(),
    endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    autoRenew: false
  });

  console.log(`✅ Test organizer created: ${TEST_ORGANIZER_EMAIL}\n`);
  return user;
}

// Test 1: CRM Access Verification
async function testCRMAccess(organizerId: string) {
  const startTime = Date.now();
  try {
    const subscription = await CRMSubscription.findOne({
      organizerId,
      status: 'active',
      'crmBundle.hasAccess': true
    });

    if (subscription) {
      logTest('CRM Access Verification', 'PASS', undefined, Date.now() - startTime);
      return true;
    } else {
      logTest('CRM Access Verification', 'FAIL', 'No active CRM subscription found');
      return false;
    }
  } catch (error: any) {
    logTest('CRM Access Verification', 'FAIL', error.message);
    return false;
  }
}

// Test 2: Lead Creation
async function testLeadCreation(organizerId: string) {
  const startTime = Date.now();
  try {
    const lead = await Lead.create({
      email: 'test.lead1@example.com',
      name: 'Test Lead 1',
      phone: '+919876543210',
      source: 'form',
      status: 'new',
      leadScore: 50,
      assignedTo: organizerId,
      metadata: {
        notes: 'Test lead created by automated test',
        tags: ['test', 'automated']
      }
    });

    if (lead && lead._id) {
      logTest('Lead Creation', 'PASS', undefined, Date.now() - startTime);
      return lead;
    } else {
      logTest('Lead Creation', 'FAIL', 'Lead not created');
      return null;
    }
  } catch (error: any) {
    logTest('Lead Creation', 'FAIL', error.message);
    return null;
  }
}

// Test 3: Lead Retrieval
async function testLeadRetrieval(organizerId: string) {
  const startTime = Date.now();
  try {
    const leads = await Lead.find({ assignedTo: organizerId });
    
    if (leads.length > 0) {
      logTest('Lead Retrieval', 'PASS', `Found ${leads.length} leads`, Date.now() - startTime);
      return true;
    } else {
      logTest('Lead Retrieval', 'FAIL', 'No leads found');
      return false;
    }
  } catch (error: any) {
    logTest('Lead Retrieval', 'FAIL', error.message);
    return false;
  }
}

// Test 4: Lead Update
async function testLeadUpdate(leadId: string) {
  const startTime = Date.now();
  try {
    const updated = await Lead.findByIdAndUpdate(
      leadId,
      {
        status: 'contacted',
        leadScore: 75,
        $push: {
          interactions: {
            type: 'email',
            description: 'Sent initial contact email',
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    if (updated && updated.status === 'contacted') {
      logTest('Lead Update', 'PASS', undefined, Date.now() - startTime);
      return true;
    } else {
      logTest('Lead Update', 'FAIL', 'Lead not updated');
      return false;
    }
  } catch (error: any) {
    logTest('Lead Update', 'FAIL', error.message);
    return false;
  }
}

// Test 5: Lead Status Progression
async function testLeadStatusProgression(leadId: string) {
  const startTime = Date.now();
  try {
    const statuses = ['new', 'contacted', 'interested', 'converted'];
    
    for (const status of statuses) {
      await Lead.findByIdAndUpdate(leadId, { status });
      const lead = await Lead.findById(leadId);
      
      if (lead?.status !== status) {
        logTest('Lead Status Progression', 'FAIL', `Failed to update to ${status}`);
        return false;
      }
    }

    logTest('Lead Status Progression', 'PASS', undefined, Date.now() - startTime);
    return true;
  } catch (error: any) {
    logTest('Lead Status Progression', 'FAIL', error.message);
    return false;
  }
}

// Test 6: Lead Interactions
async function testLeadInteractions(leadId: string) {
  const startTime = Date.now();
  try {
    const interactions = [
      { type: 'email', description: 'Sent welcome email' },
      { type: 'call', description: 'Initial phone call' },
      { type: 'chat', description: 'WhatsApp conversation' }
    ];

    for (const interaction of interactions) {
      await Lead.findByIdAndUpdate(leadId, {
        $push: {
          interactions: {
            ...interaction,
            timestamp: new Date()
          }
        }
      });
    }

    const lead = await Lead.findById(leadId);
    
    if (lead && lead.interactions.length >= interactions.length) {
      logTest('Lead Interactions', 'PASS', `Added ${interactions.length} interactions`, Date.now() - startTime);
      return true;
    } else {
      logTest('Lead Interactions', 'FAIL', 'Interactions not added');
      return false;
    }
  } catch (error: any) {
    logTest('Lead Interactions', 'FAIL', error.message);
    return false;
  }
}

// Test 7: Database Import - CSV Parsing
async function testCSVParsing() {
  const startTime = Date.now();
  try {
    // Create test CSV data
    const csvData = `email,name,phone,status,source,notes
test.import1@example.com,Import Test 1,+919876543211,new,form,Test import lead 1
test.import2@example.com,Import Test 2,+919876543212,contacted,inquiry,Test import lead 2
test.import3@example.com,Import Test 3,+919876543213,interested,chat,Test import lead 3`;

    const buffer = Buffer.from(csvData);
    const file: any = {
      buffer,
      originalname: 'test-import.csv',
      mimetype: 'text/csv',
      size: buffer.length
    };

    const sampleData = await databaseImportService.getSampleData(file, 3);
    
    if (sampleData.length === 3) {
      logTest('CSV Parsing', 'PASS', `Parsed ${sampleData.length} records`, Date.now() - startTime);
      return { success: true, file, sampleData };
    } else {
      logTest('CSV Parsing', 'FAIL', 'Incorrect number of records parsed');
      return { success: false };
    }
  } catch (error: any) {
    logTest('CSV Parsing', 'FAIL', error.message);
    return { success: false };
  }
}

// Test 8: Field Mapping Auto-Detection
async function testFieldMappingAutoDetection(sampleData: any[]) {
  const startTime = Date.now();
  try {
    if (!sampleData || sampleData.length === 0) {
      logTest('Field Mapping Auto-Detection', 'FAIL', 'No sample data provided');
      return false;
    }

    const mapping = databaseImportService.autoDetectFieldMapping(sampleData[0]);
    
    const requiredFields = ['email', 'name', 'phone'];
    const mappedFields = mapping.map(m => m.targetField);
    const hasRequiredFields = requiredFields.every(field => 
      mappedFields.some(mapped => mapped.includes(field))
    );

    if (hasRequiredFields) {
      logTest('Field Mapping Auto-Detection', 'PASS', `Detected ${mapping.length} field mappings`, Date.now() - startTime);
      return mapping;
    } else {
      logTest('Field Mapping Auto-Detection', 'FAIL', 'Required fields not detected');
      return false;
    }
  } catch (error: any) {
    logTest('Field Mapping Auto-Detection', 'FAIL', error.message);
    return false;
  }
}

// Test 9: Database Import Execution
async function testDatabaseImport(organizerId: string, file: any, fieldMapping: any) {
  const startTime = Date.now();
  try {
    const result = await databaseImportService.importDatabase(
      file,
      organizerId,
      fieldMapping,
      {
        skipDuplicates: true,
        updateExisting: false,
        validateData: true,
        autoAssignToOrganizer: true,
        defaultLeadSource: 'form',
        defaultLeadStatus: 'new',
        defaultTags: ['imported', 'test']
      }
    );

    if (result.success && result.stats.successfulImports > 0) {
      logTest('Database Import Execution', 'PASS', 
        `Imported ${result.stats.successfulImports}/${result.stats.totalRecords} records`, 
        Date.now() - startTime);
      return result;
    } else {
      logTest('Database Import Execution', 'FAIL', 'Import failed or no records imported');
      return null;
    }
  } catch (error: any) {
    logTest('Database Import Execution', 'FAIL', error.message);
    return null;
  }
}

// Test 10: Import History Retrieval
async function testImportHistory(organizerId: string) {
  const startTime = Date.now();
  try {
    const history = await databaseImportService.getImportHistory(organizerId, 10);
    
    if (history.length > 0) {
      logTest('Import History Retrieval', 'PASS', `Found ${history.length} import records`, Date.now() - startTime);
      return history;
    } else {
      logTest('Import History Retrieval', 'FAIL', 'No import history found');
      return null;
    }
  } catch (error: any) {
    logTest('Import History Retrieval', 'FAIL', error.message);
    return null;
  }
}

// Test 11: Duplicate Detection
async function testDuplicateDetection(organizerId: string) {
  const startTime = Date.now();
  try {
    // Create a lead
    await Lead.create({
      email: 'duplicate.test@example.com',
      name: 'Duplicate Test',
      phone: '+919876543220',
      source: 'form',
      status: 'new',
      assignedTo: organizerId
    });

    // Try to import the same email
    const csvData = `email,name,phone
duplicate.test@example.com,Duplicate Test 2,+919876543221`;

    const buffer = Buffer.from(csvData);
    const file: any = {
      buffer,
      originalname: 'test-duplicate.csv',
      mimetype: 'text/csv',
      size: buffer.length
    };

    const result = await databaseImportService.importDatabase(
      file,
      organizerId,
      undefined,
      { skipDuplicates: true }
    );

    if (result.stats.duplicatesSkipped > 0) {
      logTest('Duplicate Detection', 'PASS', `Skipped ${result.stats.duplicatesSkipped} duplicates`, Date.now() - startTime);
      return true;
    } else {
      logTest('Duplicate Detection', 'FAIL', 'Duplicates not detected');
      return false;
    }
  } catch (error: any) {
    logTest('Duplicate Detection', 'FAIL', error.message);
    return false;
  }
}

// Test 12: Lead Search and Filtering
async function testLeadSearchAndFiltering(organizerId: string) {
  const startTime = Date.now();
  try {
    // Test status filtering
    const newLeads = await Lead.find({ assignedTo: organizerId, status: 'new' });
    const contactedLeads = await Lead.find({ assignedTo: organizerId, status: 'contacted' });
    
    // Test source filtering
    const formLeads = await Lead.find({ assignedTo: organizerId, source: 'form' });
    
    // Test email search
    const emailSearch = await Lead.find({ 
      assignedTo: organizerId, 
      email: /test.*@example\.com/ 
    });

    if (newLeads.length >= 0 && contactedLeads.length >= 0 && formLeads.length > 0 && emailSearch.length > 0) {
      logTest('Lead Search and Filtering', 'PASS', 
        `Found leads: ${newLeads.length} new, ${contactedLeads.length} contacted, ${formLeads.length} from form`, 
        Date.now() - startTime);
      return true;
    } else {
      logTest('Lead Search and Filtering', 'FAIL', 'Search/filtering failed');
      return false;
    }
  } catch (error: any) {
    logTest('Lead Search and Filtering', 'FAIL', error.message);
    return false;
  }
}

// Test 13: CRM Analytics
async function testCRMAnalytics(organizerId: string) {
  const startTime = Date.now();
  try {
    const leads = await Lead.find({ assignedTo: organizerId });
    
    const stats = {
      totalLeads: leads.length,
      newLeads: leads.filter(l => l.status === 'new').length,
      contactedLeads: leads.filter(l => l.status === 'contacted').length,
      interestedLeads: leads.filter(l => l.status === 'interested').length,
      convertedLeads: leads.filter(l => l.status === 'converted').length,
      conversionRate: leads.length > 0 
        ? ((leads.filter(l => l.status === 'converted').length / leads.length) * 100).toFixed(2)
        : '0.00'
    };

    if (stats.totalLeads > 0) {
      logTest('CRM Analytics', 'PASS', 
        `Total: ${stats.totalLeads}, Conversion Rate: ${stats.conversionRate}%`, 
        Date.now() - startTime);
      return stats;
    } else {
      logTest('CRM Analytics', 'FAIL', 'No analytics data');
      return null;
    }
  } catch (error: any) {
    logTest('CRM Analytics', 'FAIL', error.message);
    return null;
  }
}

// Test 14: Lead Score Calculation
async function testLeadScoreCalculation(leadId: string) {
  const startTime = Date.now();
  try {
    // Update lead score based on interactions
    const lead = await Lead.findById(leadId);
    if (!lead) {
      logTest('Lead Score Calculation', 'FAIL', 'Lead not found');
      return false;
    }

    let score = 0;
    score += lead.interactions.length * 10; // 10 points per interaction
    score += lead.status === 'interested' ? 30 : 0;
    score += lead.status === 'contacted' ? 20 : 0;
    score += lead.phone ? 15 : 0;
    score = Math.min(score, 100); // Cap at 100

    await Lead.findByIdAndUpdate(leadId, { leadScore: score });
    const updated = await Lead.findById(leadId);

    if (updated && updated.leadScore === score) {
      logTest('Lead Score Calculation', 'PASS', `Score: ${score}`, Date.now() - startTime);
      return true;
    } else {
      logTest('Lead Score Calculation', 'FAIL', 'Score not updated');
      return false;
    }
  } catch (error: any) {
    logTest('Lead Score Calculation', 'FAIL', error.message);
    return false;
  }
}

// Test 15: Import Rollback
async function testImportRollback(importId: string, organizerId: string) {
  const startTime = Date.now();
  try {
    const beforeCount = await Lead.countDocuments({ assignedTo: organizerId });
    
    const success = await databaseImportService.rollbackImport(importId, organizerId);
    
    const afterCount = await Lead.countDocuments({ assignedTo: organizerId });

    if (success && afterCount < beforeCount) {
      logTest('Import Rollback', 'PASS', `Deleted ${beforeCount - afterCount} leads`, Date.now() - startTime);
      return true;
    } else {
      logTest('Import Rollback', 'FAIL', 'Rollback failed');
      return false;
    }
  } catch (error: any) {
    logTest('Import Rollback', 'FAIL', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting CRM Feature Tests\n');
  console.log('='.repeat(60));
  console.log('\n');

  try {
    await connectDB();
    await cleanupTestData();
    
    const organizer = await createTestOrganizer();
    const organizerId = organizer._id.toString();

    console.log('📋 Running Tests...\n');
    console.log('='.repeat(60));
    console.log('\n');

    // Run tests
    await testCRMAccess(organizerId);
    
    const lead = await testLeadCreation(organizerId);
    if (lead) {
      await testLeadRetrieval(organizerId);
      await testLeadUpdate(lead._id.toString());
      await testLeadStatusProgression(lead._id.toString());
      await testLeadInteractions(lead._id.toString());
      await testLeadScoreCalculation(lead._id.toString());
    }

    const csvTest = await testCSVParsing();
    if (csvTest.success) {
      const fieldMapping = await testFieldMappingAutoDetection(csvTest.sampleData);
      if (fieldMapping) {
        const importResult = await testDatabaseImport(organizerId, csvTest.file, fieldMapping);
        if (importResult && importResult.importId) {
          await testImportHistory(organizerId);
          // Note: Commenting out rollback test to preserve data for inspection
          // await testImportRollback(importResult.importId, organizerId);
        }
      }
    }

    await testDuplicateDetection(organizerId);
    await testLeadSearchAndFiltering(organizerId);
    await testCRMAnalytics(organizerId);

    // Print results
    console.log('\n');
    console.log('='.repeat(60));
    console.log('📊 Test Results Summary');
    console.log('='.repeat(60));
    console.log('\n');
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(2)}%`);
    console.log('\n');

    if (results.failed > 0) {
      console.log('Failed Tests:');
      results.tests
        .filter(t => t.status === 'FAIL')
        .forEach(t => console.log(`  ❌ ${t.name}: ${t.message}`));
      console.log('\n');
    }

    console.log('='.repeat(60));
    console.log('\n');
    console.log('🎉 CRM Feature Testing Complete!');
    console.log('\n');
    console.log('Test Organizer Credentials:');
    console.log(`  Email: ${TEST_ORGANIZER_EMAIL}`);
    console.log(`  Password: ${TEST_ORGANIZER_PASSWORD}`);
    console.log('\n');
    console.log('You can now:');
    console.log('  1. Login with these credentials');
    console.log('  2. Access CRM dashboard');
    console.log('  3. View imported leads');
    console.log('  4. Test database import feature');
    console.log('\n');

  } catch (error: any) {
    console.error('❌ Test execution failed:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

runAllTests();
