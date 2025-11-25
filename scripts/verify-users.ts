import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Verifying users in database...\n');

  const users = await prisma.user.findMany({
    where: {
      email: {
        in: ['admin@spendrule.com', 'user@spendrule.com'],
      },
    },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (users.length === 0) {
    console.log('❌ No users found! Please run: npm run db:seed');
    return;
  }

  for (const user of users) {
    console.log(`\n📧 Email: ${user.email}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   Active: ${user.isActive ? '✅' : '❌'}`);
    console.log(`   Roles: ${user.userRoles.map(ur => ur.role.roleName).join(', ') || 'None'}`);
    
    // Test password verification
    const testPasswords = {
      'admin@spendrule.com': 'admin123',
      'user@spendrule.com': 'user1234',
    };
    
    const testPassword = testPasswords[user.email as keyof typeof testPasswords];
    if (testPassword) {
      const isValid = await bcrypt.compare(testPassword, user.passwordHash);
      console.log(`   Password test: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
    }
  }

  console.log('\n✅ Verification complete!');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

