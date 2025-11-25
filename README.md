# SpendRule Platform

Healthcare spend management platform that automatically validates invoices against contract terms.

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Node.js/TypeScript, Next.js API routes
- **Database**: PostgreSQL (contractsphere_v3 schema)
- **AI/ML**: OpenAI/Anthropic API for document extraction
- **Storage**: AWS S3 or local file storage
- **ORM**: Prisma or Drizzle

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
spendrule-hack/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Dashboard pages
│   └── layout.tsx         # Root layout
├── components/            # React components
├── lib/                   # Utility functions
├── prisma/               # Prisma schema and migrations
├── types/                # TypeScript type definitions
└── public/               # Static assets
```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

