#!/usr/bin/env node
/**
 * Test API imports from contracts package
 */

console.log('Testing API imports from @escapeplan/contracts...\n');

try {
  // Change to API directory to simulate runtime
  process.chdir('/mnt/projects/escape-plan/escapeplan-app/apps/escapeplan-api');
  console.log('Working directory:', process.cwd());

  // Test imports
  console.log('\n1. Testing runtime import...');
  const { runtime } = await import('@escapeplan/contracts/runtime');
  console.log('   ✓ Runtime imported successfully');
  console.log('   - isDevelopment:', runtime.isDevelopment);
  console.log('   - baseDir:', runtime.baseDir);

  console.log('\n2. Testing paths import...');
  const paths = await import('@escapeplan/contracts/paths');
  console.log('   ✓ Paths imported successfully');
  console.log('   - getDatabasePath():', paths.getDatabasePath());
  console.log('   - getAssetBasePath():', paths.getAssetBasePath());
  console.log('   - getBackupBasePath():', paths.getBackupBasePath());

  console.log('\n3. Testing main contracts import...');
  const contracts = await import('@escapeplan/contracts');
  console.log('   ✓ Contracts imported successfully');
  console.log('   - Has schema:', !!contracts.schema);
  console.log('   - Has ROLES:', !!contracts.ROLES);

  console.log('\n✅ All imports successful!');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Import failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
