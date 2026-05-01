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
    console.error(`API Error [${method} ${endpoint}]: ${response.status}`);
  }
  return data;
}

async function triggerPurchaseComplete(email, name) {
  try {
    console.log('🛒 Simulating Purchase Complete...\n');

    // 1. Get or create contact
    console.log('1️⃣ Getting/creating contact...');
    const searchRes = await apiRequest('GET', `contacts?search=${encodeURIComponent(email)}&limit=1`);

    let contactId;

    if (searchRes.contacts && searchRes.contacts.length > 0) {
      contactId = searchRes.contacts[0].id || searchRes.contacts[0].contactId;
      console.log('   ✅ Contact found (ID: ' + contactId + ')');
    } else {
      // Create new contact
      const contactData = {
        email: email,
        firstName: name ? name.split(' ')[0] : 'Test',
        lastName: name ? name.split(' ').slice(1).join(' ') : 'User'
      };

      const createRes = await apiRequest('POST', 'contacts', { contact: contactData });
      contactId = createRes.contact?.id;

      if (!contactId) {
        console.log('   ❌ Failed to create contact');
        return;
      }

      console.log('   ✅ New contact created (ID: ' + contactId + ')');
    }

    // 2. Get buyer tag
    console.log('\n2️⃣ Getting buyer tag...');
    const tagRes = await apiRequest('GET', 'tags?search=Whats Spy-buyer-en');
    const tag = tagRes.tags?.[0];

    if (!tag) {
      console.log('   ❌ Buyer tag not found!');
      return;
    }

    console.log('   ✅ Buyer tag found (ID: ' + tag.id + ')');

    // 3. Add tag to contact (this triggers the automation)
    console.log('\n3️⃣ Adding buyer tag to contact (triggers automation)...');
    const tagContactRes = await apiRequest('POST', 'contactTags', {
      contactTag: {
        contact: String(contactId),
        tag: String(tag.id)
      }
    });

    if (tagContactRes.contactTag) {
      console.log('   ✅ Buyer tag added successfully!');
      console.log('   📧 Automation should be triggered now!');
    } else {
      console.log('   ❌ Failed to add tag');
      console.log('   Response:', JSON.stringify(tagContactRes, null, 2));
      return;
    }

    // 4. Verify contact status
    console.log('\n4️⃣ Verifying contact status...');
    const contactRes = await apiRequest('GET', `contacts/${contactId}`);

    console.log('   Contact Email:', contactRes.contact?.email);
    console.log('   First Name:', contactRes.contact?.firstName);
    console.log('   Last Name:', contactRes.contact?.lastName);
    console.log('   Has Magic Link field:', contactRes.contact?.fieldValues?.length > 0);

    if (contactRes.contact?.fieldValues?.length > 0) {
      console.log('   Field Values:', contactRes.contact.fieldValues.length);

      // Show Magic Link field value
      const magicLinkValue = contactRes.contact.fieldValues.find(fv =>
        fv.field === '7' // Magic Link field ID
      );

      if (magicLinkValue) {
        console.log('   ✅ Magic Link field is set!');
        console.log('   Value:', magicLinkValue.value);

        if (magicLinkValue.value.includes('supabase')) {
          console.log('   ✅ Contains Supabase magic link!');
        } else if (magicLinkValue.value.includes('%MAGIC_LINK%')) {
          console.log('   ❌ Contains placeholder %MAGIC_LINK%!');
          console.log('   This means the backend is sending the placeholder, not the actual URL!');
        } else {
          console.log('   Value:', magicLinkValue.value);
        }
      }
    }

    // 5. Check automation status
    console.log('\n5️⃣ Checking automation entry...');
    const contactAutomationsRes = await apiRequest('GET', `contacts/${contactId}/contactAutomations?limit=1&orders[LastDate]=DESC`);

    if (contactAutomationsRes.contactAutomations && contactAutomationsRes.contactAutomations.length > 0) {
      const entry = contactAutomationsRes.contactAutomations[0];
      console.log('   Automation Entry Found:');
      console.log('   Automation ID:', entry.automation);
      console.log('   Series ID:', entry.seriesid);
      console.log('   Status:', entry.status === 1 ? 'Active' : 'Stopped');

      if (entry.status === 1) {
        console.log('   ✅ Automation is active and running!');
        console.log('   📧 Email should be sent shortly!');
      }
    }

    console.log('\n✅ PURCHASE COMPLETE TRIGGERED!');
    console.log('\n📧 Now check your email inbox at: ' + email);
    console.log('\n👇 What to look for:');
    console.log('   1. Subject: "Welcome to Whats Spy! Access your dashboard"');
    console.log('   2. Link should contain: https://qvrykyhrmdcsogpyrxeq.supabase.co/auth/v1/verify?');
    console.log('   3. LINK SHOULD NOT contain: %MAGIC_LINK%');
    console.log('   4. LINK SHOULD contain: TEST-TOKEN-1234567890');

    console.log('\n🔗 Check here in ActiveCampaign:');
    console.log('   Contacts > Search for ' + email);
    console.log('   View the "Magic Link" field value');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('   Stack:', error.stack);
  }
}

// Test with draculatemer112@gmail.com
triggerPurchaseComplete('draculatemer112@gmail.com', 'Test Buyer');
