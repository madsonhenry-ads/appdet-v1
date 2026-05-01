const { createClient } = require('@supabase/supabase-js');

// Environment variables from .env.local
const AC_API_URL = 'https://draculatemer11258320.api-us1.com';
const AC_API_KEY = '371d6888c7c7926156a602ad9e2ff127799be33b081ae80845b599188975b7902a11591a';

const supabase = createClient(
  'https://qvrykyhrmdcsogpyrxeq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2cnlreWhybWRjc29ncHlyeGVxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3OTUxNywiZXhwIjoyMDgwODU1NTE3fQ.HjMB_OQUplBeBn17raKa_bJx7jpH-v-kfIwhyPl7Mic',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function apiRequest(method, endpoint, body = null) {
  const url = `${AC_API_URL}/api/3/${endpoint}`;
  const options = {
    method,
    headers: {
      'Api-Token': AC_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  return await response.json();
}

async function testMagicLink() {
  try {
    const testEmail = 'test-zapspy-' + Date.now() + '@example.com';

    console.log('🧪 Testing Magic Link Email Flow...\n');
    console.log('📧 Test Email: ' + testEmail + '\n');

    // 1. Get Magic Link field ID
    console.log('1️⃣ Getting Magic Link field ID...');
    const fieldsData = await apiRequest('GET', 'fields?limit=100');
    const magicLinkField = (fieldsData.fields || []).find(f => f.title === 'Magic Link');

    if (!magicLinkField) {
      console.log('   ❌ Magic Link field not found!');
      return;
    }

    console.log('   ✅ Field found (ID: ' + magicLinkField.id + ')\n');

    // 2. Generate test magic link
    console.log('2️⃣ Generating test magic link...');
    const testMagicLink = 'https://qvrykyhrmdcsogpyrxeq.supabase.co/auth/v1/verify?token=TEST-TOKEN-1234567890';

    console.log('   ✅ Test magic link generated');
    console.log('   ' + testMagicLink + '\n');

    // 3. Create/update contact with magic link
    console.log('3️⃣ Creating contact in ActiveCampaign...');
    const contactData = {
      email: testEmail,
      firstName: 'Test',
      lastName: 'User'
    };

    const contactRes = await apiRequest('POST', 'contact/sync', contactData);

    console.log('   Contact response:', JSON.stringify(contactRes, null, 2));

    const contactId = contactRes.contact?.id || contactRes.contact?.contactId;

    if (!contactId) {
      console.log('   ❌ Failed to sync contact');
      return;
    }

    console.log('   ✅ Contact created (ID: ' + contactId + ')\n');

    // 4. Update field value
    console.log('4️⃣ Setting Magic Link field value...');
    await apiRequest('PUT', `contacts/${contactId}`, {
      contact: {
        contactId: String(contactId),
        fieldValues: [
          { field: String(magicLinkField.id), value: testMagicLink }
        ]
      }
    });

    console.log('   ✅ Magic Link field updated\n');

    // 5. Add buyer tag
    console.log('5️⃣ Adding buyer tag...');
    const tagRes = await apiRequest('GET', 'tags?search=Whats Spy-buyer-en');
    const tagId = tagRes.tags?.[0]?.id;

    if (!tagId) {
      console.log('   ❌ Buyer tag not found!');
      return;
    }

    await apiRequest('POST', 'contactTags', {
      contactTag: { contact: String(contactId), tag: String(tagId) }
    });

    console.log('   ✅ Buyer tag added\n');

    // 6. Verify field value
    console.log('6️⃣ Verifying field value...');
    const verifyRes = await apiRequest('GET', `contacts/${contactId}?fields=${magicLinkField.id}`);

    const magicLinkValue = verifyRes.contact?.fieldValues?.find(fv => fv.field === String(magicLinkField.id))?.value;
    console.log('   Magic Link field value:', magicLinkValue || 'NOT FOUND');

    if (magicLinkValue === testMagicLink) {
      console.log('   ✅ Field value is correct!\n');
    } else {
      console.log('   ❌ Field value is incorrect!\n');
    }

    console.log('✅ TEST COMPLETE!');
    console.log('\n📝 Next steps:');
    console.log('1. Check your email inbox for the test email');
    console.log('2. Verify the link contains: ' + testMagicLink);
    console.log('3. If still showing placeholder, check email template configuration');
    console.log('\n👀 In ActiveCampaign:');
    console.log('   1. Contacts > Search for ' + testEmail);
    console.log('   2. Check the "Magic Link" field value');
    console.log('   3. It should contain: ' + testMagicLink);

    // Clean up: Remove tag
    console.log('\n🧹 Cleaning up test data...');
    await apiRequest('DELETE', `contactTags/${contactId}_${tagId}`, null, AC_API_KEY);
    console.log('   Test contact and tag removed');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  }
}

testMagicLink();
