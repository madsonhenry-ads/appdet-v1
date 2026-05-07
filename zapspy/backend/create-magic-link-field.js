async function apiRequest(method, endpoint, body = null, token) {
  const url = 'https://draculatemer11258320.api-us1.com/api/3/' + endpoint;
  const options = {
    method,
    headers: {
      'Api-Token': token,
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

async function main() {
  try {
    const token = '9437b06992638da05d3f1003f974a936eeddb5fdea800ad335ea1ce9bddff34b3f90d402';

    console.log('🔧 Creating Magic Link field...\n');

    // Try to find existing field first
    const fieldsData = await apiRequest('GET', 'fields?limit=100', null, token);
    const existingField = (fieldsData.fields || []).find(f =>
      f.title === 'Magic Link' ||
      f.title === 'MAGICALINK'
    );

    if (existingField) {
      console.log('✅ Magic Link field already exists (ID: ' + existingField.id + ')');
      console.log('   Title: ' + existingField.title);
      console.log('');
      console.log('   Field data:');
      console.log(JSON.stringify(existingField, null, 2));
      return;
    }

    console.log('📝 Creating new Magic Link field...\n');

    // Create the field
    const data = await apiRequest('POST', 'fields', {
      field: {
        title: 'Magic Link',
        type: 'text',
        description: 'Magic link URL for member area access (whats spy)',
        useAsUrlParameter: false
      }
    }, token);

    if (data && data.field) {
      console.log('✅ Magic Link field created successfully!');
      console.log('   Field ID: ' + data.field.id);
      console.log('   Title: ' + data.field.title);
      console.log('   Type: ' + data.field.type);
      console.log('   Description: ' + data.field.description);
      console.log('');
      console.log('   Next steps:');
      console.log('   1. Go to Automations in ActiveCampaign');
      console.log('   2. Open "Whats Spy - Compra aprovada - EN"');
      console.log('   3. In the email, use ${Magic Link} as placeholder');
      console.log('   4. Test with a new purchase');
    } else {
      console.log('❌ Failed to create field');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
