import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default organization
  const organization = await prisma.organization.upsert({
    where: { organizationId: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      organizationId: '00000000-0000-0000-0000-000000000001',
      name: 'SpendRule System',
      type: 'System',
      settings: {},
    },
  });

  // Create default roles
  const superAdminRole = await prisma.role.upsert({
    where: { roleName: 'Super Admin' },
    update: {},
    create: {
      roleName: 'Super Admin',
      roleDescription: 'Full system access, user management, system config',
      isSystemRole: true,
    },
  });

  const systemAdminRole = await prisma.role.upsert({
    where: { roleName: 'System Admin' },
    update: {},
    create: {
      roleName: 'System Admin',
      roleDescription: 'Configuration, audit logs, system settings',
      isSystemRole: true,
    },
  });

  const financeAdminRole = await prisma.role.upsert({
    where: { roleName: 'Finance Admin' },
    update: {},
    create: {
      roleName: 'Finance Admin',
      roleDescription: 'All financial data, approvals, reports',
      isSystemRole: true,
    },
  });

  const deptHeadRole = await prisma.role.upsert({
    where: { roleName: 'Department Head' },
    update: {},
    create: {
      roleName: 'Department Head',
      roleDescription: 'Department-level approvals, contracts, invoices',
      isSystemRole: true,
    },
  });

  const apClerkRole = await prisma.role.upsert({
    where: { roleName: 'AP Clerk' },
    update: {},
    create: {
      roleName: 'AP Clerk',
      roleDescription: 'Invoice processing, basic approvals ($0-$1,000)',
      isSystemRole: true,
    },
  });

  const contractManagerRole = await prisma.role.upsert({
    where: { roleName: 'Contract Manager' },
    update: {},
    create: {
      roleName: 'Contract Manager',
      roleDescription: 'Contract creation/editing, vendor management',
      isSystemRole: true,
    },
  });

  const viewerRole = await prisma.role.upsert({
    where: { roleName: 'Viewer' },
    update: {},
    create: {
      roleName: 'Viewer',
      roleDescription: 'Read-only access to assigned data',
      isSystemRole: true,
    },
  });

  // Create default permissions
  const permissions = [
    { permissionName: 'contracts:create', resource: 'contracts', action: 'create', description: 'Create contracts' },
    { permissionName: 'contracts:read', resource: 'contracts', action: 'read', description: 'Read contracts' },
    { permissionName: 'contracts:update', resource: 'contracts', action: 'update', description: 'Update contracts' },
    { permissionName: 'contracts:delete', resource: 'contracts', action: 'delete', description: 'Delete contracts' },
    { permissionName: 'contracts:approve', resource: 'contracts', action: 'approve', description: 'Approve contracts' },
    { permissionName: 'invoices:create', resource: 'invoices', action: 'create', description: 'Create invoices' },
    { permissionName: 'invoices:read', resource: 'invoices', action: 'read', description: 'Read invoices' },
    { permissionName: 'invoices:update', resource: 'invoices', action: 'update', description: 'Update invoices' },
    { permissionName: 'invoices:delete', resource: 'invoices', action: 'delete', description: 'Delete invoices' },
    { permissionName: 'invoices:validate', resource: 'invoices', action: 'validate', description: 'Validate invoices' },
    { permissionName: 'invoices:approve', resource: 'invoices', action: 'approve', description: 'Approve invoices' },
    { permissionName: 'exceptions:view', resource: 'exceptions', action: 'view', description: 'View exceptions' },
    { permissionName: 'exceptions:resolve', resource: 'exceptions', action: 'resolve', description: 'Resolve exceptions' },
    { permissionName: 'exceptions:escalate', resource: 'exceptions', action: 'escalate', description: 'Escalate exceptions' },
    { permissionName: 'exceptions:approve', resource: 'exceptions', action: 'approve', description: 'Approve exceptions' },
    { permissionName: 'parties:create', resource: 'parties', action: 'create', description: 'Create parties' },
    { permissionName: 'parties:read', resource: 'parties', action: 'read', description: 'Read parties' },
    { permissionName: 'parties:update', resource: 'parties', action: 'update', description: 'Update parties' },
    { permissionName: 'parties:delete', resource: 'parties', action: 'delete', description: 'Delete parties' },
    { permissionName: 'locations:read', resource: 'locations', action: 'read', description: 'Read locations' },
    { permissionName: 'locations:create', resource: 'locations', action: 'create', description: 'Create locations' },
    { permissionName: 'locations:update', resource: 'locations', action: 'update', description: 'Update locations' },
    { permissionName: 'service-catalog:read', resource: 'service-catalog', action: 'read', description: 'Read service catalog' },
    { permissionName: 'service-catalog:create', resource: 'service-catalog', action: 'create', description: 'Create service catalog items' },
    { permissionName: 'service-catalog:update', resource: 'service-catalog', action: 'update', description: 'Update service catalog items' },
    { permissionName: 'pricing-models:read', resource: 'pricing-models', action: 'read', description: 'Read pricing models' },
    { permissionName: 'pricing-models:create', resource: 'pricing-models', action: 'create', description: 'Create pricing models' },
    { permissionName: 'pricing-models:update', resource: 'pricing-models', action: 'update', description: 'Update pricing models' },
    { permissionName: 'documents:upload', resource: 'documents', action: 'upload', description: 'Upload documents' },
    { permissionName: 'documents:view', resource: 'documents', action: 'view', description: 'View documents' },
    { permissionName: 'documents:download', resource: 'documents', action: 'download', description: 'Download documents' },
    { permissionName: 'documents:delete', resource: 'documents', action: 'delete', description: 'Delete documents' },
    { permissionName: 'validations:trigger', resource: 'validations', action: 'trigger', description: 'Trigger validations' },
    { permissionName: 'validations:view', resource: 'validations', action: 'view', description: 'View validations' },
    { permissionName: 'validations:override', resource: 'validations', action: 'override', description: 'Override validations' },
    { permissionName: 'approvals:create', resource: 'approvals', action: 'create', description: 'Create approval requests' },
    { permissionName: 'approvals:approve', resource: 'approvals', action: 'approve', description: 'Approve requests' },
    { permissionName: 'approvals:reject', resource: 'approvals', action: 'reject', description: 'Reject requests' },
    { permissionName: 'approvals:escalate', resource: 'approvals', action: 'escalate', description: 'Escalate requests' },
    { permissionName: 'dashboard:view', resource: 'dashboard', action: 'view', description: 'View dashboard' },
    { permissionName: 'reports:view', resource: 'reports', action: 'view', description: 'View reports' },
    { permissionName: 'reports:export', resource: 'reports', action: 'export', description: 'Export reports' },
    { permissionName: 'admin:users', resource: 'admin', action: 'users', description: 'Manage users' },
    { permissionName: 'admin:config', resource: 'admin', action: 'config', description: 'System configuration' },
    { permissionName: 'admin:audit', resource: 'admin', action: 'audit', description: 'View audit logs' },
    { permissionName: 'roles:view', resource: 'roles', action: 'view', description: 'View roles' },
    { permissionName: 'roles:create', resource: 'roles', action: 'create', description: 'Create roles' },
    { permissionName: 'roles:update', resource: 'roles', action: 'update', description: 'Update roles' },
    { permissionName: 'roles:delete', resource: 'roles', action: 'delete', description: 'Delete roles' },
    { permissionName: 'permissions:view', resource: 'permissions', action: 'view', description: 'View permissions' },
    { permissionName: 'permissions:create', resource: 'permissions', action: 'create', description: 'Create permissions' },
    { permissionName: 'permissions:update', resource: 'permissions', action: 'update', description: 'Update permissions' },
    { permissionName: 'permissions:delete', resource: 'permissions', action: 'delete', description: 'Delete permissions' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { permissionName: perm.permissionName },
      update: {},
      create: perm,
    });
  }

  // Create approval levels
  const approvalLevels = [
    { levelName: 'AP Clerk', approvalSequence: 1, minAmount: 0, maxAmount: 1000, requiresRole: 'AP Clerk', escalationDays: 3 },
    { levelName: 'Department Head', approvalSequence: 2, minAmount: 1001, maxAmount: 10000, requiresRole: 'Department Head', escalationDays: 3 },
    { levelName: 'Finance Admin', approvalSequence: 3, minAmount: 10001, maxAmount: null, requiresRole: 'Finance Admin', escalationDays: 5 },
  ];

  for (const level of approvalLevels) {
    await prisma.approvalLevel.upsert({
      where: { approvalSequence: level.approvalSequence },
      update: {},
      create: level,
    });
  }

  // Assign all permissions to Super Admin role
  const allPermissions = await prisma.permission.findMany();
  const superAdminRolePermissions = allPermissions.map(perm => ({
    roleId: superAdminRole.roleId,
    permissionId: perm.permissionId,
  }));
  await prisma.rolePermission.createMany({
    data: superAdminRolePermissions,
    skipDuplicates: true,
  });

  // Assign read permissions to Viewer role
  const viewerPermissions = [
    'dashboard:view',
    'contracts:read',
    'invoices:read',
    'exceptions:view',
    'parties:read',
    'locations:read',
    'documents:view',
    'service-catalog:read',
    'pricing-models:read',
    'validations:view',
    'reports:view',
  ];
  const viewerPerms = await prisma.permission.findMany({
    where: { permissionName: { in: viewerPermissions } },
  });
  await prisma.rolePermission.createMany({
    data: viewerPerms.map(perm => ({
      roleId: viewerRole.roleId,
      permissionId: perm.permissionId,
    })),
    skipDuplicates: true,
  });

  // Assign permissions to AP Clerk role (for regular users who need to process invoices)
  const apClerkPermissions = [
    'dashboard:view',
    'contracts:read',
    'invoices:create',
    'invoices:read',
    'invoices:update',
    'invoices:validate',
    'invoices:approve',
    'exceptions:view',
    'exceptions:resolve',
    'exceptions:escalate',
    'parties:create',
    'parties:read',
    'parties:update',
    'locations:read',
    'documents:upload',
    'documents:view',
    'documents:download',
    'service-catalog:read',
    'pricing-models:read',
    'validations:trigger',
    'validations:view',
    'approvals:create',
    'approvals:approve',
    'approvals:reject',
    'reports:view',
  ];
  const apClerkPerms = await prisma.permission.findMany({
    where: { permissionName: { in: apClerkPermissions } },
  });
  await prisma.rolePermission.createMany({
    data: apClerkPerms.map(perm => ({
      roleId: apClerkRole.roleId,
      permissionId: perm.permissionId,
    })),
    skipDuplicates: true,
  });

  // Assign permissions to Department Head role
  const deptHeadPermissions = [
    'dashboard:view',
    'contracts:read',
    'contracts:update',
    'invoices:read',
    'invoices:delete',
    'invoices:approve',
    'exceptions:view',
    'exceptions:resolve',
    'exceptions:approve',
    'exceptions:escalate',
    'parties:read',
    'parties:update',
    'parties:delete',
    'locations:read',
    'documents:view',
    'service-catalog:read',
    'pricing-models:read',
    'validations:view',
    'approvals:create',
    'approvals:approve',
    'approvals:reject',
    'approvals:escalate',
    'reports:view',
  ];
  const deptHeadPerms = await prisma.permission.findMany({
    where: { permissionName: { in: deptHeadPermissions } },
  });
  await prisma.rolePermission.createMany({
    data: deptHeadPerms.map(perm => ({
      roleId: deptHeadRole.roleId,
      permissionId: perm.permissionId,
    })),
    skipDuplicates: true,
  });

  // Assign permissions to Finance Admin role
  const financeAdminPermissions = [
    'dashboard:view',
    'contracts:read',
    'contracts:update',
    'contracts:approve',
    'invoices:read',
    'invoices:update',
    'invoices:delete',
    'invoices:approve',
    'exceptions:view',
    'exceptions:resolve',
    'exceptions:approve',
    'exceptions:escalate',
    'parties:read',
    'parties:update',
    'parties:delete',
    'locations:read',
    'documents:view',
    'service-catalog:read',
    'pricing-models:read',
    'validations:view',
    'validations:override',
    'approvals:create',
    'approvals:approve',
    'approvals:reject',
    'approvals:escalate',
    'reports:view',
    'reports:export',
  ];
  const financeAdminPerms = await prisma.permission.findMany({
    where: { permissionName: { in: financeAdminPermissions } },
  });
  await prisma.rolePermission.createMany({
    data: financeAdminPerms.map(perm => ({
      roleId: financeAdminRole.roleId,
      permissionId: perm.permissionId,
    })),
    skipDuplicates: true,
  });

  // Create default admin user
  const defaultPassword = await bcrypt.hash('admin123', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@spendrule.com' },
    update: {
      passwordHash: defaultPassword,
      firstName: 'Admin',
      lastName: 'User',
      isActive: true,
    },
    create: {
      email: 'admin@spendrule.com',
      passwordHash: defaultPassword,
      firstName: 'Admin',
      lastName: 'User',
      organizationId: organization.organizationId,
      isActive: true,
    },
  });

  // Assign Super Admin role to default user
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.userId,
        roleId: superAdminRole.roleId,
      },
    },
    update: {},
    create: {
      userId: adminUser.userId,
      roleId: superAdminRole.roleId,
    },
  });

  // Create regular user
  const regularPassword = await bcrypt.hash('user1234', 12);
  const regularUser = await prisma.user.upsert({
    where: { email: 'user@spendrule.com' },
    update: {
      passwordHash: regularPassword,
      firstName: 'John',
      lastName: 'Doe',
      isActive: true,
    },
    create: {
      email: 'user@spendrule.com',
      passwordHash: regularPassword,
      firstName: 'John',
      lastName: 'Doe',
      organizationId: organization.organizationId,
      isActive: true,
    },
  });

  // Assign AP Clerk role to regular user (gives them ability to work with invoices)
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: regularUser.userId,
        roleId: apClerkRole.roleId,
      },
    },
    update: {},
    create: {
      userId: regularUser.userId,
      roleId: apClerkRole.roleId,
    },
  });

  console.log('Database seeded successfully!');
  console.log('\n=== Login Credentials ===');
  console.log('Admin User:');
  console.log('  Email: admin@spendrule.com');
  console.log('  Password: admin123');
  console.log('  Role: Super Admin');
  console.log('\nRegular User:');
  console.log('  Email: user@spendrule.com');
  console.log('  Password: user1234');
  console.log('  Role: AP Clerk');
  console.log('================================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

