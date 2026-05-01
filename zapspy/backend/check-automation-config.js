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

async function checkAutomations() {
  try {
    console.log('🔍 Checking ActiveCampaign Automations...\n');

    // Get all automations
    console.log('1️⃣ Listing all automations...');
    const automationsRes = await apiRequest('GET', 'automations?limit=100');

    if (!automationsRes.automations || automationsRes.automations.length === 0) {
      console.log('   ❌ No automations found!');
      return;
    }

    console.log(`   ✅ Found ${automationsRes.automations.length} automations:\n`);

    automationsRes.automations.forEach((auto, index) => {
      console.log(`   ${index + 1}. ${auto.name} (ID: ${auto.id})`);
      console.log(`      Status: ${auto.status === 1 ? 'Active' : 'Inactive'}`);
      console.log(`      Hidden: ${auto.hidden === 1 ? 'Yes' : 'No'}`);
      console.log('');
    });

    // Find "Whats Spy - Compra aprovada - EN"
    const purchaseApprovedAutomation = automationsRes.automations.find(a =>
      a.name.includes('Compra aprovada') && a.name.includes('EN')
    );

    if (!purchaseApprovedAutomation) {
      console.log('❌ "Whats Spy - Compra aprovada - EN" automation not found!');
      console.log('\n💡 You have these automations:');
      automationsRes.automations.forEach(a => {
        console.log(`   - ${a.name} (ID: ${a.id})`);
      });
      return;
    }

    console.log('✅ Found: "Whats Spy - Compra aprovada - EN"');
    console.log(`   Automation ID: ${purchaseApprovedAutomation.id}`);
    console.log(`   Status: ${purchaseApprovedAutomation.status === 1 ? 'Active' : 'Inactive'}`);
    console.log(`   Hidden: ${purchaseApprovedAutomation.hidden === 1 ? 'Yes' : 'No'}`);
    console.log('');

    if (purchaseApprovedAutomation.status !== 1) {
      console.log('⚠️  WARNING: This automation is INACTIVE!');
      console.log('   You need to activate it for emails to be sent.\n');
    }

    // Get automation blocks
    console.log('2️⃣ Getting automation blocks...');
    const blocksRes = await apiRequest('GET', `automations/${purchaseApprovedAutomation.id}/blocks`);

    if (!blocksRes.blocks || blocksRes.blocks.length === 0) {
      console.log('   ❌ No blocks found!');
      return;
    }

    console.log(`   ✅ Found ${blocksRes.blocks.length} blocks:\n`);

    blocksRes.blocks.forEach((block, index) => {
      console.log(`   Block ${index + 1}:`);
      console.log(`      Type: ${block.type}`);
      console.log(`      Order: ${block.order}`);

      if (block.type === 'start') {
        const config = JSON.parse(block.config || '{}');
        console.log(`      Config: ${JSON.stringify(config, null, 2)}`);
      } else if (block.type === 'send') {
        const config = JSON.parse(block.config || '{}');
        console.log(`      Email Name: ${config.name || 'N/A'}`);
        console.log(`      Subject: ${config.subject || 'N/A'}`);
        console.log(`      Preheader: ${config.preheader || 'N/A'}`);
      } else if (block.type === 'wait') {
        const config = JSON.parse(block.config || '{}');
        console.log(`      Wait Type: ${config.wait_type}`);
        console.log(`      Delay Amount: ${config.delay_amount}`);
        console.log(`      Delay Unit: ${config.delay_unit}`);
      } else if (block.type === 'action') {
        const config = JSON.parse(block.config || '{}');
        console.log(`      Action: ${config.action}`);
        if (config.tag) {
          console.log(`      Tag: ${config.tag}`);
        }
      }

      console.log('');
    });

    // Check the first send block for magic link
    const sendBlock = blocksRes.blocks.find(b => b.type === 'send');

    if (sendBlock) {
      console.log('🔍 Checking Send Block configuration...');
      const config = JSON.parse(sendBlock.config || '{}');

      console.log('   Email Name:', config.name || 'N/A');
      console.log('   Subject:', config.subject || 'N/A');
      console.log('   Preheader:', config.preheader || 'N/A');

      console.log('\n   💡 Checking if template contains magic link placeholder...');
      console.log('\n   IMPORTANT: Check the email template in ActiveCampaign UI');
      console.log('   The template should use: ${Magic Link} (with space)');
      console.log('   NOT: %MAGIC_LINK% or ${MAGIC_LINK} (without space)');

      // Find all occurrences of magic link placeholders
      const templateContent = JSON.stringify(config);

      if (templateContent.includes('${Magic Link}')) {
        console.log('\n   ✅ Found correct placeholder: ${Magic Link}');
        console.log('   This should work correctly!');
      } else if (templateContent.includes('%MAGIC_LINK%')) {
        console.log('\n   ❌ Found incorrect placeholder: %MAGIC_LINK%');
        console.log('   This is why your magic link is not working!');
        console.log('   Replace it with: ${Magic Link}');
      } else if (templateContent.includes('${MAGIC_LINK}')) {
        console.log('\n   ❌ Found incorrect placeholder: ${MAGIC_LINK}');
        console.log('   Replace it with: ${Magic Link}');
      } else {
        console.log('\n   ⚠️  No magic link placeholder found in the configuration');
        console.log('   The email might be using a static URL instead');
      }
    }

    console.log('\n🔗 Links:');
    console.log(`   Automation UI: https://matheus0597.activehosted.com/app/automations/${purchaseApprovedAutomation.id}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('   Stack:', error.stack);
  }
}

checkAutomations();
