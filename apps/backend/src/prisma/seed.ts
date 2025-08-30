import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface MarketDataCSV {
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface SeedOptions {
  skipMarketData?: boolean;
  environment?: 'development' | 'test' | 'production';
  reset?: boolean;
}

const parseCSV = (filePath: string): MarketDataCSV[] => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    return headers.reduce((obj, header, index) => {
      obj[header as keyof MarketDataCSV] = values[index];
      return obj;
    }, {} as MarketDataCSV);
  });
};

const clearDatabase = async (): Promise<void> => {
  console.log('🧹 Clearing database...');
  
  // Delete in reverse dependency order
  await prisma.fill.deleteMany();
  await prisma.orderEvent.deleteMany();
  await prisma.order.deleteMany();
  await prisma.position.deleteMany();
  await prisma.marketData.deleteMany();
  await prisma.instrument.deleteMany();
  await prisma.account.deleteMany();
  
  console.log('✅ Database cleared');
};

const createAccounts = async () => {
  console.log('👤 Creating demo accounts...');
  
  const accounts = await Promise.all([
    prisma.account.create({
      data: {
        name: 'Demo Trading Account',
        email: 'demo@papertrading.com',
        balance: 100000.00,
        buyingPower: 100000.00,
      },
    }),
    prisma.account.create({
      data: {
        name: 'Conservative Trader',
        email: 'conservative@papertrading.com',
        balance: 50000.00,
        buyingPower: 50000.00,
      },
    }),
    prisma.account.create({
      data: {
        name: 'Active Trader',
        email: 'active@papertrading.com',
        balance: 250000.00,
        buyingPower: 250000.00,
      },
    }),
  ]);
  
  console.log(`✅ Created ${accounts.length} accounts`);
  return accounts;
};

const createInstruments = async () => {
  console.log('📊 Creating instruments...');
  
  const instrumentsData = [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      sector: 'Technology',
      exchange: 'NASDAQ',
      tickSize: 0.01,
      lotSize: 1,
      referencePrice: 229.15,
      price: 229.15,
      previousClose: 227.76,
      isActive: true,
    },
    {
      symbol: 'TSLA',
      name: 'Tesla, Inc.',
      sector: 'Consumer Discretionary',
      exchange: 'NASDAQ',
      tickSize: 0.01,
      lotSize: 1,
      referencePrice: 333.25,
      price: 333.25,
      previousClose: 344.72,
      isActive: true,
    },
    {
      symbol: 'GOOGL',
      name: 'Alphabet Inc.',
      sector: 'Technology',
      exchange: 'NASDAQ',
      tickSize: 0.01,
      lotSize: 1,
      referencePrice: 212.91,
      price: 212.91,
      previousClose: 211.64,
      isActive: true,
    },
    {
      symbol: 'MSFT',
      name: 'Microsoft Corporation',
      sector: 'Technology',
      exchange: 'NASDAQ',
      tickSize: 0.01,
      lotSize: 1,
      referencePrice: 213.53,
      price: 213.53,
      previousClose: 212.37,
      isActive: true,
    },
    {
      symbol: 'NVDA',
      name: 'NVIDIA Corporation',
      sector: 'Technology',
      exchange: 'NASDAQ',
      tickSize: 0.01,
      lotSize: 1,
      referencePrice: 180.78,
      price: 180.78,
      previousClose: 181.60,
      isActive: true,
    },
    {
      symbol: 'SPY',
      name: 'SPDR S&P 500 ETF Trust',
      sector: 'ETF',
      exchange: 'NYSEARCA',
      tickSize: 0.01,
      lotSize: 1,
      referencePrice: 646.03,
      price: 646.03,
      previousClose: 650.18,
      isActive: true,
    }
  ];

  const instruments = await Promise.all(
    instrumentsData.map(data => prisma.instrument.create({ data }))
  );
  
  console.log(`✅ Created ${instruments.length} instruments`);
  return instruments;
};

