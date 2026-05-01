async function apiRequest(url, token) {
  const response = await fetch(url, {
    headers: { 'Api-Token': token }
  });
  return await response.json();
}

async function main() {
  try {
    const url = 'https://draculatemer11258320.api-us1.com/api/3/fields?limit=100';
    const token = '371d6888c7c7926156a602ad9e2ff127799be33b081ae80845b599188975b7902a11591a';

    console.log('🔍 Checking for Magic Link field...\n');

    const data = await apiRequest(url, token);

    const magicLinkField = (data.fields || []).find(f =>
      f.title === 'Magic Link' ||
      f.title === 'MAGICALINK' ||
      f.personaltag === '%MAGIC_LINK%'
    );

    if (magicLinkField) {
      console.log('✅ Magic Link field found:');
      console.log(JSON.stringify(magicLinkField, null, 2));
    } else {
      console.log('❌ No Magic Link field found');
      console.log('\n📝 Checking for fields with personaltag (placeholders)...\n');
      const placeholderFields = (data.fields || []).filter(f => f.personaltag);
      if (placeholderFields.length === 0) {
        console.log('  No fields with personaltags found');
      } else {
        placeholderFields.forEach(f => {
          console.log('  Field: ' + f.title + ' (ID: ' + f.id + ')');
          console.log('  Personaltag: ' + f.personaltag);
          console.log('');
        });
      }

      console.log('📝 Checking all custom text fields:\n');
      const textFields = (data.fields || []).filter(f => f.type === 'text' && f.description);
      if (textFields.length === 0) {
        console.log('  No text fields with descriptions found');
      } else {
        textFields.slice(0, 20).forEach(f => {
          console.log('  - ' + f.title + ' (ID: ' + f.id + ') - ' + f.description);
        });
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
