const AC_API_URL = 'https://draculatemer11258320.api-us1.com';
const AC_API_KEY = '371d6888c7c7926156a602ad9e2ff127799be33b081ae80845b599188975b7902a11591a';

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
  const data = await response.json();
  if (!response.ok && !data) {
    console.error(`API Error [${method} ${endpoint}]: ${response.status} - ${JSON.stringify(data)}`);
  }
  return data;
}

async function testMagicLink() {
  try {
    const testEmail = 'test-zapspy-' + Date.now() + '@example.com';

    console.log('🧪 Testing Magic Link Email Flow...\n');
    console.log('📧 Test Email: ' + testEmail + '\n');

    // Step 1: Get Magic Link field ID
    console.log('1️⃣ Getting Magic Link field ID...');
    const fieldsData = await apiRequest('GET', 'fields?limit=100');
    const magicLinkField = (fieldsData.fields || []).find(f => f.title === 'Magic Link');

    if (!magicLinkField) {
      console.log('   ❌ Magic Link field not found!');
      return;
    }

    console.log('   ✅ Field found (ID: ' + magicLinkField.id + ')\n');

    // Step 2: Check if contact already exists
    console.log('2️⃣ Checking for existing contact...');
    const searchRes = await apiRequest('GET', `contacts?search=${encodeURIComponent(testEmail)}&limit=1`);
    console.log('   Search response:', JSON.stringify(searchRes, null, 2));

    let contactId;

    if (searchRes.contacts && searchRes.contacts.length > 0) {
      contactId = searchRes.contacts[0].contactId;
      console.log('   ✅ Contact found (ID: ' + contactId + ')');
    } else {
      // Create new contact
      console.log('   Creating new contact...');
      const contactData = {
        email: testEmail,
        firstName: 'Test',
        lastName: 'User'
      };

      const createRes = await apiRequest('POST', 'contacts', { contact: contactData });

      if (!createRes) {
        console.log('   ❌ Failed to create contact (API error)');
        console.log('   Note: You might need to create the contact manually in ActiveCampaign');
        console.log('   URL: https://draculatemer11258320.activehosted.com/app/contacts/new');
        return;
      }

      contactId = createRes.contact?.id;
      if (!contactId) {
        console.log('   ❌ Failed to create contact');
        console.log('   Response:', JSON.stringify(createRes, null, 2));
        return;
      }

      console.log('   ✅ New contact created (ID: ' + contactId + ')\n');
    }

    // Step 3: Update Magic Link field
    console.log('3️⃣ Setting Magic Link field value...');
    const updateRes = await apiRequest('PUT', `contacts/${contactId}`, {
      contact: {
        contactId: String(contactId),
        fieldValues: [
          { field: String(magicLinkField.id), value: 'https://qvrykyhrmdcsogpyrxeq.supabase.co/auth/v1/verify?token=TEST-TOKEN-1234567890' }
        ]
      }
    });

    console.log('   Update response:', JSON.stringify(updateRes, null, 2));
    console.log('   ✅ Magic Link field updated\n');

    // Step 4: Get buyer tag
    console.log('4️⃣ Getting buyer tag...');
    const tagRes = await apiRequest('GET', 'tags?search=Whats Spy-buyer-en');
    const tag = tagRes.tags?.[0];

    if (!tag) {
      console.log('   ❌ Buyer tag not found!');
      return;
    }

    console.log('   ✅ Buyer tag found (ID: ' + tag.id + ') - ' + tag.tag + '\n');

    // Step 5: Add tag to contact
    console.log('5️⃣ Adding buyer tag to contact...');
    const tagContactRes = await apiRequest('POST', 'contactTags', {
      contactTag: {
        contact: String(contactId),
        tag: String(tag.id)
      }
    });

    console.log('   Tag contact response:', JSON.stringify(tagContactRes, null, 2));
    console.log('   ✅ Buyer tag added to contact\n');

    // Step 6: Verify field value
    console.log('6️⃣ Verifying field value...');
    const verifyRes = await apiRequest('GET', `contacts/${contactId}`);
    console.log('   Contact fields:', JSON.stringify(verifyRes, null, 2));

    // Try to find the Magic Link field value
    const fieldValues = verifyRes.contact?.fieldValues || [];
    const magicLinkFieldValue = fieldValues.find(fv => fv.field === String(magicLinkField.id));

    if (magicLinkFieldValue) {
      console.log('   ✅ Magic Link field value: ' + magicLinkFieldValue.value);

      if (magicLinkFieldValue.value.includes('TEST-TOKEN')) {
        console.log('   ✅ Field contains the test token - ready for email trigger!\n');
      }
    } else {
      console.log('   ❌ Magic Link field not found in contact');
      console.log('   Checking all field values:');
      console.log('   Field values:', JSON.stringify(fieldValues, null, 2));
    }

    console.log('\n✅ TEST COMPLETE!');
    console.log('\n📝 Next steps:');
    console.log('1. Check your email inbox for the test email');
    console.log('2. Verify the link contains: https://qvrykyhrmdcsogpyrxeq.supabase.co/auth/v1/verify?token=TEST-TOKEN-1234567890');
    console.log('3. If the link still shows %MAGIC_LINK%, check your email template configuration');
    console.log('\n👀 In ActiveCampaign:');
    console.log('   1. Contacts > Search for ' + testEmail);
    console.log('   2. Check the "Magic Link" field value (should be set now)');
    console.log('   3. Open Automations > "Whats Spy - Compra aprovada - EN"');
    console.log('   4. Verify the email template uses: ${Magic Link} (with space)');

    // Step 7: Clean up
    console.log('\n🧹 Cleaning up test data...');
    console.log('   Contact: ' + testEmail);
    console.log('   Tag: Whats Spy-buyer-en');
    console.log('\n   Remove them manually in ActiveCampaign if needed.');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('   Stack:', error.stack);
  }
}

testMagicLink();