const createSampleOrders = async (accounts: any[], instruments: any[]) => {
  console.log('📋 Creating sample orders...');
  
  const sampleOrders = [];
  const demoAccount = accounts[0];
  
  // Create a mix of filled and pending orders
  for (let i = 0; i < 5; i++) {
    const instrument = instruments[Math.floor(Math.random() * instruments.length)];
    const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
    const type = Math.random() > 0.7 ? 'LIMIT' : 'MARKET';
    const quantity = Math.floor(Math.random() * 100) + 10;
    const status = Math.random() > 0.3 ? 'FILLED' : 'PENDING';
    
    const order = await prisma.order.create({
      data: {
        accountId: demoAccount.id,
        instrumentId: instrument.id,
        type,
        side,
        quantity,
        price: type === 'LIMIT' ? instrument.price + (Math.random() - 0.5) * 10 : null,
        status,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    });
    
    sampleOrders.push(order);
    
    // Create fills for filled orders
    if (status === 'FILLED') {
      await prisma.fill.create({
        data: {
          accountId: demoAccount.id,
          orderId: order.id,
          instrumentId: instrument.id,
          side,
          quantity,
          price: instrument.price + (Math.random() - 0.5) * 2,
          executedAt: new Date(order.createdAt.getTime() + Math.random() * 60000), // Within an hour
        },
      });
      
      // Create order events
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          instrumentId: instrument.id,
          type: 'FILLED',
          payload: {
            fillPrice: instrument.price,
            fillQuantity: quantity,
            executionReason: 'Market order executed'
          },
        },
      });
    }
  }
  
  console.log(`✅ Created ${sampleOrders.length} sample orders`);
  return sampleOrders;
};

const seedDatabase = async (options: SeedOptions = {}): Promise<void> => {
  const { skipMarketData = false, environment = 'development', reset = false } = options;
  
  console.log(`🌱 Starting database seed for ${environment}...`);
  
  try {
    if (reset) {
      await clearDatabase();
    }
    
    // Create accounts
    const accounts = await createAccounts();
    
    // Create instruments
    const instruments = await createInstruments();
    
    // Create sample orders and fills
    await createSampleOrders(accounts, instruments);
    
    // Load market data if not skipped and in development
    if (!skipMarketData && environment === 'development') {
      console.log('📈 Loading market data...');
      const dataDir = path.join(process.cwd(), '../../infra/data');
      
      for (const instrument of instruments.slice(0, 2)) { // Only load for first 2 instruments
        const csvFile = path.join(dataDir, `${instrument.symbol}_minute_bars.csv`);
        
        if (fs.existsSync(csvFile)) {
          try {
            const marketData = parseCSV(csvFile);
            
            // Process in batches to avoid memory issues
            const batchSize = 1000;
            for (let i = 0; i < marketData.length; i += batchSize) {
              const batch = marketData.slice(i, i + batchSize);
              
              await Promise.all(
                batch.map(data =>
                  prisma.marketData.create({
                    data: {
                      instrumentId: instrument.id,
                      timestamp: new Date(data.timestamp),
                      open: parseFloat(data.open),
                      high: parseFloat(data.high),
                      low: parseFloat(data.low),
                      close: parseFloat(data.close),
                      volume: parseInt(data.volume),
                    },
                  })
                )
              );
            }
            
            console.log(`✅ Loaded ${marketData.length} market data points for ${instrument.symbol}`);
          } catch (error) {
            console.warn(`⚠️ Could not load market data for ${instrument.symbol}:`, error);
          }
        } else {
          console.log(`ℹ️ No market data file found for ${instrument.symbol}`);
        }
      }
    }
    
    console.log('🎉 Database seed completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: SeedOptions = {};
  
  // Parse command line arguments
  args.forEach(arg => {
    switch (arg) {
      case '--skip-market-data':
        options.skipMarketData = true;
        break;
      case '--reset':
        options.reset = true;
        break;
      case '--test':
        options.environment = 'test';
        break;
      case '--production':
        options.environment = 'production';
        break;
    }
  });
  
  seedDatabase(options);
}

export { seedDatabase };